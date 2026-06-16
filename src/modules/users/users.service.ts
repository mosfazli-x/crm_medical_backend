import type { DB } from '../../db/client'
import { users, patients } from '../../db/schema'
import { eq, and, notInArray, desc } from 'drizzle-orm'
import { NotFoundError, ConflictError } from '../../shared/errors'
import type { ApprovePatientDto } from './users.schema'

export class UserService {
  constructor(private db: DB) {}

  async findAll() {
    return this.db
      .select({
        id: users.id,
        phone: users.phone,
        fullName: users.fullName,
        role: users.role,
        status: users.status,
        organizationName: users.organizationName,
        patientId: users.patientId,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
  }

  async findById(id: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        phone: users.phone,
        fullName: users.fullName,
        role: users.role,
        status: users.status,
        organizationName: users.organizationName,
        patientId: users.patientId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))

    if (!user) throw new NotFoundError('User')
    return user
  }

  async approve(id: string) {
    const [updatedUser] = await this.db
      .update(users)
      .set({
        status: 'approved',
        requiresPasswordChange: false,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), eq(users.status, 'pending'), notInArray(users.role, ['patient'])))
      .returning({
        id: users.id,
        fullName: users.fullName,
        role: users.role,
        status: users.status,
      })

    if (!updatedUser) throw new NotFoundError('User not found or already processed')
    return updatedUser
  }

  async reject(id: string) {
    const [updatedUser] = await this.db
      .update(users)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.status, 'pending')))
      .returning({ id: users.id, fullName: users.fullName, role: users.role, status: users.status })

    if (!updatedUser) throw new NotFoundError('User not found or already processed')
    return updatedUser
  }

  async deactivate(id: string) {
    const [updatedUser] = await this.db
      .update(users)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.status, 'approved')))
      .returning({ id: users.id, fullName: users.fullName, role: users.role, status: users.status })

    if (!updatedUser) throw new NotFoundError('User not found or already inactive')
    return updatedUser
  }

  async activate(id: string) {
    const [updatedUser] = await this.db
      .update(users)
      .set({ status: 'approved', updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.status, 'rejected')))
      .returning({ id: users.id, fullName: users.fullName, role: users.role, status: users.status })

    if (!updatedUser) throw new NotFoundError('User not found or cannot be activated')
    return updatedUser
  }

  async approvePatient(id: string, dto: ApprovePatientDto) {
    const data = await this.db.transaction(async (tx) => {
      const [newPatient] = await tx
        .insert(patients)
        .values({
          firstName: dto.firstName,
          lastName: dto.lastName,
          nationalId: dto.nationalId,
          insuranceCode: dto.insuranceCode ?? null,
          insuranceType: dto.insuranceType ?? null,
          birthDate: dto.birthDate ?? null,
          address: dto.address ?? null,
          maritalStatus: dto.maritalStatus ?? null,
        })
        .returning({
          id: patients.id,
          firstName: patients.firstName,
          lastName: patients.lastName,
          nationalId: patients.nationalId,
        })

      const [userPhone] = await tx
        .select({ phone: users.phone })
        .from(users)
        .where(eq(users.id, id))

      if (userPhone?.phone) {
        await tx.update(patients).set({ phone: userPhone.phone }).where(eq(patients.id, newPatient.id))
      }

      const [updatedUser] = await tx
        .update(users)
        .set({
          patientId: newPatient.id,
          status: 'approved',
          requiresPasswordChange: false,
          updatedAt: new Date(),
        })
        .where(and(eq(users.id, id), eq(users.role, 'patient'), eq(users.status, 'pending')))
        .returning({ id: users.id, fullName: users.fullName, status: users.status, patientId: users.patientId })

      if (!updatedUser) throw new ConflictError('User is not a patient or already approved')

      return { patient: newPatient, user: updatedUser }
    })

    return data
  }
}

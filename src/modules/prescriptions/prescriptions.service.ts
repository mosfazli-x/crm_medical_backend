import type { DB } from '../../db/client'
import { prescriptions } from '../../db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { NotFoundError } from '../../shared/errors'
import type { CreatePrescriptionDto, UpdatePrescriptionDto } from './prescriptions.schema'

export class PrescriptionService {
  constructor(private db: DB) {}

  async create(doctorId: string, dto: CreatePrescriptionDto) {
    const [created] = await this.db
      .insert(prescriptions)
      .values({
        patientId: dto.patient_id,
        doctorId,
        visitId: dto.visit_id || null,
        medicationName: dto.medication_name,
        dosage: dto.dosage,
        frequency: dto.frequency || null,
        route: dto.route || null,
        duration: dto.duration || null,
        quantity: dto.quantity || null,
        refills: dto.refills || 0,
        instructions: dto.instructions || null,
        startDate: dto.start_date || null,
        endDate: dto.end_date || null,
      })
      .returning()

    return created
  }

  async getByPatient(patientId: string) {
    return this.db
      .select()
      .from(prescriptions)
      .where(eq(prescriptions.patientId, patientId))
      .orderBy(desc(prescriptions.createdAt))
  }

  async getActiveByPatient(patientId: string) {
    return this.db
      .select()
      .from(prescriptions)
      .where(and(eq(prescriptions.patientId, patientId), eq(prescriptions.isActive, true)))
      .orderBy(desc(prescriptions.createdAt))
  }

  async getById(id: string) {
    const [prescription] = await this.db
      .select()
      .from(prescriptions)
      .where(eq(prescriptions.id, id))

    if (!prescription) throw new NotFoundError('Prescription')
    return prescription
  }

  async update(id: string, dto: UpdatePrescriptionDto) {
    const [updated] = await this.db
      .update(prescriptions)
      .set({
        ...(dto.medication_name !== undefined && { medicationName: dto.medication_name }),
        ...(dto.dosage !== undefined && { dosage: dto.dosage }),
        ...(dto.frequency !== undefined && { frequency: dto.frequency }),
        ...(dto.route !== undefined && { route: dto.route }),
        ...(dto.duration !== undefined && { duration: dto.duration }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.refills !== undefined && { refills: dto.refills }),
        ...(dto.instructions !== undefined && { instructions: dto.instructions }),
        ...(dto.start_date !== undefined && { startDate: dto.start_date }),
        ...(dto.end_date !== undefined && { endDate: dto.end_date }),
        ...(dto.is_active !== undefined && { isActive: dto.is_active }),
        ...(dto.discontinued_reason !== undefined && { discontinuedReason: dto.discontinued_reason }),
        updatedAt: new Date(),
      })
      .where(eq(prescriptions.id, id))
      .returning()

    if (!updated) throw new NotFoundError('Prescription')
    return updated
  }

  async discontinue(id: string, reason?: string) {
    return this.update(id, {
      is_active: false,
      discontinued_reason: reason || 'Discontinued by doctor',
    })
  }

  async delete(id: string) {
    const [deleted] = await this.db
      .delete(prescriptions)
      .where(eq(prescriptions.id, id))
      .returning()

    if (!deleted) throw new NotFoundError('Prescription')
    return { id: deleted.id }
  }
}

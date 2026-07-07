import path from 'node:path'
import type { DB } from '../../db/client'
import {
  patients,
  users,
  diseases,
  medications,
  allergies,
  pregnancies,
  attachments,
} from '../../db/schema'
import { eq, and, or, notInArray, desc, sql, ilike, inArray } from 'drizzle-orm'
import { NotFoundError, ConflictError } from '../../shared/errors'
import { getInsuranceInfo } from '../../shared/constants/insurance'
import { fileService } from '../../shared/services'
import type { CreatePatientDto, UpdatePatientDto, SearchPatientsDto } from './patients.schema'
import bcrypt from 'bcrypt'

export class PatientService {
  constructor(private db: DB) {}

  async create(dto: CreatePatientDto, uploadedFiles: Array<{ type: string; fieldname?: string; originalName: string; filePath: string; fileHash?: string; fileSize?: number; mimeType?: string; relativePath?: string }>) {
    const newPatient = await this.db.transaction(async (tx) => {
      const [insertedPatient] = await tx
        .insert(patients)
        .values({
          firstName: dto.patient.first_name,
          lastName: dto.patient.last_name,
          nationalId: dto.patient.national_id,
          insuranceCode: dto.patient.insurance_code || null,
          insuranceType: dto.patient.insurance_type || null,
          birthDate: dto.patient.birth_date || null,
          phone: dto.patient.phone || null,
          address: dto.patient.address || null,
          maritalStatus: dto.patient.marital_status || null,
          smoking: dto.patient.smoking || null,
          bmi: dto.patient.bmi ? String(dto.patient.bmi) : null,
          exercise: dto.patient.exercise || null,
          alcohol: dto.patient.alcohol || null,
          confidentialNotes: dto.patient.confidential_notes || null,
        })
        .returning()

      if (dto.patient.diseases && dto.patient.diseases.length > 0) {
        await tx.insert(diseases).values(
          dto.patient.diseases.map((d) => ({
            patientId: insertedPatient.id,
            name: d.name,
            diagnosedAt: d.diagnosed_at || null,
          }))
        )
      }

      if (dto.patient.medications && dto.patient.medications.length > 0) {
        await tx.insert(medications).values(
          dto.patient.medications.map((m) => ({
            patientId: insertedPatient.id,
            name: m.name,
            dosage: m.dosage || null,
          }))
        )
      }

      if (dto.patient.allergies && dto.patient.allergies.length > 0) {
        await tx.insert(allergies).values(
          dto.patient.allergies.map((a) => ({
            patientId: insertedPatient.id,
            substance: a.substance,
            severity: a.severity || '\u0645\u062A\u0648\u0633\u0637',
          }))
        )
      }

      if (uploadedFiles.length > 0) {
        await tx.insert(attachments).values(
          uploadedFiles.map((file) => ({
            patientId: insertedPatient.id,
            fileType: file.type || (file.fieldname?.replace(/\[\]$/, '') ?? 'unknown'),
            fileName: file.originalName,
            filePath: file.filePath,
            fileHash: file.fileHash ?? '',
            fileSize: file.fileSize ?? 0,
            mimeType: file.mimeType ?? 'application/octet-stream',
            storagePath: file.relativePath ?? '',
          }))
        )
      }

      if (insertedPatient.phone) {
        const passwordHash = await bcrypt.hash(insertedPatient.nationalId, 12)
        await tx.insert(users).values({
          phone: insertedPatient.phone,
          passwordHash,
          role: 'patient',
          patientId: insertedPatient.id,
          fullName: `${insertedPatient.firstName} ${insertedPatient.lastName}`,
          phoneConfirmed: true,
          status: 'approved',
          requiresPasswordChange: true,
        })
      }

      return insertedPatient
    })

    return newPatient
  }

  async findAll() {
    return this.db
      .select({
        id: patients.id,
        firstName: patients.firstName,
        lastName: patients.lastName,
        nationalId: patients.nationalId,
        phone: patients.phone,
        birthDate: patients.birthDate,
        insuranceCode: patients.insuranceCode,
        insuranceType: patients.insuranceType,
        maritalStatus: patients.maritalStatus,
        createdAt: patients.createdAt,
      })
      .from(patients)
      .where(eq(patients.isDeleted, false))
      .orderBy(desc(patients.createdAt))
  }

  async search(dto: SearchPatientsDto) {
    const filters: any[] = [eq(patients.isDeleted, false)]

    if (dto.q) {
      const pattern = `%${dto.q}%`
      filters.push(
        or(
          ilike(patients.firstName, pattern),
          ilike(patients.lastName, pattern),
          ilike(patients.phone, pattern),
          ilike(patients.nationalId, pattern),
        )
      )
    } else {
      if (dto.first_name) {
        filters.push(ilike(patients.firstName, `%${dto.first_name}%`))
      }
      if (dto.last_name) {
        filters.push(ilike(patients.lastName, `%${dto.last_name}%`))
      }
      if (dto.phone) {
        filters.push(ilike(patients.phone, `%${dto.phone}%`))
      }
      if (dto.national_id) {
        filters.push(ilike(patients.nationalId, `%${dto.national_id}%`))
      }
    }

    return this.db
      .select({
        id: patients.id,
        firstName: patients.firstName,
        lastName: patients.lastName,
        nationalId: patients.nationalId,
        phone: patients.phone,
        birthDate: patients.birthDate,
        insuranceCode: patients.insuranceCode,
        insuranceType: patients.insuranceType,
        maritalStatus: patients.maritalStatus,
        createdAt: patients.createdAt,
      })
      .from(patients)
      .where(and(...filters))
      .orderBy(desc(patients.createdAt))
      .limit(50)
  }

  async findById(id: string) {
    const patientData = await this.db.transaction(async (tx) => {
      const [patient] = await tx
        .select({
          id: patients.id,
          firstName: patients.firstName,
          lastName: patients.lastName,
          nationalId: patients.nationalId,
          insuranceCode: patients.insuranceCode,
          insuranceType: patients.insuranceType,
          birth_date: patients.birthDate,
          phone: patients.phone,
          address: patients.address,
          maritalStatus: patients.maritalStatus,
          smoking: patients.smoking,
          bmi: patients.bmi,
          exercise: patients.exercise,
          alcohol: patients.alcohol,
          confidentialNotes: patients.confidentialNotes,
        })
        .from(patients)
        .where(eq(patients.id, id))

      if (!patient) throw new NotFoundError('Patient')

      const [diseasesList, medicationsList, allergiesList, obstetricHistory, attachmentsList] =
        await Promise.all([
          tx
            .select({ name: diseases.name, diagnosed_at: diseases.diagnosedAt, id: diseases.id })
            .from(diseases)
            .where(eq(diseases.patientId, id)),
          tx
            .select({ name: medications.name, dosage: medications.dosage, id: medications.id })
            .from(medications)
            .where(eq(medications.patientId, id)),
          tx
            .select({ substance: allergies.substance, severity: allergies.severity, id: allergies.id })
            .from(allergies)
            .where(eq(allergies.patientId, id)),
          tx
            .select()
            .from(pregnancies)
            .where(eq(pregnancies.patientId, id))
            .orderBy(pregnancies.gravidaIndex),
          tx
            .select({
              id: attachments.id,
              fileType: attachments.fileType,
              fileName: attachments.fileName,
              filePath: attachments.filePath,
              fileHash: attachments.fileHash,
              fileSize: attachments.fileSize,
              mimeType: attachments.mimeType,
              createdAt: attachments.createdAt,
            })
            .from(attachments)
            .where(and(eq(attachments.patientId, id), eq(attachments.isDeleted, false))),
        ])

      const groupedAttachments = {
        ultrasound: attachmentsList.filter((f) => f.fileType === 'ultrasound'),
        lab: attachmentsList.filter((f) => f.fileType === 'lab'),
        prescription: attachmentsList.filter((f) => f.fileType === 'prescription'),
      }

      return {
        ...patient,
        insurance: getInsuranceInfo(patient.insuranceType),
        diseases: diseasesList,
        medications: medicationsList,
        allergies: allergiesList,
        obstetricHistory,
        attachments: groupedAttachments,
      }
    })

    return patientData
  }

  async update(
    patientId: string,
    dto: UpdatePatientDto,
    uploadedFiles: Array<{ type: string; fieldname?: string; originalName: string; filePath: string; fileHash?: string; fileSize?: number; mimeType?: string; relativePath?: string }>
  ) {
    const result = await this.db.transaction(async (tx) => {
      const p = dto.patient
      const updatedPatientList = await tx
        .update(patients)
        .set({
          ...(p.first_name !== undefined && { firstName: p.first_name }),
          ...(p.last_name !== undefined && { lastName: p.last_name }),
          ...(p.insurance_code !== undefined && { insuranceCode: p.insurance_code ?? null }),
          ...(p.insurance_type !== undefined && { insuranceType: p.insurance_type ?? null }),
          ...(p.birth_date !== undefined && { birthDate: p.birth_date ?? null }),
          ...(p.phone !== undefined && { phone: p.phone ?? null }),
          ...(p.address !== undefined && { address: p.address ?? null }),
          ...(p.marital_status !== undefined && { maritalStatus: p.marital_status ?? null }),
          ...(p.smoking !== undefined && { smoking: p.smoking ?? null }),
          ...(p.bmi !== undefined && { bmi: p.bmi ? String(p.bmi) : null }),
          ...(p.exercise !== undefined && { exercise: p.exercise ?? null }),
          ...(p.alcohol !== undefined && { alcohol: p.alcohol ?? null }),
          ...(p.confidential_notes !== undefined && { confidentialNotes: p.confidential_notes ?? null }),
          updatedAt: new Date(),
        })
        .where(eq(patients.id, patientId))
        .returning()

      if (updatedPatientList.length === 0) throw new NotFoundError('Patient')

      if (p.diseases !== undefined) {
        const incomingIds = p.diseases.filter((d) => d.id).map((d) => d.id!)
        await syncRelated(tx, diseases, diseases.patientId, patientId, incomingIds)
        for (const d of p.diseases) {
          const payload = { patientId, name: d.name, diagnosedAt: d.diagnosed_at ?? null }
          if (d.id) {
            await tx.update(diseases).set(payload).where(eq(diseases.id, d.id))
          } else {
            await tx.insert(diseases).values(payload)
          }
        }
      }

      if (p.medications !== undefined) {
        const incomingIds = p.medications.filter((m) => m.id).map((m) => m.id!)
        await syncRelated(tx, medications, medications.patientId, patientId, incomingIds)
        for (const m of p.medications) {
          const payload = { patientId, name: m.name, dosage: m.dosage ?? null }
          if (m.id) {
            await tx.update(medications).set(payload).where(eq(medications.id, m.id))
          } else {
            await tx.insert(medications).values(payload)
          }
        }
      }

      if (p.allergies !== undefined) {
        const incomingIds = p.allergies.filter((a) => a.id).map((a) => a.id!)
        await syncRelated(tx, allergies, allergies.patientId, patientId, incomingIds)
        for (const a of p.allergies) {
          const payload = { patientId, substance: a.substance, severity: a.severity ?? '\u0645\u062A\u0648\u0633\u0637' }
          if (a.id) {
            await tx.update(allergies).set(payload).where(eq(allergies.id, a.id))
          } else {
            await tx.insert(allergies).values(payload)
          }
        }
      }

      if (uploadedFiles.length > 0) {
        await tx.insert(attachments).values(
          uploadedFiles.map((file) => ({
            patientId,
            fileType: file.type || (file.fieldname?.replace(/\[\]$/, '') ?? 'unknown'),
            fileName: file.originalName,
            filePath: file.filePath,
            fileHash: file.fileHash ?? '',
            fileSize: file.fileSize ?? 0,
            mimeType: file.mimeType ?? 'application/octet-stream',
            storagePath: file.relativePath ?? '',
          }))
        )
      }

      return updatedPatientList[0]
    })

    return result
  }

  async deleteAttachment(patientId: string, attachmentId: string) {
    return this.db.transaction(async (tx) => {
      const [attachment] = await tx
        .select()
        .from(attachments)
        .where(and(eq(attachments.id, attachmentId), eq(attachments.patientId, patientId)))

      if (!attachment) throw new NotFoundError('Attachment')

      if (attachment.storagePath) {
        await fileService.moveFileToTrash(attachment.storagePath)
      } else {
        const filename = path.basename(attachment.filePath)
        await fileService.deleteFile(path.join(fileService.getBaseDir(), filename))
      }

      await tx.delete(attachments).where(eq(attachments.id, attachmentId))

      return { id: attachmentId }
    })
  }

  async getDoctors() {
    return this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
        role: users.role,
      })
      .from(users)
      .where(
        and(
          inArray(users.role, ['doctor', 'admin_doctor']),
          eq(users.status, 'approved'),
        )
      )
      .orderBy(users.fullName)
  }

  async updateMyProfile(patientId: string, data: Record<string, any>) {
    const result = await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(patients)
        .set({
          ...(data.first_name !== undefined && { firstName: data.first_name }),
          ...(data.last_name !== undefined && { lastName: data.last_name }),
          ...(data.insurance_code !== undefined && { insuranceCode: data.insurance_code ?? null }),
          ...(data.insurance_type !== undefined && { insuranceType: data.insurance_type ?? null }),
          ...(data.birth_date !== undefined && { birthDate: data.birth_date ?? null }),
          ...(data.phone !== undefined && { phone: data.phone ?? null }),
          ...(data.address !== undefined && { address: data.address ?? null }),
          ...(data.marital_status !== undefined && { maritalStatus: data.marital_status ?? null }),
          ...(data.smoking !== undefined && { smoking: data.smoking ?? null }),
          ...(data.bmi !== undefined && { bmi: data.bmi ? String(data.bmi) : null }),
          ...(data.exercise !== undefined && { exercise: data.exercise ?? null }),
          ...(data.alcohol !== undefined && { alcohol: data.alcohol ?? null }),
          updatedAt: new Date(),
        })
        .where(eq(patients.id, patientId))
        .returning()

      if (!updated) throw new NotFoundError('Patient')

      if (updated.phone) {
        await tx
          .update(users)
          .set({ phone: updated.phone })
          .where(eq(users.patientId, patientId))
      }

      return updated
    })

    return result
  }

  async softDelete(id: string) {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: patients.id, isDeleted: patients.isDeleted })
        .from(patients)
        .where(eq(patients.id, id))

      if (!existing) throw new NotFoundError('Patient')
      if (existing.isDeleted) throw new ConflictError('Patient already deleted')

      const [deletedPatient] = await tx
        .update(patients)
        .set({ isDeleted: true, deletedAt: new Date() })
        .where(eq(patients.id, id))
        .returning({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName })

      return deletedPatient
    })
  }
}

async function syncRelated(
  tx: any,
  table: any,
  patientIdCol: any,
  patientId: string,
  keepIds: string[]
) {
  if (keepIds.length > 0) {
    await tx
      .delete(table)
      .where(and(eq(patientIdCol, patientId), notInArray(table.id, keepIds)))
  } else {
    await tx.delete(table).where(eq(patientIdCol, patientId))
  }
}

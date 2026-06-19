import type { DB } from '../../db/client'
import { patients, consentRecords } from '../../db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { NotFoundError } from '../../shared/errors'
import type { ConsentRecordDto } from './consent.schema'

export class ConsentService {
  constructor(private db: DB) {}

  async getByPatient(patientId: string) {
    return this.db
      .select()
      .from(consentRecords)
      .where(eq(consentRecords.patientId, patientId))
      .orderBy(desc(consentRecords.createdAt))
  }

  async grant(dto: ConsentRecordDto, grantedById: string) {
    const [patient] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, dto.patient_id), eq(patients.isDeleted, false)))
    if (!patient) throw new NotFoundError('Patient')

    const [record] = await this.db
      .insert(consentRecords)
      .values({
        patientId: dto.patient_id,
        consentType: dto.consent_type,
        isGranted: dto.is_granted ?? true,
        grantedAt: new Date(),
        expiresAt: dto.expires_at ? new Date(dto.expires_at) : null,
        grantedById,
        notes: dto.notes || null,
      })
      .returning()
    return record
  }

  async revoke(consentId: string) {
    const [record] = await this.db
      .update(consentRecords)
      .set({ isGranted: false, revokedAt: new Date() })
      .where(eq(consentRecords.id, consentId))
      .returning()
    if (!record) throw new NotFoundError('Consent record')
    return record
  }

  async delete(consentId: string) {
    const [deleted] = await this.db
      .delete(consentRecords)
      .where(eq(consentRecords.id, consentId))
      .returning()
    if (!deleted) throw new NotFoundError('Consent record')
    return deleted
  }

  async getActiveConsents(patientId: string) {
    return this.db
      .select()
      .from(consentRecords)
      .where(
        and(
          eq(consentRecords.patientId, patientId),
          eq(consentRecords.isGranted, true),
        )
      )
  }
}
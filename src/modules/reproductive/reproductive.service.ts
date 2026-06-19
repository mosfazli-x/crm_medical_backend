import type { DB } from '../../db/client'
import {
  patients, menstrualHistory, sexualHistory,
  gynecologicalSurgeries, contraceptiveHistory, familyHistory, reproductiveSummary,
} from '../../db/schema'
import { eq, and, notInArray, sql } from 'drizzle-orm'
import { NotFoundError } from '../../shared/errors'
import type {
  MenstrualHistoryDto, SexualHistoryDto,
  GynecologicalSurgeryDto, ContraceptiveHistoryDto,
  FamilyHistoryDto, ReproductiveSummaryDto, ReproductiveHistoryBundleDto,
} from './reproductive.schema'

export class ReproductiveService {
  constructor(private db: DB) {}

  async getBundle(patientId: string) {
    const [patient] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.isDeleted, false)))
    if (!patient) throw new NotFoundError('Patient')

    const [mh] = await this.db
      .select()
      .from(menstrualHistory)
      .where(eq(menstrualHistory.patientId, patientId))
      .limit(1)

    const [sh] = await this.db
      .select()
      .from(sexualHistory)
      .where(eq(sexualHistory.patientId, patientId))
      .limit(1)

    const surgeries = await this.db
      .select()
      .from(gynecologicalSurgeries)
      .where(eq(gynecologicalSurgeries.patientId, patientId))
      .orderBy(sql`${gynecologicalSurgeries.surgeryDate} DESC NULLS LAST`)

    const contraceptives = await this.db
      .select()
      .from(contraceptiveHistory)
      .where(eq(contraceptiveHistory.patientId, patientId))
      .orderBy(sql`${contraceptiveHistory.startDate} DESC NULLS LAST`)

    const famHistory = await this.db
      .select()
      .from(familyHistory)
      .where(eq(familyHistory.patientId, patientId))

    const [rs] = await this.db
      .select()
      .from(reproductiveSummary)
      .where(eq(reproductiveSummary.patientId, patientId))
      .limit(1)

    return {
      menstrual_history: mh || null,
      sexual_history: sh || null,
      surgeries,
      contraceptives,
      family_history: famHistory,
      reproductive_summary: rs || null,
    }
  }

  async updateMenstrualHistory(patientId: string, dto: MenstrualHistoryDto) {
    const [patient] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.isDeleted, false)))
    if (!patient) throw new NotFoundError('Patient')

    const [existing] = await this.db
      .select({ id: menstrualHistory.id })
      .from(menstrualHistory)
      .where(eq(menstrualHistory.patientId, patientId))
      .limit(1)

    if (existing) {
      const [updated] = await this.db
        .update(menstrualHistory)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(menstrualHistory.patientId, patientId))
        .returning()
      return updated
    }

    const [created] = await this.db
      .insert(menstrualHistory)
      .values({ patientId, ...dto })
      .returning()
    return created
  }

  async updateSexualHistory(patientId: string, dto: SexualHistoryDto) {
    const [patient] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.isDeleted, false)))
    if (!patient) throw new NotFoundError('Patient')

    const [existing] = await this.db
      .select({ id: sexualHistory.id })
      .from(sexualHistory)
      .where(eq(sexualHistory.patientId, patientId))
      .limit(1)

    if (existing) {
      const [updated] = await this.db
        .update(sexualHistory)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(sexualHistory.patientId, patientId))
        .returning()
      return updated
    }

    const [created] = await this.db
      .insert(sexualHistory)
      .values({ patientId, ...dto })
      .returning()
    return created
  }

  async syncSurgeries(patientId: string, items: GynecologicalSurgeryDto[]) {
    const [patient] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.isDeleted, false)))
    if (!patient) throw new NotFoundError('Patient')

    const incomingIds = items.filter((s) => s.id).map((s) => s.id!)
    if (incomingIds.length > 0) {
      await this.db
        .delete(gynecologicalSurgeries)
        .where(and(eq(gynecologicalSurgeries.patientId, patientId), notInArray(gynecologicalSurgeries.id, incomingIds as [string, ...string[]])))
    } else {
      await this.db
        .delete(gynecologicalSurgeries)
        .where(eq(gynecologicalSurgeries.patientId, patientId))
    }

    for (const s of items) {
      const payload = {
        patientId,
        surgeryType: s.surgery_type,
        surgeryDate: s.surgery_date || null,
        hospital: s.hospital || null,
        surgeonName: s.surgeon_name || null,
        indication: s.indication || null,
        findings: s.findings || null,
        notes: s.notes || null,
      }
      if (s.id) {
        await this.db.update(gynecologicalSurgeries).set(payload).where(eq(gynecologicalSurgeries.id, s.id))
      } else {
        await this.db.insert(gynecologicalSurgeries).values(payload)
      }
    }
  }

  async syncContraceptives(patientId: string, items: ContraceptiveHistoryDto[]) {
    const [patient] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.isDeleted, false)))
    if (!patient) throw new NotFoundError('Patient')

    const incomingIds = items.filter((c) => c.id).map((c) => c.id!)
    if (incomingIds.length > 0) {
      await this.db
        .delete(contraceptiveHistory)
        .where(and(eq(contraceptiveHistory.patientId, patientId), notInArray(contraceptiveHistory.id, incomingIds as [string, ...string[]])))
    } else {
      await this.db
        .delete(contraceptiveHistory)
        .where(eq(contraceptiveHistory.patientId, patientId))
    }

    for (const c of items) {
      const payload = {
        patientId,
        method: c.method,
        startDate: c.start_date || null,
        endDate: c.end_date || null,
        isCurrent: c.is_current ?? true,
        reasonForDiscontinuation: c.reason_for_discontinuation || null,
        notes: c.notes || null,
      }
      if (c.id) {
        await this.db.update(contraceptiveHistory).set(payload).where(eq(contraceptiveHistory.id, c.id))
      } else {
        await this.db.insert(contraceptiveHistory).values(payload)
      }
    }
  }

  async syncFamilyHistory(patientId: string, items: FamilyHistoryDto[]) {
    const [patient] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.isDeleted, false)))
    if (!patient) throw new NotFoundError('Patient')

    const incomingIds = items.filter((f) => f.id).map((f) => f.id!)
    if (incomingIds.length > 0) {
      await this.db
        .delete(familyHistory)
        .where(and(eq(familyHistory.patientId, patientId), notInArray(familyHistory.id, incomingIds as [string, ...string[]])))
    } else {
      await this.db
        .delete(familyHistory)
        .where(eq(familyHistory.patientId, patientId))
    }

    for (const f of items) {
      const payload = {
        patientId,
        relationship: f.relationship,
        condition: f.condition,
        ageAtDiagnosis: f.age_at_diagnosis || null,
        isDeceased: f.is_deceased || false,
        notes: f.notes || null,
      }
      if (f.id) {
        await this.db.update(familyHistory).set(payload).where(eq(familyHistory.id, f.id))
      } else {
        await this.db.insert(familyHistory).values(payload)
      }
    }
  }

  async updateReproductiveSummary(patientId: string, dto: ReproductiveSummaryDto) {
    const [patient] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.isDeleted, false)))
    if (!patient) throw new NotFoundError('Patient')

    const [existing] = await this.db
      .select({ id: reproductiveSummary.id })
      .from(reproductiveSummary)
      .where(eq(reproductiveSummary.patientId, patientId))
      .limit(1)

    if (existing) {
      const [updated] = await this.db
        .update(reproductiveSummary)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(reproductiveSummary.patientId, patientId))
        .returning()
      return updated
    }

    const [created] = await this.db
      .insert(reproductiveSummary)
      .values({ patientId, ...dto })
      .returning()
    return created
  }
}
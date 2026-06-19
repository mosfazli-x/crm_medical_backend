import type { DB } from '../../db/client'
import { patients, labResults } from '../../db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { NotFoundError } from '../../shared/errors'
import type { LabResultDto } from './lab-results.schema'

export class LabResultsService {
  constructor(private db: DB) {}

  async getByPatient(patientId: string, category?: string) {
    const conditions = [eq(labResults.patientId, patientId)]
    if (category) conditions.push(eq(labResults.category, category))
    return this.db
      .select()
      .from(labResults)
      .where(and(...conditions))
      .orderBy(desc(labResults.performedDate))
  }

  async getById(id: string) {
    const [result] = await this.db
      .select()
      .from(labResults)
      .where(eq(labResults.id, id))
      .limit(1)
    if (!result) throw new NotFoundError('Lab result')
    return result
  }

  async create(dto: LabResultDto) {
    const [patient] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, dto.patient_id), eq(patients.isDeleted, false)))
    if (!patient) throw new NotFoundError('Patient')

    const [result] = await this.db
      .insert(labResults)
      .values({
        patientId: dto.patient_id,
        category: dto.category,
        testName: dto.test_name,
        testCode: dto.test_code || null,
        value: dto.value,
        unit: dto.unit || null,
        referenceRangeLow: dto.reference_range_low || null,
        referenceRangeHigh: dto.reference_range_high || null,
        isAbnormal: dto.is_abnormal || null,
        performedDate: new Date(dto.performed_date),
        performedBy: dto.performed_by || null,
        notes: dto.notes || null,
      })
      .returning()
    return result
  }

  async delete(id: string) {
    const [deleted] = await this.db
      .delete(labResults)
      .where(eq(labResults.id, id))
      .returning()
    if (!deleted) throw new NotFoundError('Lab result')
    return deleted
  }

  async getTrend(patientId: string, testName: string) {
    return this.db
      .select()
      .from(labResults)
      .where(
        and(
          eq(labResults.patientId, patientId),
          eq(labResults.testName, testName),
        )
      )
      .orderBy(labResults.performedDate)
  }

  async getCategories(patientId: string) {
    const rows = await this.db
      .select({
        category: labResults.category,
        count: sql<number>`count(*)`,
      })
      .from(labResults)
      .where(eq(labResults.patientId, patientId))
      .groupBy(labResults.category)
    return rows
  }
}
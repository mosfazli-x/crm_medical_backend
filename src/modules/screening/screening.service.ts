import type { DB } from '../../db/client'
import { patients, screeningSchedules, screeningResults } from '../../db/schema'
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm'
import { NotFoundError } from '../../shared/errors'
import type { ScreeningScheduleDto, ScreeningResultDto } from './screening.schema'

export class ScreeningService {
  constructor(private db: DB) {}

  async getSchedules(patientId?: string) {
    const conditions: ReturnType<typeof eq>[] = []
    if (patientId) conditions.push(eq(screeningSchedules.patientId, patientId))
    const query = this.db
      .select()
      .from(screeningSchedules)
      .orderBy(desc(screeningSchedules.dueDate))
    if (conditions.length > 0) {
      return query.where(and(...conditions))
    }
    return query
  }

  async getScheduleById(id: string) {
    const [schedule] = await this.db
      .select()
      .from(screeningSchedules)
      .where(eq(screeningSchedules.id, id))
      .limit(1)
    if (!schedule) throw new NotFoundError('Screening schedule')
    return schedule
  }

  async createSchedule(dto: ScreeningScheduleDto) {
    const [patient] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, dto.patient_id), eq(patients.isDeleted, false)))
    if (!patient) throw new NotFoundError('Patient')

    const [schedule] = await this.db
      .insert(screeningSchedules)
      .values({
        patientId: dto.patient_id,
        screeningType: dto.screening_type,
        dueDate: dto.due_date,
        status: dto.status || 'pending',
        riskLevel: dto.risk_level || null,
        assignedToId: dto.assigned_to_id || null,
        notes: dto.notes || null,
      })
      .returning()
    return schedule
  }

  async updateSchedule(id: string, dto: Partial<ScreeningScheduleDto>) {
    const updates: Record<string, unknown> = {}
    if (dto.screening_type !== undefined) updates.screeningType = dto.screening_type
    if (dto.due_date !== undefined) updates.dueDate = dto.due_date
    if (dto.status !== undefined) updates.status = dto.status
    if (dto.risk_level !== undefined) updates.riskLevel = dto.risk_level
    if (dto.notes !== undefined) updates.notes = dto.notes

    const [updated] = await this.db
      .update(screeningSchedules)
      .set(updates)
      .where(eq(screeningSchedules.id, id))
      .returning()
    if (!updated) throw new NotFoundError('Screening schedule')
    return updated
  }

  async deleteSchedule(id: string) {
    const [deleted] = await this.db
      .delete(screeningSchedules)
      .where(eq(screeningSchedules.id, id))
      .returning()
    if (!deleted) throw new NotFoundError('Screening schedule')
    return deleted
  }

  async getResults(patientId?: string, screeningType?: string) {
    const conditions: ReturnType<typeof eq>[] = []
    if (patientId) conditions.push(eq(screeningResults.patientId, patientId))
    if (screeningType) conditions.push(eq(screeningResults.screeningType, screeningType))
    const query = this.db
      .select()
      .from(screeningResults)
      .orderBy(desc(screeningResults.performedDate))
    if (conditions.length > 0) {
      return query.where(and(...conditions))
    }
    return query
  }

  async getResultById(id: string) {
    const [result] = await this.db
      .select()
      .from(screeningResults)
      .where(eq(screeningResults.id, id))
      .limit(1)
    if (!result) throw new NotFoundError('Screening result')
    return result
  }

  async createResult(dto: ScreeningResultDto) {
    const [patient] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, dto.patient_id), eq(patients.isDeleted, false)))
    if (!patient) throw new NotFoundError('Patient')

    const [result] = await this.db
      .insert(screeningResults)
      .values({
        patientId: dto.patient_id,
        screeningType: dto.screening_type,
        performedDate: dto.performed_date,
        result: dto.result || null,
        resultDetails: dto.result_details || null,
        facilityName: dto.facility_name || null,
        notes: dto.notes || null,
        nextDueDate: dto.next_due_date || null,
      })
      .returning()
    return result
  }

  async getOverdueSchedules() {
    return this.db
      .select()
      .from(screeningSchedules)
      .where(
        and(
          eq(screeningSchedules.status, 'pending'),
          lte(screeningSchedules.dueDate, sql`CURRENT_DATE`)
        )
      )
      .orderBy(screeningSchedules.dueDate)
  }

  async getDueSchedules(days: number = 30) {
    return this.db
      .select()
      .from(screeningSchedules)
      .where(
        and(
          eq(screeningSchedules.status, 'pending'),
          lte(screeningSchedules.dueDate, sql`CURRENT_DATE + INTERVAL '${sql.raw(String(days))} days'`),
          gte(screeningSchedules.dueDate, sql`CURRENT_DATE`)
        )
      )
      .orderBy(screeningSchedules.dueDate)
  }
}
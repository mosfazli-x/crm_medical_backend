import type { DB } from '../../db/client'
import { dailyReportVisitTypes, dailyReports, patients } from '../../db/schema'
import { eq, and, desc, sql, type SQL } from 'drizzle-orm'
import { NotFoundError } from '../../shared/errors'
import type {
  CreateDailyReportDto,
  CreateDailyReportVisitTypeDto,
  DailyReportsStatsQueryDto,
  ListDailyReportsQueryDto,
  UpdateDailyReportVisitTypeDto,
} from './daily-reports.schema'

type ReportFilters = Pick<
  ListDailyReportsQueryDto,
  'reportDate' | 'from' | 'to' | 'paymentMethod' | 'procedure' | 'visitType' | 'patientId'
>

const DEFAULT_VISIT_TYPES: Array<{ name: string; description: string; price: string; color: string }> = [
  { name: 'ویزیت ترمیمی', description: 'ویزیت درمانی ترمیمی بیمار', price: '1500000', color: '#4F46E5' },
  { name: 'ویزیت مشاوره', description: 'ویزیت صرفاً مشاوره‌ای', price: '800000', color: '#0EA5E9' },
  { name: 'ویزیت کنترل', description: 'پیگیری و کنترل وضعیت بیمار', price: '1000000', color: '#16A34A' },
  { name: 'ویزیت اول', description: 'اولین ویزیت و پرونده‌سازی بیمار', price: '1200000', color: '#F59E0B' },
]

export class DailyReportsService {
  constructor(private db: DB) {}

  async ensureDefaults() {
    const [existing] = await this.db
      .select({ id: dailyReportVisitTypes.id })
      .from(dailyReportVisitTypes)
      .where(eq(dailyReportVisitTypes.isDeleted, false))
      .limit(1)

    if (existing) return

    await this.db.insert(dailyReportVisitTypes).values(DEFAULT_VISIT_TYPES)
  }

  async create(dto: CreateDailyReportDto, recordedById?: string) {
    const [report] = await this.db
      .insert(dailyReports)
      .values({
        reportDate: dto.reportDate,
        patientId: dto.patientId,
        visitTypes: dto.visitTypes,
        procedures: dto.procedures,
        otherProcedureText: dto.otherProcedureText || null,
        feeCollected: dto.feeCollected != null ? String(dto.feeCollected) : null,
        paymentMethod: dto.paymentMethod,
        notes: dto.notes || null,
        recordedById: recordedById || null,
      })
      .returning()
    return report
  }

  private buildListConditions(dto: ReportFilters): SQL[] {
    const conditions: SQL[] = []
    if (dto.reportDate) conditions.push(eq(dailyReports.reportDate, dto.reportDate))
    if (dto.from) conditions.push(sql`${dailyReports.reportDate} >= ${dto.from}`)
    if (dto.to) conditions.push(sql`${dailyReports.reportDate} <= ${dto.to}`)
    if (dto.paymentMethod) conditions.push(eq(dailyReports.paymentMethod, dto.paymentMethod))
    if (dto.patientId) conditions.push(eq(dailyReports.patientId, dto.patientId))
    if (dto.visitType) {
      conditions.push(sql`${dailyReports.visitTypes} @> ${JSON.stringify([dto.visitType])}::jsonb`)
    }
    if (dto.procedure) {
      conditions.push(sql`${dailyReports.procedures} @> ${JSON.stringify([dto.procedure])}::jsonb`)
    }
    return conditions
  }

  async list(dto: ListDailyReportsQueryDto) {
    const conditions = this.buildListConditions(dto)

    const query = this.db
      .select({
        id: dailyReports.id,
        reportDate: dailyReports.reportDate,
        patientId: dailyReports.patientId,
        visitTypes: dailyReports.visitTypes,
        procedures: dailyReports.procedures,
        otherProcedureText: dailyReports.otherProcedureText,
        feeCollected: dailyReports.feeCollected,
        paymentMethod: dailyReports.paymentMethod,
        notes: dailyReports.notes,
        recordedById: dailyReports.recordedById,
        createdAt: dailyReports.createdAt,
        patientFirstName: patients.firstName,
        patientLastName: patients.lastName,
        patientNationalId: patients.nationalId,
        patientPhone: patients.phone,
        patientInsuranceType: patients.insuranceType,
      })
      .from(dailyReports)
      .leftJoin(patients, eq(dailyReports.patientId, patients.id))
      .orderBy(desc(dailyReports.createdAt))

    if (conditions.length > 0) return query.where(and(...conditions))
    return query
  }

  async delete(id: string) {
    const [deleted] = await this.db
      .delete(dailyReports)
      .where(eq(dailyReports.id, id))
      .returning()
    if (!deleted) throw new NotFoundError('Daily report')
    return deleted
  }

  async listVisitTypes(includeInactive: boolean) {
    const conditions: SQL[] = [eq(dailyReportVisitTypes.isDeleted, false)]
    if (!includeInactive) conditions.push(eq(dailyReportVisitTypes.isActive, true))
    return this.db
      .select()
      .from(dailyReportVisitTypes)
      .where(and(...conditions))
      .orderBy(dailyReportVisitTypes.name)
  }

  async createVisitType(dto: CreateDailyReportVisitTypeDto) {
    const [visitType] = await this.db
      .insert(dailyReportVisitTypes)
      .values({
        name: dto.name,
        description: dto.description ?? null,
        price: dto.price != null ? String(dto.price) : null,
        color: dto.color ?? null,
      })
      .returning()
    return visitType
  }

  async updateVisitType(id: string, dto: UpdateDailyReportVisitTypeDto) {
    const existing = await this.db
      .select()
      .from(dailyReportVisitTypes)
      .where(and(eq(dailyReportVisitTypes.id, id), eq(dailyReportVisitTypes.isDeleted, false)))
      .limit(1)
    if (!existing.length) throw new NotFoundError('Visit type')

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (dto.name !== undefined) updates.name = dto.name
    if (dto.description !== undefined) updates.description = dto.description
    if (dto.price !== undefined) updates.price = String(dto.price)
    if (dto.color !== undefined) updates.color = dto.color
    if (dto.isActive !== undefined) updates.isActive = dto.isActive

    const [updated] = await this.db
      .update(dailyReportVisitTypes)
      .set(updates)
      .where(eq(dailyReportVisitTypes.id, id))
      .returning()
    return updated
  }

  async deleteVisitType(id: string) {
    const existing = await this.db
      .select()
      .from(dailyReportVisitTypes)
      .where(and(eq(dailyReportVisitTypes.id, id), eq(dailyReportVisitTypes.isDeleted, false)))
      .limit(1)
    if (!existing.length) throw new NotFoundError('Visit type')

    const [deleted] = await this.db
      .update(dailyReportVisitTypes)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(dailyReportVisitTypes.id, id))
      .returning()
    return deleted
  }

  private buildWhereClause(dto: ReportFilters): SQL {
    const conditions = this.buildListConditions(dto)
    if (!conditions.length) return sql``
    return sql`WHERE ${sql.join(conditions, sql` AND `)}`
  }

  private async aggregateRows(sqlQuery: SQL): Promise<Record<string, unknown>[]> {
    const result = await this.db.execute(sqlQuery)
    return result.rows as Record<string, unknown>[]
  }

  async stats(dto: DailyReportsStatsQueryDto) {
    const where = this.buildWhereClause(dto)

    const [totals] = await this.aggregateRows(
      sql`SELECT COUNT(*)::int AS count,
                 COALESCE(SUM(${dailyReports.feeCollected}::numeric), 0)::text AS total
          FROM ${dailyReports} ${where}`
    )

    const byPaymentMethod = await this.aggregateRows(
      sql`SELECT ${dailyReports.paymentMethod} AS payment_method,
                 COUNT(*)::int AS count,
                 COALESCE(SUM(${dailyReports.feeCollected}::numeric), 0)::text AS total
          FROM ${dailyReports} ${where}
          GROUP BY ${dailyReports.paymentMethod}
          ORDER BY count DESC`
    )

    const byDay = await this.aggregateRows(
      sql`SELECT ${dailyReports.reportDate}::text AS date,
                 COUNT(*)::int AS count,
                 COALESCE(SUM(${dailyReports.feeCollected}::numeric), 0)::text AS total
          FROM ${dailyReports} ${where}
          GROUP BY ${dailyReports.reportDate}
          ORDER BY ${dailyReports.reportDate}`
    )

    const byProcedure = await this.aggregateRows(
      sql`SELECT t.procedure AS procedure,
                 COUNT(*)::int AS count,
                 COALESCE(SUM(${dailyReports.feeCollected}::numeric), 0)::text AS total
          FROM ${dailyReports}
          CROSS JOIN LATERAL jsonb_array_elements_text(${dailyReports.procedures}) AS t(procedure)
          ${where}
          GROUP BY t.procedure
          ORDER BY count DESC`
    )

    const byVisitType = await this.aggregateRows(
      sql`SELECT t.name AS name,
                 COUNT(*)::int AS count,
                 COALESCE(SUM(${dailyReports.feeCollected}::numeric), 0)::text AS total
          FROM ${dailyReports}
          CROSS JOIN LATERAL jsonb_array_elements_text(${dailyReports.visitTypes}) AS t(name)
          ${where}
          GROUP BY t.name
          ORDER BY count DESC`
    )

    const totalReports = Number(totals?.count ?? 0)
    const totalCollected = String(totals?.total ?? '0')
    const average = totalReports > 0 ? String(Math.round((Number(totalCollected) / totalReports) * 100) / 100) : '0'

    return {
      totalReports,
      totalCollected,
      average,
      byPaymentMethod,
      byDay,
      byProcedure,
      byVisitType,
    }
  }
}

import type { DB } from '../../db/client'
import { patients, procedureCodes, billingRecords } from '../../db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { NotFoundError } from '../../shared/errors'
import type { ProcedureCodeDto, BillingRecordDto } from './billing.schema'

export class BillingService {
  constructor(private db: DB) {}

  async getProcedureCodes(category?: string) {
    const conditions: ReturnType<typeof eq>[] = [eq(procedureCodes.isActive, true)]
    if (category) conditions.push(eq(procedureCodes.category, category))
    return this.db
      .select()
      .from(procedureCodes)
      .where(and(...conditions))
      .orderBy(procedureCodes.category)
  }

  async createProcedureCode(dto: ProcedureCodeDto) {
    const [code] = await this.db
      .insert(procedureCodes)
      .values({
        code: dto.code,
        description: dto.description,
        category: dto.category || null,
        defaultPrice: dto.default_price ? String(dto.default_price) : null,
        insuranceCoverageRate: dto.insurance_coverage_rate ? String(dto.insurance_coverage_rate / 100) : null,
      })
      .returning()
    return code
  }

  async getBillingRecords(patientId?: string, status?: string) {
    const conditions: ReturnType<typeof eq>[] = []
    if (patientId) conditions.push(eq(billingRecords.patientId, patientId))
    if (status) conditions.push(eq(billingRecords.status, status))
    const query = this.db
      .select()
      .from(billingRecords)
      .orderBy(desc(billingRecords.createdAt))
    if (conditions.length > 0) {
      return query.where(and(...conditions))
    }
    return query
  }

  async getBillingRecordById(id: string) {
    const [record] = await this.db
      .select()
      .from(billingRecords)
      .where(eq(billingRecords.id, id))
      .limit(1)
    if (!record) throw new NotFoundError('Billing record')
    return record
  }

  async createBillingRecord(dto: BillingRecordDto) {
    const [patient] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, dto.patient_id), eq(patients.isDeleted, false)))
    if (!patient) throw new NotFoundError('Patient')

    const values: Record<string, unknown> = {
      patientId: dto.patient_id,
      procedureCodeId: dto.procedure_code_id || null,
      visitId: dto.visit_id || null,
      description: dto.description,
      amount: String(dto.amount),
      insuranceClaimAmount: dto.insurance_claim_amount ? String(dto.insurance_claim_amount) : null,
      patientPayAmount: dto.patient_pay_amount ? String(dto.patient_pay_amount) : null,
      status: dto.status || 'pending',
      billedDate: dto.billed_date || null,
      paidDate: dto.paid_date || null,
      notes: dto.notes || null,
    }

    const [record] = await this.db
      .insert(billingRecords)
      .values(values as typeof billingRecords.$inferInsert)
      .returning()
    return record
  }

  async updateBillingStatus(id: string, status: string, paidDate?: string) {
    const updates: Record<string, unknown> = { status }
    if (paidDate) updates.paidDate = paidDate
    const [updated] = await this.db
      .update(billingRecords)
      .set(updates)
      .where(eq(billingRecords.id, id))
      .returning()
    if (!updated) throw new NotFoundError('Billing record')
    return updated
  }

  async getPatientBalance(patientId: string) {
    const result = await this.db
      .select({
        total_billed: sql<string>`COALESCE(SUM(CASE WHEN status != 'cancelled' THEN amount ELSE 0 END), 0)`,
        total_paid: sql<string>`COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0)`,
        total_pending: sql<string>`COALESCE(SUM(CASE WHEN status IN ('pending', 'billed') THEN amount ELSE 0 END), 0)`,
      })
      .from(billingRecords)
      .where(eq(billingRecords.patientId, patientId))
    return result[0]
  }
}
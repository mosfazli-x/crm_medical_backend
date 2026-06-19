import { z } from 'zod'

export const ProcedureCodeSchema = z.object({
  code: z.string().min(1),
  description: z.string().min(1),
  category: z.string().optional().nullable(),
  default_price: z.number().positive().optional().nullable(),
  insurance_coverage_rate: z.number().min(0).max(100).optional().nullable(),
})

export const BillingRecordSchema = z.object({
  id: z.string().optional(),
  patient_id: z.string(),
  procedure_code_id: z.string().optional().nullable(),
  visit_id: z.string().optional().nullable(),
  description: z.string().min(1),
  amount: z.number().positive(),
  insurance_claim_amount: z.number().min(0).optional().nullable(),
  patient_pay_amount: z.number().min(0).optional().nullable(),
  status: z.enum(['pending', 'billed', 'paid', 'partially_paid', 'written_off', 'cancelled']).optional(),
  billed_date: z.string().optional().nullable(),
  paid_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const CreateBillingRecordSchema = z.object({
  patient_id: z.string(),
  procedure_code_id: z.string().optional().nullable(),
  visit_id: z.string().optional().nullable(),
  description: z.string().min(1),
  amount: z.number().positive(),
  insurance_claim_amount: z.number().min(0).optional().nullable(),
  patient_pay_amount: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type ProcedureCodeDto = z.infer<typeof ProcedureCodeSchema>
export type BillingRecordDto = z.infer<typeof BillingRecordSchema>
import { z } from 'zod'

export const ScreeningScheduleSchema = z.object({
  id: z.string().optional(),
  patient_id: z.string(),
  screening_type: z.string().min(1),
  due_date: z.string().min(1),
  status: z.enum(['pending', 'completed', 'overdue', 'cancelled', 'rescheduled']).optional(),
  risk_level: z.enum(['normal', 'elevated', 'high']).optional().nullable(),
  assigned_to_id: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const ScreeningResultSchema = z.object({
  id: z.string().optional(),
  patient_id: z.string(),
  screening_type: z.string().min(1),
  performed_date: z.string().min(1),
  result: z.string().optional().nullable(),
  result_details: z.record(z.string(), z.unknown()).optional().nullable(),
  provider_id: z.string().optional().nullable(),
  facility_name: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  next_due_date: z.string().optional().nullable(),
})

export const CreateScreeningScheduleSchema = z.object({
  patient_id: z.string(),
  screening_type: z.enum([
    'pap_smear', 'hpv_test', 'mammography', 'bone_density',
    'pelvic_ultrasound', 'sti_screening', 'colposcopy', 'other',
  ]),
  due_date: z.string().min(1),
  risk_level: z.enum(['normal', 'elevated', 'high']).optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const CreateScreeningResultSchema = z.object({
  patient_id: z.string(),
  screening_type: z.string().min(1),
  performed_date: z.string().min(1),
  result: z.string().optional().nullable(),
  result_details: z.record(z.string(), z.unknown()).optional().nullable(),
  facility_name: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  next_due_date: z.string().optional().nullable(),
})

export type ScreeningScheduleDto = z.infer<typeof ScreeningScheduleSchema>
export type ScreeningResultDto = z.infer<typeof ScreeningResultSchema>
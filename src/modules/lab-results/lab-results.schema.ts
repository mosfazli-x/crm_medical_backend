import { z } from 'zod'

const reportTypeEnum = z.enum([
  'simple', 'pap_smear', 'hpv_dna', 'general_panel',
])

export const LabResultSchema = z.object({
  id: z.string().optional(),
  patient_id: z.string(),
  lab_order_id: z.string().optional().nullable(),
  category: z.enum([
    'hormone', 'hematology', 'biochemistry', 'tumor_marker',
    'microbiology', 'urinalysis', 'genetics', 'cytology',
    'pathology', 'molecular', 'other',
  ]),
  test_name: z.string().min(1),
  test_code: z.string().optional().nullable(),
  value: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  reference_range_low: z.string().optional().nullable(),
  reference_range_high: z.string().optional().nullable(),
  is_abnormal: z.boolean().optional().nullable(),
  report_type: reportTypeEnum.optional().nullable(),
  report_data: z.record(z.string(), z.any()).optional().nullable(),
  performed_date: z.string().min(1),
  performed_by: z.string().optional().nullable(),
  validated_by_id: z.string().optional().nullable(),
  validated_at: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const CreateLabResultSchema = z.object({
  patient_id: z.string(),
  lab_order_id: z.string().optional().nullable(),
  category: z.enum([
    'hormone', 'hematology', 'biochemistry', 'tumor_marker',
    'microbiology', 'urinalysis', 'genetics', 'cytology',
    'pathology', 'molecular', 'other',
  ]),
  test_name: z.string().min(1),
  test_code: z.string().optional().nullable(),
  value: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  reference_range_low: z.string().optional().nullable(),
  reference_range_high: z.string().optional().nullable(),
  is_abnormal: z.boolean().optional().nullable(),
  report_type: reportTypeEnum.optional().nullable(),
  report_data: z.record(z.string(), z.any()).optional().nullable(),
  performed_date: z.string().min(1),
  performed_by: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const UpdateLabResultSchema = z.object({
  category: z.enum([
    'hormone', 'hematology', 'biochemistry', 'tumor_marker',
    'microbiology', 'urinalysis', 'genetics', 'cytology',
    'pathology', 'molecular', 'other',
  ]).optional(),
  test_name: z.string().min(1).optional(),
  value: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  reference_range_low: z.string().optional().nullable(),
  reference_range_high: z.string().optional().nullable(),
  is_abnormal: z.boolean().optional().nullable(),
  report_type: reportTypeEnum.optional().nullable(),
  report_data: z.record(z.string(), z.any()).optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type LabResultDto = z.infer<typeof LabResultSchema>
export type CreateLabResultDto = z.infer<typeof CreateLabResultSchema>
export type UpdateLabResultDto = z.infer<typeof UpdateLabResultSchema>

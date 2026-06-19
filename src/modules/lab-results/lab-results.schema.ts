import { z } from 'zod'

export const LabResultSchema = z.object({
  id: z.string().optional(),
  patient_id: z.string(),
  category: z.enum([
    'hormone', 'hematology', 'biochemistry', 'tumor_marker',
    'microbiology', 'urinalysis', 'genetics', 'other',
  ]),
  test_name: z.string().min(1),
  test_code: z.string().optional().nullable(),
  value: z.string().min(1),
  unit: z.string().optional().nullable(),
  reference_range_low: z.string().optional().nullable(),
  reference_range_high: z.string().optional().nullable(),
  is_abnormal: z.boolean().optional().nullable(),
  performed_date: z.string().min(1),
  performed_by: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const CreateLabResultSchema = z.object({
  patient_id: z.string(),
  category: z.enum([
    'hormone', 'hematology', 'biochemistry', 'tumor_marker',
    'microbiology', 'urinalysis', 'genetics', 'other',
  ]),
  test_name: z.string().min(1),
  test_code: z.string().optional().nullable(),
  value: z.string().min(1),
  unit: z.string().optional().nullable(),
  reference_range_low: z.string().optional().nullable(),
  reference_range_high: z.string().optional().nullable(),
  performed_date: z.string().min(1),
  performed_by: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type LabResultDto = z.infer<typeof LabResultSchema>
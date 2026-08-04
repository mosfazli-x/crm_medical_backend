import { z } from 'zod'

export const PatientUsageSchema = z.object({
  patient_id: z.string().uuid(),
  product_id: z.string().uuid(),
  visit_id: z.string().uuid().optional().nullable(),
  quantity: z.number().positive(),
  unit_price: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const PatientUsageListQuerySchema = z.object({
  patient_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
})

export const SearchUsagePatientsSchema = z.object({
  q: z.string().optional(),
})

export const SearchUsageVisitsSchema = z.object({
  patient_id: z.string().uuid(),
})

export type PatientUsageDto = z.infer<typeof PatientUsageSchema>
export type PatientUsageListQueryDto = z.infer<typeof PatientUsageListQuerySchema>
export type SearchUsagePatientsDto = z.infer<typeof SearchUsagePatientsSchema>
export type SearchUsageVisitsDto = z.infer<typeof SearchUsageVisitsSchema>

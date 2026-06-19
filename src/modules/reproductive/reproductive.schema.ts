import { z } from 'zod'

export const MenstrualHistorySchema = z.object({
  menarche_age: z.number().int().min(8).max(20).optional().nullable(),
  cycle_length: z.number().int().min(1).max(180).optional().nullable(),
  cycle_length_max: z.number().int().min(1).max(180).optional().nullable(),
  flow_duration: z.number().int().min(1).max(30).optional().nullable(),
  flow_severity: z.string().optional().nullable(),
  lmp_date: z.string().optional().nullable(),
  dysmenorrhea_severity: z.string().optional().nullable(),
  dysmenorrhea_vas: z.number().int().min(0).max(10).optional().nullable(),
  pms_pmdd: z.string().optional().nullable(),
  intermenstrual_bleeding: z.boolean().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const SexualHistorySchema = z.object({
  is_active: z.boolean().optional().nullable(),
  partners_count: z.number().int().min(0).optional().nullable(),
  dyspareunia: z.string().optional().nullable(),
  dyspareunia_notes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const GynecologicalSurgerySchema = z.object({
  id: z.string().optional(),
  surgery_type: z.string().min(1),
  surgery_date: z.string().optional().nullable(),
  hospital: z.string().optional().nullable(),
  surgeon_name: z.string().optional().nullable(),
  indication: z.string().optional().nullable(),
  findings: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const ContraceptiveHistorySchema = z.object({
  id: z.string().optional(),
  method: z.string().min(1),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  is_current: z.boolean().optional().nullable(),
  reason_for_discontinuation: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const FamilyHistorySchema = z.object({
  id: z.string().optional(),
  relationship: z.string().min(1),
  condition: z.string().min(1),
  age_at_diagnosis: z.number().int().min(0).optional().nullable(),
  is_deceased: z.boolean().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const ReproductiveSummarySchema = z.object({
  gravida: z.number().int().min(0).optional().nullable(),
  para: z.number().int().min(0).optional().nullable(),
  abortions: z.number().int().min(0).optional().nullable(),
  ectopics: z.number().int().min(0).optional().nullable(),
  live_births: z.number().int().min(0).optional().nullable(),
  preterm_births: z.number().int().min(0).optional().nullable(),
  stillbirths: z.number().int().min(0).optional().nullable(),
  cesarean_sections: z.number().int().min(0).optional().nullable(),
  vaginal_deliveries: z.number().int().min(0).optional().nullable(),
})

export const ReproductiveHistoryBundleSchema = z.object({
  menstrual_history: MenstrualHistorySchema.optional().nullable(),
  sexual_history: SexualHistorySchema.optional().nullable(),
  surgeries: z.array(GynecologicalSurgerySchema).optional().nullable(),
  contraceptives: z.array(ContraceptiveHistorySchema).optional().nullable(),
  family_history: z.array(FamilyHistorySchema).optional().nullable(),
  reproductive_summary: ReproductiveSummarySchema.optional().nullable(),
})

export type MenstrualHistoryDto = z.infer<typeof MenstrualHistorySchema>
export type SexualHistoryDto = z.infer<typeof SexualHistorySchema>
export type GynecologicalSurgeryDto = z.infer<typeof GynecologicalSurgerySchema>
export type ContraceptiveHistoryDto = z.infer<typeof ContraceptiveHistorySchema>
export type FamilyHistoryDto = z.infer<typeof FamilyHistorySchema>
export type ReproductiveSummaryDto = z.infer<typeof ReproductiveSummarySchema>
export type ReproductiveHistoryBundleDto = z.infer<typeof ReproductiveHistoryBundleSchema>
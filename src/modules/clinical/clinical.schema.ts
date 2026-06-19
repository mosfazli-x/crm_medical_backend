import { z } from 'zod'

export const MenopauseScoringSchema = z.object({
  hot_flushes: z.number().int().min(0).max(4).default(0),
  night_sweats: z.number().int().min(0).max(4).default(0),
  sleep_disturbance: z.number().int().min(0).max(4).default(0),
  mood_swings: z.number().int().min(0).max(4).default(0),
  vaginal_dryness: z.number().int().min(0).max(4).default(0),
  reduced_libido: z.number().int().min(0).max(4).default(0),
  joint_pain: z.number().int().min(0).max(4).default(0),
  fatigue: z.number().int().min(0).max(4).default(0),
  urinary_frequency: z.number().int().min(0).max(4).default(0),
  anxiety: z.number().int().min(0).max(4).default(0),
})

export const BishopScoreSchema = z.object({
  cervical_dilation_cm: z.number().min(0).max(10),
  cervical_effacement_percent: z.number().min(0).max(100),
  cervical_consistency: z.enum(['firm', 'medium', 'soft']),
  cervical_position: z.enum(['posterior', 'mid', 'anterior']),
  fetal_station: z.number().min(-5).max(5),
})

export const BreastCancerRiskSchema = z.object({
  age: z.number().min(18).max(120),
  age_at_menarche: z.number().min(8).max(20),
  age_at_first_live_birth: z.number().min(0).max(60).optional().nullable(),
  family_history_breast_cancer: z.boolean().default(false),
  family_history_ovarian_cancer: z.boolean().default(false),
  previous_breast_biopsy: z.boolean().default(false),
  atypical_hyperplasia: z.boolean().default(false),
  brca_mutation: z.boolean().optional().nullable(),
  bmi: z.number().min(10).max(60).optional().nullable(),
  alcohol_use: z.boolean().optional().nullable(),
  hormone_therapy: z.boolean().optional().nullable(),
})

export const PcosRotterdamSchema = z.object({
  oligo_anovulation: z.boolean().default(false),
  clinical_hyperandrogenism: z.boolean().default(false),
  biochemical_hyperandrogenism: z.boolean().default(false),
  polycystic_ovaries_us: z.boolean().default(false),

  age: z.number().min(10).max(60).optional().nullable(),
  bmi: z.number().min(10).max(60).optional().nullable(),
  cycle_length_days: z.number().int().min(15).max(365).optional().nullable(),

  hirsutism: z.boolean().optional().nullable(),
  acne: z.boolean().optional().nullable(),
  alopecia: z.boolean().optional().nullable(),
  acanthosis_nigricans: z.boolean().optional().nullable(),

  testosterone_elevated: z.boolean().optional().nullable(),
  dheas_elevated: z.boolean().optional().nullable(),
  free_androgen_index_elevated: z.boolean().optional().nullable(),

  follicle_count_per_ovary: z.number().int().min(0).optional().nullable(),
  ovarian_volume_ml: z.number().min(0).optional().nullable(),

  excluded_cah: z.boolean().optional().nullable(),
  excluded_cushing: z.boolean().optional().nullable(),
  excluded_tumor: z.boolean().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type PcosRotterdamDto = z.infer<typeof PcosRotterdamSchema>
export type MenopauseScoringDto = z.infer<typeof MenopauseScoringSchema>
export type BishopScoreDto = z.infer<typeof BishopScoreSchema>
export type BreastCancerRiskDto = z.infer<typeof BreastCancerRiskSchema>
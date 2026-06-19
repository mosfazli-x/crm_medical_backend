import { z } from 'zod'

export const PrenatalVisitSchema = z.object({
  id: z.string().optional(),
  pregnancy_id: z.string(),
  gestational_age_weeks: z.number().int().min(0),
  gestational_age_days: z.number().int().min(0).max(6).optional().nullable(),
  visit_date: z.string().min(1),
  blood_pressure_systolic: z.number().int().optional().nullable(),
  blood_pressure_diastolic: z.number().int().optional().nullable(),
  weight_kg: z.number().optional().nullable(),
  fundal_height_cm: z.number().optional().nullable(),
  fetal_heart_rate: z.number().int().optional().nullable(),
  urine_protein: z.string().optional().nullable(),
  urine_glucose: z.string().optional().nullable(),
  presentation: z.string().optional().nullable(),
  engaged: z.boolean().optional().nullable(),
  cervical_dilation: z.number().optional().nullable(),
  cervical_effacement: z.number().int().optional().nullable(),
  contractions: z.string().optional().nullable(),
  edema: z.string().optional().nullable(),
  varicose_veins: z.boolean().optional().nullable(),
  fetal_movements: z.string().optional().nullable(),
  lab_tests_ordered: z.array(z.string()).optional().nullable(),
  medications_prescribed: z.array(z.object({
    name: z.string(),
    dosage: z.string().optional(),
  })).optional().nullable(),
  notes: z.string().optional().nullable(),
  plan: z.string().optional().nullable(),
})

export const FetalMeasurementSchema = z.object({
  id: z.string().optional(),
  pregnancy_id: z.string(),
  prenatal_visit_id: z.string().optional().nullable(),
  measurement_date: z.string().min(1),
  gestational_age_weeks: z.number().int().optional().nullable(),
  gestational_age_days: z.number().int().optional().nullable(),
  biparietal_diameter_mm: z.number().optional().nullable(),
  femur_length_mm: z.number().optional().nullable(),
  abdominal_circumference_mm: z.number().optional().nullable(),
  head_circumference_mm: z.number().optional().nullable(),
  estimated_fetal_weight_g: z.number().optional().nullable(),
  amniotic_fluid_index: z.number().optional().nullable(),
  placenta_position: z.string().optional().nullable(),
  placenta_grade: z.string().optional().nullable(),
  umbilical_artery_pi: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const PostpartumCarePlanSchema = z.object({
  id: z.string().optional(),
  pregnancy_id: z.string(),
  patient_id: z.string(),
  ppd_screening_date: z.string().optional().nullable(),
  epds_score: z.number().int().min(0).max(30).optional().nullable(),
  breastfeeding_status: z.string().optional().nullable(),
  breastfeeding_challenges: z.string().optional().nullable(),
  contraception_counseling: z.boolean().optional().nullable(),
  contraception_method: z.string().optional().nullable(),
  perineal_wound_healing: z.string().optional().nullable(),
  cs_wound_healing: z.string().optional().nullable(),
  lochia_status: z.string().optional().nullable(),
  mood_assessment: z.string().optional().nullable(),
  follow_up_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type PrenatalVisitDto = z.infer<typeof PrenatalVisitSchema>
export type FetalMeasurementDto = z.infer<typeof FetalMeasurementSchema>
export type PostpartumCarePlanDto = z.infer<typeof PostpartumCarePlanSchema>
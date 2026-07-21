import { z } from 'zod'

export const CreatePatientSchema = z.object({
  patient: z.object({
    first_name: z.string().min(2, 'First name must be at least 2 characters'),
    last_name: z.string().min(2, 'Last name must be at least 2 characters'),
    national_id: z.string().length(10, 'National ID must be exactly 10 digits'),
    insurance_code: z.string().optional().nullable(),
    insurance_type: z.enum(['social_security', 'health', 'armed_forces', 'relief_committee', 'iran', 'supplementary', 'other']).optional().nullable(),
    birth_date: z.string().nullable().optional(),
    phone: z.string().regex(/^09\d{9}$/).optional().or(z.literal('')),
    address: z.string().optional().nullable(),
    marital_status: z.string().optional().nullable(),
    smoking: z.string().optional().nullable(),
    bmi: z.number().positive().optional().nullable(),
    exercise: z.string().optional().nullable(),
    alcohol: z.string().optional().nullable(),
    confidential_notes: z.string().optional().nullable(),
    diseases: z.array(z.object({
      name: z.string().min(1),
      diagnosed_at: z.string().nullable().optional(),
    })).optional().default([]),
    medications: z.array(z.object({
      name: z.string().min(1),
      dosage: z.string().optional().nullable(),
    })).optional().default([]),
    allergies: z.array(z.object({
      substance: z.string().min(1),
      severity: z.enum(['\u062E\u0641\u06CC\u0641', '\u0645\u062A\u0648\u0633\u0637', '\u0634\u062F\u06CC\u062F']).optional().default('\u0645\u062A\u0648\u0633\u0637'),
    })).optional().default([]),
    pregnancies: z.array(z.object({
      gravida_index: z.number().int().nullable().optional(),
      status: z.string().optional(),
      lmp: z.string().nullable().optional(),
      edd: z.string().nullable().optional(),
      end_date: z.string().nullable().optional(),
      gestational_age_weeks: z.number().int().nullable().optional(),
      gestational_age_days: z.number().int().nullable().optional(),
      outcome: z.string().nullable().optional(),
      delivery_method: z.string().nullable().optional(),
      anesthesia_type: z.string().nullable().optional(),
      maternal_complications: z.array(z.object({
        title: z.string(),
        severity: z.string().optional(),
        onset_date: z.string().optional(),
        notes: z.string().optional(),
      })).optional().default([]),
      prenatal_screenings: z.record(z.boolean()).optional().default({}),
      newborns_details: z.array(z.object({
        gender: z.string().optional(),
        weight: z.number().nullable().optional(),
        height: z.number().nullable().optional(),
        head_circumference: z.number().nullable().optional(),
        apgar1: z.number().nullable().optional(),
        apgar5: z.number().nullable().optional(),
        nicu: z.boolean().optional(),
      })).optional().default([]),
      notes: z.string().nullable().optional(),
    })).optional().default([]),
  }),
})

export const UpdatePatientSchema = z.object({
  patient: z.object({
    first_name: z.string().min(2).optional(),
    last_name: z.string().min(2).optional(),
    national_id: z.string().length(10).optional(),
    insurance_code: z.string().optional().nullable(),
    insurance_type: z.enum(['social_security', 'health', 'armed_forces', 'relief_committee', 'iran', 'supplementary', 'other']).optional().nullable(),
    birth_date: z.string().nullable().optional(),
    phone: z.string().regex(/^09\d{9}$/).optional().or(z.literal('')),
    address: z.string().optional().nullable(),
    marital_status: z.string().optional().nullable(),
    smoking: z.string().optional().nullable(),
    bmi: z.number().positive().optional().nullable(),
    exercise: z.string().optional().nullable(),
    alcohol: z.string().optional().nullable(),
    confidential_notes: z.string().optional().nullable(),
    diseases: z.array(z.object({
      id: z.string().optional(),
      name: z.string().min(1),
      diagnosed_at: z.string().nullable().optional(),
    })).optional(),
    medications: z.array(z.object({
      id: z.string().optional(),
      name: z.string().min(1),
      dosage: z.string().optional().nullable(),
    })).optional(),
    allergies: z.array(z.object({
      id: z.string().optional(),
      substance: z.string().min(1),
      severity: z.string().optional(),
    })).optional(),
    pregnancies: z.array(z.object({
      id: z.string().optional(),
      gravida_index: z.number().int().nullable().optional(),
      status: z.string().optional(),
      lmp: z.string().nullable().optional(),
      edd: z.string().nullable().optional(),
      end_date: z.string().nullable().optional(),
      gestational_age_weeks: z.number().int().nullable().optional(),
      gestational_age_days: z.number().int().nullable().optional(),
      outcome: z.string().nullable().optional(),
      delivery_method: z.string().nullable().optional(),
      anesthesia_type: z.string().nullable().optional(),
      maternal_complications: z.array(z.object({
        title: z.string(),
        severity: z.string().optional(),
        onset_date: z.string().optional(),
        notes: z.string().optional(),
      })).optional().default([]),
      prenatal_screenings: z.record(z.boolean()).optional().default({}),
      newborns_details: z.array(z.object({
        gender: z.string().optional(),
        weight: z.number().nullable().optional(),
        height: z.number().nullable().optional(),
        head_circumference: z.number().nullable().optional(),
        apgar1: z.number().nullable().optional(),
        apgar5: z.number().nullable().optional(),
        nicu: z.boolean().optional(),
      })).optional().default([]),
      notes: z.string().nullable().optional(),
    })).optional(),
  }),
})

export const SendSmsSchema = z.object({
  phone: z.string().regex(/^09\d{9}$/, 'Phone must be a valid Iranian mobile number'),
  text: z.string().min(1, 'Message text is required').max(1000, 'Message text must not exceed 1000 characters'),
})

export const SearchPatientsSchema = z.object({
  q: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  national_id: z.string().optional(),
})

export const PatientSelfUpdateSchema = z.object({
  first_name: z.string().min(2).optional(),
  last_name: z.string().min(2).optional(),
  insurance_code: z.string().optional().nullable(),
  insurance_type: z.enum(['social_security', 'health', 'armed_forces', 'relief_committee', 'iran', 'supplementary', 'other']).optional().nullable(),
  birth_date: z.string().nullable().optional(),
  phone: z.string().regex(/^09\d{9}$/).optional().or(z.literal('')),
  address: z.string().optional().nullable(),
  marital_status: z.string().optional().nullable(),
  smoking: z.string().optional().nullable(),
  bmi: z.number().positive().optional().nullable(),
  exercise: z.string().optional().nullable(),
  alcohol: z.string().optional().nullable(),
})

export type CreatePatientDto = z.infer<typeof CreatePatientSchema>
export type UpdatePatientDto = z.infer<typeof UpdatePatientSchema>
export type PatientSelfUpdateDto = z.infer<typeof PatientSelfUpdateSchema>
export type SendSmsDto = z.infer<typeof SendSmsSchema>
export type SearchPatientsDto = z.infer<typeof SearchPatientsSchema>

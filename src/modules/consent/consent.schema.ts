import { z } from 'zod'

export const ConsentRecordSchema = z.object({
  id: z.string().optional(),
  patient_id: z.string(),
  consent_type: z.enum([
    'treatment_consent',
    'data_sharing',
    'procedure_consent',
    'anesthesia_consent',
    'research_participation',
    'photo_documentation',
    'contraception_counseling',
    'hiv_testing',
    'genetic_testing',
    'abortion_care',
    'minor_confidential_care',
    'telemedicine',
    'other',
  ]),
  is_granted: z.boolean().optional(),
  expires_at: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type ConsentRecordDto = z.infer<typeof ConsentRecordSchema>
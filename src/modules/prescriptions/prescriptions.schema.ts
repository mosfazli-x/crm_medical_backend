import { z } from 'zod'

export const CreatePrescriptionSchema = z.object({
  patient_id: z.string().uuid(),
  visit_id: z.string().uuid().optional().nullable(),
  medication_name: z.string().min(1, 'Medication name is required').max(255),
  dosage: z.string().min(1, 'Dosage is required').max(100),
  frequency: z.string().max(100).optional(),
  route: z.string().max(50).optional(),
  duration: z.string().max(100).optional(),
  quantity: z.number().int().positive().optional(),
  refills: z.number().int().min(0).default(0),
  instructions: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
})

export const UpdatePrescriptionSchema = z.object({
  medication_name: z.string().min(1).max(255).optional(),
  dosage: z.string().min(1).max(100).optional(),
  frequency: z.string().max(100).optional().nullable(),
  route: z.string().max(50).optional().nullable(),
  duration: z.string().max(100).optional().nullable(),
  quantity: z.number().int().positive().optional().nullable(),
  refills: z.number().int().min(0).optional(),
  instructions: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  discontinued_reason: z.string().optional().nullable(),
})

export type CreatePrescriptionDto = z.infer<typeof CreatePrescriptionSchema>
export type UpdatePrescriptionDto = z.infer<typeof UpdatePrescriptionSchema>

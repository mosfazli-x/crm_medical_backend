import { z } from 'zod'

export const CreateVisitSchema = z.object({
  patientId: z.string().uuid('Invalid patient ID'),
  visitDate: z.string().datetime('Invalid date format'),
  visitType: z.string().optional().nullable(),
  visitReason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  durationMinutes: z.number().int().min(15).optional().default(30),
})

export const UpdateVisitSchema = z.object({
  patientId: z.string().uuid('Invalid patient ID').optional(),
  visitDate: z.string().datetime('Invalid date format').optional(),
  visitType: z.string().optional().nullable(),
  visitReason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  durationMinutes: z.number().int().min(15).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
})

export type CreateVisitDto = z.infer<typeof CreateVisitSchema>
export type UpdateVisitDto = z.infer<typeof UpdateVisitSchema>

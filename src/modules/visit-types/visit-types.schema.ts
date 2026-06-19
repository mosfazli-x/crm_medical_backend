import { z } from 'zod'

export const CreateVisitTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  durationMinutes: z.number().int().min(5).max(480).default(30),
  price: z.number().positive().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').optional(),
})

export const UpdateVisitTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  price: z.number().positive().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').optional(),
  isActive: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
})

export type CreateVisitTypeDto = z.infer<typeof CreateVisitTypeSchema>
export type UpdateVisitTypeDto = z.infer<typeof UpdateVisitTypeSchema>

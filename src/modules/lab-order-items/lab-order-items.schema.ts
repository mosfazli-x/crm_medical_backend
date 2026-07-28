import { z } from 'zod'

export const CreateLabOrderItemSchema = z.object({
  lab_order_id: z.string().uuid(),
  test_name: z.string().min(1),
  test_code: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const UpdateLabOrderItemSchema = z.object({
  test_name: z.string().min(1).optional(),
  test_code: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type CreateLabOrderItemDto = z.infer<typeof CreateLabOrderItemSchema>
export type UpdateLabOrderItemDto = z.infer<typeof UpdateLabOrderItemSchema>

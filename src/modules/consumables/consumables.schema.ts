import { z } from 'zod'

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/

export const ConsumableItemSchema = z.object({
  name: z.string().trim().min(1).max(150),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
})

export const ConsumableExpenseSchema = z.object({
  item_id: z.string().uuid(),
  amount: z.coerce.number().min(0),
  notes: z.string().trim().max(500).optional().nullable(),
})

export const BulkUpsertExpensesSchema = z.object({
  month: z.string().regex(MONTH_REGEX, 'Invalid month format (expected YYYY-MM)'),
  items: z.array(ConsumableExpenseSchema).max(300),
})

export const ListMonthQuerySchema = z.object({
  month: z.string().regex(MONTH_REGEX, 'Invalid month format (expected YYYY-MM)'),
})

export type ConsumableItemDto = z.infer<typeof ConsumableItemSchema>
export type ConsumableExpenseDto = z.infer<typeof ConsumableExpenseSchema>
export type BulkUpsertExpensesDto = z.infer<typeof BulkUpsertExpensesSchema>

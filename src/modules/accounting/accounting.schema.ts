import { z } from 'zod'

export const AccountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  parent_id: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
})

export const JournalEntryLineSchema = z.object({
  account_id: z.string().uuid(),
  debit: z.number().min(0).optional().default(0),
  credit: z.number().min(0).optional().default(0),
  description: z.string().optional().nullable(),
})

export const JournalEntrySchema = z.object({
  entry_date: z.string(),
  description: z.string().min(1),
  reference: z.string().optional().nullable(),
  reference_type: z.string().optional().nullable(),
  lines: z.array(JournalEntryLineSchema).min(2, 'Journal entry must have at least 2 lines'),
})

export const ReportQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly', 'annual', 'custom']).default('monthly'),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  account_type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']).optional(),
  account_id: z.string().uuid().optional(),
})

export const TrialBalanceQuerySchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
})

export type AccountDto = z.infer<typeof AccountSchema>
export type JournalEntryDto = z.infer<typeof JournalEntrySchema>
export type JournalEntryLineDto = z.infer<typeof JournalEntryLineSchema>
export type ReportQueryDto = z.infer<typeof ReportQuerySchema>

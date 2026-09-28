import { z } from 'zod'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const COLOR_REGEX = /^#[0-9a-f]{6}$/i
const MAX_POSTGRES_BIGINT = 9223372036854775807n

function isCalendarDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime())
    && date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

function validateDateRange(value: { from?: string; to?: string }, ctx: z.RefinementCtx) {
  if (value.from && value.to && value.from > value.to) {
    ctx.addIssue({
      code: 'custom',
      path: ['from'],
      message: 'The start date must not be after the end date',
    })
  }
}

const DateStringSchema = z.string().regex(DATE_REGEX).refine(isCalendarDate, 'Invalid calendar date')
const MonthStringSchema = z.string().regex(MONTH_REGEX).refine((value) => Number(value.slice(0, 4)) > 0, 'Invalid month')

const RialInputSchema = z.union([
  z.string().regex(/^\d{1,19}$/, 'Amount must be an integer'),
  z.number().int().safe(),
  z.bigint(),
]).transform((value) => typeof value === 'bigint' ? value : BigInt(value))
  .refine((value) => value <= MAX_POSTGRES_BIGINT, 'Amount is too large')

const PositiveRialInputSchema = RialInputSchema.refine((value) => value > 0n, 'Amount must be greater than zero')
const NonNegativeRialInputSchema = RialInputSchema.refine((value) => value >= 0n, 'Amount cannot be negative')

const OptionalText = z.string().trim().max(2000).nullable().optional()

export const CashbookKindSchema = z.enum(['income', 'expense'])
export const CashbookStatusSchema = z.enum(['active', 'voided'])

export const CashbookCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: CashbookKindSchema,
  color: z.string().regex(COLOR_REGEX).nullable().optional(),
  isArchived: z.boolean().optional(),
})

export const UpdateCashbookCategorySchema = CashbookCategorySchema.partial()

const CashbookAccountFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(['cash', 'bank', 'card', 'other']),
  openingBalanceRial: NonNegativeRialInputSchema,
  isArchived: z.boolean().optional(),
})

export const CashbookAccountSchema = CashbookAccountFieldsSchema.extend({
  type: z.enum(['cash', 'bank', 'card', 'other']).default('cash'),
  openingBalanceRial: NonNegativeRialInputSchema.default(0n),
})

export const UpdateCashbookAccountSchema = CashbookAccountFieldsSchema.partial()

export const CreateCashbookEntrySchema = z.object({
  entryDate: DateStringSchema,
  kind: CashbookKindSchema,
  amountRial: PositiveRialInputSchema,
  categoryId: z.string().uuid(),
  accountId: z.string().uuid(),
  description: z.string().trim().min(1).max(500),
  notes: OptionalText,
  reference: z.string().trim().max(100).nullable().optional(),
})

export const UpdateCashbookEntrySchema = CreateCashbookEntrySchema.partial()

export const VoidCashbookEntrySchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export const CashbookBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  month: MonthStringSchema,
  amountRial: PositiveRialInputSchema,
})

export const CashbookListQuerySchema = z.object({
  from: DateStringSchema.optional(),
  to: DateStringSchema.optional(),
  kind: CashbookKindSchema.optional(),
  status: CashbookStatusSchema.optional(),
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  userId: z.string().uuid().optional(),
}).superRefine(validateDateRange)

export const CashbookOwnerQuerySchema = z.object({
  userId: z.string().uuid().optional(),
})

export const CashbookResourceQuerySchema = CashbookOwnerQuerySchema.extend({
  includeArchived: z.enum(['true', 'false']).optional().transform((value) => value === 'true'),
})

const CashbookSummaryFieldsSchema = z.object({
  from: DateStringSchema.optional(),
  to: DateStringSchema.optional(),
  month: MonthStringSchema.optional(),
  userId: z.string().uuid().optional(),
})

export const CashbookSummaryQuerySchema = CashbookSummaryFieldsSchema.superRefine(validateDateRange)

export const CashbookExportQuerySchema = CashbookSummaryFieldsSchema.extend({
  kind: CashbookKindSchema.optional(),
  status: CashbookStatusSchema.optional(),
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
  format: z.enum(['xlsx', 'csv']).default('xlsx'),
}).superRefine(validateDateRange)

export const CashbookIdSchema = z.string().uuid()

export const CashbookMonthSchema = MonthStringSchema

export type CashbookKind = z.infer<typeof CashbookKindSchema>
export type CashbookStatus = z.infer<typeof CashbookStatusSchema>
export type CashbookCategoryDto = z.infer<typeof CashbookCategorySchema>
export type UpdateCashbookCategoryDto = z.infer<typeof UpdateCashbookCategorySchema>
export type CashbookAccountDto = z.infer<typeof CashbookAccountSchema>
export type UpdateCashbookAccountDto = z.infer<typeof UpdateCashbookAccountSchema>
export type CreateCashbookEntryDto = z.infer<typeof CreateCashbookEntrySchema>
export type UpdateCashbookEntryDto = z.infer<typeof UpdateCashbookEntrySchema>
export type CashbookBudgetDto = z.infer<typeof CashbookBudgetSchema>
export type CashbookListQuery = z.infer<typeof CashbookListQuerySchema>
export type CashbookSummaryQuery = z.infer<typeof CashbookSummaryQuerySchema>
export type CashbookExportQuery = z.infer<typeof CashbookExportQuerySchema>

export { MONTH_REGEX, UUID_REGEX }

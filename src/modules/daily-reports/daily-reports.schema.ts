import { z } from 'zod'

export const PROCEDURE_KEYS = ['mixed_laser', 'single_laser', 'colonoscopy', 'co2_test', 'other'] as const

export const PAYMENT_METHODS = ['card_terminal', 'cash'] as const

export const SHEET_CATEGORIES = ['visit', 'mixed_laser', 'single_laser', 'colposcopy', 'co_test', 'miscellaneous'] as const

const SheetDateSchema = z.iso.date().refine((value) => !value.startsWith('0000-'), 'Invalid calendar date')
const SheetAmountSchema = z.number().min(0).max(9999999999.99).refine(
  (value) => /^\d+(\.\d{1,2})?$/.test(String(value)),
  'Amount must have at most two decimal places'
)

export const DailyReportSheetQuerySchema = z.object({ date: SheetDateSchema })
export const DailyReportSheetParamsSchema = z.object({ id: z.string().uuid('Invalid sheet row ID') })
export const PutDailyReportSheetRowSchema = z.object({
  reportDate: SheetDateSchema,
  patientId: z.string().uuid('Invalid patient ID'),
  visitType: z.string().trim().min(1).max(100),
  category: z.enum(SHEET_CATEGORIES),
  bankAmount: SheetAmountSchema,
  posAmount: SheetAmountSchema,
  cashAmount: SheetAmountSchema,
})

export type PutDailyReportSheetRowDto = z.infer<typeof PutDailyReportSheetRowSchema>

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const CreateDailyReportSchema = z.object({
  reportDate: z.string().regex(DATE_REGEX, 'Invalid date format (YYYY-MM-DD)'),
  patientId: z.string().uuid('Invalid patient ID'),
  visitTypes: z.array(z.string().min(1).max(100)).max(50).default([]),
  procedures: z.array(z.enum(PROCEDURE_KEYS)).max(10).default([]),
  otherProcedureText: z.string().max(500).optional().nullable(),
  feeCollected: z.number().min(0).optional().nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).default('cash'),
  notes: z.string().max(2000).optional().nullable(),
})

export const ListDailyReportsQuerySchema = z.object({
  reportDate: z.string().regex(DATE_REGEX, 'Invalid date format (YYYY-MM-DD)').optional(),
  from: z.string().regex(DATE_REGEX, 'Invalid date format (YYYY-MM-DD)').optional(),
  to: z.string().regex(DATE_REGEX, 'Invalid date format (YYYY-MM-DD)').optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  procedure: z.enum(PROCEDURE_KEYS).optional(),
  visitType: z.string().max(100).optional(),
  patientId: z.string().uuid().optional(),
})

export const DailyReportsStatsQuerySchema = z.object({
  from: z.string().regex(DATE_REGEX, 'Invalid date format (YYYY-MM-DD)').optional(),
  to: z.string().regex(DATE_REGEX, 'Invalid date format (YYYY-MM-DD)').optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  procedure: z.enum(PROCEDURE_KEYS).optional(),
  visitType: z.string().max(100).optional(),
  patientId: z.string().uuid().optional(),
})

export const CreateDailyReportVisitTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional().nullable(),
  price: z.number().min(0).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').optional().nullable(),
})

export const UpdateDailyReportVisitTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  price: z.number().min(0).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').optional().nullable(),
  isActive: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
})

export const DailyReportVisitTypeQuerySchema = z.object({
  includeInactive: z.enum(['true', 'false']).optional(),
})

export type CreateDailyReportDto = z.infer<typeof CreateDailyReportSchema>
export type ListDailyReportsQueryDto = z.infer<typeof ListDailyReportsQuerySchema>
export type DailyReportsStatsQueryDto = z.infer<typeof DailyReportsStatsQuerySchema>
export type CreateDailyReportVisitTypeDto = z.infer<typeof CreateDailyReportVisitTypeSchema>
export type UpdateDailyReportVisitTypeDto = z.infer<typeof UpdateDailyReportVisitTypeSchema>
export type DailyReportVisitTypeQueryDto = z.infer<typeof DailyReportVisitTypeQuerySchema>

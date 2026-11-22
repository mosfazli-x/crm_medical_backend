import { z } from 'zod'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const MAX_POSTGRES_BIGINT = 9223372036854775807n

const RialInputSchema = z.union([
  z.string().regex(/^\d{1,19}$/, 'Amount must be an integer'),
  z.number().int().safe(),
  z.bigint(),
]).transform((value) => (typeof value === 'bigint' ? value : BigInt(value)))
  .refine((value) => value > 0n && value <= MAX_POSTGRES_BIGINT, 'Amount must be a positive integer')

export const SmsMessageInputSchema = z.object({
  /** Device-generated id, used to make retries idempotent. */
  clientId: z.string().trim().min(1).max(120).optional(),
  sender: z.string().trim().max(120).optional().nullable(),
  text: z.string().trim().min(1).max(2000),
  receivedAt: z.coerce.date().optional(),
})

export const IngestSmsSchema = z.object({
  messages: z.array(SmsMessageInputSchema).min(1).max(50),
})

export const PasteSmsSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  sender: z.string().trim().max(120).optional(),
  sourceId: z.string().uuid().optional(),
})

export const FinanceChannelSchema = z.enum(['sms', 'android_app', 'ios_shortcut', 'manual', 'bank_api'])
export const FinancePlatformSchema = z.enum(['android', 'ios', 'web', 'unknown'])
export const FinanceMessageStatusSchema = z.enum(['posted', 'review', 'duplicate', 'ignored', 'failed'])

export const CreateSourceSchema = z.object({
  label: z.string().trim().min(1).max(120),
  bankCode: z.string().trim().min(1).max(40),
  channel: FinanceChannelSchema.default('sms'),
  senderPatterns: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  cardLast4: z.string().regex(/^\d{4}$/, 'cardLast4 must be four digits').nullable().optional(),
  accountId: z.string().uuid(),
  incomeCategoryId: z.string().uuid().nullable().optional(),
  expenseCategoryId: z.string().uuid().nullable().optional(),
  autoPost: z.boolean().default(true),
  isActive: z.boolean().default(true),
})

export const UpdateSourceSchema = CreateSourceSchema.partial()

export const CreateTokenSchema = z.object({
  label: z.string().trim().min(1).max(120),
  platform: FinancePlatformSchema.default('unknown'),
})

export const MessageListQuerySchema = z.object({
  status: FinanceMessageStatusSchema.optional(),
  direction: z.enum(['income', 'expense']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const ApproveMessageSchema = z.object({
  kind: z.enum(['income', 'expense']).optional(),
  amountRial: RialInputSchema.optional(),
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  entryDate: z.string().regex(DATE_REGEX).optional(),
  description: z.string().trim().min(1).max(500).optional(),
})

export const FinanceIdSchema = z.string().uuid()

export type SmsMessageInput = z.infer<typeof SmsMessageInputSchema>
export type IngestSmsDto = z.infer<typeof IngestSmsSchema>
export type PasteSmsDto = z.infer<typeof PasteSmsSchema>
export type CreateSourceDto = z.infer<typeof CreateSourceSchema>
export type UpdateSourceDto = z.infer<typeof UpdateSourceSchema>
export type CreateTokenDto = z.infer<typeof CreateTokenSchema>
export type MessageListQuery = z.infer<typeof MessageListQuerySchema>
export type ApproveMessageDto = z.infer<typeof ApproveMessageSchema>

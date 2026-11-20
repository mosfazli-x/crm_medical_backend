import { z } from 'zod'

/** JavaScript getDay() convention: 0 = Sunday, 1 = Monday, …, 6 = Saturday. */
export const DAYS_OF_WEEK_LABELS: Record<number, string> = {
  0: 'یک‌شنبه',
  1: 'دوشنبه',
  2: 'سه‌شنبه',
  3: 'چهارشنبه',
  4: 'پنج‌شنبه',
  5: 'جمعه',
  6: 'شنبه',
}

export const DAYS_OF_WEEK = z.array(
  z.number().int().min(0).max(6, 'Day of week must be between 0 (Sunday) and 6 (Saturday)')
).nonempty('At least one day of week is required')

export const CreateSmsBroadcastSchema = z
  .object({
    name: z.string().min(2, 'Broadcast name must be at least 2 characters').max(150),
    message: z.string().min(1, 'Message text is required').max(2000, 'Message text must not exceed 2000 characters'),
    targetType: z.enum(['all', 'specific']).default('all'),
    targetPatientIds: z.array(z.string().uuid()).optional().default([]),
    daysOfWeek: DAYS_OF_WEEK.default([0, 2]),
    hour: z.coerce.number().int().min(0).max(23).default(9),
    minute: z.coerce.number().int().min(0).max(59).default(0),
  })
  .superRefine((value, ctx) => {
    if (value.targetType === 'specific' && value.targetPatientIds.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetPatientIds'],
        message: 'At least one patient must be selected for a specific broadcast',
      })
    }
  })

export const UpdateSmsBroadcastSchema = z
  .object({
    name: z.string().min(2).max(150).optional(),
    message: z.string().min(1).max(2000).optional(),
    targetType: z.enum(['all', 'specific']).optional(),
    targetPatientIds: z.array(z.string().uuid()).optional(),
    daysOfWeek: DAYS_OF_WEEK.optional(),
    hour: z.coerce.number().int().min(0).max(23).optional(),
    minute: z.coerce.number().int().min(0).max(59).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.targetType === 'specific' && value.targetPatientIds?.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetPatientIds'],
        message: 'At least one patient must be selected for a specific broadcast',
      })
    }
  })

export const RunSmsBroadcastSchema = z.object({
  /**
   * Manual "send now" runs may explicitly re-send on a day the scheduler has
   * already executed. Scheduled runs never set this.
   */
  force: z.boolean().optional().default(false),
})

export const ListSmsBroadcastsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().max(100).optional(),
  isActive: z.preprocess(
    (val) => val === 'true' || val === '1' || val === true,
    z.boolean()
  ).optional(),
})

export type CreateSmsBroadcastDto = z.infer<typeof CreateSmsBroadcastSchema>
export type UpdateSmsBroadcastDto = z.infer<typeof UpdateSmsBroadcastSchema>
export type RunSmsBroadcastDto = z.infer<typeof RunSmsBroadcastSchema>
export type ListSmsBroadcastsQueryDto = z.infer<typeof ListSmsBroadcastsQuerySchema>

export interface SmsBroadcastRow {
  id: string
  name: string
  message: string
  targetType: 'all' | 'specific'
  targetPatientIds: string[] | null
  daysOfWeek: number[]
  hour: number
  minute: number
  isActive: boolean
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
  lastRunAt: Date | null
  nextRunAt: Date | null
  totalSent: number
  totalFailed: number
}

export interface SmsBroadcastLogRow {
  id: string
  broadcastId: string
  patientId: string
  sentAt: Date
  status: 'sent' | 'failed' | 'skipped'
  error: string | null
  phone: string | null
}

/** Why a manual/scheduled run did not deliver anything. */
export type SmsBroadcastRunReason = 'channel_disabled' | 'no_credit' | 'already_ran' | null

export interface SmsBroadcastRunResult {
  sent: number
  failed: number
  skipped: number
  recipientCount: number
  reason: SmsBroadcastRunReason
  forced: boolean
}

export interface SmsBroadcastRunStats {
  broadcasts: number
  sent: number
  failed: number
  skipped: number
}

export interface SmsBroadcastSummary {
  id: string
  name: string
  message: string
  targetType: 'all' | 'specific'
  targetPatientIds: string[] | null
  isActive: boolean
  daysOfWeek: number[]
  hour: number
  minute: number
  lastRunAt: Date | null
  nextRunAt: Date | null
  totalSent: number
  totalFailed: number
  recipientCount: number
}

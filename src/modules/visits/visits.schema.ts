import { z } from 'zod'
import { MAX_REMINDER_DAYS, MIN_REMINDER_DAYS } from './followup-window'

/**
 * A return/follow-up appointment date. The client posts an ISO timestamp; the
 * date picker sends `YYYY-MM-DD`, which Zod widens to midnight server-local.
 */
const NextVisitDateSchema = z.union([
  z.string().datetime({ offset: true, message: 'Invalid date format' }),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
])

const ReminderDaysSchema = z
  .number()
  .int()
  .min(MIN_REMINDER_DAYS)
  .max(MAX_REMINDER_DAYS)
  .nullable()
  .optional()

export const CreateVisitSchema = z.object({
  patientId: z.string().uuid('Invalid patient ID'),
  visitDate: z.string().datetime('Invalid date format'),
  visitType: z.string().optional().nullable(),
  visitReason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  durationMinutes: z.number().int().min(15).optional().default(30),
  /** Scheduled return date. Null/absent means this visit has no follow-up. */
  nextVisitDate: NextVisitDateSchema.nullable().optional(),
  /** Lead-time override; null falls back to the clinic-wide setting. */
  reminderDaysBefore: ReminderDaysSchema,
})

export const UpdateVisitSchema = z.object({
  patientId: z.string().uuid('Invalid patient ID').optional(),
  visitDate: z.string().datetime('Invalid date format').optional(),
  visitType: z.string().optional().nullable(),
  visitReason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  durationMinutes: z.number().int().min(15).optional(),
  nextVisitDate: NextVisitDateSchema.nullable().optional(),
  reminderDaysBefore: ReminderDaysSchema,
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
})

/** Query filters for the follow-up management list. */
export const FollowUpListQuerySchema = z.object({
  /**
   * - `overdue`  follow-up date already passed
   * - `today`    follow-up date is today
   * - `upcoming` future follow-up dates
   * - `pending`  not yet reminded (the operational work queue)
   * - `all`      every follow-up
   */
  window: z
    .enum(['overdue', 'today', 'upcoming', 'pending', 'all'])
    .optional()
    .default('pending'),
  /** Free-text match on patient first/last name or national ID. */
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export type CreateVisitDto = z.infer<typeof CreateVisitSchema>
export type UpdateVisitDto = z.infer<typeof UpdateVisitSchema>
export type FollowUpListQueryDto = z.infer<typeof FollowUpListQuerySchema>
export type FollowUpWindow = FollowUpListQueryDto['window']

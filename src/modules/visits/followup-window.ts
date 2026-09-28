/**
 * Pure follow-up reminder logic.
 *
 * Kept free of database and network access so the scheduling rules can be unit
 * tested deterministically (see `src/__tests__/followup-window.test.ts`).
 *
 * A follow-up visit scheduled for day D with a lead time of N days is reminded
 * on day D-N. All comparisons are done at calendar-day granularity: a reminder
 * is about a *day*, so the stored time-of-day must never change the outcome.
 */
import { dateToJalaliStr } from '../../shared/utils/date'

/** Lead time bounds. Guards against absurd values from bad settings or input. */
export const MIN_REMINDER_DAYS = 0
export const MAX_REMINDER_DAYS = 90

export const DEFAULT_REMINDER_DAYS = 3

/** Midnight (server local time) on the same calendar day as `date`. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * Calendar-day arithmetic. Using `setDate` keeps local-time semantics, so a DST
 * transition cannot shift the result onto the wrong day.
 */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Whole calendar days from `from` to `to` (negative when `to` is in the past). */
export function daysUntil(from: Date, to: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY)
}

/** Clamp a lead time into the supported range, substituting `fallback` for bad input. */
export function clampReminderDays(value: number | null | undefined, fallback: number): number {
  const base = typeof fallback === 'number' && Number.isFinite(fallback)
    ? Math.trunc(fallback)
    : DEFAULT_REMINDER_DAYS
  if (typeof value !== 'number' || !Number.isFinite(value)) return base
  const resolved = Math.trunc(value)
  if (resolved < MIN_REMINDER_DAYS) return MIN_REMINDER_DAYS
  if (resolved > MAX_REMINDER_DAYS) return MAX_REMINDER_DAYS
  return resolved
}

/**
 * Effective lead time for a visit: the per-visit override when present,
 * otherwise the clinic-wide default.
 */
export function resolveLeadDays(
  perVisitDays: number | null | undefined,
  clinicDefaultDays: number | null | undefined
): number {
  const clinicDefault =
    typeof clinicDefaultDays === 'number' && Number.isFinite(clinicDefaultDays)
      ? Math.trunc(clinicDefaultDays)
      : DEFAULT_REMINDER_DAYS
  return clampReminderDays(perVisitDays, clinicDefault)
}

/** The calendar day on which the reminder for `nextVisitDate` becomes due. */
export function reminderTargetDay(nextVisitDate: Date, leadDays: number): Date {
  return addDays(startOfDay(nextVisitDate), -clampReminderDays(leadDays, DEFAULT_REMINDER_DAYS))
}

export interface ReminderDecisionInput {
  /** Scheduled return date, or null when the visit has no follow-up. */
  nextVisitDate: Date | null
  /** Already-delivered marker; makes the sweep idempotent. */
  reminderSentAt: Date | null
  /** Effective lead time (already resolved via `resolveLeadDays`). */
  leadDays: number
  now?: Date
}

export type ReminderDecision =
  | { due: true; reason: 'due' }
  | { due: false; reason: 'no_followup' | 'already_sent' | 'past_due' | 'not_yet_due' }

/**
 * Decide whether a follow-up reminder should be sent right now.
 *
 * A reminder is due once its target day has arrived, but never once the visit
 * itself has already passed: reminding a patient about yesterday's appointment is
 * noise, and past-dated rows should not accumulate as permanently "pending".
 */
export function shouldSendReminder(input: ReminderDecisionInput): ReminderDecision {
  const { nextVisitDate, reminderSentAt, leadDays } = input
  const now = input.now ?? new Date()

  if (!nextVisitDate || Number.isNaN(nextVisitDate.getTime())) {
    return { due: false, reason: 'no_followup' }
  }
  if (reminderSentAt) {
    return { due: false, reason: 'already_sent' }
  }

  // The visit day itself has passed.
  if (daysUntil(now, nextVisitDate) < 0) {
    return { due: false, reason: 'past_due' }
  }

  const targetDay = reminderTargetDay(nextVisitDate, leadDays)
  if (daysUntil(now, targetDay) > 0) {
    return { due: false, reason: 'not_yet_due' }
  }

  return { due: true, reason: 'due' }
}

/**
 * Accepts either a full ISO timestamp or a bare `YYYY-MM-DD` date.
 *
 * A bare date is built with local-time components on purpose: `new Date(str)`
 * would parse it as UTC midnight, which lands on the previous calendar day in
 * negative-offset timezones and would silently shift a patient's return date.
 */
export function parseNextVisitDate(value: string | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const bareDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (bareDate) {
    const [, y, m, d] = bareDate
    return new Date(Number(y), Number(m) - 1, Number(d))
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Persian reminder SMS body. Kept short to stay within a single SMS segment. */
export function buildFollowUpReminderText({
  patientName,
  doctorName,
  nextVisitDate,
}: {
  patientName: string
  doctorName?: string | null
  nextVisitDate: Date
}): string {
  const jalaliDate = dateToJalaliStr(nextVisitDate)
  const time = `${String(nextVisitDate.getHours()).padStart(2, '0')}:${String(
    nextVisitDate.getMinutes()
  ).padStart(2, '0')}`
  const withDoctor = doctorName ? ` با ${doctorName}` : ''

  return [
    `${patientName} گرامی،`,
    `یادآوری می‌شود موعد مراجعه بعدی شما ${jalaliDate} ساعت ${time}${withDoctor} می‌باشد.`,
    'در صورت نیاز به هماهنگی، پیش از موعد با کلینیک تماس بگیرید.',
  ].join('\n')
}

import type { DB } from '../../db/client'
import { patients, users, visits } from '../../db/schema'
import { and, asc, eq, gte, ilike, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { NotFoundError } from '../../shared/errors'
// Deep imports, not the `shared/services` barrel: the barrel eagerly instantiates
// the audit service (and its DB pool) at import time, which would make this
// module unusable outside a live server.
import { notificationService } from '../../shared/services/notification.service'
import { smsService } from '../../shared/services/sms.service'
import { SettingsService } from '../settings/settings.service'
import type { CreateVisitDto, FollowUpListQueryDto, UpdateVisitDto } from './visits.schema'
import {
  DEFAULT_REMINDER_DAYS,
  MAX_REMINDER_DAYS,
  addDays,
  buildFollowUpReminderText,
  daysUntil,
  parseNextVisitDate,
  resolveLeadDays,
  shouldSendReminder,
  startOfDay,
} from './followup-window'

/** Setting key holding the clinic-wide reminder lead time, in days. */
export const FOLLOWUP_REMINDER_DAYS_SETTING = 'followup_reminder_days'
/** Notification event key used for the per-clinic follow-up toggle. */
export const FOLLOWUP_NOTIFICATION_EVENT = 'followup_reminder'
/** Upper bound on how many reminders a single sweep will attempt. */
const SWEEP_BATCH_LIMIT = 500

const FOLLOWUP_SELECT = {
  id: visits.id,
  patientId: visits.patientId,
  doctorId: visits.doctorId,
  patientFirstName: patients.firstName,
  patientLastName: patients.lastName,
  patientFullName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`.as('patient_full_name'),
  patientNationalId: patients.nationalId,
  patientPhone: patients.phone,
  doctorFullName: users.fullName,
  visitDate: visits.visitDate,
  visitType: visits.visitType,
  status: visits.status,
  nextVisitDate: visits.nextVisitDate,
  reminderDaysBefore: visits.reminderDaysBefore,
  reminderSentAt: visits.reminderSentAt,
} as const

export class VisitService {
  private readonly settings: SettingsService

  constructor(private db: DB) {
    this.settings = new SettingsService(db)
  }

  async getPatientList() {
    return this.db
      .select({
        id: patients.id,
        fullName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`.as('full_name'),
        nationalId: patients.nationalId,
      })
      .from(patients)
      .where(eq(patients.isDeleted, false))
      .orderBy(patients.lastName)
  }

  async getCalendarEvents() {
    const appointments = await this.db
      .select({
        id: visits.id,
        title: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`.as('full_name'),
        start: visits.visitDate,
        visitType: visits.visitType,
        notes: visits.notes,
        patientId: visits.patientId,
        durationMinutes: visits.durationMinutes,
        nextVisitDate: visits.nextVisitDate,
        reminderDaysBefore: visits.reminderDaysBefore,
        reminderSentAt: visits.reminderSentAt,
      })
      .from(visits)
      .innerJoin(patients, eq(visits.patientId, patients.id))
      .where(eq(patients.isDeleted, false))

    return appointments.map((apt) => {
      const start = apt.start
      const end = new Date(start.getTime() + (apt.durationMinutes || 30) * 60_000)

      return {
        id: apt.id,
        title: `${apt.visitType || 'Visit'} - ${apt.title}`,
        start: start.toISOString(),
        end: end.toISOString(),
        backgroundColor: getVisitColor(apt.visitType),
        borderColor: getVisitBorderColor(apt.visitType),
        textColor: '#ffffff',
        extendedProps: {
          patientId: apt.patientId,
          notes: apt.notes || '',
          type: apt.visitType || 'Visit',
          // Carried so the edit dialog can prefill the follow-up fields without
          // a second request.
          nextVisitDate: apt.nextVisitDate ? apt.nextVisitDate.toISOString() : null,
          reminderDaysBefore: apt.reminderDaysBefore,
          reminderSentAt: apt.reminderSentAt ? apt.reminderSentAt.toISOString() : null,
        },
      }
    })
  }

  async create(dto: CreateVisitDto) {
    const [newVisit] = await this.db
      .insert(visits)
      .values({
        patientId: dto.patientId,
        visitType: dto.visitType || '\u0648\u06CC\u0632\u06CC\u062A \u0627\u0648\u0644\u06CC\u0647',
        visitReason: dto.visitReason || null,
        notes: dto.notes || null,
        visitDate: new Date(dto.visitDate),
        durationMinutes: dto.durationMinutes,
        nextVisitDate: parseNextVisitDate(dto.nextVisitDate),
        reminderDaysBefore: dto.reminderDaysBefore ?? null,
      })
      .returning()

    return newVisit
  }

  async update(id: string, dto: UpdateVisitDto) {
    const updates: Record<string, unknown> = {}
    if (dto.patientId !== undefined) updates.patientId = dto.patientId
    if (dto.visitDate !== undefined) updates.visitDate = new Date(dto.visitDate)
    if (dto.visitType !== undefined) updates.visitType = dto.visitType ?? '\u0648\u06CC\u0632\u06CC\u062A \u0627\u0648\u0644\u06CC\u0647'
    if (dto.visitReason !== undefined) updates.visitReason = dto.visitReason
    if (dto.notes !== undefined) updates.notes = dto.notes
    if (dto.durationMinutes !== undefined) updates.durationMinutes = dto.durationMinutes
    if (dto.reminderDaysBefore !== undefined) updates.reminderDaysBefore = dto.reminderDaysBefore
    if (dto.nextVisitDate !== undefined) {
      updates.nextVisitDate = parseNextVisitDate(dto.nextVisitDate)
      // A moved follow-up date invalidates any reminder already sent for the old
      // date, so the row becomes eligible again. Only reset when the date really
      // changes, otherwise editing other fields could trigger a duplicate SMS.
      updates.reminderSentAt = null
    }

    const [updatedVisit] = await this.db
      .update(visits)
      .set(updates)
      .where(eq(visits.id, id))
      .returning()

    if (!updatedVisit) throw new NotFoundError('Visit')

    return updatedVisit
  }

  async delete(id: string) {
    const [deletedVisit] = await this.db
      .delete(visits)
      .where(eq(visits.id, id))
      .returning()

    if (!deletedVisit) throw new NotFoundError('Visit')

    return deletedVisit
  }

  /**
   * Single visit lookup, including the follow-up fields. The calendar view only
   * loads the events in its visible range, so deep links from the follow-ups
   * page need this to open the edit dialog for a visit outside that range.
   */
  async getById(id: string) {
    const [row] = await this.db
      .select({
        id: visits.id,
        patientId: visits.patientId,
        doctorId: visits.doctorId,
        visitDate: visits.visitDate,
        visitType: visits.visitType,
        status: visits.status,
        notes: visits.notes,
        durationMinutes: visits.durationMinutes,
        nextVisitDate: visits.nextVisitDate,
        reminderDaysBefore: visits.reminderDaysBefore,
        reminderSentAt: visits.reminderSentAt,
        patientFirstName: patients.firstName,
        patientLastName: patients.lastName,
      })
      .from(visits)
      .innerJoin(patients, eq(patients.id, visits.patientId))
      .where(eq(visits.id, id))
      .limit(1)

    if (!row) throw new NotFoundError('Visit')

    return {
      ...row,
      patientFullName: `${row.patientFirstName ?? ''} ${row.patientLastName ?? ''}`.trim(),
    }
  }

  // ── Follow-up reminders ──

  /** Clinic-wide lead time in days, falling back to the built-in default. */
  async getDefaultReminderDays(): Promise<number> {
    const stored = await this.settings.getNumericValue(FOLLOWUP_REMINDER_DAYS_SETTING)
    return resolveLeadDays(null, stored ?? DEFAULT_REMINDER_DAYS)
  }

  /**
   * Filtered, paginated follow-up list.
   *
   * `now` is injectable so the window calculations stay testable and so a single
   * request cannot straddle midnight and produce inconsistent `daysUntil` values.
   */
  async listFollowUps(dto: FollowUpListQueryDto, now = new Date()) {
    const today = startOfDay(now)
    const tomorrow = addDays(today, 1)
    const defaultDays = await this.getDefaultReminderDays()

    const conditions = [isNotNull(visits.nextVisitDate)]

    switch (dto.window) {
      case 'overdue':
        conditions.push(lt(visits.nextVisitDate, today))
        break
      case 'today':
        conditions.push(gte(visits.nextVisitDate, today), lt(visits.nextVisitDate, tomorrow))
        break
      case 'upcoming':
        conditions.push(gte(visits.nextVisitDate, tomorrow))
        break
      case 'pending':
        // The operational work queue: not yet reminded and still actionable.
        conditions.push(isNull(visits.reminderSentAt), gte(visits.nextVisitDate, today))
        break
      case 'all':
        break
    }

    if (dto.search) {
      const pattern = `%${dto.search}%`
      conditions.push(
        or(
          ilike(patients.firstName, pattern),
          ilike(patients.lastName, pattern),
          ilike(patients.nationalId, pattern),
          ilike(patients.phone, pattern)
        )!
      )
    }

    const where = and(...conditions)
    const offset = (dto.page - 1) * dto.limit

    const [rows, countResult] = await Promise.all([
      this.db
        .select(FOLLOWUP_SELECT)
        .from(visits)
        .innerJoin(patients, eq(visits.patientId, patients.id))
        .leftJoin(users, eq(visits.doctorId, users.id))
        .where(where)
        .orderBy(asc(visits.nextVisitDate))
        .limit(dto.limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(visits)
        .innerJoin(patients, eq(visits.patientId, patients.id))
        .where(where),
    ])

    const data = rows.map((row) => decorateFollowUp(row, defaultDays, now))

    return {
      data,
      total: countResult[0]?.count ?? 0,
      page: dto.page,
      limit: dto.limit,
      totalPages: Math.max(1, Math.ceil((countResult[0]?.count ?? 0) / dto.limit)),
    }
  }

  /**
   * Counts for the follow-up dashboard.
   *
   * `dueNow` is the number of pending reminders whose window has opened, and
   * `missingPhone` flags rows the clinic cannot actually reach — both are the
   * actionable numbers, so they are computed server-side.
   */
  async getFollowUpSummary(now = new Date()) {
    const today = startOfDay(now)
    const tomorrow = addDays(today, 1)
    const defaultDays = await this.getDefaultReminderDays()
    const maxWindow = addDays(today, MAX_REMINDER_DAYS)

    const base = isNotNull(visits.nextVisitDate)
    const pending = and(base, isNull(visits.reminderSentAt), gte(visits.nextVisitDate, today))

    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) FILTER (WHERE ${visits.reminderSentAt} IS NULL)::int`,
        overdue: sql<number>`count(*) FILTER (WHERE ${visits.nextVisitDate} < ${today})::int`,
        today: sql<number>`count(*) FILTER (WHERE ${visits.nextVisitDate} >= ${today} AND ${visits.nextVisitDate} < ${tomorrow})::int`,
        upcoming: sql<number>`count(*) FILTER (WHERE ${visits.nextVisitDate} >= ${tomorrow})::int`,
        sent: sql<number>`count(*) FILTER (WHERE ${visits.reminderSentAt} IS NOT NULL)::int`,
        missingPhone: sql<number>`count(*) FILTER (
          WHERE ${visits.reminderSentAt} IS NULL
            AND ${visits.nextVisitDate} >= ${today}
            AND ${patients.phone} IS NULL
        )::int`,
      })
      .from(visits)
      .innerJoin(patients, eq(visits.patientId, patients.id))
      .where(base)

    // Rows whose reminder window is open, evaluated in JS because the lead time
    // is a per-row override and cannot be expressed as a single SQL comparison.
    const candidates = await this.db
      .select({
        nextVisitDate: visits.nextVisitDate,
        reminderDaysBefore: visits.reminderDaysBefore,
      })
      .from(visits)
      .where(and(pending, lte(visits.nextVisitDate, maxWindow)))

    const dueNow = candidates.filter(
      (row) =>
        shouldSendReminder({
          nextVisitDate: row.nextVisitDate,
          reminderSentAt: null,
          leadDays: resolveLeadDays(row.reminderDaysBefore, defaultDays),
          now,
        }).due
    ).length

    return {
      total: row?.total ?? 0,
      pending: row?.pending ?? 0,
      overdue: row?.overdue ?? 0,
      today: row?.today ?? 0,
      upcoming: row?.upcoming ?? 0,
      sent: row?.sent ?? 0,
      dueNow,
      missingPhone: row?.missingPhone ?? 0,
      defaultReminderDays: defaultDays,
    }
  }

  /**
   * Deliver the reminder SMS for one follow-up and record the outcome.
   *
   * This is the only path that writes `reminder_sent_at`, so both the manual
   * endpoint and the scheduler share identical validation and failure handling.
   *
   * `force` is used by the manual resend: it bypasses the already-sent and
   * past-due guards, because a doctor explicitly asking to notify a patient is
   * always allowed — including for a follow-up whose date has already passed.
   */
  async sendFollowUpReminder(
    visitId: string,
    options: { force?: boolean; now?: Date } = {}
  ): Promise<{
    sent: boolean
    reason?: string
    reminderSentAt?: Date | null
    leadDays: number
  }> {
    const { force = false } = options
    const now = options.now ?? new Date()

    const [row] = await this.db
      .select(FOLLOWUP_SELECT)
      .from(visits)
      .innerJoin(patients, eq(visits.patientId, patients.id))
      .leftJoin(users, eq(visits.doctorId, users.id))
      .where(eq(visits.id, visitId))
      .limit(1)

    if (!row) throw new NotFoundError('Visit')

    const defaultDays = await this.getDefaultReminderDays()
    const leadDays = resolveLeadDays(row.reminderDaysBefore, defaultDays)

    if (!force) {
      const decision = shouldSendReminder({
        nextVisitDate: row.nextVisitDate,
        reminderSentAt: row.reminderSentAt,
        leadDays,
        now,
      })
      if (!decision.due) {
        return { sent: false, reason: decision.reason, reminderSentAt: row.reminderSentAt, leadDays }
      }
    }

    if (!row.nextVisitDate) {
      return { sent: false, reason: 'no_followup', reminderSentAt: row.reminderSentAt, leadDays }
    }

    if (!(await notificationService.isChannelEnabled(FOLLOWUP_NOTIFICATION_EVENT, 'sms'))) {
      return { sent: false, reason: 'disabled', reminderSentAt: row.reminderSentAt, leadDays }
    }

    // Checked before channel availability: a missing phone number is a permanent
    // data problem the clinic must fix, and reporting it is more actionable than
    // reporting the channel state.
    const phone = row.patientPhone?.trim()
    if (!phone) {
      return { sent: false, reason: 'no_phone', reminderSentAt: row.reminderSentAt, leadDays }
    }

    if (!(await smsService.isEnabled())) {
      return { sent: false, reason: 'sms_unavailable', reminderSentAt: row.reminderSentAt, leadDays }
    }

    const text = buildFollowUpReminderText({
      patientName: row.patientFullName,
      doctorName: row.doctorFullName,
      nextVisitDate: row.nextVisitDate,
    })

    const delivered = await smsService.send(phone, text)
    if (!delivered) {
      return { sent: false, reason: 'send_failed', reminderSentAt: row.reminderSentAt, leadDays }
    }

    const [updated] = await this.db
      .update(visits)
      .set({ reminderSentAt: now })
      .where(eq(visits.id, visitId))
      .returning({ reminderSentAt: visits.reminderSentAt })

    return { sent: true, reminderSentAt: updated?.reminderSentAt ?? now, leadDays }
  }

  /**
   * Daily sweep: notify every follow-up whose reminder window has opened.
   *
   * Idempotent — a reminder is only ever sent once because `reminder_sent_at` is
   * written on success and re-checked before every attempt. The candidate query
   * is bounded on both ends (no past rows, nothing beyond the maximum lead time)
   * so it can use the `next_visit_date` index.
   */
  async runFollowUpReminderSweep(now = new Date()) {
    const today = startOfDay(now)
    const defaultDays = await this.getDefaultReminderDays()
    const maxWindow = addDays(today, MAX_REMINDER_DAYS)

    const candidates = await this.db
      .select({
        id: visits.id,
        nextVisitDate: visits.nextVisitDate,
        reminderDaysBefore: visits.reminderDaysBefore,
      })
      .from(visits)
      .where(
        and(
          isNotNull(visits.nextVisitDate),
          isNull(visits.reminderSentAt),
          gte(visits.nextVisitDate, today),
          lte(visits.nextVisitDate, maxWindow)
        )
      )
      .orderBy(asc(visits.nextVisitDate))
      .limit(SWEEP_BATCH_LIMIT)

    const stats = { scanned: candidates.length, due: 0, sent: 0, failed: 0, skipped: 0 }

    for (const candidate of candidates) {
      const decision = shouldSendReminder({
        nextVisitDate: candidate.nextVisitDate,
        reminderSentAt: null,
        leadDays: resolveLeadDays(candidate.reminderDaysBefore, defaultDays),
        now,
      })
      if (!decision.due) {
        stats.skipped += 1
        continue
      }

      stats.due += 1
      const result = await this.sendFollowUpReminder(candidate.id, { now })
      if (result.sent) {
        stats.sent += 1
      } else {
        stats.failed += 1
        console.warn(
          `Follow-up reminder failed for visit ${candidate.id}: ${result.reason ?? 'unknown'}`
        )
      }
    }

    return stats
  }
}

type FollowUpRow = {
  id: string
  patientId: string
  doctorId: string | null
  patientFirstName: string
  patientLastName: string
  patientFullName: string
  patientNationalId: string | null
  patientPhone: string | null
  doctorFullName: string | null
  visitDate: Date
  visitType: string | null
  status: string | null
  nextVisitDate: Date | null
  reminderDaysBefore: number | null
  reminderSentAt: Date | null
}

/** Adds the derived scheduling fields the UI needs, so the client stays dumb. */
function decorateFollowUp(row: FollowUpRow, defaultDays: number, now: Date) {
  const leadDays = resolveLeadDays(row.reminderDaysBefore, defaultDays)
  const decision = shouldSendReminder({
    nextVisitDate: row.nextVisitDate,
    reminderSentAt: row.reminderSentAt,
    leadDays,
    now,
  })

  return {
    ...row,
    reminderDaysBefore: row.reminderDaysBefore,
    effectiveReminderDays: leadDays,
    usesDefaultReminderDays: row.reminderDaysBefore === null,
    daysUntil: row.nextVisitDate ? daysUntil(now, row.nextVisitDate) : null,
    reminderState: row.reminderSentAt
      ? ('sent' as const)
      : decision.due
        ? ('due' as const)
        : decision.reason === 'past_due'
          ? ('overdue' as const)
          : ('scheduled' as const),
    hasPhone: !!row.patientPhone?.trim(),
  }
}

function getVisitColor(type: string | null): string {
  switch (type) {
    case '\u0648\u06CC\u0632\u06CC\u062A \u0627\u0648\u0644\u06CC\u0647': return '#3b82f6'
    case '\u0686\u06A9\u0627\u067E \u0628\u0627\u0631\u062F\u0627\u0631\u06CC': return '#10b981'
    case '\u067E\u06CC\u06AF\u06CC\u0631\u06CC': return '#f59e0b'
    case '\u0627\u0648\u0631\u0698\u0627\u0646\u0633\u06CC': return '#ef4444'
    default: return '#6366f1'
  }
}

function getVisitBorderColor(type: string | null): string {
  switch (type) {
    case '\u0648\u06CC\u0632\u06CC\u062A \u0627\u0648\u0644\u06CC\u0647': return '#2563eb'
    case '\u0686\u06A9\u0627\u067E \u0628\u0627\u0631\u062F\u0627\u0631\u06CC': return '#059669'
    case '\u067E\u06CC\u06AF\u06CC\u0631\u06CC': return '#d97706'
    case '\u0627\u0648\u0631\u0698\u0627\u0646\u0633\u06CC': return '#dc2626'
    default: return '#4f46e5'
  }
}

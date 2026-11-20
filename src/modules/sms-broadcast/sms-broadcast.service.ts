import type { DB } from '../../db/client'
import {
  patients,
  users,
  smsBroadcasts,
  smsBroadcastLogs,
} from '../../db/schema'
import {
  eq,
  and,
  or,
  isNull,
  inArray,
  sql,
  desc,
  gte,
} from 'drizzle-orm'
import { NotFoundError, ConflictError, ValidationError } from '../../shared/errors'
import { smsService, notificationService } from '../../shared/services'
import { normalizeMobile } from '../../shared/services/sms.service'
import type {
  CreateSmsBroadcastDto,
  UpdateSmsBroadcastDto,
  ListSmsBroadcastsQueryDto,
  SmsBroadcastRow,
  SmsBroadcastLogRow,
  SmsBroadcastRunResult,
  SmsBroadcastRunStats,
  SmsBroadcastSummary,
} from './sms-broadcast.schema'

/**
 * Service for automated, selective SMS broadcasts to patients.
 *
 * A broadcast targets patients (all active patients with a phone, or a specific
 * list) on a configured set of weekdays at a configured time. Delivery is
 * idempotent per broadcast per calendar day, so a broadcast never sends twice
 * to the same patient on the same day regardless of scheduler restarts or
 * catch-up runs. Manual "send now" actions may opt into a forced re-send.
 */

const startOfDay = (d: Date): Date => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const minutesOf = (d: Date): number => d.getHours() * 60 + d.getMinutes()

const subDay = (d: Date): Date => {
  const x = new Date(d)
  x.setDate(x.getDate() - 1)
  return x
}

/** How many provider calls may be in flight at once during a broadcast. */
const SEND_CONCURRENCY = 8
/** Insert delivery logs in chunks so a long run is not one giant statement. */
const LOG_INSERT_CHUNK = 200

interface BroadcastTarget {
  targetType: 'all' | 'specific'
  targetPatientIds: string[] | null
}

interface MatchedPatient {
  id: string
  firstName: string | null
  lastName: string | null
  nationalId: string | null
  phone: string
}

export class SmsBroadcastService {
  constructor(private db: DB) {}

  async create(dto: CreateSmsBroadcastDto, createdBy: string | null): Promise<SmsBroadcastRow> {
    if (dto.targetType === 'specific' && !dto.targetPatientIds.length) {
      throw new ValidationError('At least one patient must be selected for a specific broadcast')
    }

    const now = new Date()
    const [inserted] = await this.db
      .insert(smsBroadcasts)
      .values({
        name: dto.name,
        message: dto.message,
        targetType: dto.targetType,
        targetPatientIds:
          dto.targetType === 'specific' && dto.targetPatientIds.length
            ? dto.targetPatientIds
            : null,
        daysOfWeek: dto.daysOfWeek,
        hour: dto.hour,
        minute: dto.minute,
        isActive: true,
        createdBy,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    const nextRunAt = this.computeNextRunAt(this.toRow(inserted), now)
    await this.db
      .update(smsBroadcasts)
      .set({ nextRunAt, updatedAt: new Date() })
      .where(eq(smsBroadcasts.id, inserted.id))

    return this.toRow({ ...inserted, nextRunAt })
  }

  async list(dto: ListSmsBroadcastsQueryDto) {
    const conditions: any[] = []

    if (dto.q) {
      const pattern = `%${dto.q}%`
      conditions.push(
        or(sql`${smsBroadcasts.name} ILIKE ${pattern}`, sql`${smsBroadcasts.message} ILIKE ${pattern}`)
      )
    }

    if (dto.isActive !== undefined) {
      conditions.push(eq(smsBroadcasts.isActive, dto.isActive))
    }

    const where = conditions.length ? and(...conditions) : undefined

    const paginated = Boolean(dto.page && dto.limit)

    const rows = paginated
      ? await this.db
          .select()
          .from(smsBroadcasts)
          .where(where)
          .orderBy(desc(smsBroadcasts.createdAt))
          .limit(dto.limit!)
          .offset((dto.page! - 1) * dto.limit!)
      : await this.db
          .select()
          .from(smsBroadcasts)
          .where(where)
          .orderBy(desc(smsBroadcasts.createdAt))

    const total = paginated
      ? (
          await this.db
            .select({ count: sql<number>`count(*)::int` })
            .from(smsBroadcasts)
            .where(where)
        )[0]?.count ?? 0
      : rows.length

    // Recipient preview: the list card should show how many patients will
    // actually receive this broadcast, not just how many ids were picked.
    const eligibleIds = await this.eligiblePatientIds()
    const eligible = new Set(eligibleIds)
    const countRecipients = (broadcast: SmsBroadcastRow) =>
      broadcast.targetType === 'specific'
        ? (broadcast.targetPatientIds ?? []).filter((id) => eligible.has(id)).length
        : eligible.size

    const limit = paginated ? dto.limit! : rows.length
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0

    return {
      data: rows.map((row) => this.toSummary(this.toRow(row), countRecipients(this.toRow(row)))),
      total,
      page: paginated ? dto.page! : 1,
      limit,
      totalPages,
      hasMore: paginated ? dto.page! < totalPages : false,
    }
  }

  async getById(id: string): Promise<{ broadcast: SmsBroadcastRow; recipientCount: number; recentLogs: SmsBroadcastLogRow[] }> {
    const [broadcast] = await this.db
      .select()
      .from(smsBroadcasts)
      .where(eq(smsBroadcasts.id, id))
      .limit(1)

    if (!broadcast) throw new NotFoundError('Sms broadcast')

    const row = this.toRow(broadcast)
    const patients = await this.getMatchingPatients(row)

    const recentLogs = await this.db
      .select()
      .from(smsBroadcastLogs)
      .where(eq(smsBroadcastLogs.broadcastId, id))
      .orderBy(desc(smsBroadcastLogs.sentAt))
      .limit(50)

    return {
      broadcast: row,
      recipientCount: patients.length,
      recentLogs: recentLogs.map((entry) => this.toLogRow(entry)),
    }
  }

  async update(id: string, dto: UpdateSmsBroadcastDto): Promise<SmsBroadcastRow> {
    const [existing] = await this.db
      .select()
      .from(smsBroadcasts)
      .where(eq(smsBroadcasts.id, id))
      .limit(1)

    if (!existing) throw new NotFoundError('Sms broadcast')

    const current = this.toRow(existing)
    const now = new Date()
    const updateData: Record<string, unknown> = { updatedAt: now }

    if (dto.name !== undefined) updateData.name = dto.name
    if (dto.message !== undefined) updateData.message = dto.message
    if (dto.daysOfWeek !== undefined) updateData.daysOfWeek = dto.daysOfWeek
    if (dto.hour !== undefined) updateData.hour = dto.hour
    if (dto.minute !== undefined) updateData.minute = dto.minute
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive

    // Resolve the effective target so switching to "specific" without sending a
    // new list keeps the previous selection instead of silently targeting all.
    const targetType = dto.targetType ?? current.targetType
    let targetPatientIds = current.targetPatientIds

    if (dto.targetType === 'all') {
      targetPatientIds = null
    } else if (dto.targetPatientIds !== undefined) {
      targetPatientIds = dto.targetPatientIds
    }

    if (targetType === 'specific' && (!targetPatientIds || targetPatientIds.length === 0)) {
      throw new ValidationError('At least one patient must be selected for a specific broadcast')
    }

    if (dto.targetType !== undefined) updateData.targetType = targetType
    updateData.targetPatientIds = targetType === 'specific' ? targetPatientIds : null

    const [updated] = await this.db
      .update(smsBroadcasts)
      .set(updateData)
      .where(eq(smsBroadcasts.id, id))
      .returning()

    const merged = this.toRow(updated)
    const nextRunAt = merged.isActive ? this.computeNextRunAt(merged, now) : null
    await this.db
      .update(smsBroadcasts)
      .set({ nextRunAt, updatedAt: new Date() })
      .where(eq(smsBroadcasts.id, id))

    return this.toRow({ ...updated, nextRunAt })
  }

  async delete(id: string): Promise<{ id: string }> {
    const existing = await this.db
      .select({ id: smsBroadcasts.id })
      .from(smsBroadcasts)
      .where(eq(smsBroadcasts.id, id))
      .limit(1)

    if (!existing.length) throw new NotFoundError('Sms broadcast')

    await this.db.delete(smsBroadcasts).where(eq(smsBroadcasts.id, id))
    return { id }
  }

  /**
   * Execute a single broadcast to all matching patients.
   *
   * Without `force`, a broadcast executes at most once per calendar day and
   * patients already logged today are skipped. With `force` (manual "send
   * now"), today's log rows for this broadcast are replaced so the UI still
   * shows the latest delivery attempt.
   */
  async runBroadcast(
    broadcastId: string,
    options: { now?: Date; force?: boolean } = {}
  ): Promise<SmsBroadcastRunResult> {
    const now = options.now ?? new Date()
    const force = Boolean(options.force)
    const dayStart = startOfDay(now)

    const [broadcast] = await this.db
      .select()
      .from(smsBroadcasts)
      .where(eq(smsBroadcasts.id, broadcastId))
      .limit(1)

    if (!broadcast) throw new NotFoundError('Sms broadcast')
    if (!broadcast.isActive) throw new ConflictError('Broadcast is not active')

    const b = this.toRow(broadcast)
    const patientsToNotify = await this.getMatchingPatients(b)

    const emptyResult = (reason: SmsBroadcastRunResult['reason']): SmsBroadcastRunResult => ({
      sent: 0,
      failed: 0,
      skipped: patientsToNotify.length,
      recipientCount: patientsToNotify.length,
      reason,
      forced: force,
    })

    // Respect the per-event SMS channel toggle (admin can switch broadcasts off
    // without touching code). Fail-open when the setting is missing.
    const broadcastChannelAllowed = await notificationService.isChannelEnabled('broadcast_sms', 'sms')
    if (!broadcastChannelAllowed) return emptyResult('channel_disabled')

    // Do not report thousands of fake failures when the provider is off or the
    // clinic is out of credit — surface the real reason instead.
    const smsStatus = await smsService.getStatus()
    if (!smsStatus.enabled) {
      return emptyResult(smsStatus.reason === 'no_credit' ? 'no_credit' : 'channel_disabled')
    }

    // Idempotency: a broadcast executes at most once per calendar day, unless a
    // manual request explicitly forces a re-send.
    if (!force) {
      const lastRun = b.lastRunAt ? new Date(b.lastRunAt) : null
      if (lastRun && lastRun >= dayStart) return emptyResult('already_ran')
    }

    // Patients already logged for today are skipped (defensive; also covered by
    // the unique index on (broadcast_id, patient_id, date(sent_at))).
    const todayLogs = await this.db
      .select({ patientId: smsBroadcastLogs.patientId })
      .from(smsBroadcastLogs)
      .where(and(eq(smsBroadcastLogs.broadcastId, broadcastId), gte(smsBroadcastLogs.sentAt, dayStart)))
    const sentToday = force ? new Set<string>() : new Set(todayLogs.map((row) => row.patientId))

    let sent = 0
    let failed = 0
    let skipped = 0
    const logRows: Array<{
      broadcastId: string
      patientId: string
      status: 'sent' | 'failed'
      error: string | null
      phone: string | null
    }> = []

    const queue = patientsToNotify.filter((patient) => {
      if (sentToday.has(patient.id)) {
        skipped++
        return false
      }
      return true
    })

    let cursor = 0
    const worker = async () => {
      while (true) {
        const index = cursor++
        if (index >= queue.length) return

        const patient = queue[index]
        const text = this.interpolateMessage(b.message, patient)
        const delivery = await smsService.sendDetailed(patient.phone, text)

        logRows.push({
          broadcastId,
          patientId: patient.id,
          status: delivery.ok ? 'sent' : 'failed',
          error: delivery.ok ? null : delivery.error,
          phone: patient.phone,
        })

        if (delivery.ok) sent++
        else failed++
      }
    }

    const workerCount = Math.min(SEND_CONCURRENCY, queue.length)
    await Promise.all(Array.from({ length: workerCount }, () => worker()))

    if (force && logRows.length) {
      // A forced manual run replaces today's rows for this broadcast so the
      // per-day unique index cannot hide the newest attempt.
      await this.db
        .delete(smsBroadcastLogs)
        .where(and(eq(smsBroadcastLogs.broadcastId, broadcastId), gte(smsBroadcastLogs.sentAt, dayStart)))
    }

    for (let i = 0; i < logRows.length; i += LOG_INSERT_CHUNK) {
      try {
        await this.db
          .insert(smsBroadcastLogs)
          .values(logRows.slice(i, i + LOG_INSERT_CHUNK))
          .onConflictDoNothing()
      } catch (error) {
        console.error(
          '[sms-broadcast] failed to persist delivery logs:',
          error instanceof Error ? error.message : error
        )
      }
    }

    const nextRunAt = this.computeNextRunAt(b, now)
    await this.db
      .update(smsBroadcasts)
      .set({
        lastRunAt: now,
        nextRunAt,
        totalSent: sql`${smsBroadcasts.totalSent} + ${sent}`,
        totalFailed: sql`${smsBroadcasts.totalFailed} + ${failed}`,
        updatedAt: new Date(),
      })
      .where(eq(smsBroadcasts.id, broadcastId))

    return {
      sent,
      failed,
      skipped,
      recipientCount: patientsToNotify.length,
      reason: null,
      forced: force,
    }
  }

  /**
   * Run every broadcast that is due right now. Used by the hourly scheduler
   * and by on-demand/manual triggers.
   *
   * `next_run_at` is the source of truth for due-ness (computed on create,
   * update and after each run). It naturally provides catch-up: if the process
   * was down at the scheduled minute, the run happens at the next tick.
   */
  async runDueBroadcasts(options: { now?: Date } = {}): Promise<SmsBroadcastRunStats> {
    const ref = options.now ?? new Date()
    const todayWeekday = ref.getDay()
    const dayStart = startOfDay(ref)
    const yesterdayStart = subDay(dayStart)

    const smsStatus = await smsService.getStatus()
    if (!smsStatus.enabled) {
      return { broadcasts: 0, sent: 0, failed: 0, skipped: 0 }
    }

    const broadcasts = await this.db
      .select()
      .from(smsBroadcasts)
      .where(eq(smsBroadcasts.isActive, true))

    let broadcastsRun = 0
    let sent = 0
    let failed = 0
    let skipped = 0

    for (const raw of broadcasts) {
      const b = this.toRow(raw)
      const lastRun = b.lastRunAt ? new Date(b.lastRunAt) : null
      if (lastRun && lastRun >= dayStart) continue

      const due = b.nextRunAt
        ? new Date(b.nextRunAt).getTime() <= ref.getTime()
        : this.isLegacyDue(b, lastRun, ref, todayWeekday, yesterdayStart)

      if (!due) continue

      try {
        const stats = await this.runBroadcast(b.id, { now: ref, force: false })
        if (stats.reason === 'already_ran') continue
        broadcastsRun++
        sent += stats.sent
        failed += stats.failed
        skipped += stats.skipped
      } catch (error) {
        console.error(
          `[sms-broadcast] run failed for ${b.id}:`,
          error instanceof Error ? error.message : error
        )
      }
    }

    return { broadcasts: broadcastsRun, sent, failed, skipped }
  }

  async getLogs(broadcastId: string, dto: ListSmsBroadcastsQueryDto) {
    const paginated = Boolean(dto.page && dto.limit)
    const where = eq(smsBroadcastLogs.broadcastId, broadcastId)

    if (!paginated) {
      const data = await this.db
        .select()
        .from(smsBroadcastLogs)
        .where(where)
        .orderBy(desc(smsBroadcastLogs.sentAt))

      return {
        data: data.map((row) => this.toLogRow(row)),
        total: data.length,
        page: 1,
        limit: data.length,
        totalPages: data.length === 0 ? 0 : 1,
        hasMore: false,
      }
    }

    const offset = (dto.page! - 1) * dto.limit!
    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(smsBroadcastLogs)
        .where(where)
        .orderBy(desc(smsBroadcastLogs.sentAt))
        .limit(dto.limit!)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(smsBroadcastLogs)
        .where(where),
    ])

    const total = countResult[0]?.count ?? 0
    const totalPages = Math.ceil(total / dto.limit!)

    return {
      data: rows.map((row) => this.toLogRow(row)),
      total,
      page: dto.page!,
      limit: dto.limit!,
      totalPages,
      hasMore: dto.page! < totalPages,
    }
  }

  /**
   * Build the query of patients eligible to receive a broadcast. A "specific"
   * broadcast with no ids must never fall back to every patient.
   */
  private matchingPatientsQuery(target: BroadcastTarget) {
    const conditions: any[] = [
      eq(patients.isDeleted, false),
      sql`${patients.phone} IS NOT NULL AND ${patients.phone} <> ''`,
      or(isNull(users.smsEnabled), eq(users.smsEnabled, true)),
    ]

    if (target.targetType === 'specific') {
      const ids = target.targetPatientIds ?? []
      if (!ids.length) conditions.push(sql`false`)
      else conditions.push(inArray(patients.id, ids))
    }

    return this.db
      .selectDistinct({
        id: patients.id,
        firstName: patients.firstName,
        lastName: patients.lastName,
        nationalId: patients.nationalId,
        phone: patients.phone,
      })
      .from(patients)
      .leftJoin(users, eq(users.patientId, patients.id))
      .where(and(...conditions))
  }

  /** Matching patients with phone numbers normalised and invalid numbers removed. */
  private async getMatchingPatients(broadcast: BroadcastTarget): Promise<MatchedPatient[]> {
    const rows = await this.matchingPatientsQuery(broadcast)
    const result: MatchedPatient[] = []
    for (const row of rows) {
      const phone = normalizeMobile(row.phone)
      if (!phone) continue
      result.push({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        nationalId: row.nationalId,
        phone,
      })
    }
    return result
  }

  private async eligiblePatientIds(): Promise<string[]> {
    const rows = await this.getMatchingPatients({ targetType: 'all', targetPatientIds: null })
    return rows.map((row) => row.id)
  }

  private interpolateMessage(
    message: string,
    patient: { firstName?: string | null; lastName?: string | null; nationalId?: string | null; phone?: string | null }
  ): string {
    const fullName = [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim()
    return message
      .replace(/\{firstName\}/g, patient.firstName ?? '')
      .replace(/\{lastName\}/g, patient.lastName ?? '')
      .replace(/\{fullName\}/g, fullName)
      .replace(/\{nationalId\}/g, patient.nationalId ?? '')
      .replace(/\{phone\}/g, patient.phone ?? '')
  }

  /**
   * Compute the next future occurrence of this broadcast (next matching weekday
   * at the configured hour:minute) at or after `from`. Returns null when the
   * broadcast is disabled or has no weekdays configured.
   */
  private computeNextRunAt(broadcast: SmsBroadcastRow, from: Date): Date | null {
    if (!broadcast.isActive) return null

    const days = Array.isArray(broadcast.daysOfWeek) ? broadcast.daysOfWeek : []
    if (!days.length) return null

    const cursor = new Date(from)
    cursor.setHours(0, 0, 0, 0)

    for (let i = 0; i < 8; i++) {
      if (days.includes(cursor.getDay())) {
        const candidate = new Date(cursor)
        candidate.setHours(broadcast.hour, broadcast.minute, 0, 0)
        if (candidate.getTime() >= from.getTime()) return candidate
      }
      cursor.setDate(cursor.getDate() + 1)
    }
    return null
  }

  /** Fallback for rows created before next_run_at was populated. */
  private isLegacyDue(
    broadcast: SmsBroadcastRow,
    lastRun: Date | null,
    ref: Date,
    todayWeekday: number,
    yesterdayStart: Date
  ): boolean {
    const days = Array.isArray(broadcast.daysOfWeek) ? broadcast.daysOfWeek : []
    if (!days.includes(todayWeekday)) return false
    const timePassedToday = minutesOf(ref) >= broadcast.hour * 60 + broadcast.minute
    const missedPreviousDay = lastRun !== null && lastRun < yesterdayStart
    return timePassedToday || missedPreviousDay
  }

  private toRow(row: any): SmsBroadcastRow {
    return {
      id: row.id,
      name: row.name,
      message: row.message,
      targetType: (row.targetType as 'all' | 'specific') ?? 'all',
      targetPatientIds: row.targetPatientIds ?? null,
      daysOfWeek: Array.isArray(row.daysOfWeek) ? row.daysOfWeek : [],
      hour: row.hour,
      minute: row.minute,
      isActive: row.isActive,
      createdBy: row.createdBy ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastRunAt: row.lastRunAt ?? null,
      nextRunAt: row.nextRunAt ?? null,
      totalSent: row.totalSent ?? 0,
      totalFailed: row.totalFailed ?? 0,
    }
  }

  private toSummary(row: SmsBroadcastRow, recipientCount: number): SmsBroadcastSummary {
    return {
      id: row.id,
      name: row.name,
      message: row.message,
      targetType: row.targetType,
      targetPatientIds: row.targetPatientIds,
      isActive: row.isActive,
      daysOfWeek: row.daysOfWeek,
      hour: row.hour,
      minute: row.minute,
      lastRunAt: row.lastRunAt,
      nextRunAt: row.nextRunAt,
      totalSent: row.totalSent,
      totalFailed: row.totalFailed,
      recipientCount,
    }
  }

  private toLogRow(row: any): SmsBroadcastLogRow {
    return {
      id: row.id,
      broadcastId: row.broadcastId,
      patientId: row.patientId,
      sentAt: row.sentAt,
      status: row.status as 'sent' | 'failed' | 'skipped',
      error: row.error ?? null,
      phone: row.phone ?? null,
    }
  }
}

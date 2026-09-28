import type { DB } from '../../db/client'
import { env } from '../../config/env'
import { VisitService } from '../../modules/visits/visits.service'
import { msUntilNextRun } from './daily-schedule'

/**
 * In-process daily scheduler for follow-up reminder SMS.
 *
 * The clinic runs a single Node process (see Dockerfile), so no external worker
 * or cron dependency is warranted. A self-rearming `setTimeout` is used instead
 * of `setInterval` because a fixed 24h interval drifts with daylight-saving
 * changes and would fire at the wrong hour twice a year.
 *
 * Every run is idempotent — `reminder_sent_at` is written on success — so a
 * restart, a catch-up run, or two runs racing each other can never double-send.
 */

const MS_PER_MINUTE = 60_000

export interface FollowUpSchedulerOptions {
  /** Local hour (0-23) at which the daily sweep runs. */
  hour?: number
  /** Local minute (0-59) at which the daily sweep runs. */
  minute?: number
  /** Run once immediately on start, to catch up on missed runs. Default true. */
  runOnStart?: boolean
  /** Injected for tests; defaults to the real service. */
  service?: Pick<VisitService, 'runFollowUpReminderSweep'>
}

export interface FollowUpSchedulerHandle {
  /** Stop the scheduler. Safe to call more than once. */
  stop: () => void
  /** Milliseconds until the next scheduled run — exposed for tests/diagnostics. */
  nextRunInMs: () => number
}

/** Milliseconds from `from` until the next occurrence of hour:minute local time. */
export { msUntilNextRun }

export function startFollowUpReminderScheduler(
  db: DB,
  options: FollowUpSchedulerOptions = {}
): FollowUpSchedulerHandle | null {
  if (!env.FOLLOWUP_REMINDER_ENABLED) {
    console.log('[followup-scheduler] disabled via FOLLOWUP_REMINDER_ENABLED')
    return null
  }

  const hour = options.hour ?? env.FOLLOWUP_REMINDER_HOUR
  const minute = options.minute ?? env.FOLLOWUP_REMINDER_MINUTE
  const runOnStart = options.runOnStart ?? true
  const service = options.service ?? new VisitService(db)

  let timer: NodeJS.Timeout | null = null
  let stopped = false
  /** Guards against a slow sweep overlapping the next scheduled one. */
  let running = false

  const runSweep = async (trigger: 'startup' | 'schedule') => {
    if (running) {
      console.warn('[followup-scheduler] previous sweep still running, skipping')
      return
    }
    running = true
    try {
      const stats = await service.runFollowUpReminderSweep()
      console.log(
        `[followup-scheduler] ${trigger} sweep done:` +
          ` scanned=${stats.scanned} due=${stats.due} sent=${stats.sent}` +
          ` failed=${stats.failed} skipped=${stats.skipped}`
      )
    } catch (error) {
      // Never let a transient DB/network error kill the scheduler.
      console.error(
        '[followup-scheduler] sweep failed:',
        error instanceof Error ? error.message : error
      )
    } finally {
      running = false
    }
  }

  const arm = () => {
    if (stopped) return
    const delay = msUntilNextRun(new Date(), hour, minute)
    timer = setTimeout(async () => {
      await runSweep('schedule')
      arm()
    }, delay)
    // Never hold the event loop open on account of the scheduler.
    timer.unref?.()
    console.log(
      `[followup-scheduler] next run at ${String(hour).padStart(2, '0')}:` +
        `${String(minute).padStart(2, '0')} local (in ${Math.round(delay / MS_PER_MINUTE)} min)`
    )
  }

  arm()
  if (runOnStart) {
    // Fire-and-forget: startup must not block on SMS delivery.
    void runSweep('startup')
  }

  return {
    stop: () => {
      stopped = true
      if (timer) clearTimeout(timer)
      timer = null
    },
    nextRunInMs: () => msUntilNextRun(new Date(), hour, minute),
  }
}

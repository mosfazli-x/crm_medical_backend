import type { DB } from '../../db/client'
import { env } from '../../config/env'
import { SmsBroadcastService } from '../../modules/sms-broadcast/sms-broadcast.service'

/**
 * In-process scheduler for automated, selective SMS broadcasts to patients.
 *
 * The clinic runs a single Node process (see Dockerfile), so a self-rearming
 * `setTimeout` is used instead of an external cron dependency. The scheduler
 * ticks once a minute and executes every active broadcast whose `next_run_at`
 * is due. Because due-ness is computed from `next_run_at` rather than from an
 * exact wall-clock match, a restart or a busy event loop never causes a missed
 * broadcast — the next tick catches it up.
 *
 * Every run is idempotent: a broadcast is executed at most once per calendar
 * day (tracked via `last_run_at` and the per-day unique log index), so a
 * restart, a catch-up run, or two runs racing each other can never double-send
 * to the same patient on the same day.
 */

export interface SmsBroadcastSchedulerOptions {
  /** How often to check for due broadcasts. Default 60 seconds. */
  intervalMs?: number
  /** Run once immediately on start, to catch up on missed broadcasts. Default true. */
  runOnStart?: boolean
  /** Injected for tests; defaults to the real service. */
  service?: Pick<SmsBroadcastService, 'runDueBroadcasts'>
}

export interface SmsBroadcastSchedulerHandle {
  /** Stop the scheduler. Safe to call more than once. */
  stop: () => void
  /** Milliseconds until the next scheduled tick — exposed for tests/diagnostics. */
  nextRunInMs: () => number
}

type DueBroadcastsService = Pick<SmsBroadcastService, 'runDueBroadcasts'>

const DEFAULT_INTERVAL_MS = 60_000

export function startSmsBroadcastScheduler(
  db: DB,
  options: SmsBroadcastSchedulerOptions = {}
): SmsBroadcastSchedulerHandle | null {
  if (!env.SMS_BROADCAST_ENABLED) {
    console.log('[sms-broadcast-scheduler] disabled via SMS_BROADCAST_ENABLED')
    return null
  }

  const intervalMs = Math.max(10_000, options.intervalMs ?? DEFAULT_INTERVAL_MS)
  const runOnStart = options.runOnStart ?? true
  const service: DueBroadcastsService = options.service ?? new SmsBroadcastService(db)

  let timer: NodeJS.Timeout | null = null
  let stopped = false
  let nextAt = Date.now() + intervalMs
  /** Guards against a slow tick overlapping the next scheduled one. */
  let running = false

  const runTick = async (trigger: 'startup' | 'schedule') => {
    if (running) {
      console.warn('[sms-broadcast-scheduler] previous tick still running, skipping')
      return
    }
    running = true
    try {
      const stats = await service.runDueBroadcasts({ now: new Date() })
      if (stats.broadcasts > 0) {
        console.log(
          `[sms-broadcast-scheduler] ${trigger} tick done:` +
            ` broadcasts=${stats.broadcasts} sent=${stats.sent} failed=${stats.failed} skipped=${stats.skipped}`
        )
      }
    } catch (error) {
      // Never let a transient DB/SMS error kill the scheduler.
      console.error(
        '[sms-broadcast-scheduler] tick failed:',
        error instanceof Error ? error.message : error
      )
    } finally {
      running = false
    }
  }

  const arm = () => {
    if (stopped) return
    nextAt = Date.now() + intervalMs
    timer = setTimeout(async () => {
      await runTick('schedule')
      arm()
    }, intervalMs)
    // Never hold the event loop open on account of the scheduler.
    timer.unref?.()
  }

  arm()
  if (runOnStart) {
    // Fire-and-forget: startup must not block on SMS delivery.
    void runTick('startup')
  }

  console.log(
    `[sms-broadcast-scheduler] started; checking for due broadcasts every ${Math.round(intervalMs / 1000)}s`
  )

  return {
    stop: () => {
      stopped = true
      if (timer) clearTimeout(timer)
      timer = null
    },
    nextRunInMs: () => Math.max(0, nextAt - Date.now()),
  }
}

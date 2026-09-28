/**
 * Pure helpers for scheduling a job at a fixed local wall-clock time.
 *
 * Split out of the scheduler itself so the timing arithmetic can be unit tested
 * without importing the service layer (and therefore without a database).
 */

/**
 * Milliseconds from `from` until the next occurrence of `hour:minute` local time.
 *
 * Uses a self-rearming `setTimeout` upstream rather than a 24h `setInterval`,
 * because a fixed interval drifts across daylight-saving transitions and would
 * fire at the wrong hour twice a year.
 */
export function msUntilNextRun(from: Date, hour: number, minute: number): number {
  const next = new Date(from)
  next.setHours(hour, minute, 0, 0)
  // Strictly greater: scheduling for the current minute must not yield a zero
  // delay, otherwise the job would fire immediately and in a tight loop.
  if (next.getTime() <= from.getTime()) {
    next.setDate(next.getDate() + 1)
  }
  return next.getTime() - from.getTime()
}

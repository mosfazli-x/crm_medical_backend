import { describe, it, expect } from 'vitest'
import { msUntilNextHour } from '../shared/schedulers/daily-schedule'

describe('msUntilNextHour', () => {
  it('returns the delay until the next hour boundary', () => {
    const from = new Date(2026, 0, 1, 9, 30, 0, 0) // 09:30
    const delay = msUntilNextHour(from)
    const expected = new Date(2026, 0, 1, 10, 0, 0, 0).getTime() - from.getTime()
    expect(delay).toBe(expected)
    expect(delay).toBe(30 * 60 * 1000)
  })

  it('never returns zero or negative (always strictly in the future)', () => {
    const from = new Date(2026, 0, 1, 9, 0, 0, 0) // exactly 09:00
    const delay = msUntilNextHour(from)
    expect(delay).toBeGreaterThan(0)
    expect(delay).toBe(60 * 60 * 1000)
  })

  it('works across hour rollover', () => {
    const from = new Date(2026, 0, 1, 23, 45, 0, 0)
    const delay = msUntilNextHour(from)
    expect(delay).toBe(15 * 60 * 1000)
    const next = new Date(from.getTime() + delay)
    expect(next.getHours()).toBe(0)
    expect(next.getMinutes()).toBe(0)
  })
})

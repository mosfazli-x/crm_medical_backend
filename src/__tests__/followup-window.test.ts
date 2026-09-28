import { describe, it, expect } from 'vitest'
import {
  DEFAULT_REMINDER_DAYS,
  MAX_REMINDER_DAYS,
  MIN_REMINDER_DAYS,
  addDays,
  buildFollowUpReminderText,
  clampReminderDays,
  daysUntil,
  parseNextVisitDate,
  reminderTargetDay,
  resolveLeadDays,
  shouldSendReminder,
  startOfDay,
} from '../modules/visits/followup-window'
import { msUntilNextRun } from '../shared/schedulers/daily-schedule'

/** Local-time constructor, so tests are independent of the machine timezone. */
const local = (y: number, m: number, d: number, h = 0, min = 0, sec = 0) =>
  new Date(y, m - 1, d, h, min, sec)

describe('followup-window date helpers', () => {
  it('startOfDay strips the time component', () => {
    expect(startOfDay(local(2026, 10, 5, 23, 59))).toEqual(local(2026, 10, 5, 0, 0, 0))
  })

  it('addDays crosses month and year boundaries', () => {
    expect(addDays(local(2026, 10, 30), 3)).toEqual(local(2026, 11, 2))
    expect(addDays(local(2026, 12, 30), 3)).toEqual(local(2027, 1, 2))
  })

  it('daysUntil is signed and counts whole days', () => {
    expect(daysUntil(local(2026, 10, 5, 9), local(2026, 10, 5, 23))).toBe(0)
    expect(daysUntil(local(2026, 10, 5), local(2026, 10, 8))).toBe(3)
    expect(daysUntil(local(2026, 10, 8), local(2026, 10, 5))).toBe(-3)
  })
})

describe('clampReminderDays / resolveLeadDays', () => {
  it('falls back when the value is missing or not finite', () => {
    expect(clampReminderDays(null, 5)).toBe(5)
    expect(clampReminderDays(undefined, 5)).toBe(5)
    expect(clampReminderDays(Number.NaN, 5)).toBe(5)
    // A broken fallback falls back again, rather than propagating NaN.
    expect(clampReminderDays(null, Number.NaN)).toBe(DEFAULT_REMINDER_DAYS)
    // A valid value always wins, even if the fallback is garbage.
    expect(clampReminderDays(7, Number.NaN)).toBe(7)
  })

  it('clamps into the supported range', () => {
    expect(clampReminderDays(-5, 3)).toBe(MIN_REMINDER_DAYS)
    expect(clampReminderDays(9999, 3)).toBe(MAX_REMINDER_DAYS)
  })

  it('truncates fractional values', () => {
    expect(clampReminderDays(4.9, 3)).toBe(4)
  })

  it('prefers the per-visit override over the clinic default', () => {
    expect(resolveLeadDays(10, 3)).toBe(10)
    expect(resolveLeadDays(0, 3)).toBe(0)
    expect(resolveLeadDays(null, 3)).toBe(3)
    expect(resolveLeadDays(null, null)).toBe(DEFAULT_REMINDER_DAYS)
  })
})

describe('reminderTargetDay', () => {
  it('moves the target back by the lead time', () => {
    expect(reminderTargetDay(local(2026, 10, 10), 3)).toEqual(local(2026, 10, 7))
    expect(reminderTargetDay(local(2026, 10, 10), 0)).toEqual(local(2026, 10, 10))
  })
})

describe('shouldSendReminder', () => {
  const leadDays = 3

  it('ignores visits without a follow-up date', () => {
    const decision = shouldSendReminder({
      nextVisitDate: null,
      reminderSentAt: null,
      leadDays,
      now: local(2026, 10, 1),
    })
    expect(decision).toEqual({ due: false, reason: 'no_followup' })
  })

  it('is idempotent once a reminder has been delivered', () => {
    const decision = shouldSendReminder({
      nextVisitDate: local(2026, 10, 10),
      reminderSentAt: local(2026, 10, 7, 9, 1),
      leadDays,
      now: local(2026, 10, 7, 10, 0),
    })
    expect(decision).toEqual({ due: false, reason: 'already_sent' })
  })

  it('waits until the target day arrives', () => {
    const decision = shouldSendReminder({
      nextVisitDate: local(2026, 10, 10),
      reminderSentAt: null,
      leadDays,
      now: local(2026, 10, 6, 23, 59),
    })
    expect(decision).toEqual({ due: false, reason: 'not_yet_due' })
  })

  it('fires on the target day regardless of the time of day', () => {
    const visit = local(2026, 10, 10, 19, 30)
    // Early in the morning of the target day: due.
    expect(
      shouldSendReminder({
        nextVisitDate: visit,
        reminderSentAt: null,
        leadDays,
        now: local(2026, 10, 7, 0, 1),
      })
    ).toEqual({ due: true, reason: 'due' })
    // Late in the evening of the target day: still exactly one send.
    expect(
      shouldSendReminder({
        nextVisitDate: visit,
        reminderSentAt: null,
        leadDays,
        now: local(2026, 10, 7, 23, 59),
      })
    ).toEqual({ due: true, reason: 'due' })
  })

  it('stays due on every day between the target day and the visit day', () => {
    for (let day = 7; day <= 10; day += 1) {
      const decision = shouldSendReminder({
        nextVisitDate: local(2026, 10, 10),
        reminderSentAt: null,
        leadDays,
        now: local(2026, 10, day, 12, 0),
      })
      expect(decision.due, `day ${day}`).toBe(true)
    }
  })

  it('never reminds about a follow-up whose day has passed', () => {
    const decision = shouldSendReminder({
      nextVisitDate: local(2026, 10, 10, 9, 0),
      reminderSentAt: null,
      leadDays,
      // Visit day has passed, even though the stored time of day is earlier.
      now: local(2026, 10, 11, 8, 0),
    })
    expect(decision).toEqual({ due: false, reason: 'past_due' })
  })

  it('a zero lead time still fires on the visit day itself', () => {
    expect(
      shouldSendReminder({
        nextVisitDate: local(2026, 10, 10, 14, 0),
        reminderSentAt: null,
        leadDays: 0,
        now: local(2026, 10, 10, 8, 0),
      }).due
    ).toBe(true)
  })

  it('an invalid date is treated as no follow-up', () => {
    const decision = shouldSendReminder({
      nextVisitDate: new Date('not-a-date'),
      reminderSentAt: null,
      leadDays,
      now: local(2026, 10, 1),
    })
    expect(decision).toEqual({ due: false, reason: 'no_followup' })
  })

  it('a longer per-visit lead time delays the reminder', () => {
    const visit = local(2026, 10, 10)
    // 8 days out: the 7-day window has not opened yet.
    expect(
      shouldSendReminder({
        nextVisitDate: visit,
        reminderSentAt: null,
        leadDays: 7,
        now: local(2026, 10, 2),
      })
    ).toEqual({ due: false, reason: 'not_yet_due' })
    // Exactly 7 days out the window opens.
    expect(
      shouldSendReminder({
        nextVisitDate: visit,
        reminderSentAt: null,
        leadDays: 7,
        now: local(2026, 10, 3),
      }).due
    ).toBe(true)
    // The shorter clinic default has not opened yet on the same day: a smaller
    // lead time means *less* advance notice, so its window opens closer to the visit.
    expect(
      shouldSendReminder({
        nextVisitDate: visit,
        reminderSentAt: null,
        leadDays: 3,
        now: local(2026, 10, 3),
      })
    ).toEqual({ due: false, reason: 'not_yet_due' })
    // ...and it opens four days later, on Oct 7.
    expect(
      shouldSendReminder({
        nextVisitDate: visit,
        reminderSentAt: null,
        leadDays: 3,
        now: local(2026, 10, 7),
      }).due
    ).toBe(true)
  })
})

describe('parseNextVisitDate', () => {
  it('returns null for empty input', () => {
    expect(parseNextVisitDate(null)).toBeNull()
    expect(parseNextVisitDate(undefined)).toBeNull()
    expect(parseNextVisitDate('')).toBeNull()
  })

  it('builds a bare date at local midnight, not UTC midnight', () => {
    const parsed = parseNextVisitDate('2026-10-05')
    expect(parsed).toEqual(local(2026, 10, 5, 0, 0, 0))
    expect(parsed!.getDate()).toBe(5)
  })

  it('accepts a full ISO timestamp', () => {
    const iso = '2026-10-05T13:45:00.000Z'
    expect(parseNextVisitDate(iso)!.toISOString()).toBe(iso)
  })

  it('returns null for an unparseable value', () => {
    expect(parseNextVisitDate('nonsense')).toBeNull()
  })
})

describe('buildFollowUpReminderText', () => {
  it('includes the patient name, Jalali date and time', () => {
    const text = buildFollowUpReminderText({
      patientName: 'زهرا کریمی',
      nextVisitDate: local(2026, 10, 5, 14, 30),
    })
    expect(text).toContain('زهرا کریمی')
    // 5 Oct 2026 === 13 Mehr 1405
    expect(text).toContain('13 مهر 1405')
    expect(text).toContain('14:30')
  })

  it('mentions the doctor only when one is known', () => {
    const withDoctor = buildFollowUpReminderText({
      patientName: 'زهرا کریمی',
      doctorName: 'دکتر احمدی',
      nextVisitDate: local(2026, 10, 5, 9, 0),
    })
    expect(withDoctor).toContain('ساعت 09:00 با دکتر احمدی')

    const withoutDoctor = buildFollowUpReminderText({
      patientName: 'زهرا کریمی',
      doctorName: null,
      nextVisitDate: local(2026, 10, 5, 9, 0),
    })
    expect(withoutDoctor).toContain('ساعت 09:00 می‌باشد')
    expect(withoutDoctor).not.toContain('دکتر')
  })

  it('pads single-digit hours', () => {
    const text = buildFollowUpReminderText({
      patientName: 'بیمار',
      nextVisitDate: local(2026, 10, 5, 9, 5),
    })
    expect(text).toContain('09:05')
  })
})

describe('msUntilNextRun', () => {
  it('targets today when the time is still ahead', () => {
    const from = local(2026, 10, 5, 7, 0)
    const delay = msUntilNextRun(from, 9, 0)
    expect(delay).toBe(2 * 60 * 60 * 1000)
  })

  it('rolls to tomorrow when the time has already passed', () => {
    const from = local(2026, 10, 5, 10, 0)
    const delay = msUntilNextRun(from, 9, 0)
    expect(delay).toBe(23 * 60 * 60 * 1000)
  })

  it('rolls to tomorrow when the time is exactly now (never a zero delay)', () => {
    const from = local(2026, 10, 5, 9, 0, 0)
    expect(msUntilNextRun(from, 9, 0)).toBe(24 * 60 * 60 * 1000)
  })
})

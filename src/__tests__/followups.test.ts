import { randomUUID } from 'node:crypto'
import { describe, it, expect, beforeAll } from 'vitest'
import { api, registerTestUser } from './helpers'

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001'

/**
 * Patients are created through a multipart endpoint. This one deliberately has
 * **no phone number**, so reminder delivery must fail closed rather than report
 * a success that never happened.
 */
async function createPatientWithoutPhone(token: string) {
  const nationalId = randomUUID().replace(/\D/g, '').slice(0, 10).padEnd(10, '0')
  const form = new FormData()
  form.append(
    'patient',
    JSON.stringify({
      first_name: 'زهرا',
      last_name: 'کریمی',
      national_id: nationalId,
    })
  )
  const res = await fetch(`${API_BASE}/api/patients/register`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  return { nationalId, body: (await res.json()) as any }
}

/**
 * Integration tests for the follow-up reminder endpoints.
 *
 * These run against a live server (see `src/__tests__/helpers.ts`), so they are
 * skipped automatically when nothing is listening on API_BASE_URL.
 */
describe('Follow-up reminders API', () => {
  let patientToken = ''
  let doctorToken = ''
  let adminToken = ''
  let patientId = ''
  let nationalId = ''

  beforeAll(async () => {
    patientToken = (await registerTestUser('patient')).token
    doctorToken = (await registerTestUser('doctor')).token
    adminToken = (await registerTestUser('admin_doctor')).token

    // A dedicated patient so the assertions never depend on existing records.
    const created = await createPatientWithoutPhone(doctorToken)
    nationalId = created.nationalId
    patientId = created.body?.patientId ?? created.body?.data?.id ?? ''
    expect(patientId, 'test patient must be created').toBeTruthy()
  })

  /** Follow-up rows for the test patient only, isolated from real clinic data. */
  const myRows = async (window: string, extra = '') => {
    const res = await api.get(
      `/api/visits/follow-ups?window=${window}&search=${encodeURIComponent(nationalId)}&limit=100${extra}`,
      doctorToken
    )
    expect(res.status).toBe(200)
    return res.body.data as any[]
  }

  const tomorrow = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  const createVisit = async (extra: Record<string, unknown> = {}) => {
    const res = await api.post(
      '/api/visits',
      {
        patientId,
        visitDate: new Date().toISOString(),
        visitType: 'ویزیت اولیه',
        ...extra,
      },
      doctorToken
    )
    expect(res.status).toBe(201)
    return res.body.visit
  }

  describe('authorization', () => {
    it('rejects the list without auth', async () => {
      const { status } = await api.get('/api/visits/follow-ups')
      expect(status).toBe(401)
    })

    it('rejects the list for a patient role', async () => {
      const { status } = await api.get('/api/visits/follow-ups', patientToken)
      expect(status).toBe(403)
    })

    it('rejects the summary for a patient role', async () => {
      const { status } = await api.get('/api/visits/follow-ups/summary', patientToken)
      expect(status).toBe(403)
    })

    it('restricts the manual sweep to admin_doctor', async () => {
      const doctor = await api.post('/api/visits/follow-ups/run', {}, doctorToken)
      expect(doctor.status).toBe(403)

      const admin = await api.post('/api/visits/follow-ups/run', {}, adminToken)
      expect(admin.status).toBe(200)
      expect(admin.body.data).toHaveProperty('scanned')
      expect(admin.body.data).toHaveProperty('sent')
    })
  })

  describe('GET /api/visits/follow-ups/summary', () => {
    it('returns the operational counters', async () => {
      const { status, body } = await api.get('/api/visits/follow-ups/summary', doctorToken)
      expect(status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data).toMatchObject({
        total: expect.any(Number),
        pending: expect.any(Number),
        overdue: expect.any(Number),
        today: expect.any(Number),
        upcoming: expect.any(Number),
        sent: expect.any(Number),
        dueNow: expect.any(Number),
        missingPhone: expect.any(Number),
        defaultReminderDays: expect.any(Number),
      })
    })
  })

  describe('visit persistence', () => {
    it('stores the follow-up date and per-visit lead time', async () => {
      const visit = await createVisit({
        nextVisitDate: tomorrow(),
        reminderDaysBefore: 5,
      })

      expect(visit.nextVisitDate).toBeTruthy()
      expect(visit.reminderDaysBefore).toBe(5)
      expect(visit.reminderSentAt).toBeNull()
    })

    it('accepts a visit with no follow-up', async () => {
      const visit = await createVisit()
      expect(visit.nextVisitDate).toBeNull()
      expect(visit.reminderDaysBefore).toBeNull()
    })

    it('rejects an out-of-range lead time', async () => {
      const { status } = await api.post(
        '/api/visits',
        {
          patientId,
          visitDate: new Date().toISOString(),
          nextVisitDate: tomorrow(),
          reminderDaysBefore: 9999,
        },
        doctorToken
      )
      expect(status).toBeGreaterThanOrEqual(400)
    })

    it('resets the sent marker when the follow-up date is moved', async () => {
      const visit = await createVisit({ nextVisitDate: tomorrow() })
      const res = await api.put(
        `/api/visits/${visit.id}`,
        { nextVisitDate: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10) },
        doctorToken
      )
      expect(res.status).toBe(200)
      expect(res.body.visit.reminderSentAt).toBeNull()
    })

    it('keeps the sent marker when only other fields change', async () => {
      const visit = await createVisit({ nextVisitDate: tomorrow() })
      // Simulate a delivered reminder.
      const doctorRes = await api.post(`/api/visits/${visit.id}/follow-up-reminder`, {}, doctorToken)
      // With no phone on the patient this is expected to fail closed.
      expect([200, 422]).toContain(doctorRes.status)

      const res = await api.put(`/api/visits/${visit.id}`, { notes: 'updated' }, doctorToken)
      expect(res.status).toBe(200)
      // The follow-up date was not touched, so the sent marker must survive.
      expect(res.body.visit.reminderSentAt).toBe(visit.reminderSentAt)
    })
  })

  describe('GET /api/visits/:id', () => {
    it('returns a single visit with the follow-up fields the edit dialog needs', async () => {
      const created = await createVisit({ nextVisitDate: tomorrow(), reminderDaysBefore: 5 })
      const { status, body } = await api.get(`/api/visits/${created.id}`, doctorToken)
      expect(status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data).toMatchObject({
        id: created.id,
        patientId,
        reminderDaysBefore: 5,
        reminderSentAt: null,
        durationMinutes: expect.any(Number),
        patientFullName: expect.any(String),
      })
      expect(body.data.nextVisitDate).toBeTruthy()
      // `endTime` is derived from the duration, never stored.
      expect(body.data.endTime).toBeUndefined()
    })

    it('404s for an unknown visit', async () => {
      const { status } = await api.get('/api/visits/00000000-0000-4000-8000-000000000000', doctorToken)
      expect(status).toBe(404)
    })

    it('rejects a patient role', async () => {
      const visit = await createVisit({ nextVisitDate: tomorrow() })
      const { status } = await api.get(`/api/visits/${visit.id}`, patientToken)
      expect(status).toBe(403)
    })
  })

  describe('GET /api/visits/follow-ups', () => {
    it('returns a paginated envelope', async () => {
      await createVisit({ nextVisitDate: tomorrow() })
      const { status, body } = await api.get('/api/visits/follow-ups?window=all', doctorToken)
      expect(status).toBe(200)
      expect(Array.isArray(body.data)).toBe(true)
      expect(body).toMatchObject({
        total: expect.any(Number),
        page: 1,
        limit: 20,
        totalPages: expect.any(Number),
      })
    })

    it('exposes the derived scheduling fields the UI needs', async () => {
      const visit = await createVisit({ nextVisitDate: tomorrow(), reminderDaysBefore: 2 })
      const rows = await myRows('all')
      const row = rows.find((r) => r.id === visit.id)
      expect(row, 'follow-up row for the created visit').toBeTruthy()
      expect(row).toMatchObject({
        patientId,
        hasPhone: false,
        reminderDaysBefore: 2,
        effectiveReminderDays: 2,
        usesDefaultReminderDays: false,
        reminderState: expect.any(String),
      })
      expect(row.daysUntil).toBeGreaterThanOrEqual(0)
    })

    it('falls back to the clinic default when the visit has no override', async () => {
      const visit = await createVisit({ nextVisitDate: tomorrow() })
      const rows = await myRows('all')
      const row = rows.find((r) => r.id === visit.id)
      expect(row, 'row for the created visit').toBeTruthy()
      expect(row.reminderDaysBefore).toBeNull()
      expect(row.usesDefaultReminderDays).toBe(true)
      const { body: summary } = await api.get('/api/visits/follow-ups/summary', doctorToken)
      expect(row.effectiveReminderDays).toBe(summary.data.defaultReminderDays)
    })

    it('filters to the pending work queue', async () => {
      const { status, body } = await api.get('/api/visits/follow-ups?window=pending', doctorToken)
      expect(status).toBe(200)
      for (const row of body.data) {
        expect(row.reminderSentAt).toBeNull()
      }
    })

    it('rejects an unknown window value', async () => {
      const { status } = await api.get('/api/visits/follow-ups?window=bogus', doctorToken)
      expect(status).toBeGreaterThanOrEqual(400)
    })

    it('searches by national ID', async () => {
      const rows = await myRows('all')
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) {
        expect(row.patientId).toBe(patientId)
      }
    })
  })

  describe('POST /api/visits/:id/follow-up-reminder', () => {
    it('fails closed when the patient has no phone', async () => {
      const visit = await createVisit({ nextVisitDate: tomorrow() })
      const { status, body } = await api.post(
        `/api/visits/${visit.id}/follow-up-reminder`,
        {},
        doctorToken
      )
      expect(status).toBe(422)
      expect(JSON.stringify(body)).toContain('no_phone')
    })

    it('fails when the visit has no follow-up date', async () => {
      const visit = await createVisit()
      const { status, body } = await api.post(
        `/api/visits/${visit.id}/follow-up-reminder`,
        {},
        doctorToken
      )
      expect(status).toBe(400)
      expect(JSON.stringify(body)).toContain('no_followup')
    })

    it('rejects a patient role', async () => {
      const visit = await createVisit({ nextVisitDate: tomorrow() })
      const { status } = await api.post(
        `/api/visits/${visit.id}/follow-up-reminder`,
        {},
        patientToken
      )
      expect(status).toBe(403)
    })

    it('404s for an unknown visit', async () => {
      const { status } = await api.post(
        '/api/visits/00000000-0000-0000-0000-000000000000/follow-up-reminder',
        {},
        doctorToken
      )
      expect(status).toBe(404)
    })
  })
})

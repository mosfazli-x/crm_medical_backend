import { describe, it, expect, beforeAll } from 'vitest'
import { api, registerTestUser } from './helpers'

describe('Daily Reports API', () => {
  let patientToken = ''
  let doctorToken = ''
  let patientId = ''
  let createdReportId = ''
  const today = new Date().toISOString().slice(0, 10)

  beforeAll(async () => {
    const patient = await registerTestUser('patient')
    patientToken = patient.token
    const doctor = await registerTestUser('doctor')
    doctorToken = doctor.token

    const res = await api.get('/api/patients', doctorToken)
    const list = res.body.data
    if (Array.isArray(list) && list.length > 0) {
      patientId = list[0].id
    }
  })

  describe('GET /api/daily-reports', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/daily-reports')
      expect(status).toBe(401)
    })

    it('should reject with patient role', async () => {
      const { status } = await api.get('/api/daily-reports', patientToken)
      expect(status).toBe(403)
    })

    it('should return reports list for doctor', async () => {
      const { status, body } = await api.get('/api/daily-reports', doctorToken)
      expect(status).toBe(200)
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
    })
  })

  describe('POST /api/daily-reports', () => {
    it('should reject without auth', async () => {
      const { status } = await api.post('/api/daily-reports', {})
      expect(status).toBe(401)
    })

    it('should create a daily report with doctor role', async () => {
      if (!patientId) return
      const { status, body } = await api.post('/api/daily-reports', {
        reportDate: today,
        patientId,
        visitTypes: ['Initial Visit', 'Follow-up'],
        procedures: ['mixed_laser', 'co2_test', 'other'],
        otherProcedureText: 'Custom procedure',
        feeCollected: 1500000,
        paymentMethod: 'card_terminal',
        notes: 'Test daily report',
      }, doctorToken)
      expect(status).toBe(201)
      expect(body.success).toBe(true)
      expect(body.data).toBeDefined()
      createdReportId = body.data?.id
    })

    it('should reject invalid payment method', async () => {
      if (!patientId) return
      const { status } = await api.post('/api/daily-reports', {
        reportDate: today,
        patientId,
        procedures: [],
        paymentMethod: 'cheque',
      }, doctorToken)
      expect(status).toBe(400)
    })
  })

  describe('DELETE /api/daily-reports/:id', () => {
    it('should delete the created report', async () => {
      if (!createdReportId) return
      const { status, body } = await api.delete(`/api/daily-reports/${createdReportId}`, doctorToken)
      expect(status).toBe(200)
      expect(body.success).toBe(true)
    })
  })

  describe('Daily Report Visit Types', () => {
    let visitTypeId = ''

    it('should list visit types with doctor role', async () => {
      const { status, body } = await api.get('/api/daily-reports/visit-types', doctorToken)
      expect(status).toBe(200)
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('should reject creating visit type without auth', async () => {
      const { status } = await api.post('/api/daily-reports/visit-types', { name: 'No Auth Type' })
      expect(status).toBe(401)
    })

    it('should create a visit type', async () => {
      const { status, body } = await api.post('/api/daily-reports/visit-types', {
        name: 'Test Daily Type',
        description: 'Created by tests',
        price: 250000,
        color: '#4F46E5',
      }, doctorToken)
      expect(status).toBe(201)
      expect(body.success).toBe(true)
      expect(body.data?.name).toBe('Test Daily Type')
      visitTypeId = body.data?.id
    })

    it('should reject invalid visit type (empty name)', async () => {
      const { status } = await api.post('/api/daily-reports/visit-types', { name: '' }, doctorToken)
      expect(status).toBe(400)
    })

    it('should update the created visit type', async () => {
      if (!visitTypeId) return
      const { status, body } = await api.put(`/api/daily-reports/visit-types/${visitTypeId}`, {
        price: 300000,
        isActive: false,
      }, doctorToken)
      expect(status).toBe(200)
      expect(body.data?.price).toBeDefined()
    })

    it('should delete the created visit type', async () => {
      if (!visitTypeId) return
      const { status, body } = await api.delete(`/api/daily-reports/visit-types/${visitTypeId}`, doctorToken)
      expect(status).toBe(200)
      expect(body.success).toBe(true)
    })
  })

  describe('GET /api/daily-reports/stats', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/daily-reports/stats')
      expect(status).toBe(401)
    })

    it('should return stats structure for doctor', async () => {
      const { status, body } = await api.get('/api/daily-reports/stats', doctorToken)
      expect(status).toBe(200)
      expect(body.success).toBe(true)
      expect(typeof body.data.totalReports).toBe('number')
      expect(typeof body.data.totalCollected).toBe('string')
      expect(Array.isArray(body.data.byPaymentMethod)).toBe(true)
      expect(Array.isArray(body.data.byDay)).toBe(true)
      expect(Array.isArray(body.data.byProcedure)).toBe(true)
      expect(Array.isArray(body.data.byVisitType)).toBe(true)
    })

    it('should accept range and payment filters', async () => {
      const { status, body } = await api.get('/api/daily-reports/stats?from=2020-01-01&to=2030-01-01&paymentMethod=cash', doctorToken)
      expect(status).toBe(200)
      expect(body.success).toBe(true)
    })
  })
})

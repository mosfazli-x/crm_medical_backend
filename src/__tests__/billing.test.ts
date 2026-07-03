import { describe, it, expect, beforeAll } from 'vitest'
import { api, registerTestUser } from './helpers'

describe('Billing API', () => {
  let patientToken = ''
  let doctorToken = ''

  beforeAll(async () => {
    const patient = await registerTestUser('patient')
    patientToken = patient.token
    const doctor = await registerTestUser('doctor')
    doctorToken = doctor.token
  })

  describe('GET /api/billing/procedure-codes', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/billing/procedure-codes')
      expect(status).toBe(401)
    })

    it('should return procedure codes for doctor', async () => {
      const { status, body } = await api.get('/api/billing/procedure-codes', doctorToken)
      expect(status).toBe(200)
      expect(body.success).toBe(true)
    })
  })

  describe('POST /api/billing/procedure-codes', () => {
    it('should reject without auth', async () => {
      const { status } = await api.post('/api/billing/procedure-codes', {})
      expect(status).toBe(401)
    })

    it('should require admin_doctor role (not doctor)', async () => {
      const { status } = await api.post('/api/billing/procedure-codes', {
        code: 'TEST',
      }, doctorToken)
      expect(status).toBe(403)
    })
  })

  describe('GET /api/billing/records', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/billing/records')
      expect(status).toBe(401)
    })

    it('should return billing records for doctor', async () => {
      const { status, body } = await api.get('/api/billing/records', doctorToken)
      expect(status).toBe(200)
      expect(body.success).toBe(true)
    })
  })

  describe('POST /api/billing/records', () => {
    it('should reject without auth', async () => {
      const { status } = await api.post('/api/billing/records', {})
      expect(status).toBe(401)
    })
  })
})

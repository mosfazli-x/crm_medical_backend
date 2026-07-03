import { describe, it, expect, beforeAll } from 'vitest'
import { api, registerTestUser } from './helpers'

describe('Reproductive Health API', () => {
  let patientToken = ''
  let doctorToken = ''

  beforeAll(async () => {
    const patient = await registerTestUser('patient')
    patientToken = patient.token
    const doctor = await registerTestUser('doctor')
    doctorToken = doctor.token
  })

  describe('GET /api/reproductive/:patientId', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/reproductive/test-id')
      expect(status).toBe(401)
    })

    it('should reject with patient role', async () => {
      const { status } = await api.get('/api/reproductive/test-id', patientToken)
      expect(status).toBe(403)
    })
  })

  describe('PUT /api/reproductive/:patientId/menstrual-history', () => {
    it('should reject without auth', async () => {
      const { status } = await api.put('/api/reproductive/test-id/menstrual-history', {})
      expect(status).toBe(401)
    })
  })

  describe('PUT /api/reproductive/:patientId/sexual-history', () => {
    it('should reject without auth', async () => {
      const { status } = await api.put('/api/reproductive/test-id/sexual-history', {})
      expect(status).toBe(401)
    })
  })

  describe('PUT /api/reproductive/:patientId/surgeries', () => {
    it('should reject without auth', async () => {
      const { status } = await api.put('/api/reproductive/test-id/surgeries', {})
      expect(status).toBe(401)
    })
  })

  describe('PUT /api/reproductive/:patientId/contraceptives', () => {
    it('should reject without auth', async () => {
      const { status } = await api.put('/api/reproductive/test-id/contraceptives', {})
      expect(status).toBe(401)
    })
  })

  describe('PUT /api/reproductive/:patientId/family-history', () => {
    it('should reject without auth', async () => {
      const { status } = await api.put('/api/reproductive/test-id/family-history', {})
      expect(status).toBe(401)
    })
  })

  describe('PUT /api/reproductive/:patientId/reproductive-summary', () => {
    it('should reject without auth', async () => {
      const { status } = await api.put('/api/reproductive/test-id/reproductive-summary', {})
      expect(status).toBe(401)
    })
  })
})

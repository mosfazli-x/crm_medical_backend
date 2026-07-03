import { describe, it, expect, beforeAll } from 'vitest'
import { api, registerTestUser } from './helpers'

describe('Pregnancy API', () => {
  let patientToken = ''
  let doctorToken = ''

  beforeAll(async () => {
    const patient = await registerTestUser('patient')
    patientToken = patient.token
    const doctor = await registerTestUser('doctor')
    doctorToken = doctor.token
  })

  describe('GET /api/pregnancy/:pregnancyId/prenatal-visits', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/pregnancy/test-id/prenatal-visits')
      expect(status).toBe(401)
    })

    it('should reject with patient role', async () => {
      const { status } = await api.get('/api/pregnancy/test-id/prenatal-visits', patientToken)
      expect(status).toBe(403)
    })
  })

  describe('POST /api/pregnancy/prenatal-visits', () => {
    it('should reject without auth', async () => {
      const { status } = await api.post('/api/pregnancy/prenatal-visits', {})
      expect(status).toBe(401)
    })
  })

  describe('GET /api/pregnancy/:pregnancyId/fetal-measurements', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/pregnancy/test-id/fetal-measurements')
      expect(status).toBe(401)
    })
  })

  describe('GET /api/pregnancy/:pregnancyId/postpartum-plan', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/pregnancy/test-id/postpartum-plan')
      expect(status).toBe(401)
    })
  })
})

import { describe, it, expect, beforeAll } from 'vitest'
import { api, registerTestUser } from './helpers'

describe('Consent API', () => {
  let patientToken = ''
  let doctorToken = ''

  beforeAll(async () => {
    const patient = await registerTestUser('patient')
    patientToken = patient.token
    const doctor = await registerTestUser('doctor')
    doctorToken = doctor.token
  })

  describe('GET /api/consent/patient/:patientId', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/consent/patient/test-id')
      expect(status).toBe(401)
    })
  })

  describe('GET /api/consent/patient/:patientId/active', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/consent/patient/test-id/active')
      expect(status).toBe(401)
    })
  })

  describe('POST /api/consent', () => {
    it('should reject without auth', async () => {
      const { status } = await api.post('/api/consent', {})
      expect(status).toBe(401)
    })
  })
})

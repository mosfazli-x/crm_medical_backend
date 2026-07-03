import { describe, it, expect, beforeAll } from 'vitest'
import { api, registerTestUser } from './helpers'

describe('Scheduling API', () => {
  let patientToken = ''
  let doctorToken = ''

  beforeAll(async () => {
    const patient = await registerTestUser('patient')
    patientToken = patient.token
    const doctor = await registerTestUser('doctor')
    doctorToken = doctor.token
  })

  describe('GET /api/scheduling/doctors (public)', () => {
    it('should return list of doctors', async () => {
      const { status, body } = await api.get('/api/scheduling/doctors')
      expect(status).toBe(200)
      expect(body.success).toBe(true)
    })
  })

  describe('POST /api/scheduling/availability', () => {
    it('should reject without auth', async () => {
      const { status } = await api.post('/api/scheduling/availability', {})
      expect(status).toBe(401)
    })
  })

  describe('POST /api/scheduling/appointments', () => {
    it('should reject invalid booking data', async () => {
      const { status } = await api.post('/api/scheduling/appointments', {})
      expect(status).toBe(400)
    })
  })

  describe('GET /api/scheduling/appointments (requires auth)', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/scheduling/appointments')
      expect(status).toBe(401)
    })
  })
})

import { describe, it, expect, beforeAll } from 'vitest'
import { api, registerTestUser } from './helpers'

describe('Visit Types API', () => {
  let patientToken = ''
  let doctorToken = ''
  let doctorId = ''

  beforeAll(async () => {
    const patient = await registerTestUser('patient')
    patientToken = patient.token
    const doctor = await registerTestUser('doctor')
    doctorToken = doctor.token
    doctorId = doctor.user.id
  })

  describe('GET /api/visit-types/:doctorId (public)', () => {
    it('should return visit types for public access', async () => {
      const { status } = await api.get(`/api/visit-types/${doctorId}`)
      expect(status).toBe(200)
    })
  })

  describe('POST /api/visit-types', () => {
    it('should reject without auth', async () => {
      const { status } = await api.post('/api/visit-types', {})
      expect(status).toBe(401)
    })

    it('should validate required fields', async () => {
      const { status } = await api.post('/api/visit-types', {}, doctorToken)
      expect(status).toBe(400)
    })
  })
})

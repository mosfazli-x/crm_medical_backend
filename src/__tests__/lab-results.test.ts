import { describe, it, expect, beforeAll } from 'vitest'
import { api, registerTestUser } from './helpers'

describe('Lab Results API', () => {
  let patientToken = ''
  let doctorToken = ''

  beforeAll(async () => {
    const patient = await registerTestUser('patient')
    patientToken = patient.token
    const doctor = await registerTestUser('doctor')
    doctorToken = doctor.token
  })

  describe('GET /api/lab-results/patient/:patientId/categories', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/lab-results/patient/test-id/categories')
      expect(status).toBe(401)
    })
  })

  describe('GET /api/lab-results/patient/:patientId', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/lab-results/patient/test-id')
      expect(status).toBe(401)
    })
  })

  describe('POST /api/lab-results/', () => {
    it('should reject without auth', async () => {
      const { status } = await api.post('/api/lab-results/', {})
      expect(status).toBe(401)
    })
  })
})

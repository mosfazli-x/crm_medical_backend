import { describe, it, expect, beforeAll } from 'vitest'
import { api, registerTestUser } from './helpers'

describe('Visits API', () => {
  let patientToken = ''
  let doctorToken = ''

  beforeAll(async () => {
    const patient = await registerTestUser('patient')
    patientToken = patient.token
    const doctor = await registerTestUser('doctor')
    doctorToken = doctor.token
  })

  describe('GET /api/visits', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/visits')
      expect(status).toBe(401)
    })

    it('should reject with patient role', async () => {
      const { status } = await api.get('/api/visits', patientToken)
      expect(status).toBe(403)
    })

    it('should return visits list for doctor', async () => {
      const { status } = await api.get('/api/visits', doctorToken)
      expect(status).toBe(200)
    })
  })

  describe('GET /api/visits/ (calendar events)', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/visits/')
      expect(status).toBe(401)
    })

    it('should return calendar events for doctor', async () => {
      const { status } = await api.get('/api/visits/', doctorToken)
      expect(status).toBe(200)
    })
  })

  describe('GET /api/visits/patients', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/visits/patients')
      expect(status).toBe(401)
    })
  })

  describe('POST /api/visits', () => {
    it('should reject without auth', async () => {
      const { status } = await api.post('/api/visits', {})
      expect(status).toBe(401)
    })
  })
})

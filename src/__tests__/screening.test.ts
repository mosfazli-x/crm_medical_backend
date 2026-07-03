import { describe, it, expect, beforeAll } from 'vitest'
import { api, registerTestUser } from './helpers'

describe('Screening API', () => {
  let patientToken = ''
  let doctorToken = ''

  beforeAll(async () => {
    const patient = await registerTestUser('patient')
    patientToken = patient.token
    const doctor = await registerTestUser('doctor')
    doctorToken = doctor.token
  })

  describe('GET /api/screening/schedules', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/screening/schedules')
      expect(status).toBe(401)
    })
  })

  describe('POST /api/screening/schedules', () => {
    it('should reject without auth', async () => {
      const { status } = await api.post('/api/screening/schedules', {})
      expect(status).toBe(401)
    })
  })

  describe('GET /api/screening/results', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/screening/results')
      expect(status).toBe(401)
    })
  })

  describe('POST /api/screening/results', () => {
    it('should reject without auth', async () => {
      const { status } = await api.post('/api/screening/results', {})
      expect(status).toBe(401)
    })
  })
})

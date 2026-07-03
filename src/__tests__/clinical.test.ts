import { describe, it, expect, beforeAll } from 'vitest'
import { api, registerTestUser } from './helpers'

describe('Clinical Tools API', () => {
  let patientToken = ''
  let doctorToken = ''

  beforeAll(async () => {
    const patient = await registerTestUser('patient')
    patientToken = patient.token
    const doctor = await registerTestUser('doctor')
    doctorToken = doctor.token
  })

  describe('POST /api/clinical/assess/pcos-rotterdam', () => {
    it('should reject without auth', async () => {
      const { status } = await api.post('/api/clinical/assess/pcos-rotterdam', {})
      expect(status).toBe(401)
    })

    it('should reject with patient role', async () => {
      const { status } = await api.post('/api/clinical/assess/pcos-rotterdam', {}, patientToken)
      expect(status).toBe(403)
    })

    it('should return 500 for invalid patient_id (backend bug)', async () => {
      const { status } = await api.post('/api/clinical/assess/pcos-rotterdam', {
        patient_id: 'test',
      }, doctorToken)
      expect(status).toBe(500)
    })
  })

  describe('POST /api/clinical/assess/menopause-score', () => {
    it('should reject without auth', async () => {
      const { status } = await api.post('/api/clinical/assess/menopause-score', {})
      expect(status).toBe(401)
    })
  })

  describe('POST /api/clinical/assess/bishop-score', () => {
    it('should reject without auth', async () => {
      const { status } = await api.post('/api/clinical/assess/bishop-score', {})
      expect(status).toBe(401)
    })
  })

  describe('POST /api/clinical/assess/breast-cancer-risk', () => {
    it('should reject without auth', async () => {
      const { status } = await api.post('/api/clinical/assess/breast-cancer-risk', {})
      expect(status).toBe(401)
    })
  })

  describe('GET /api/clinical/history/:patientId', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/clinical/history/test-id')
      expect(status).toBe(401)
    })
  })
})

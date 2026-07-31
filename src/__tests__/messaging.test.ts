import { describe, it, expect, beforeAll } from 'vitest'
import { api, registerTestUser } from './helpers'

describe('Messaging API', () => {
  let patientToken = ''
  let doctorToken = ''

  beforeAll(async () => {
    const patient = await registerTestUser('patient')
    patientToken = patient.token
    const doctor = await registerTestUser('doctor')
    doctorToken = doctor.token
  })

  describe('GET /api/messaging/inbox', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/messaging/inbox')
      expect(status).toBe(401)
    })

    it('should return inbox for doctor', async () => {
      const { status, body } = await api.get('/api/messaging/inbox', doctorToken)
      expect(status).toBe(200)
      expect(body.success).toBe(true)
    })
  })

  describe('GET /api/messaging/sent', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/messaging/sent')
      expect(status).toBe(401)
    })

    it('should return sent messages for doctor', async () => {
      const { status, body } = await api.get('/api/messaging/sent', doctorToken)
      expect(status).toBe(200)
    })
  })

  describe('GET /api/messaging/unread-count', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/messaging/unread-count')
      expect(status).toBe(401)
    })
  })

  describe('POST /api/messaging/send', () => {
    it('should reject without auth', async () => {
      const { status } = await api.post('/api/messaging/send', {})
      expect(status).toBe(401)
    })

    it('should validate required fields', async () => {
      const { status } = await api.post('/api/messaging/send', {
        subject: 'Test',
      }, doctorToken)
      expect(status).toBe(400)
    })
  })

  describe('PATCH /api/messaging/:id/read', () => {
    it('should reject without auth', async () => {
      const { status } = await api.patch('/api/messaging/test-id/read')
      expect(status).toBe(401)
    })
  })
})

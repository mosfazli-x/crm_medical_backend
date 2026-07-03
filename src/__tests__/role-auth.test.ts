import { describe, it, expect, beforeAll } from 'vitest'
import { api, registerTestUser } from './helpers'

describe('Role-Based Access Control', () => {
  let patientToken = ''
  let doctorToken = ''

  beforeAll(async () => {
    const patient = await registerTestUser('patient')
    patientToken = patient.token
    const doctor = await registerTestUser('doctor')
    doctorToken = doctor.token
  })

  const patientRestrictedEndpoints = [
    '/api/patients',
    '/api/visits',
    '/api/reproductive/test-id',
    '/api/screening/schedules',
    '/api/screening/results',
    '/api/lab-results/categories',
    '/api/billing/records',
    '/api/billing/procedure-codes',
    '/api/consent/patient/test-id',
  ]

  const publicEndpoints = [
    '/api/scheduling/doctors',
  ]

  describe('Unauthenticated access', () => {
    it('should return 401 for protected endpoints', async () => {
      const endpoints = [
        '/api/auth/me',
        '/api/patients',
        '/api/visits',
        '/api/billing/records',
        '/api/messaging/inbox',
        '/api/consent/patient/test',
      ]

      for (const path of endpoints) {
        const { status } = await api.get(path)
        expect(status, `${path} should return 401`).toBe(401)
      }
    })
  })

  describe('Patient role restrictions', () => {
    it('should return 403 for doctor/admin-only endpoints', async () => {
      for (const path of patientRestrictedEndpoints) {
        const { status } = await api.get(path, patientToken)
        expect(status, `${path} should return 403 for patient role`).toBe(403)
      }
    })
  })

  describe('Protected endpoints accessible to doctor role', () => {
    it('should return 200 for doctor on patient endpoints', async () => {
      const { status } = await api.get('/api/patients', doctorToken)
      expect(status).toBe(200)
    })
  })

  describe('Endpoints requiring auth', () => {
    it('should reject unauthenticated access', async () => {
      const authEndpoints = [
        { path: '/api/auth/change-password', method: 'patch' as const, body: {} },
        { path: '/api/auth/profile', method: 'patch' as const, body: {} },
        { path: '/api/patients/send-sms', method: 'post' as const, body: {} },
      ]

      for (const { path, method, body } of authEndpoints) {
        const { status } = await api[method](path, body)
        expect(status, `${method.toUpperCase()} ${path} should return 401`).toBe(401)
      }
    })
  })
})

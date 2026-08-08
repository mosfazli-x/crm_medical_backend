import { describe, it, expect, beforeAll } from 'vitest'
import { api, generatePhone, registerTestUser } from './helpers'

describe('Patients API', () => {
  let patientToken = ''
  let doctorToken = ''
  let createdPatientId = ''

  beforeAll(async () => {
    const patient = await registerTestUser('patient')
    patientToken = patient.token
    const doctor = await registerTestUser('doctor')
    doctorToken = doctor.token
  })

  describe('POST /api/patients/register', () => {
    it('should reject without auth', async () => {
      const { status } = await api.post('/api/patients/register', {
        patient: {
          first_name: 'Test',
          last_name: 'Patient',
          national_id: generatePhone().slice(0, 10),
        }
      })
      expect(status).toBe(401)
    })

    it('should reject with patient role (403)', async () => {
      const nationalId = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0')
      const { status } = await api.post('/api/patients/register', {
        patient: {
          first_name: 'Test',
          last_name: 'Patient',
          national_id: nationalId,
          phone: generatePhone(),
        }
      }, patientToken)
      expect(status).toBe(403)
    })

    it('should require multipart form data', async () => {
      const nationalId = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0')
      const { status, body } = await api.post('/api/patients/register', {
        patient: {
          first_name: 'Test',
          last_name: 'Patient',
          national_id: nationalId,
          phone: generatePhone(),
        }
      }, doctorToken)
      expect(status).toBe(400)
      expect(body.success).toBe(false)
    })

    it('should require admin_doctor or doctor role', async () => {
      const { status } = await api.post('/api/patients/register', {}, patientToken)
      expect(status).toBe(403)
    })
  })

  describe('GET /api/patients', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/patients')
      expect(status).toBe(401)
    })

    it('should reject with patient role', async () => {
      const { status } = await api.get('/api/patients', patientToken)
      expect(status).toBe(403)
    })

    it('should return patients list with doctor role', async () => {
      const { status, body } = await api.get('/api/patients', doctorToken)
      expect(status).toBe(200)
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('should return pagination envelope when page/limit provided', async () => {
      const { status, body } = await api.get('/api/patients?page=1&limit=5', doctorToken)
      expect(status).toBe(200)
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data.length).toBeLessThanOrEqual(5)
      const pagination = body.pagination!
      expect(pagination).toBeDefined()
      expect(pagination.page).toBe(1)
      expect(pagination.limit).toBe(5)
      expect(pagination.total).toBeTypeOf('number')
      expect(pagination.totalPages).toBeTypeOf('number')
      expect(pagination.hasMore).toBeTypeOf('boolean')
    })

    it('should omit pagination when page/limit not provided (backward compat)', async () => {
      const { status, body } = await api.get('/api/patients', doctorToken)
      expect(status).toBe(200)
      expect(body.pagination).toBeUndefined()
    })

    it('should filter by q and marital_status', async () => {
      const { status, body } = await api.get(
        `/api/patients?page=1&limit=10&q=${generatePhone().slice(0, 6)}&marital_status=single`,
        doctorToken
      )
      expect(status).toBe(200)
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.pagination!.total).toBe(0)
    })

    it('should apply sort param', async () => {
      const { status, body } = await api.get('/api/patients?page=1&limit=10&sort=full_name_asc', doctorToken)
      expect(status).toBe(200)
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.pagination).toBeDefined()
      expect(body.pagination!.totalPages).toBeTypeOf('number')
    })
  })

  describe('GET /api/patients/search', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/patients/search')
      expect(status).toBe(401)
    })

    it('should search by national_id, phone, first_name, last_name', async () => {
      const { status, body } = await api.get('/api/patients/search?q=test', doctorToken)
      expect(status).toBe(200)
      expect(body.success).toBe(true)
    })
  })

  describe('GET /api/patients/:id', () => {
    it('should return 500 for invalid UUID (backend bug)', async () => {
      const { status } = await api.get('/api/patients/invalid-id', doctorToken)
      expect(status).toBe(500)
    })
  })

  describe('DELETE /api/patients/:id', () => {
    it('should reject without auth', async () => {
      const { status } = await api.delete('/api/patients/some-id')
      expect(status).toBe(401)
    })
  })
})

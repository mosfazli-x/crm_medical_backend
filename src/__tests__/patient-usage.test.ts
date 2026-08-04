import { describe, it, expect, beforeAll } from 'vitest'
import { api, generatePhone, registerTestUser } from './helpers'

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001'

async function createPatient(token: string, name: string) {
  const nationalId = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0')
  const form = new FormData()
  form.append('patient', JSON.stringify({
    first_name: name,
    last_name: 'Usage Test',
    national_id: nationalId,
    phone: generatePhone(),
  }))
  const res = await fetch(`${API_BASE}/api/patients/register`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  return res.json() as any
}

async function registerPharmacy() {
  const phone = generatePhone()
  const res = await api.post('/api/auth/register', {
    phone,
    fullName: 'Test pharmacy',
    role: 'pharmacy',
    password: 'Test1234',
    organizationName: 'Test Pharmacy Co',
  })
  if (res.status >= 400) {
    throw new Error(`Failed to register pharmacy: ${JSON.stringify(res.body)}`)
  }
  return res.body.token!
}

describe('Patient Usage API', () => {
  let adminToken = ''
  let pharmacyToken = ''
  let doctorToken = ''
  let patientToken = ''

  let productId = ''
  let patientId = ''
  let usageId = ''

  beforeAll(async () => {
    const admin = await registerTestUser('admin_doctor')
    adminToken = admin.token
    pharmacyToken = await registerPharmacy()
    const doctor = await registerTestUser('doctor')
    doctorToken = doctor.token
    const patient = await registerTestUser('patient')
    patientToken = patient.token
  })

  describe('Auth & role checks', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/patient-usage')
      expect(status).toBe(401)
    })

    it('should reject patient role (403)', async () => {
      const { status } = await api.get('/api/patient-usage', patientToken)
      expect(status).toBe(403)
    })

    it('should reject doctor role (403)', async () => {
      const { status } = await api.post('/api/patient-usage', {}, doctorToken)
      expect(status).toBe(403)
    })

    it('should reject pharmacy delete (admin only, 403)', async () => {
      const { status } = await api.delete('/api/patient-usage/00000000-0000-0000-0000-000000000000', pharmacyToken)
      expect(status).toBe(403)
    })
  })

  describe('POST /api/patient-usage', () => {
    beforeAll(async () => {
      const productRes = await api.post('/api/inventory/products', {
        name: 'Usage Test Product',
        sku: `USG-${Math.floor(Math.random() * 100000)}`,
        unit: 'عدد',
        min_stock_level: 5,
      }, adminToken)
      expect(productRes.status).toBe(201)
      productId = productRes.body.data?.id ?? productRes.body.data?.product?.id

      const stockRes = await api.post('/api/inventory/stock-movements', {
        product_id: productId,
        movement_type: 'in',
        quantity: 100,
      }, adminToken)
      expect(stockRes.status).toBe(201)

      const patientRes = await createPatient(adminToken, 'Usage')
      patientId = patientRes.patientId
      expect(patientId).toBeTruthy()
    })

    it('should record usage and decrement stock', async () => {
      const { status, body } = await api.post('/api/patient-usage', {
        patient_id: patientId,
        product_id: productId,
        quantity: 10,
        unit_price: 500,
        notes: 'test usage',
      }, adminToken)
      expect(status).toBe(201)
      expect(body.success).toBe(true)
      usageId = body.data?.id
      expect(usageId).toBeTruthy()
      expect(Number(body.data?.quantity)).toBe(10)
      expect(Number(body.data?.totalPrice)).toBe(5000)
    })

    it('should reject insufficient stock', async () => {
      const { status, body } = await api.post('/api/patient-usage', {
        patient_id: patientId,
        product_id: productId,
        quantity: 9999,
      }, adminToken)
      expect(status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.error).toMatch(/Insufficient stock/)
    })

    it('should reject invalid body', async () => {
      const { status } = await api.post('/api/patient-usage', { product_id: productId }, adminToken)
      expect(status).toBe(400)
    })
  })

  describe('GET /api/patient-usage', () => {
    it('should list usages with joined patient/product info', async () => {
      const { status, body } = await api.get('/api/patient-usage', adminToken)
      expect(status).toBe(200)
      const usage = body.data?.find((u: any) => u.id === usageId)
      expect(usage).toBeTruthy()
      expect(usage.patientName).toBeTruthy()
      expect(usage.productName).toBeTruthy()
      expect(Number(usage.quantity)).toBe(10)
    })

    it('should filter by product_id', async () => {
      const { status, body } = await api.get(`/api/patient-usage?product_id=${productId}`, pharmacyToken)
      expect(status).toBe(200)
      expect(body.data?.every((u: any) => u.productId === productId)).toBe(true)
    })
  })

  describe('Search endpoints', () => {
    it('should search patients by query', async () => {
      const { status, body } = await api.get('/api/patient-usage/patients/search?q=Usage', pharmacyToken)
      expect(status).toBe(200)
      expect(body.data?.some((p: any) => p.id === patientId)).toBe(true)
    })

    it('should reject visits search without patient_id', async () => {
      const { status } = await api.get('/api/patient-usage/visits/search', pharmacyToken)
      expect(status).toBe(400)
    })

    it('should return visits for a patient', async () => {
      const { status, body } = await api.get(`/api/patient-usage/visits/search?patient_id=${patientId}`, pharmacyToken)
      expect(status).toBe(200)
      expect(Array.isArray(body.data)).toBe(true)
    })
  })

  describe('DELETE /api/patient-usage/:id', () => {
    it('should delete usage and restock the product', async () => {
      const { status } = await api.delete(`/api/patient-usage/${usageId}`, adminToken)
      expect(status).toBe(200)

      const { body } = await api.get('/api/patient-usage', adminToken)
      expect(body.data?.some((u: any) => u.id === usageId)).toBe(false)

      const productRes = await api.get(`/api/inventory/products/${productId}`, adminToken)
      expect(Number(productRes.body.data?.currentStock)).toBe(100)
    })

    it('should 404 for unknown id', async () => {
      const { status } = await api.delete('/api/patient-usage/00000000-0000-0000-0000-000000000000', adminToken)
      expect(status).toBe(404)
    })
  })
})

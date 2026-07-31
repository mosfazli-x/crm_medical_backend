import { describe, it, expect, beforeAll } from 'vitest'
import { api, registerTestUser, generatePhone } from './helpers'

function randomNationalId(): string {
  return Math.floor(1000000000 + Math.random() * 8999999999).toString()
}

describe('Lead Sources API', () => {
  let doctorToken = ''
  let adminToken = ''
  let sourceName = ''

  beforeAll(async () => {
    const doctor = await registerTestUser('doctor')
    doctorToken = doctor.token
    const admin = await registerTestUser('admin_doctor')
    adminToken = admin.token
    sourceName = `Test Source ${Date.now()}`
  })

  describe('GET /api/lead-sources', () => {
    it('should reject without auth', async () => {
      const { status } = await api.get('/api/lead-sources')
      expect(status).toBe(401)
    })

    it('should list default sources for doctor', async () => {
      const { status, body } = await api.get('/api/lead-sources', doctorToken)
      expect(status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.length).toBeGreaterThanOrEqual(9)
      expect(body.data.some((s: any) => s.name === 'Instagram')).toBe(true)
      expect(body.data[0].category).toBeDefined()
    })
  })

  describe('POST /api/lead-sources', () => {
    it('should forbid non-admin creation', async () => {
      const { status } = await api.post('/api/lead-sources', { name: 'X' }, doctorToken)
      expect(status).toBe(403)
    })

    it('should create a source as admin', async () => {
      const { status, body } = await api.post('/api/lead-sources', {
        name: sourceName,
        type: 'other',
        category: 'other',
        sortOrder: 99,
      }, adminToken)
      expect(status).toBe(201)
      expect(body.data.name).toBe(sourceName)
    })

    it('should reject duplicate names', async () => {
      const { status } = await api.post('/api/lead-sources', {
        name: sourceName,
        type: 'other',
      }, adminToken)
      expect(status).toBe(409)
    })

    it('should reject invalid type', async () => {
      const { status } = await api.post('/api/lead-sources', {
        name: 'Bad Source',
        type: 'not_a_type',
      }, adminToken)
      expect(status).toBe(400)
    })
  })
})

describe('Leads API', () => {
  let adminToken = ''
  let doctorToken = ''
  let leadId = ''
  let convertedPatientId = ''

  beforeAll(async () => {
    const admin = await registerTestUser('admin_doctor')
    adminToken = admin.token
    const doctor = await registerTestUser('doctor')
    doctorToken = doctor.token
  })

  describe('GET /api/leads/options', () => {
    it('should return controlled option sets', async () => {
      const { status, body } = await api.get('/api/leads/options', doctorToken)
      expect(status).toBe(200)
      expect(body.data.statuses).toContain('qualified')
      expect(body.data.statuses).toContain('converted')
      expect(body.data.priorities).toContain('high')
      expect(body.data.lostReasons).toContain('competitor')
    })
  })

  describe('POST /api/leads', () => {
    it('should reject without auth', async () => {
      const { status } = await api.post('/api/leads', { firstName: 'Ali', lastName: 'Rezaei' })
      expect(status).toBe(401)
    })

    it('should validate required fields', async () => {
      const { status } = await api.post('/api/leads', { firstName: 'Ali' }, doctorToken)
      expect(status).toBe(400)
    })

    it('should create a lead with attribution', async () => {
      const { status, body } = await api.post('/api/leads', {
        firstName: 'Sara',
        lastName: 'Mohammadi',
        phone: generatePhone(),
        nationalId: randomNationalId(),
        sourceId: (await api.get('/api/lead-sources', adminToken)).body.data[0].id,
        campaignName: 'spring-campaign',
        utmSource: 'instagram',
        priority: 'high',
        tags: ['beauty', 'urgent'],
        expectedValue: 2500000,
        nextFollowUpAt: new Date(Date.now() + 86400000).toISOString(),
        marketingConsent: true,
      }, adminToken)
      expect(status).toBe(201)
      expect(body.data.status).toBe('new')
      expect(body.data.tags).toEqual(['beauty', 'urgent'])
      leadId = body.data.id
    })
  })

  describe('GET /api/leads', () => {
    it('should list leads with pagination', async () => {
      const { status, body } = await api.get('/api/leads?page=1&limit=5', doctorToken)
      expect(status).toBe(200)
      expect(body.pagination!.total).toBeGreaterThanOrEqual(1)
      expect(body.data.length).toBeGreaterThanOrEqual(1)
    })

    it('should filter by status', async () => {
      const { status, body } = await api.get('/api/leads?status=new', doctorToken)
      expect(status).toBe(200)
      expect(body.data.every((l: any) => l.status === 'new')).toBe(true)
    })

    it('should search by name', async () => {
      const { status, body } = await api.get('/api/leads?q=Sara', doctorToken)
      expect(status).toBe(200)
      expect(body.data.some((l: any) => l.firstName === 'Sara')).toBe(true)
    })

    it('should filter by tag', async () => {
      const { status, body } = await api.get('/api/leads?tag=urgent', doctorToken)
      expect(status).toBe(200)
      expect(body.data.some((l: any) => (l.tags ?? []).includes('urgent'))).toBe(true)
    })
  })

  describe('GET /api/leads/:id', () => {
    it('should return lead with activities', async () => {
      const { status, body } = await api.get(`/api/leads/${leadId}`, adminToken)
      expect(status).toBe(200)
      expect(body.data.id).toBe(leadId)
      expect(body.data.activities.length).toBeGreaterThanOrEqual(1)
      expect(body.data.activities[0].type).toBe('created')
    })
  })

  describe('PUT /api/leads/:id', () => {
    it('should update lead fields', async () => {
      const { status, body } = await api.put(`/api/leads/${leadId}`, {
        priority: 'medium',
        note: 'follow-up by phone',
      }, doctorToken)
      expect(status).toBe(200)
      expect(body.data.priority).toBe('medium')
    })
  })

  describe('POST /api/leads/:id/contact', () => {
    it('should record contact and set first/last contact', async () => {
      const { status, body } = await api.post(`/api/leads/${leadId}/contact`, {
        note: 'called and talked',
      }, doctorToken)
      expect(status).toBe(200)
      expect(body.data.firstContactAt).toBeTruthy()
      expect(body.data.lastContactAt).toBeTruthy()
    })
  })

  describe('POST /api/leads/:id/assign', () => {
    it('should assign a doctor', async () => {
      const { body } = await api.get('/api/users/doctors', doctorToken)
      const doctor = body.data[0]
      const { status } = await api.post(`/api/leads/${leadId}/assign`, {
        assignedDoctorId: doctor.id,
      }, adminToken)
      expect(status).toBe(200)
    })
  })

  describe('POST /api/leads/:id/notes', () => {
    it('should add a note and activity', async () => {
      const { status, body } = await api.post(`/api/leads/${leadId}/notes`, {
        body: 'patient prefers evening appointments',
      }, adminToken)
      expect(status).toBe(201)
      expect(body.data.body).toContain('evening')

      const detail = await api.get(`/api/leads/${leadId}`, adminToken)
      expect(detail.body.data.notes.some((n: any) => n.body.includes('evening'))).toBe(true)
      expect(detail.body.data.activities.some((a: any) => a.type === 'note_added')).toBe(true)
    })
  })

  describe('POST /api/leads/:id/status', () => {
    it('should forbid arbitrary transitions', async () => {
      const { status } = await api.post(`/api/leads/${leadId}/status`, {
        status: 'appointment_booked',
      }, doctorToken)
      expect(status).toBe(400)
    })

    it('should allow new -> contacted', async () => {
      const { status } = await api.post(`/api/leads/${leadId}/status`, {
        status: 'contacted',
      }, doctorToken)
      expect(status).toBe(200)
    })

    it('should allow contacted -> qualified', async () => {
      const { status } = await api.post(`/api/leads/${leadId}/status`, {
        status: 'qualified',
      }, doctorToken)
      expect(status).toBe(200)
    })

    it('should reject converting via status endpoint', async () => {
      const { status } = await api.post(`/api/leads/${leadId}/status`, {
        status: 'converted',
      }, doctorToken)
      expect(status).toBe(400)
    })
  })

  describe('POST /api/leads/:id/lost', () => {
    it('should require a reason', async () => {
      const { status } = await api.post(`/api/leads/${leadId}/lost`, {}, doctorToken)
      expect(status).toBe(400)
    })

    it('should mark lead lost', async () => {
      const { status, body } = await api.post(`/api/leads/${leadId}/lost`, {
        reason: 'budget',
      }, doctorToken)
      expect(status).toBe(200)
      expect(body.data.status).toBe('lost')
      expect(body.data.lostReason).toBe('budget')
    })

    it('should allow reopening a lost lead', async () => {
      const { status } = await api.post(`/api/leads/${leadId}/status`, {
        status: 'contacted',
      }, doctorToken)
      expect(status).toBe(200)
    })
  })

  describe('POST /api/leads/:id/convert', () => {
    let convertLeadId = ''

    it('should convert a lead to a patient', async () => {
      const { body: created } = await api.post('/api/leads', {
        firstName: 'Maryam',
        lastName: 'Ahmadi',
        phone: generatePhone(),
        nationalId: randomNationalId(),
        sourceId: (await api.get('/api/lead-sources', adminToken)).body.data[1].id,
      }, adminToken)
      convertLeadId = created.data.id

      const { status, body } = await api.post(`/api/leads/${convertLeadId}/convert`, {}, adminToken)
      expect(status).toBe(200)
      expect(body.data.patientCreated).toBe(true)
      expect(body.data.patientId).toBeTruthy()
      convertedPatientId = body.data.patientId
    })

    it('should prevent duplicate conversion', async () => {
      const { status } = await api.post(`/api/leads/${convertLeadId}/convert`, {}, adminToken)
      expect(status).toBe(409)
    })

    it('should persist conversion relationship permanently', async () => {
      const { body } = await api.get(`/api/leads/${convertLeadId}`, adminToken)
      expect(body.data.status).toBe('converted')
      expect(body.data.convertedPatientId).toBe(convertedPatientId)
      expect(body.data.conversionDate).toBeTruthy()
      expect(body.data.activities.some((a: any) => a.type === 'converted')).toBe(true)
    })
  })

  describe('GET /api/leads/summary', () => {
    it('should return reporting aggregates', async () => {
      const { status, body } = await api.get('/api/leads/summary', adminToken)
      expect(status).toBe(200)
      expect(body.data.totalLeads).toBeGreaterThanOrEqual(2)
      expect(body.data.convertedLeads).toBeGreaterThanOrEqual(1)
      expect(body.data.conversionRate).toBeGreaterThanOrEqual(0)
      expect(body.data.pipeline).toBeInstanceOf(Array)
      expect(body.data.bySource).toBeInstanceOf(Array)
      expect(body.data.followUps).toHaveProperty('overdue')
    })
  })

  describe('DELETE /api/leads/:id', () => {
    it('should soft delete a lead', async () => {
      const { status } = await api.delete(`/api/leads/${leadId}`, adminToken)
      expect(status).toBe(200)
    })

    it('should forbid doctor deletes', async () => {
      const { body: created } = await api.post('/api/leads', {
        firstName: 'Delete',
        lastName: 'Me',
      }, adminToken)
      const { status } = await api.delete(`/api/leads/${created.data.id}`, doctorToken)
      expect(status).toBe(403)
    })
  })
})

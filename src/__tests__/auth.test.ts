import { describe, it, expect, beforeAll } from 'vitest'
import { api, generatePhone, registerTestUser } from './helpers'

describe('Auth API', () => {
  const testUser = { phone: '', password: 'test1234', fullName: 'Auth Test User' }
  let patientToken = ''
  let patientId = ''

  beforeAll(async () => {
    testUser.phone = generatePhone()
  })

  describe('POST /api/auth/register', () => {
    it('should register a new patient user', async () => {
      const { status, body } = await api.post('/api/auth/register', {
        phone: testUser.phone,
        fullName: testUser.fullName,
        role: 'patient',
        password: testUser.password,
      })
      expect(status).toBe(201)
      expect(body.success).toBe(true)
      expect(body.token).toBeDefined()
      expect(body.token!.length).toBeGreaterThan(0)
      expect(body.user.phone).toBe(testUser.phone)
      expect(body.user.role).toBe('patient')
      patientToken = body.token!
    })

    it('should reject duplicate phone registration', async () => {
      const { status, body } = await api.post('/api/auth/register', {
        phone: testUser.phone,
        fullName: 'Another User',
        role: 'patient',
        password: 'test1234',
      })
      expect(status).toBe(409)
      expect(body.success).toBe(false)
      expect(body.error).toBeDefined()
    })

    it('should reject invalid phone number', async () => {
      const { status, body } = await api.post('/api/auth/register', {
        phone: '12345',
        fullName: 'Bad Phone',
        role: 'patient',
        password: 'test1234',
      })
      expect(status).toBe(400)
      expect(body.success).toBe(false)
    })

    it('should reject short password', async () => {
      const { status, body } = await api.post('/api/auth/register', {
        phone: generatePhone(),
        fullName: 'Short Pwd',
        role: 'patient',
        password: '123',
      })
      expect(status).toBe(400)
      expect(body.success).toBe(false)
    })

    it('should reject invalid role', async () => {
      const { status, body } = await api.post('/api/auth/register', {
        phone: generatePhone(),
        fullName: 'Bad Role',
        role: 'invalid_role',
        password: 'test1234',
      })
      expect(status).toBe(400)
      expect(body.success).toBe(false)
    })

    it('should register a doctor user (pending status)', async () => {
      const phone = generatePhone()
      const { status, body } = await api.post('/api/auth/register', {
        phone,
        fullName: 'Test Doctor',
        role: 'doctor',
        password: 'test1234',
      })
      expect(status).toBe(201)
      expect(body.success).toBe(true)
      expect(body.token).toBeDefined()
    })

    it('should register with all valid roles', async () => {
      for (const role of ['admin_doctor', 'doctor', 'lab', 'pharmacy', 'patient']) {
        const phone = generatePhone()
        const { status, body } = await api.post('/api/auth/register', {
          phone,
          fullName: `Test ${role}`,
          role,
          password: 'test1234',
        })
        expect(status).toBe(201)
        expect(body.success).toBe(true)
        expect(body.user.role).toBe(role)
      }
    })
  })

  describe('POST /api/auth/login', () => {
    it('should login with valid phone and password', async () => {
      const { status, body } = await api.post('/api/auth/login', {
        phone: testUser.phone,
        password: testUser.password,
      })
      expect(status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.token).toBeDefined()
      expect(body.user.id).toBeDefined()
      expect(body.user.role).toBe('patient')
      patientId = body.user.id
    })

    it('should reject invalid phone', async () => {
      const { status, body } = await api.post('/api/auth/login', {
        phone: '09111111111',
        password: testUser.password,
      })
      expect(status).toBe(401)
      expect(body.success).toBe(false)
    })

    it('should reject wrong password', async () => {
      const { status, body } = await api.post('/api/auth/login', {
        phone: testUser.phone,
        password: 'wrongpassword123',
      })
      expect(status).toBe(401)
      expect(body.success).toBe(false)
    })

    it('should reject invalid phone format', async () => {
      const { status, body } = await api.post('/api/auth/login', {
        phone: '12345',
        password: testUser.password,
      })
      expect(status).toBe(400)
      expect(body.success).toBe(false)
    })
  })

  describe('GET /api/auth/me', () => {
    it('should return current user profile with valid token', async () => {
      const { status, body } = await api.get('/api/auth/me', patientToken)
      expect(status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.user.phone).toBe(testUser.phone)
      expect(body.user.role).toBe('patient')
      expect(body.user.id).toBeDefined()
    })

    it('should reject without token', async () => {
      const { status } = await api.get('/api/auth/me')
      expect(status).toBe(401)
    })

    it('should reject invalid token', async () => {
      const { status } = await api.get('/api/auth/me', 'invalid_token_here')
      expect(status).toBe(401)
    })
  })

  describe('PATCH /api/auth/profile', () => {
    it('should update profile with valid data', async () => {
      const { status, body } = await api.patch('/api/auth/profile', {
        fullName: 'Updated Name',
      }, patientToken)
      expect(status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.user.fullName).toBe('Updated Name')
    })

    it('should reject without auth', async () => {
      const { status } = await api.patch('/api/auth/profile', {
        fullName: 'No Auth',
      })
      expect(status).toBe(401)
    })
  })

  describe('PATCH /api/auth/change-password', () => {
    it('should change password with correct current password', async () => {
      const { status, body } = await api.patch('/api/auth/change-password', {
        currentPassword: testUser.password,
        newPassword: 'newpassword123',
      }, patientToken)
      expect(status).toBe(200)
      expect(body.success).toBe(true)

      // Revert password for other tests
      await api.patch('/api/auth/change-password', {
        currentPassword: 'newpassword123',
        newPassword: testUser.password,
      }, patientToken)
    })

    it('should reject wrong current password', async () => {
      const { status } = await api.patch('/api/auth/change-password', {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123',
      }, patientToken)
      expect(status).toBe(401)
    })

    it('should reject without auth', async () => {
      const { status } = await api.patch('/api/auth/change-password', {
        currentPassword: 'test',
        newPassword: 'newpassword123',
      })
      expect(status).toBe(401)
    })
  })

  describe('POST /api/auth/forgot-password', () => {
    it('should accept valid phone number', async () => {
      const { status, body } = await api.post('/api/auth/forgot-password', {
        phone: testUser.phone,
      })
      expect(status).toBe(200)
      expect(body.success).toBe(true)
    })

    it('should accept non-existent phone (security)', async () => {
      const { status, body } = await api.post('/api/auth/forgot-password', {
        phone: generatePhone(),
      })
      expect(status).toBe(200)
      expect(body.success).toBe(true)
    })

    it('should reject invalid phone format', async () => {
      const { status } = await api.post('/api/auth/forgot-password', {
        phone: '12345',
      })
      expect(status).toBe(400)
    })
  })

  describe('POST /api/auth/reset-password', () => {
    it('should reject invalid OTP code', async () => {
      const { status } = await api.post('/api/auth/reset-password', {
        phone: testUser.phone,
        code: '00000',
        password: 'newpwd12345',
      })
      expect(status).toBe(401)
    })
  })
})

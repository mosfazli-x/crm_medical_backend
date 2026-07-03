import { describe, it, expect } from 'vitest'
import { api } from './helpers'

describe('Health & Public Endpoints', () => {
  it('GET /health should return ok status', async () => {
    const { status, body } = await api.get('/health')
    expect(status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeDefined()
  })

  it('GET /api/insurance-types should return insurance types', async () => {
    const { status, body } = await api.get('/api/insurance-types')
    expect(status).toBe(200)
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBeGreaterThanOrEqual(7)

    const types = body.data.map((t: any) => t.key)
    expect(types).toContain('social_security')
    expect(types).toContain('health')
    expect(types).toContain('armed_forces')
    expect(types).toContain('relief_committee')
    expect(types).toContain('iran')
    expect(types).toContain('supplementary')
    expect(types).toContain('other')

    for (const t of body.data) {
      expect(t).toHaveProperty('key')
      expect(t).toHaveProperty('label')
      expect(t).toHaveProperty('logo')
    }
  })

  it('GET /api/insurance-types should not require auth', async () => {
    const { status } = await api.get('/api/insurance-types')
    expect(status).toBe(200)
  })
})

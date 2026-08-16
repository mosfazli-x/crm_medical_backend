import { describe, it, expect } from 'vitest'
import { api, registerAndLogin } from './helpers'

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001'

describe('OCR Handwriting Endpoint', () => {
  it('should require authentication', async () => {
    const { status } = await api.post('/api/ocr/handwriting')
    expect(status).toBe(401)
  })

  it('should reject non-multipart requests', async () => {
    const { token } = await registerAndLogin('doctor')
    const { status } = await api.post('/api/ocr/handwriting', { some: 'json' }, token)
    expect(status).toBe(400)
  })

  it('should reject multipart requests without a file', async () => {
    const { token } = await registerAndLogin('doctor')
    const form = new FormData()
    const res = await fetch(`${API_BASE}/api/ocr/handwriting`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    expect(res.status).toBe(400)
  })
})

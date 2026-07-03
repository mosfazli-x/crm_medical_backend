const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001'

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  token?: string
  user?: any
  details?: any
}

async function request<T = any>(
  method: string,
  path: string,
  options: { body?: any; token?: string; headers?: Record<string, string> } = {}
): Promise<{ status: number; body: ApiResponse<T> }> {
  const url = `${API_BASE}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`
  }

  const res = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

export const api = {
  get: <T = any>(path: string, token?: string) =>
    request<T>('GET', path, { token }),

  post: <T = any>(path: string, body?: any, token?: string) =>
    request<T>('POST', path, { body, token }),

  put: <T = any>(path: string, body?: any, token?: string) =>
    request<T>('PUT', path, { body, token }),

  patch: <T = any>(path: string, body?: any, token?: string) =>
    request<T>('PATCH', path, { body, token }),

  delete: <T = any>(path: string, token?: string) =>
    request<T>('DELETE', path, { token }),
}

export function generatePhone(): string {
  const prefix = '09'
  const rest = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')
  return (prefix + rest).slice(0, 11)
}

export async function registerTestUser(role: 'patient' | 'doctor' | 'admin_doctor' | 'lab' | 'pharmacy' = 'patient') {
  const phone = generatePhone()
  const res = await api.post('/api/auth/register', {
    phone,
    fullName: `Test ${role}`,
    role,
    password: 'test1234',
  })

  if (res.status >= 400) {
    throw new Error(`Failed to register test user: ${JSON.stringify(res.body)}`)
  }

  return {
    phone,
    password: 'test1234',
    token: res.body.token!,
    user: res.body.user!,
  }
}

export async function registerAndLogin(role: 'patient' | 'doctor' | 'admin_doctor' | 'lab' | 'pharmacy' = 'patient') {
  const user = await registerTestUser(role)

  if (role === 'patient') {
    const loginRes = await api.post('/api/auth/login', {
      phone: user.phone,
      password: user.password,
    })
    return { ...user, token: loginRes.body.token! }
  }

  return user
}

export async function expectUnauthorized(path: string, method: 'get' | 'post' | 'put' | 'patch' | 'delete' = 'get') {
  const res = await api[method](path)
  return {
    status: res.status,
    ok: res.status === 401 && res.body.error,
  }
}

export async function expectForbidden(path: string, token: string, method: 'get' | 'post' | 'put' | 'patch' | 'delete' = 'get') {
  const res = await api[method](path, undefined, token)
  return {
    status: res.status,
    ok: res.status === 403,
  }
}

import type { FastifyRequest, FastifyReply } from 'fastify'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}, 60_000)

export function rateLimit(opts: {
  max: number
  windowMs: number
  keyGenerator?: (request: FastifyRequest) => string
  message?: string
}) {
  const keyGenerator = opts.keyGenerator || ((req: FastifyRequest) => {
    return req.ip || req.socket.remoteAddress || 'unknown'
  })

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const key = `${request.routeOptions?.url || request.url}:${keyGenerator(request)}`
    const now = Date.now()
    const entry = store.get(key)

    if (entry && now < entry.resetAt) {
      if (entry.count >= opts.max) {
        reply.header('Retry-After', Math.ceil((entry.resetAt - now) / 1000))
        reply.status(429).send({
          success: false,
          error: opts.message || 'Too many requests. Please try again later.',
        })
        return
      }
      entry.count++
    } else {
      store.set(key, { count: 1, resetAt: now + opts.windowMs })
    }
  }
}

export const authRateLimit = rateLimit({
  max: 10,
  windowMs: 15 * 60 * 1000,
  message: 'تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً ۱۵ دقیقه دیگر تلاش کنید.',
})

export const registerPhoneRateLimit = rateLimit({
  max: 3,
  windowMs: 60 * 60 * 1000,
  keyGenerator: (request: FastifyRequest) => {
    const body = request.body as { phone?: string } | undefined
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''
    const ip = request.ip || request.socket.remoteAddress || 'unknown'
    return `register:${ip}:${phone || 'unknown'}`
  },
  message: 'برای این شماره تلفن بیش از حد مجاز ثبت‌نام انجام شده است. لطفاً یک ساعت دیگر تلاش کنید.',
})

export const globalRateLimit = rateLimit({
  max: 300,
  windowMs: 60_000,
  message: 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.',
})

export function honeypotProtection(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  const body = request.body as Record<string, unknown> | undefined
  const website = body && typeof body === 'object' ? body.website : undefined

  if (typeof website === 'string' && website.trim().length > 0) {
    reply.status(201).send({
      success: true,
      message: 'حساب شما با موفقیت ساخته شد',
    })
    return
  }

  done()
}

export const smsRateLimit = rateLimit({
  max: 5,
  windowMs: 60 * 60 * 1000,
  message: 'Too many SMS requests. Please try again later.',
})

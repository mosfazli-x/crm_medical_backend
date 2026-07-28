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
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
})

export const smsRateLimit = rateLimit({
  max: 5,
  windowMs: 60 * 60 * 1000,
  message: 'Too many SMS requests. Please try again later.',
})

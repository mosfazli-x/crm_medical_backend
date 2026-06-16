import type { FastifyRequest, FastifyReply } from 'fastify'
import { ForbiddenError, UnauthorizedError } from '../errors'

export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      await request.jwtVerify<{ role: string }>()
    } catch {
      throw new UnauthorizedError('Invalid or expired token')
    }

    const { role } = request.user
    if (!allowedRoles.includes(role)) {
      throw new ForbiddenError(`Access denied. Required role: ${allowedRoles.join(' or ')}`)
    }
  }
}

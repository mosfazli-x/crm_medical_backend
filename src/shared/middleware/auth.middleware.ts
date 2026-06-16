import type { FastifyRequest, FastifyReply } from 'fastify'
import { UnauthorizedError } from '../errors'

export async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    throw new UnauthorizedError('Invalid or expired token')
  }
}

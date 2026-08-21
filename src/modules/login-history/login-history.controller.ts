import type { FastifyRequest, FastifyReply } from 'fastify'
import { LoginHistoryService } from './login-history.service'
import { LoginHistoryQuerySchema, RevokeSessionSchema } from './login-history.schema'

export class LoginHistoryController {
  constructor(private service: LoginHistoryService) {}

  async getMySessions(request: FastifyRequest, reply: FastifyReply) {
    const query = LoginHistoryQuerySchema.parse(request.query)
    const result = await this.service.getByUserId(request.user.id, query.page, query.limit)

    return reply.send({
      success: true,
      ...result,
    })
  }

  async getMySummary(request: FastifyRequest, reply: FastifyReply) {
    const summary = await this.service.getUserSessionSummary(request.user.id)

    return reply.send({
      success: true,
      summary,
    })
  }

  async getAllSessions(request: FastifyRequest, reply: FastifyReply) {
    const query = LoginHistoryQuerySchema.parse(request.query)
    const result = await this.service.getAll(query.page, query.limit, {
      userId: query.userId,
      event: query.event,
    })

    return reply.send({
      success: true,
      ...result,
    })
  }

  async getUserSessions(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.params as { userId: string }
    const query = LoginHistoryQuerySchema.parse(request.query)
    const result = await this.service.getByUserId(userId, query.page, query.limit)

    return reply.send({
      success: true,
      ...result,
    })
  }

  async getUserSummary(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.params as { userId: string }
    const summary = await this.service.getUserSessionSummary(userId)

    return reply.send({
      success: true,
      summary,
    })
  }

  async revokeSession(request: FastifyRequest, reply: FastifyReply) {
    const { sessionId } = request.params as { sessionId: string }

    const result = await this.service.revokeSession(sessionId)

    return reply.send({
      success: true,
      message: result.alreadyRevoked ? 'Session was already revoked' : 'Session revoked successfully',
      ...result,
    })
  }

  async revokeAllUserSessions(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.params as { userId: string }

    await this.service.revokeAllUserSessionsExcept(userId)

    return reply.send({
      success: true,
      message: 'All sessions revoked successfully',
    })
  }
}

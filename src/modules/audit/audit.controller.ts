import type { FastifyRequest, FastifyReply } from 'fastify'
import { getAuditService } from '../../shared/services'

export class AuditController {
  async getAll(request: FastifyRequest<{ Querystring: { page?: string; limit?: string } }>, reply: FastifyReply) {
    const page = parseInt(request.query.page || '1')
    const limit = Math.min(parseInt(request.query.limit || '50'), 100)
    const auditService = getAuditService()
    const { data, total } = await auditService.getAll(page, limit)
    return reply.send({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  }

  async getByEntity(request: FastifyRequest<{ Params: { entityType: string; entityId: string } }>, reply: FastifyReply) {
    const { entityType, entityId } = request.params
    const auditService = getAuditService()
    const data = await auditService.getByEntity(entityType, entityId)
    return reply.send({ success: true, data })
  }
}

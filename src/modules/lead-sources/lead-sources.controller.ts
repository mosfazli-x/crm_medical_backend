import type { FastifyRequest, FastifyReply } from 'fastify'
import { LeadSourcesService } from './lead-sources.service'
import { CreateLeadSourceSchema, UpdateLeadSourceSchema } from './lead-sources.schema'
import { auditService } from '../../shared/services'

export class LeadSourcesController {
  constructor(private leadSourcesService: LeadSourcesService) {}

  async list(request: FastifyRequest, reply: FastifyReply) {
    const includeInactive = (request.query as { includeInactive?: string })?.includeInactive === 'true'
    const data = await this.leadSourcesService.findAll(includeInactive)
    return reply.status(200).send({ success: true, data })
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const data = await this.leadSourcesService.getById(id)
    return reply.status(200).send({ success: true, data })
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateLeadSourceSchema.parse(request.body)
    const data = await this.leadSourcesService.create(dto)

    await auditService.log({
      userId: (request.user as any)?.id,
      action: 'create',
      entityType: 'lead_source',
      entityId: data.id,
      newValues: { name: data.name, type: data.type, category: data.category },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    })

    return reply.status(201).send({ success: true, message: 'Lead source created successfully', data })
  }

  async update(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const dto = UpdateLeadSourceSchema.parse(request.body)
    const data = await this.leadSourcesService.update(id, dto)

    await auditService.log({
      userId: (request.user as any)?.id,
      action: 'update',
      entityType: 'lead_source',
      entityId: id,
      oldValues: dto,
      newValues: { name: data.name, type: data.type, category: data.category, isActive: data.isActive },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    })

    return reply.status(200).send({ success: true, message: 'Lead source updated successfully', data })
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const data = await this.leadSourcesService.deactivate(id)

    await auditService.log({
      userId: (request.user as any)?.id,
      action: 'delete',
      entityType: 'lead_source',
      entityId: id,
      newValues: { isActive: data.isActive },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    })

    return reply.status(200).send({ success: true, message: 'Lead source deactivated successfully', data })
  }
}

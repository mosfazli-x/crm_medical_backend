import type { FastifyRequest, FastifyReply } from 'fastify'
import { SmsBroadcastService } from './sms-broadcast.service'
import {
  CreateSmsBroadcastSchema,
  UpdateSmsBroadcastSchema,
  RunSmsBroadcastSchema,
  ListSmsBroadcastsQuerySchema,
} from './sms-broadcast.schema'

export class SmsBroadcastController {
  constructor(private broadcastService: SmsBroadcastService) {}

  async create(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateSmsBroadcastSchema.parse(request.body)
    const userId = (request.user as any)?.id ?? null
    const broadcast = await this.broadcastService.create(dto, userId)
    return reply.status(201).send({ success: true, data: broadcast })
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const dto = ListSmsBroadcastsQuerySchema.parse(request.query)
    const result = await this.broadcastService.list(dto)
    return reply.status(200).send({
      success: true,
      data: result.data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasMore: result.hasMore,
      },
    })
  }

  async getById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const data = await this.broadcastService.getById(id)
    return reply.status(200).send({ success: true, data })
  }

  async update(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const dto = UpdateSmsBroadcastSchema.parse(request.body)
    const broadcast = await this.broadcastService.update(id, dto)
    return reply.status(200).send({ success: true, data: broadcast })
  }

  async delete(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    await this.broadcastService.delete(id)
    return reply.status(200).send({ success: true, message: 'SMS broadcast deleted successfully' })
  }

  async run(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const dto = RunSmsBroadcastSchema.parse(request.body ?? {})
    const stats = await this.broadcastService.runBroadcast(id, { force: dto.force })
    return reply.status(200).send({ success: true, data: stats })
  }

  async runDue(request: FastifyRequest, reply: FastifyReply) {
    const stats = await this.broadcastService.runDueBroadcasts()
    return reply.status(200).send({ success: true, data: stats })
  }

  async getLogs(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const dto = ListSmsBroadcastsQuerySchema.parse(request.query)
    const result = await this.broadcastService.getLogs(id, dto)
    return reply.status(200).send({
      success: true,
      data: result.data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasMore: result.hasMore,
      },
    })
  }
}

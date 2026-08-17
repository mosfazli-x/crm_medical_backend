import type { FastifyRequest, FastifyReply } from 'fastify'
import { FaqService } from './faq.service'
import { CreateFaqSchema, UpdateFaqSchema, SearchFaqSchema } from './faq.schema'

export class FaqController {
  constructor(private service: FaqService) {}

  async search(request: FastifyRequest, reply: FastifyReply) {
    const dto = SearchFaqSchema.parse(request.query)
    const results = await this.service.search(dto)
    return reply.send({ success: true, data: results })
  }

  async searchFallback(request: FastifyRequest, reply: FastifyReply) {
    const { q, language = 'fa', limit = 5 } = request.query as any
    const results = await this.service.searchFallback(q, language, limit)
    return reply.send({ success: true, data: results })
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const entry = await this.service.getById(request.params.id)
    return reply.send({ success: true, data: entry })
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const { language = 'fa', category, page = 1, limit = 20 } = request.query as any
    const result = await this.service.list(language, category, page, limit)
    return reply.send({ success: true, data: result.data, pagination: result.pagination })
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateFaqSchema.parse(request.body)
    const entry = await this.service.create(dto, request.user.id)
    return reply.status(201).send({ success: true, data: entry, message: 'FAQ entry created' })
  }

  async update(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const dto = UpdateFaqSchema.parse(request.body)
    const entry = await this.service.update(request.params.id, dto, request.user.id)
    return reply.send({ success: true, data: entry, message: 'FAQ entry updated' })
  }

  async approve(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const entry = await this.service.approve(request.params.id, request.user.id)
    return reply.send({ success: true, data: entry, message: 'FAQ entry approved' })
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const result = await this.service.delete(request.params.id)
    return reply.send({ success: true, data: result, message: 'FAQ entry deleted' })
  }

  async getPendingApprovals(request: FastifyRequest, reply: FastifyReply) {
    const { page = 1, limit = 20 } = request.query as any
    const result = await this.service.getPendingApprovals(page, limit)
    return reply.send({ success: true, data: result.data, pagination: result.pagination })
  }
}

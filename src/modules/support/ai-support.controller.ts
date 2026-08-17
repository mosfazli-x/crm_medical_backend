import type { FastifyRequest, FastifyReply } from 'fastify'
import { TicketService } from './ticket.service'
import { AskQuestionSchema, ConfirmAnswerSchema } from './ai-support.schema'

export class AiSupportController {
  constructor(private service: TicketService) {}

  async ask(request: FastifyRequest, reply: FastifyReply) {
    const dto = AskQuestionSchema.parse(request.body)
    const userName = (request.user as any).fullName || (request.user as any).name
    const result = await this.service.askQuestion(
      request.user.id,
      userName,
      dto,
    )
    return reply.send({ success: true, data: result })
  }

  async confirm(request: FastifyRequest, reply: FastifyReply) {
    const dto = ConfirmAnswerSchema.parse(request.body)
    const result = await this.service.confirmAnswer(
      dto.ticket_id,
      request.user.id,
      dto.helpful,
      dto.feedback,
    )
    return reply.send({ success: true, data: result })
  }

  async getTickets(request: FastifyRequest, reply: FastifyReply) {
    const { page = 1, limit = 20, unresolved = false } = request.query as any
    const result = await this.service.getTickets(page, limit, unresolved)
    return reply.send({ success: true, data: result.data, pagination: result.pagination })
  }

  async getTicketById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const ticket = await this.service.getTicketById(request.params.id)
    return reply.send({ success: true, data: ticket })
  }

  async resolveByAdmin(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const { answer } = request.body as { answer: string }
    const result = await this.service.resolveByAdmin(
      request.params.id,
      request.user.id,
      answer,
    )
    return reply.send({ success: true, data: result, message: 'Ticket resolved' })
  }

  async getStats(request: FastifyRequest, reply: FastifyReply) {
    const stats = await this.service.getStats()
    return reply.send({ success: true, data: stats })
  }
}

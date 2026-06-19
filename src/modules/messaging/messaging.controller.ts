import type { FastifyRequest, FastifyReply } from 'fastify'
import { MessagingService } from './messaging.service'
import { SendMessageSchema } from './messaging.schema'

export class MessagingController {
  constructor(private service: MessagingService) {}

  async send(request: FastifyRequest, reply: FastifyReply) {
    const dto = SendMessageSchema.parse(request.body)
    const data = await this.service.sendMessage(request.user.id, request.user.role, dto)
    return reply.status(201).send({ success: true, data, message: 'Message sent' })
  }

  async inbox(request: FastifyRequest, reply: FastifyReply) {
    const data = await this.service.getInbox(request.user.id, request.user.role)
    return reply.send({ success: true, data })
  }

  async sent(request: FastifyRequest, reply: FastifyReply) {
    const data = await this.service.getSentMessages(request.user.id)
    return reply.send({ success: true, data })
  }

  async patientMessages(
    request: FastifyRequest<{ Params: { patientId: string } }>,
    reply: FastifyReply
  ) {
    const { patientId } = request.params
    const data = await this.service.getPatientMessages(patientId)
    return reply.send({ success: true, data })
  }

  async markRead(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const data = await this.service.markAsRead(id, request.user.id)
    return reply.send({ success: true, data, message: 'Message marked as read' })
  }

  async unreadCount(request: FastifyRequest, reply: FastifyReply) {
    const count = await this.service.getUnreadCount(request.user.id)
    return reply.send({ success: true, data: { unread_count: count } })
  }
}
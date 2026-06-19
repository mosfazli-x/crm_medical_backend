import type { FastifyInstance } from 'fastify'
import { MessagingController } from './messaging.controller'
import { MessagingService } from './messaging.service'
import { authenticate, requireRole } from '../../shared/middleware'

export async function messagingRoutes(fastify: FastifyInstance) {
  const service = new MessagingService(fastify.db)
  const controller = new MessagingController(service)

  fastify.post('/send', { preHandler: authenticate }, controller.send.bind(controller))
  fastify.get('/inbox', { preHandler: authenticate }, controller.inbox.bind(controller))
  fastify.get('/sent', { preHandler: authenticate }, controller.sent.bind(controller))
  fastify.get('/unread-count', { preHandler: authenticate }, controller.unreadCount.bind(controller))
  fastify.patch<{ Params: { id: string } }>('/:id/read', { preHandler: authenticate }, controller.markRead.bind(controller))
  fastify.get<{ Params: { patientId: string } }>('/patient/:patientId', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.patientMessages.bind(controller))
}
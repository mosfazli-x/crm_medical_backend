import type { FastifyInstance } from 'fastify'
import { AiSupportController } from './ai-support.controller'
import { TicketService } from './ticket.service'
import { KnowledgeService } from './knowledge.service'
import { authenticate, requireRole } from '../../shared/middleware'

export async function aiSupportRoutes(fastify: FastifyInstance) {
  const service = new TicketService(fastify.db)
  const knowledgeService = new KnowledgeService(fastify.db)
  const controller = new AiSupportController(service, knowledgeService)

  // Authenticated user routes
  fastify.post('/ask', { preHandler: authenticate }, (req, rep) => controller.ask(req, rep))
  fastify.post('/confirm', { preHandler: authenticate }, (req, rep) => controller.confirm(req, rep))

  // Admin routes
  fastify.get('/tickets', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.getTickets(req, rep))
  fastify.get<{ Params: { id: string } }>('/tickets/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.getTicketById(req, rep))
  fastify.patch<{ Params: { id: string } }>('/tickets/:id/resolve', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.resolveByAdmin(req, rep))
  fastify.get('/stats', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.getStats(req, rep))
  fastify.post('/knowledge/reindex', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.reindexKnowledgeBase(req, rep))
}

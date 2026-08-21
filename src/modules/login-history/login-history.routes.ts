import type { FastifyInstance } from 'fastify'
import { LoginHistoryController } from './login-history.controller'
import { LoginHistoryService } from './login-history.service'
import { authenticate, requireRole, checkRevocation } from '../../shared/middleware'

export async function loginHistoryRoutes(fastify: FastifyInstance) {
  const service = new LoginHistoryService(fastify.db)
  const controller = new LoginHistoryController(service)

  // User routes - view own sessions
  fastify.get('/me', { preHandler: [authenticate, checkRevocation] }, controller.getMySessions.bind(controller))
  fastify.get('/me/summary', { preHandler: [authenticate, checkRevocation] }, controller.getMySummary.bind(controller))

  // Admin routes - view all sessions
  fastify.get('/', { preHandler: [requireRole('admin_doctor'), checkRevocation] }, controller.getAllSessions.bind(controller))
  fastify.get('/user/:userId', { preHandler: [requireRole('admin_doctor'), checkRevocation] }, controller.getUserSessions.bind(controller))
  fastify.get('/user/:userId/summary', { preHandler: [requireRole('admin_doctor'), checkRevocation] }, controller.getUserSummary.bind(controller))
  fastify.post('/:sessionId/revoke', { preHandler: [requireRole('admin_doctor'), checkRevocation] }, controller.revokeSession.bind(controller))
  fastify.post('/user/:userId/revoke-all', { preHandler: [requireRole('admin_doctor'), checkRevocation] }, controller.revokeAllUserSessions.bind(controller))
}

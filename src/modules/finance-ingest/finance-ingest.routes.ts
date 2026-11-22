import type { FastifyInstance } from 'fastify'
import { checkRevocation, requireRole } from '../../shared/middleware'
import { FinanceIngestController } from './finance-ingest.controller'
import { FinanceIngestService } from './finance-ingest.service'

export async function financeIngestRoutes(fastify: FastifyInstance) {
  const controller = new FinanceIngestController(new FinanceIngestService(fastify.db))
  const read = [requireRole('admin_doctor', 'doctor'), checkRevocation]
  const write = [requireRole('admin_doctor', 'doctor'), checkRevocation]

  // Device companions authenticate with their per-device token, never a JWT.
  fastify.post('/sms', controller.ingestDevice.bind(controller))

  fastify.post('/paste', { preHandler: write }, controller.paste.bind(controller))
  fastify.get('/stats', { preHandler: read }, controller.stats.bind(controller))

  fastify.get('/sources', { preHandler: read }, controller.listSources.bind(controller))
  fastify.post('/sources', { preHandler: write }, controller.createSource.bind(controller))
  fastify.patch('/sources/:id', { preHandler: write }, controller.updateSource.bind(controller))
  fastify.delete('/sources/:id', { preHandler: write }, controller.deleteSource.bind(controller))

  fastify.get('/tokens', { preHandler: read }, controller.listTokens.bind(controller))
  fastify.post('/tokens', { preHandler: write }, controller.createToken.bind(controller))
  fastify.delete('/tokens/:id', { preHandler: write }, controller.revokeToken.bind(controller))

  fastify.get('/messages', { preHandler: read }, controller.listMessages.bind(controller))
  fastify.post('/messages/:id/approve', { preHandler: write }, controller.approveMessage.bind(controller))
  fastify.post('/messages/:id/ignore', { preHandler: write }, controller.ignoreMessage.bind(controller))
}

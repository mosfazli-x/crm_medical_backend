import type { FastifyInstance } from 'fastify'
import { AuditController } from './audit.controller'
import { requireRole } from '../../shared/middleware'

export async function auditRoutes(fastify: FastifyInstance) {
  const controller = new AuditController()

  fastify.get('/', { preHandler: requireRole('admin_doctor') }, controller.getAll.bind(controller))

  fastify.get<{ Params: { entityType: string; entityId: string } }>(
    '/:entityType/:entityId',
    { preHandler: requireRole('admin_doctor') },
    controller.getByEntity.bind(controller)
  )
}

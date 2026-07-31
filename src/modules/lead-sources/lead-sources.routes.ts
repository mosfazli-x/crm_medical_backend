import type { FastifyInstance } from 'fastify'
import { LeadSourcesController } from './lead-sources.controller'
import { LeadSourcesService } from './lead-sources.service'
import { requireRole } from '../../shared/middleware'

export async function leadSourcesRoutes(fastify: FastifyInstance) {
  const service = new LeadSourcesService(fastify.db)
  const controller = new LeadSourcesController(service)

  fastify.get('/', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.list(req, rep))
  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.getById(req, rep))
  fastify.post('/', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.create(req, rep))
  fastify.put<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.update(req, rep))
  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.delete(req, rep))
}

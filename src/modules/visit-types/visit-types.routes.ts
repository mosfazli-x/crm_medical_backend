import type { FastifyInstance } from 'fastify'
import { VisitTypesController } from './visit-types.controller'
import { VisitTypesService } from './visit-types.service'
import { requireRole } from '../../shared/middleware'

export async function visitTypesRoutes(fastify: FastifyInstance) {
  const service = new VisitTypesService(fastify.db)
  const controller = new VisitTypesController(service)

  fastify.get<{ Params: { doctorId: string } }>('/:doctorId', (req, rep) => controller.getByDoctor(req, rep))

  fastify.post('/', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.create(req, rep))

  fastify.put<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.update(req, rep))

  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.delete(req, rep))
}

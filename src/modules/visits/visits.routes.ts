import type { FastifyInstance } from 'fastify'
import { VisitController } from './visits.controller'
import { VisitService } from './visits.service'
import { requireRole } from '../../shared/middleware'

export async function visitRoutes(fastify: FastifyInstance) {
  const service = new VisitService(fastify.db)
  const controller = new VisitController(service)

  fastify.get('/patients', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.getPatientList(req, rep))

  fastify.get('/', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.getCalendarEvents(req, rep))

  fastify.post('/', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.create(req, rep))

  fastify.put<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.update(req, rep))

  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.delete(req, rep))
}

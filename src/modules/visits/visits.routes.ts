import type { FastifyInstance } from 'fastify'
import { VisitController } from './visits.controller'
import { VisitService } from './visits.service'
import { requireRole } from '../../shared/middleware'

export async function visitRoutes(fastify: FastifyInstance) {
  const service = new VisitService(fastify.db)
  const controller = new VisitController(service)

  fastify.get('/patients', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.getPatientList(req, rep))

  // Follow-up routes are declared before '/:id' so the literal paths can never be
  // captured as a visit id.
  fastify.get('/follow-ups', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.listFollowUps(req, rep))

  fastify.get('/follow-ups/summary', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.getFollowUpSummary(req, rep))

  fastify.post('/follow-ups/run', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.runReminderSweep(req, rep))

  fastify.post<{ Params: { id: string } }>('/:id/follow-up-reminder', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.sendFollowUpReminder(req, rep))

  fastify.get('/', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.getCalendarEvents(req, rep))

  fastify.post('/', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.create(req, rep))

  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.getById(req, rep))

  fastify.put<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.update(req, rep))

  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.delete(req, rep))
}

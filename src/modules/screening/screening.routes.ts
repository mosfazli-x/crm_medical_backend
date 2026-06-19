import type { FastifyInstance } from 'fastify'
import { ScreeningController } from './screening.controller'
import { ScreeningService } from './screening.service'
import { requireRole } from '../../shared/middleware'

export async function screeningRoutes(fastify: FastifyInstance) {
  const service = new ScreeningService(fastify.db)
  const controller = new ScreeningController(service)

  fastify.get<{ Querystring: { patientId?: string } }>('/schedules', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getSchedules.bind(controller))
  fastify.get('/schedules/overdue', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getOverdueSchedules.bind(controller))
  fastify.get<{ Querystring: { days?: string } }>('/schedules/upcoming', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getDueSchedules.bind(controller))
  fastify.get<{ Params: { id: string } }>('/schedules/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getScheduleById.bind(controller))
  fastify.post('/schedules', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.createSchedule.bind(controller))
  fastify.put<{ Params: { id: string } }>('/schedules/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.updateSchedule.bind(controller))
  fastify.delete<{ Params: { id: string } }>('/schedules/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.deleteSchedule.bind(controller))

  fastify.get<{ Querystring: { patientId?: string; screeningType?: string } }>('/results', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getResults.bind(controller))
  fastify.get<{ Params: { id: string } }>('/results/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getResultById.bind(controller))
  fastify.post('/results', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.createResult.bind(controller))
}
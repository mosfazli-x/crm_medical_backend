import type { FastifyInstance } from 'fastify'
import { ScheduleController } from './schedule.controller'
import { ScheduleService } from './schedule.service'
import { requireRole } from '../../shared/middleware'

const TASK_ROLES = ['admin_doctor', 'doctor', 'lab', 'pharmacy', 'clinic_staff']

export async function scheduleRoutes(fastify: FastifyInstance) {
  const service = new ScheduleService(fastify.db)
  const controller = new ScheduleController(service)

  fastify.get('/assignees', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.listAssignees(req, rep))
  fastify.get('/', { preHandler: requireRole(...TASK_ROLES) }, (req, rep) => controller.list(req, rep))
  fastify.post('/', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.create(req, rep))

  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: requireRole(...TASK_ROLES) }, (req, rep) => controller.getById(req, rep))
  fastify.put<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.update(req, rep))
  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.delete(req, rep))
  fastify.post<{ Params: { id: string } }>('/:id/status', { preHandler: requireRole(...TASK_ROLES) }, (req, rep) => controller.changeStatus(req, rep))
}

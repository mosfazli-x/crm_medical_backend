import type { FastifyInstance } from 'fastify'
import { UserController } from './users.controller'
import { UserService } from './users.service'
import { authenticate, requireRole } from '../../shared/middleware'

export async function userRoutes(fastify: FastifyInstance) {
  const service = new UserService(fastify.db)
  const controller = new UserController(service)

  fastify.get('/', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.findAll(req, rep))

  fastify.get('/doctors', { preHandler: authenticate }, (req, rep) => controller.findDoctors(req, rep))

  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.findById(req, rep))

  fastify.post<{ Params: { id: string } }>('/approve/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.approve(req, rep))

  fastify.post<{ Params: { id: string } }>('/reject/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.reject(req, rep))

  fastify.post<{ Params: { id: string } }>('/deactivate/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.deactivate(req, rep))

  fastify.post<{ Params: { id: string } }>('/activate/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.activate(req, rep))

  fastify.post<{ Params: { id: string } }>('/approve-patient/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.approvePatient(req, rep))

  fastify.get<{ Params: { id: string } }>('/:id/notification-preferences', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.getNotificationPrefs(req, rep))

  fastify.put<{ Params: { id: string } }>('/:id/notification-preferences', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.updateNotificationPrefs(req, rep))
}

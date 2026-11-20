import type { FastifyInstance } from 'fastify'
import { SmsBroadcastController } from './sms-broadcast.controller'
import { SmsBroadcastService } from './sms-broadcast.service'
import { authenticate, requireRole } from '../../shared/middleware'

export async function smsBroadcastRoutes(fastify: FastifyInstance) {
  const service = new SmsBroadcastService(fastify.db)
  const controller = new SmsBroadcastController(service)

  fastify.post(
    '/',
    { preHandler: [authenticate, requireRole('admin_doctor', 'doctor')] },
    (req, rep) => controller.create(req, rep)
  )

  fastify.get(
    '/',
    { preHandler: [authenticate, requireRole('admin_doctor', 'doctor')] },
    (req, rep) => controller.list(req, rep)
  )

  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate, requireRole('admin_doctor', 'doctor')] },
    (req, rep) => controller.getById(req, rep)
  )

  fastify.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate, requireRole('admin_doctor', 'doctor')] },
    (req, rep) => controller.update(req, rep)
  )

  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate, requireRole('admin_doctor', 'doctor')] },
    (req, rep) => controller.delete(req, rep)
  )

  fastify.post<{ Params: { id: string } }>(
    '/:id/run',
    { preHandler: [authenticate, requireRole('admin_doctor', 'doctor')] },
    (req, rep) => controller.run(req, rep)
  )

  fastify.post(
    '/run-due',
    { preHandler: [authenticate, requireRole('admin_doctor', 'doctor')] },
    (req, rep) => controller.runDue(req, rep)
  )

  fastify.get<{ Params: { id: string } }>(
    '/:id/logs',
    { preHandler: [authenticate, requireRole('admin_doctor', 'doctor')] },
    (req, rep) => controller.getLogs(req, rep)
  )
}

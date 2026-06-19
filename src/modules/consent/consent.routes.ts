import type { FastifyInstance } from 'fastify'
import { ConsentController } from './consent.controller'
import { ConsentService } from './consent.service'
import { requireRole } from '../../shared/middleware'

export async function consentRoutes(fastify: FastifyInstance) {
  const service = new ConsentService(fastify.db)
  const controller = new ConsentController(service)

  fastify.get<{ Params: { patientId: string } }>('/patient/:patientId', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getByPatient.bind(controller))
  fastify.get<{ Params: { patientId: string } }>('/patient/:patientId/active', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getActive.bind(controller))
  fastify.post('/', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.grant.bind(controller))
  fastify.patch<{ Params: { id: string } }>('/:id/revoke', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.revoke.bind(controller))
  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor') }, controller.delete.bind(controller))
}
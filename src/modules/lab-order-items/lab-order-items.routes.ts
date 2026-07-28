import type { FastifyInstance } from 'fastify'
import { LabOrderItemsController } from './lab-order-items.controller'
import { LabOrderItemsService } from './lab-order-items.service'
import { requireRole } from '../../shared/middleware'

export async function labOrderItemsRoutes(fastify: FastifyInstance) {
  const service = new LabOrderItemsService(fastify.db)
  const controller = new LabOrderItemsController(service)

  fastify.get<{ Params: { labOrderId: string } }>('/order/:labOrderId', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getByOrderId.bind(controller))
  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getById.bind(controller))
  fastify.post('/', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.create.bind(controller))
  fastify.patch<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.update.bind(controller))
  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.delete.bind(controller))
}

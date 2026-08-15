import type { FastifyInstance } from 'fastify'
import { requireRole } from '../../shared/middleware'
import { ConsumablesController } from './consumables.controller'
import { ConsumablesService } from './consumables.service'

export async function consumablesRoutes(fastify: FastifyInstance) {
  const service = new ConsumablesService(fastify.db)
  const controller = new ConsumablesController(service)

  fastify.get('/items', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.listItems.bind(controller))
  fastify.post('/items', { preHandler: requireRole('admin_doctor') }, controller.createItem.bind(controller))
  fastify.put('/items/:id', { preHandler: requireRole('admin_doctor') }, controller.updateItem.bind(controller))
  fastify.delete('/items/:id', { preHandler: requireRole('admin_doctor') }, controller.deleteItem.bind(controller))

  fastify.get('/months', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.listMonths.bind(controller))
  fastify.get('/export', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.exportMonth.bind(controller))
  fastify.get('/', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getMonthReport.bind(controller))

  fastify.put('/expenses', { preHandler: requireRole('admin_doctor') }, controller.bulkUpsertExpenses.bind(controller))
}

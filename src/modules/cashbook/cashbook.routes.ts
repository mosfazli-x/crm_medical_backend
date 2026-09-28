import type { FastifyInstance } from 'fastify'
import { checkRevocation, requireRole } from '../../shared/middleware'
import { CashbookController } from './cashbook.controller'
import { CashbookService } from './cashbook.service'

export async function cashbookRoutes(fastify: FastifyInstance) {
  const controller = new CashbookController(new CashbookService(fastify.db))
  const read = [requireRole('admin_doctor', 'doctor'), checkRevocation]
  const write = [requireRole('admin_doctor', 'doctor'), checkRevocation]

  fastify.get('/summary', { preHandler: read }, controller.summary.bind(controller))
  fastify.get('/export', { preHandler: read }, controller.exportEntries.bind(controller))
  fastify.get('/entries', { preHandler: read }, controller.listEntries.bind(controller))
  fastify.get('/entries/:id', { preHandler: read }, controller.getEntry.bind(controller))
  fastify.post('/entries', { preHandler: write }, controller.createEntry.bind(controller))
  fastify.patch('/entries/:id', { preHandler: write }, controller.updateEntry.bind(controller))
  fastify.post('/entries/:id/void', { preHandler: write }, controller.voidEntry.bind(controller))
  fastify.post('/entries/:id/receipt', { preHandler: write }, controller.uploadReceipt.bind(controller))

  fastify.get('/categories', { preHandler: read }, controller.listCategories.bind(controller))
  fastify.post('/categories', { preHandler: write }, controller.createCategory.bind(controller))
  fastify.patch('/categories/:id', { preHandler: write }, controller.updateCategory.bind(controller))
  fastify.get('/accounts', { preHandler: read }, controller.listAccounts.bind(controller))
  fastify.post('/accounts', { preHandler: write }, controller.createAccount.bind(controller))
  fastify.patch('/accounts/:id', { preHandler: write }, controller.updateAccount.bind(controller))

  fastify.get('/budgets/:month', { preHandler: read }, controller.getBudgets.bind(controller))
  fastify.post('/budgets', { preHandler: write }, controller.upsertBudget.bind(controller))
  fastify.delete('/budgets/:id', { preHandler: write }, controller.deleteBudget.bind(controller))

  fastify.get('/receipts/:id', { preHandler: read }, controller.serveReceipt.bind(controller))
}

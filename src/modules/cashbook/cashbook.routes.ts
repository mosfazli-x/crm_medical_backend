import type { FastifyInstance } from 'fastify'
import { checkRevocation, requireRole } from '../../shared/middleware'
import { CashbookAccessService } from './cashbook-access.service'
import { CashbookController } from './cashbook.controller'
import { CashbookService } from './cashbook.service'

export async function cashbookRoutes(fastify: FastifyInstance) {
  const access = new CashbookAccessService(fastify.db)
  const controller = new CashbookController(new CashbookService(fastify.db, access), access)
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

  // Owner-controlled ledger sharing. Every handler is self-scoped: the acting user is
  // always both the grant owner and the revocation authority, so no route accepts an
  // owner id that could be swapped for someone else's ledger.
  fastify.get('/access/ledgers', { preHandler: read }, controller.listVisibleLedgers.bind(controller))
  fastify.get('/access/grants', { preHandler: read }, controller.listGrants.bind(controller))
  fastify.get('/access/candidates', { preHandler: read }, controller.listGrantableUsers.bind(controller))
  fastify.post('/access/grants', { preHandler: write }, controller.createGrant.bind(controller))
  fastify.delete('/access/grants/:id', { preHandler: write }, controller.revokeGrant.bind(controller))
}

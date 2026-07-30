import type { FastifyInstance } from 'fastify'
import { AccountingController } from './accounting.controller'
import { AccountingService } from './accounting.service'
import { requireRole } from '../../shared/middleware'

export async function accountingRoutes(fastify: FastifyInstance) {
  const service = new AccountingService(fastify.db)
  const controller = new AccountingController(service)

  // Chart of Accounts
  fastify.get('/accounts', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getAccounts.bind(controller))
  fastify.get('/accounts/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getAccountById.bind(controller))
  fastify.post('/accounts', { preHandler: requireRole('admin_doctor') }, controller.createAccount.bind(controller))
  fastify.put('/accounts/:id', { preHandler: requireRole('admin_doctor') }, controller.updateAccount.bind(controller))
  fastify.delete('/accounts/:id', { preHandler: requireRole('admin_doctor') }, controller.deleteAccount.bind(controller))

  // Journal Entries
  fastify.get('/journal-entries', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getJournalEntries.bind(controller))
  fastify.get('/journal-entries/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getJournalEntryById.bind(controller))
  fastify.post('/journal-entries', { preHandler: requireRole('admin_doctor') }, controller.createJournalEntry.bind(controller))

  // Reports
  fastify.get('/reports/period', { preHandler: requireRole('admin_doctor') }, controller.getReport.bind(controller))
  fastify.get('/reports/income-statement', { preHandler: requireRole('admin_doctor') }, controller.getIncomeStatement.bind(controller))
  fastify.get('/reports/balance-sheet', { preHandler: requireRole('admin_doctor') }, controller.getBalanceSheet.bind(controller))
  fastify.get('/reports/trial-balance', { preHandler: requireRole('admin_doctor') }, controller.getTrialBalance.bind(controller))

  // Seed default accounts
  fastify.post('/seed', { preHandler: requireRole('admin_doctor') }, controller.seedAccounts.bind(controller))
}

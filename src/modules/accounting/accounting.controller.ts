import type { FastifyRequest, FastifyReply } from 'fastify'
import { AccountingService } from './accounting.service'
import { AccountSchema, JournalEntrySchema, ReportQuerySchema } from './accounting.schema'

export class AccountingController {
  constructor(private service: AccountingService) {}

  async getAccounts(request: FastifyRequest, reply: FastifyReply) {
    const { type } = request.query as { type?: string }
    const data = await this.service.getAccounts(type)
    return reply.send({ success: true, data })
  }

  async getAccountById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string }
    const data = await this.service.getAccountById(id)
    return reply.send({ success: true, data })
  }

  async createAccount(request: FastifyRequest, reply: FastifyReply) {
    const dto = AccountSchema.parse(request.body)
    const data = await this.service.createAccount(dto)
    return reply.status(201).send({ success: true, data, message: 'Account created' })
  }

  async updateAccount(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string }
    const dto = AccountSchema.partial().parse(request.body)
    const data = await this.service.updateAccount(id, dto)
    return reply.send({ success: true, data, message: 'Account updated' })
  }

  async deleteAccount(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string }
    const data = await this.service.deleteAccount(id)
    return reply.send({ success: true, data, message: 'Account deactivated' })
  }

  async getJournalEntries(request: FastifyRequest, reply: FastifyReply) {
    const { start_date, end_date, status } = request.query as {
      start_date?: string; end_date?: string; status?: string
    }
    const data = await this.service.getJournalEntries(start_date, end_date, status)
    return reply.send({ success: true, data })
  }

  async getJournalEntryById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string }
    const data = await this.service.getJournalEntryById(id)
    return reply.send({ success: true, data })
  }

  async createJournalEntry(request: FastifyRequest, reply: FastifyReply) {
    const dto = JournalEntrySchema.parse(request.body)
    const user = request.user as { id: string }
    const data = await this.service.createJournalEntry(dto, user.id)
    return reply.status(201).send({ success: true, data, message: 'Journal entry created' })
  }

  async getReport(request: FastifyRequest, reply: FastifyReply) {
    const { period, start_date, end_date } = request.query as {
      period?: string; start_date?: string; end_date?: string
    }
    const query = ReportQuerySchema.parse({ period: period || 'monthly', start_date, end_date })
    const data = await this.service.getPeriodReport(query.period, query.start_date, query.end_date)
    return reply.send({ success: true, data })
  }

  async getIncomeStatement(request: FastifyRequest, reply: FastifyReply) {
    const { start_date, end_date } = request.query as { start_date?: string; end_date?: string }
    const now = new Date()
    const sDate = start_date || `${now.getFullYear()}-01-01`
    const eDate = end_date || `${now.getFullYear()}-12-31`
    const data = await this.service.getIncomeStatement(sDate, eDate)
    return reply.send({ success: true, data })
  }

  async getBalanceSheet(request: FastifyRequest, reply: FastifyReply) {
    const { as_of_date } = request.query as { as_of_date?: string }
    const asOfDate = as_of_date || new Date().toISOString().split('T')[0]
    const data = await this.service.getBalanceSheet(asOfDate)
    return reply.send({ success: true, data })
  }

  async getTrialBalance(request: FastifyRequest, reply: FastifyReply) {
    const { start_date, end_date } = request.query as { start_date?: string; end_date?: string }
    const data = await this.service.getTrialBalance(start_date, end_date)
    return reply.send({ success: true, data })
  }

  async seedAccounts(_request: FastifyRequest, reply: FastifyReply) {
    await this.service.seedDefaultAccounts()
    return reply.send({ success: true, message: 'Default accounts seeded' })
  }
}

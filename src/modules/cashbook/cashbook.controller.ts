import type { FastifyReply, FastifyRequest } from 'fastify'
import { env } from '../../config/env'
import { ValidationError } from '../../shared/errors'
import {
  CashbookAccountSchema,
  CashbookBudgetSchema,
  CashbookCategorySchema,
  CashbookExportQuerySchema,
  CashbookIdSchema,
  CashbookListQuerySchema,
  CashbookMonthSchema,
  CashbookOwnerQuerySchema,
  CashbookResourceQuerySchema,
  CashbookSummaryQuerySchema,
  CreateCashbookEntrySchema,
  UpdateCashbookAccountSchema,
  UpdateCashbookCategorySchema,
  UpdateCashbookEntrySchema,
  VoidCashbookEntrySchema,
} from './cashbook.schema'
import { CashbookService } from './cashbook.service'

export class CashbookController {
  constructor(private service: CashbookService) {}

  async listEntries(request: FastifyRequest, reply: FastifyReply) {
    const query = CashbookListQuerySchema.parse(request.query)
    const ownerId = this.service.resolveOwnerId(request.user.id, request.user.role, query.userId)
    const data = await this.service.listEntries(ownerId, { ...query, userId: undefined })
    return reply.send({ success: true, ...data })
  }

  async getEntry(request: FastifyRequest, reply: FastifyReply) {
    const id = CashbookIdSchema.parse((request.params as { id: string }).id)
    const query = CashbookOwnerQuerySchema.parse(request.query)
    const data = await this.service.getEntry(id, request.user.id, request.user.role, query.userId)
    return reply.send({ success: true, data })
  }

  async createEntry(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateCashbookEntrySchema.parse(request.body)
    const data = await this.service.createEntry(request.user.id, dto)
    return reply.status(201).send({ success: true, data, message: 'Cashbook entry created' })
  }

  async updateEntry(request: FastifyRequest, reply: FastifyReply) {
    const id = CashbookIdSchema.parse((request.params as { id: string }).id)
    const dto = UpdateCashbookEntrySchema.parse(request.body)
    const data = await this.service.updateEntry(id, request.user.id, dto)
    return reply.send({ success: true, data, message: 'Cashbook entry updated' })
  }

  async voidEntry(request: FastifyRequest, reply: FastifyReply) {
    const id = CashbookIdSchema.parse((request.params as { id: string }).id)
    const dto = VoidCashbookEntrySchema.parse(request.body)
    const data = await this.service.voidEntry(id, request.user.id, dto.reason)
    return reply.send({ success: true, data, message: 'Cashbook entry voided' })
  }

  async summary(request: FastifyRequest, reply: FastifyReply) {
    const query = CashbookSummaryQuerySchema.parse(request.query)
    const ownerId = this.service.resolveOwnerId(request.user.id, request.user.role, query.userId)
    const data = await this.service.getSummary(ownerId, query)
    return reply.send({ success: true, data })
  }

  async listCategories(request: FastifyRequest, reply: FastifyReply) {
    const query = CashbookResourceQuerySchema.parse(request.query)
    const ownerId = this.service.resolveOwnerId(request.user.id, request.user.role, query.userId)
    const data = await this.service.listCategories(ownerId, query.includeArchived)
    return reply.send({ success: true, data })
  }

  async createCategory(request: FastifyRequest, reply: FastifyReply) {
    const dto = CashbookCategorySchema.parse(request.body)
    const data = await this.service.createCategory(request.user.id, dto)
    return reply.status(201).send({ success: true, data, message: 'Cashbook category created' })
  }

  async updateCategory(request: FastifyRequest, reply: FastifyReply) {
    const id = CashbookIdSchema.parse((request.params as { id: string }).id)
    const dto = UpdateCashbookCategorySchema.parse(request.body)
    const data = await this.service.updateCategory(id, request.user.id, dto)
    return reply.send({ success: true, data, message: 'Cashbook category updated' })
  }

  async listAccounts(request: FastifyRequest, reply: FastifyReply) {
    const query = CashbookResourceQuerySchema.parse(request.query)
    const ownerId = this.service.resolveOwnerId(request.user.id, request.user.role, query.userId)
    const data = await this.service.listAccounts(ownerId, query.includeArchived)
    return reply.send({ success: true, data })
  }

  async createAccount(request: FastifyRequest, reply: FastifyReply) {
    const dto = CashbookAccountSchema.parse(request.body)
    const data = await this.service.createAccount(request.user.id, dto)
    return reply.status(201).send({ success: true, data, message: 'Cashbook account created' })
  }

  async updateAccount(request: FastifyRequest, reply: FastifyReply) {
    const id = CashbookIdSchema.parse((request.params as { id: string }).id)
    const dto = UpdateCashbookAccountSchema.parse(request.body)
    const data = await this.service.updateAccount(id, request.user.id, dto)
    return reply.send({ success: true, data, message: 'Cashbook account updated' })
  }

  async getBudgets(request: FastifyRequest, reply: FastifyReply) {
    const month = CashbookMonthSchema.parse((request.params as { month: string }).month)
    const query = CashbookOwnerQuerySchema.parse(request.query)
    const ownerId = this.service.resolveOwnerId(request.user.id, request.user.role, query.userId)
    const data = await this.service.getBudgets(ownerId, month)
    return reply.send({ success: true, data })
  }

  async upsertBudget(request: FastifyRequest, reply: FastifyReply) {
    const dto = CashbookBudgetSchema.parse(request.body)
    const data = await this.service.upsertBudget(request.user.id, dto)
    return reply.status(201).send({ success: true, data, message: 'Cashbook budget saved' })
  }

  async deleteBudget(request: FastifyRequest, reply: FastifyReply) {
    const id = CashbookIdSchema.parse((request.params as { id: string }).id)
    const data = await this.service.deleteBudget(id, request.user.id)
    return reply.send({ success: true, data, message: 'Cashbook budget removed' })
  }

  async exportEntries(request: FastifyRequest, reply: FastifyReply) {
    const query = CashbookExportQuerySchema.parse(request.query)
    const ownerId = this.service.resolveOwnerId(request.user.id, request.user.role, query.userId)
    const buffer = await this.service.exportEntries(ownerId, query)
    const filename = `cashbook-${query.month || 'period'}-${new Date().toISOString().slice(0, 10)}.${query.format}`
    reply.header('Content-Type', query.format === 'csv'
      ? 'text/csv; charset=utf-8'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    reply.header('Content-Disposition', `attachment; filename="${filename}"`)
    reply.header('Cache-Control', 'private, no-store')
    return reply.send(buffer)
  }

  async uploadReceipt(request: FastifyRequest, reply: FastifyReply) {
    const id = CashbookIdSchema.parse((request.params as { id: string }).id)
    const part = await request.file()
    if (!part) throw new ValidationError('No receipt file uploaded')
    try {
      const buffer = await part.toBuffer()
      const data = await this.service.uploadReceipt(id, request.user.id, request.user.role, buffer, part.filename || 'receipt')
      return reply.status(201).send({ success: true, data, message: 'Receipt uploaded successfully' })
    } finally {
      part.file.destroy()
    }
  }

  async serveReceipt(request: FastifyRequest, reply: FastifyReply) {
    const id = CashbookIdSchema.parse((request.params as { id: string }).id)
    const query = CashbookOwnerQuerySchema.parse(request.query)
    const result = await this.service.getReceipt(id, request.user.id, request.user.role, query.userId)
    const filename = result.receipt.originalName.replace(/[\r\n"]/g, '') || 'receipt'
    reply.header('Content-Type', result.receipt.mimeType)
    reply.header('Content-Disposition', `inline; filename="${filename}"`)
    reply.header('Cache-Control', 'private, no-store')
    reply.header('Content-Length', result.file.size)
    reply.header('X-Content-Type-Options', 'nosniff')
    if (env.NODE_ENV === 'production') {
      reply.header('Content-Security-Policy', "default-src 'none'; sandbox")
    }
    return reply.send(result.file.stream)
  }
}

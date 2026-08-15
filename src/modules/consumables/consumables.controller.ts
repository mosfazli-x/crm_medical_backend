import type { FastifyReply, FastifyRequest } from 'fastify'
import {
  BulkUpsertExpensesSchema,
  ConsumableItemSchema,
  ListMonthQuerySchema,
} from './consumables.schema'
import { ConsumablesService } from './consumables.service'

export class ConsumablesController {
  constructor(private service: ConsumablesService) {}

  async listItems(_request: FastifyRequest, reply: FastifyReply) {
    const data = await this.service.listItems()
    return reply.send({ success: true, data })
  }

  async createItem(request: FastifyRequest, reply: FastifyReply) {
    const dto = ConsumableItemSchema.parse(request.body)
    const data = await this.service.createItem(dto)
    return reply.status(201).send({ success: true, data, message: 'Consumable item created' })
  }

  async updateItem(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string }
    const dto = ConsumableItemSchema.partial().parse(request.body)
    const data = await this.service.updateItem(id, dto)
    return reply.send({ success: true, data, message: 'Consumable item updated' })
  }

  async deleteItem(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string }
    const data = await this.service.deleteItem(id)
    return reply.send({ success: true, data, message: 'Consumable item deactivated' })
  }

  async getMonthReport(request: FastifyRequest, reply: FastifyReply) {
    const { month } = ListMonthQuerySchema.parse(request.query)
    const data = await this.service.getMonthReport(month)
    return reply.send({ success: true, data })
  }

  async bulkUpsertExpenses(request: FastifyRequest, reply: FastifyReply) {
    const dto = BulkUpsertExpensesSchema.parse(request.body)
    const data = await this.service.bulkUpsertExpenses(dto)
    return reply.send({ success: true, data, message: 'Month expenses saved' })
  }

  async listMonths(_request: FastifyRequest, reply: FastifyReply) {
    const data = await this.service.listMonths()
    return reply.send({ success: true, data })
  }

  async exportMonth(request: FastifyRequest, reply: FastifyReply) {
    const { month } = ListMonthQuerySchema.parse(request.query)
    const buffer = await this.service.exportMonth(month)
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    reply.header('Content-Disposition', `attachment; filename="consumables-${month}.xlsx"`)
    return reply.send(buffer)
  }
}

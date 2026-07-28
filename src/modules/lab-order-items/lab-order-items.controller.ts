import type { FastifyRequest, FastifyReply } from 'fastify'
import { LabOrderItemsService } from './lab-order-items.service'
import { CreateLabOrderItemSchema, UpdateLabOrderItemSchema } from './lab-order-items.schema'

export class LabOrderItemsController {
  constructor(private service: LabOrderItemsService) {}

  async getByOrderId(
    request: FastifyRequest<{ Params: { labOrderId: string } }>,
    reply: FastifyReply
  ) {
    const { labOrderId } = request.params
    const data = await this.service.getByOrderId(labOrderId)
    return reply.send({ success: true, data })
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const data = await this.service.getById(id)
    return reply.send({ success: true, data })
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateLabOrderItemSchema.parse(request.body)
    const data = await this.service.create(dto)
    return reply.status(201).send({ success: true, data, message: 'Lab order item created' })
  }

  async update(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const dto = UpdateLabOrderItemSchema.parse(request.body)
    const data = await this.service.update(id, dto)
    return reply.send({ success: true, data, message: 'Lab order item updated' })
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    await this.service.delete(id)
    return reply.send({ success: true, message: 'Lab order item deleted' })
  }
}

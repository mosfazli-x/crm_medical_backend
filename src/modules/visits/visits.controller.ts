import type { FastifyRequest, FastifyReply } from 'fastify'
import { VisitService } from './visits.service'
import { CreateVisitSchema, UpdateVisitSchema } from './visits.schema'

export class VisitController {
  constructor(private visitService: VisitService) {}

  async getPatientList(_request: FastifyRequest, reply: FastifyReply) {
    const data = await this.visitService.getPatientList()
    return reply.status(200).send({ success: true, data })
  }

  async getCalendarEvents(_request: FastifyRequest, reply: FastifyReply) {
    const events = await this.visitService.getCalendarEvents()
    return reply.status(200).send(events)
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateVisitSchema.parse(request.body)
    const visit = await this.visitService.create(dto)
    return reply.status(201).send({
      success: true,
      message: 'Visit created successfully',
      visit,
    })
  }

  async update(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const dto = UpdateVisitSchema.parse(request.body)
    const visit = await this.visitService.update(id, dto)
    return reply.status(200).send({
      success: true,
      message: 'Visit updated successfully',
      visit,
    })
  }

  async delete(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    await this.visitService.delete(id)
    return reply.status(200).send({
      success: true,
      message: 'Visit deleted successfully',
    })
  }
}

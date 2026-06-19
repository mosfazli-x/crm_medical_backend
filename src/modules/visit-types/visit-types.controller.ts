import type { FastifyRequest, FastifyReply } from 'fastify'
import { VisitTypesService } from './visit-types.service'
import { CreateVisitTypeSchema, UpdateVisitTypeSchema } from './visit-types.schema'

export class VisitTypesController {
  constructor(private visitTypesService: VisitTypesService) {}

  async getByDoctor(
    request: FastifyRequest<{ Params: { doctorId: string } }>,
    reply: FastifyReply
  ) {
    const { doctorId } = request.params
    const data = await this.visitTypesService.getByDoctor(doctorId)
    return reply.status(200).send({ success: true, data })
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateVisitTypeSchema.parse(request.body)
    const doctorId = request.user.id
    const data = await this.visitTypesService.create(doctorId, dto)
    return reply.status(201).send({ success: true, message: 'Visit type created successfully', data })
  }

  async update(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const dto = UpdateVisitTypeSchema.parse(request.body)
    const doctorId = request.user.id
    const data = await this.visitTypesService.update(id, doctorId, dto)
    return reply.status(200).send({ success: true, message: 'Visit type updated successfully', data })
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const doctorId = request.user.id
    await this.visitTypesService.delete(id, doctorId)
    return reply.status(200).send({ success: true, message: 'Visit type deleted successfully' })
  }
}

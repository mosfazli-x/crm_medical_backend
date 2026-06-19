import type { FastifyRequest, FastifyReply } from 'fastify'
import { ScreeningService } from './screening.service'
import {
  CreateScreeningScheduleSchema, ScreeningScheduleSchema,
  CreateScreeningResultSchema, ScreeningResultSchema,
} from './screening.schema'

export class ScreeningController {
  constructor(private service: ScreeningService) {}

  async getSchedules(
    request: FastifyRequest<{ Querystring: { patientId?: string } }>,
    reply: FastifyReply
  ) {
    const { patientId } = request.query
    const data = await this.service.getSchedules(patientId)
    return reply.send({ success: true, data })
  }

  async getScheduleById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const data = await this.service.getScheduleById(id)
    return reply.send({ success: true, data })
  }

  async createSchedule(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateScreeningScheduleSchema.parse(request.body)
    const data = await this.service.createSchedule(dto)
    return reply.status(201).send({ success: true, data, message: 'Screening schedule created' })
  }

  async updateSchedule(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const dto = ScreeningScheduleSchema.partial().parse(request.body)
    const data = await this.service.updateSchedule(id, dto)
    return reply.send({ success: true, data, message: 'Screening schedule updated' })
  }

  async deleteSchedule(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    await this.service.deleteSchedule(id)
    return reply.send({ success: true, message: 'Screening schedule deleted' })
  }

  async getResults(
    request: FastifyRequest<{ Querystring: { patientId?: string; screeningType?: string } }>,
    reply: FastifyReply
  ) {
    const { patientId, screeningType } = request.query
    const data = await this.service.getResults(patientId, screeningType)
    return reply.send({ success: true, data })
  }

  async getResultById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const data = await this.service.getResultById(id)
    return reply.send({ success: true, data })
  }

  async createResult(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateScreeningResultSchema.parse(request.body)
    const data = await this.service.createResult(dto)
    return reply.status(201).send({ success: true, data, message: 'Screening result recorded' })
  }

  async getOverdueSchedules(_request: FastifyRequest, reply: FastifyReply) {
    const data = await this.service.getOverdueSchedules()
    return reply.send({ success: true, data })
  }

  async getDueSchedules(
    request: FastifyRequest<{ Querystring: { days?: string } }>,
    reply: FastifyReply
  ) {
    const days = request.query.days ? parseInt(request.query.days) : 30
    const data = await this.service.getDueSchedules(days)
    return reply.send({ success: true, data })
  }
}
import type { FastifyRequest, FastifyReply } from 'fastify'
import { LabResultsService } from './lab-results.service'
import { CreateLabResultSchema, UpdateLabResultSchema } from './lab-results.schema'

export class LabResultsController {
  constructor(private service: LabResultsService) {}

  async getByPatient(
    request: FastifyRequest<{ Params: { patientId: string }; Querystring: { category?: string; reportType?: string } }>,
    reply: FastifyReply
  ) {
    const { patientId } = request.params
    const { category, reportType } = request.query
    const data = await this.service.getByPatient(patientId, category, reportType)
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
    const dto = CreateLabResultSchema.parse(request.body)
    const data = await this.service.create(dto)
    return reply.status(201).send({ success: true, data, message: 'نتیجه آزمایش ثبت شد' })
  }

  async update(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const dto = UpdateLabResultSchema.parse(request.body)
    const data = await this.service.update(id, dto)
    return reply.send({ success: true, data, message: 'نتیجه آزمایش به‌روزرسانی شد' })
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    await this.service.delete(id)
    return reply.send({ success: true, message: 'نتیجه آزمایش حذف شد' })
  }

  async getTrend(
    request: FastifyRequest<{ Params: { patientId: string }; Querystring: { testName: string } }>,
    reply: FastifyReply
  ) {
    const { patientId } = request.params
    const { testName } = request.query
    if (!testName) {
      return reply.status(400).send({ success: false, error: 'testName query parameter is required' })
    }
    const data = await this.service.getTrend(patientId, testName)
    return reply.send({ success: true, data })
  }

  async getCategories(
    request: FastifyRequest<{ Params: { patientId: string } }>,
    reply: FastifyReply
  ) {
    const { patientId } = request.params
    const data = await this.service.getCategories(patientId)
    return reply.send({ success: true, data })
  }
}

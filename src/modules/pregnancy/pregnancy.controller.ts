import type { FastifyRequest, FastifyReply } from 'fastify'
import { PregnancyEnhancedService } from './pregnancy.service'
import { PrenatalVisitSchema, FetalMeasurementSchema, PostpartumCarePlanSchema } from './pregnancy.schema'

export class PregnancyEnhancedController {
  constructor(private service: PregnancyEnhancedService) {}

  async getPrenatalVisits(
    request: FastifyRequest<{ Params: { pregnancyId: string } }>,
    reply: FastifyReply
  ) {
    const { pregnancyId } = request.params
    const data = await this.service.getPrenatalVisits(pregnancyId)
    return reply.send({ success: true, data })
  }

  async createPrenatalVisit(request: FastifyRequest, reply: FastifyReply) {
    const dto = PrenatalVisitSchema.parse(request.body)
    const data = await this.service.createPrenatalVisit(dto)
    return reply.status(201).send({ success: true, data, message: 'Prenatal visit recorded' })
  }

  async updatePrenatalVisit(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const dto = PrenatalVisitSchema.partial().parse(request.body)
    const data = await this.service.updatePrenatalVisit(id, dto)
    return reply.send({ success: true, data, message: 'Prenatal visit updated' })
  }

  async deletePrenatalVisit(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    await this.service.deletePrenatalVisit(id)
    return reply.send({ success: true, message: 'Prenatal visit deleted' })
  }

  async getFetalMeasurements(
    request: FastifyRequest<{ Params: { pregnancyId: string } }>,
    reply: FastifyReply
  ) {
    const { pregnancyId } = request.params
    const data = await this.service.getFetalMeasurements(pregnancyId)
    return reply.send({ success: true, data })
  }

  async createFetalMeasurement(request: FastifyRequest, reply: FastifyReply) {
    const dto = FetalMeasurementSchema.parse(request.body)
    const data = await this.service.createFetalMeasurement(dto)
    return reply.status(201).send({ success: true, data, message: 'Fetal measurement recorded' })
  }

  async deleteFetalMeasurement(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    await this.service.deleteFetalMeasurement(id)
    return reply.send({ success: true, message: 'Fetal measurement deleted' })
  }

  async getPostpartumCarePlan(
    request: FastifyRequest<{ Params: { pregnancyId: string } }>,
    reply: FastifyReply
  ) {
    const { pregnancyId } = request.params
    const data = await this.service.getPostpartumCarePlan(pregnancyId)
    return reply.send({ success: true, data })
  }

  async upsertPostpartumCarePlan(request: FastifyRequest, reply: FastifyReply) {
    const dto = PostpartumCarePlanSchema.parse(request.body)
    const data = await this.service.upsertPostpartumCarePlan(dto)
    return reply.send({ success: true, data, message: 'Postpartum care plan saved' })
  }
}
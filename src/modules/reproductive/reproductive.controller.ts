import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { ReproductiveService } from './reproductive.service'
import {
  MenstrualHistorySchema, SexualHistorySchema,
  GynecologicalSurgerySchema, ContraceptiveHistorySchema,
  FamilyHistorySchema, ReproductiveSummarySchema, ReproductiveHistoryBundleSchema,
} from './reproductive.schema'

export class ReproductiveController {
  constructor(private service: ReproductiveService) {}

  async getBundle(
    request: FastifyRequest<{ Params: { patientId: string } }>,
    reply: FastifyReply
  ) {
    const { patientId } = request.params
    const data = await this.service.getBundle(patientId)
    return reply.send({ success: true, data })
  }

  async updateMenstrualHistory(
    request: FastifyRequest<{ Params: { patientId: string } }>,
    reply: FastifyReply
  ) {
    const { patientId } = request.params
    const dto = MenstrualHistorySchema.parse(request.body)
    const data = await this.service.updateMenstrualHistory(patientId, dto)
    return reply.send({ success: true, data, message: 'Menstrual history updated' })
  }

  async updateSexualHistory(
    request: FastifyRequest<{ Params: { patientId: string } }>,
    reply: FastifyReply
  ) {
    const { patientId } = request.params
    const dto = SexualHistorySchema.parse(request.body)
    const data = await this.service.updateSexualHistory(patientId, dto)
    return reply.send({ success: true, data, message: 'Sexual history updated' })
  }

  async syncSurgeries(
    request: FastifyRequest<{ Params: { patientId: string } }>,
    reply: FastifyReply
  ) {
    const { patientId } = request.params
    const body = z.array(GynecologicalSurgerySchema).parse(request.body)
    await this.service.syncSurgeries(patientId, body)
    return reply.send({ success: true, message: 'Surgeries updated' })
  }

  async syncContraceptives(
    request: FastifyRequest<{ Params: { patientId: string } }>,
    reply: FastifyReply
  ) {
    const { patientId } = request.params
    const body = z.array(ContraceptiveHistorySchema).parse(request.body)
    await this.service.syncContraceptives(patientId, body)
    return reply.send({ success: true, message: 'Contraceptive history updated' })
  }

  async syncFamilyHistory(
    request: FastifyRequest<{ Params: { patientId: string } }>,
    reply: FastifyReply
  ) {
    const { patientId } = request.params
    const body = z.array(FamilyHistorySchema).parse(request.body)
    await this.service.syncFamilyHistory(patientId, body)
    return reply.send({ success: true, message: 'Family history updated' })
  }

  async updateReproductiveSummary(
    request: FastifyRequest<{ Params: { patientId: string } }>,
    reply: FastifyReply
  ) {
    const { patientId } = request.params
    const dto = ReproductiveSummarySchema.parse(request.body)
    const data = await this.service.updateReproductiveSummary(patientId, dto)
    return reply.send({ success: true, data, message: 'Reproductive summary updated' })
  }
}
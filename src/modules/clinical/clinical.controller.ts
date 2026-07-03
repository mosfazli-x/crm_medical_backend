import type { FastifyRequest, FastifyReply } from 'fastify'
import { ClinicalService } from './clinical.service'
import { PcosRotterdamSchema, MenopauseScoringSchema, BishopScoreSchema, BreastCancerRiskSchema } from './clinical.schema'

export class ClinicalController {
  constructor(private service: ClinicalService) {}

  async assessPcos(request: FastifyRequest, reply: FastifyReply) {
    const dto = PcosRotterdamSchema.parse(request.body)
    const data = await this.service.assessPcosRotterdam(dto)
    return reply.send({ success: true, data })
  }

  async menopauseScore(request: FastifyRequest, reply: FastifyReply) {
    const dto = MenopauseScoringSchema.parse(request.body)
    const data = await this.service.calculateMenopauseScore(dto)
    return reply.send({ success: true, data })
  }

  async bishopScore(request: FastifyRequest, reply: FastifyReply) {
    const dto = BishopScoreSchema.parse(request.body)
    const data = await this.service.calculateBishopScore(dto)
    return reply.send({ success: true, data })
  }

  async breastCancerRisk(request: FastifyRequest, reply: FastifyReply) {
    const dto = BreastCancerRiskSchema.parse(request.body)
    const data = await this.service.assessBreastCancerRisk(dto)
    return reply.send({ success: true, data })
  }

  async getHistory(
    request: FastifyRequest<{ Params: { patientId: string }; Querystring: { type?: string } }>,
    reply: FastifyReply
  ) {
    const { patientId } = request.params
    const { type } = request.query
    const data = await this.service.getAssessmentHistory(patientId, type)
    return reply.send({ success: true, data })
  }
}
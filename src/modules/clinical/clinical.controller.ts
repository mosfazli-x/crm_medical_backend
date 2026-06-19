import type { FastifyRequest, FastifyReply } from 'fastify'
import { ClinicalService } from './clinical.service'
import { PcosRotterdamSchema, MenopauseScoringSchema, BishopScoreSchema, BreastCancerRiskSchema } from './clinical.schema'

export class ClinicalController {
  constructor(private service: ClinicalService) {}

  async assessPcos(request: FastifyRequest, reply: FastifyReply) {
    const dto = PcosRotterdamSchema.parse(request.body)
    const data = this.service.assessPcosRotterdam(dto)
    return reply.send({ success: true, data })
  }

  async menopauseScore(request: FastifyRequest, reply: FastifyReply) {
    const dto = MenopauseScoringSchema.parse(request.body)
    const data = this.service.calculateMenopauseScore(dto)
    return reply.send({ success: true, data })
  }

  async bishopScore(request: FastifyRequest, reply: FastifyReply) {
    const dto = BishopScoreSchema.parse(request.body)
    const data = this.service.calculateBishopScore(dto)
    return reply.send({ success: true, data })
  }

  async breastCancerRisk(request: FastifyRequest, reply: FastifyReply) {
    const dto = BreastCancerRiskSchema.parse(request.body)
    const data = this.service.assessBreastCancerRisk(dto)
    return reply.send({ success: true, data })
  }
}
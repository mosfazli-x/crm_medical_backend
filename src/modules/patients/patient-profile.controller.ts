import type { FastifyRequest, FastifyReply } from 'fastify'
import { PatientProfileService } from './patient-profile.service'

export class PatientProfileController {
  constructor(private service: PatientProfileService) {}

  async getProfile(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const data = await this.service.getPatientProfile(id)
    return reply.send({ success: true, data })
  }
}
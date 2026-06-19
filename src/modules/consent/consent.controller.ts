import type { FastifyRequest, FastifyReply } from 'fastify'
import { ConsentService } from './consent.service'
import { ConsentRecordSchema } from './consent.schema'

export class ConsentController {
  constructor(private service: ConsentService) {}

  async getByPatient(
    request: FastifyRequest<{ Params: { patientId: string } }>,
    reply: FastifyReply
  ) {
    const { patientId } = request.params
    const data = await this.service.getByPatient(patientId)
    return reply.send({ success: true, data })
  }

  async grant(request: FastifyRequest, reply: FastifyReply) {
    const dto = ConsentRecordSchema.parse(request.body)
    const data = await this.service.grant(dto, request.user.id)
    return reply.status(201).send({ success: true, data, message: 'Consent recorded' })
  }

  async revoke(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const data = await this.service.revoke(id)
    return reply.send({ success: true, data, message: 'Consent revoked' })
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    await this.service.delete(id)
    return reply.send({ success: true, message: 'Consent record deleted' })
  }

  async getActive(
    request: FastifyRequest<{ Params: { patientId: string } }>,
    reply: FastifyReply
  ) {
    const { patientId } = request.params
    const data = await this.service.getActiveConsents(patientId)
    return reply.send({ success: true, data })
  }
}
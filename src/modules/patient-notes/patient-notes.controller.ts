import type { FastifyRequest, FastifyReply } from 'fastify'
import { PatientNotesService } from './patient-notes.service'

export class PatientNotesController {
  constructor(private service: PatientNotesService) {}

  async listByPatient(request: FastifyRequest<{ Params: { patientId: string } }>, reply: FastifyReply) {
    const { patientId } = request.params
    const data = await this.service.listByPatient(patientId)
    return reply.status(200).send({ success: true, data })
  }

  async create(request: FastifyRequest<{ Params: { patientId: string }; Body: { content: string; eventType?: string; eventDate?: string } }>, reply: FastifyReply) {
    const { patientId } = request.params
    const doctorId = (request.user as any).id
    const note = await this.service.create(patientId, doctorId, request.body)
    return reply.status(201).send({ success: true, data: note })
  }

  async update(request: FastifyRequest<{ Params: { id: string }; Body: { content?: string; eventType?: string; eventDate?: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const note = await this.service.update(id, '', request.body)
    return reply.status(200).send({ success: true, data: note })
  }

  async delete(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const result = await this.service.softDelete(id)
    return reply.status(200).send({ success: true, data: result })
  }
}

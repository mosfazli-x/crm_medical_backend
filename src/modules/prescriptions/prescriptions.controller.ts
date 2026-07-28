import type { FastifyRequest, FastifyReply } from 'fastify'
import { PrescriptionService } from './prescriptions.service'
import { CreatePrescriptionSchema, UpdatePrescriptionSchema } from './prescriptions.schema'

export class PrescriptionController {
  constructor(private service: PrescriptionService) {}

  async create(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreatePrescriptionSchema.parse(request.body)
    const doctorId = (request.user as any).id
    const data = await this.service.create(doctorId, dto)
    return reply.status(201).send({ success: true, data, message: 'Prescription created' })
  }

  async getByPatient(request: FastifyRequest<{ Params: { patientId: string } }>, reply: FastifyReply) {
    const { patientId } = request.params
    const data = await this.service.getByPatient(patientId)
    return reply.send({ success: true, data })
  }

  async getActiveByPatient(request: FastifyRequest<{ Params: { patientId: string } }>, reply: FastifyReply) {
    const { patientId } = request.params
    const data = await this.service.getActiveByPatient(patientId)
    return reply.send({ success: true, data })
  }

  async getById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const data = await this.service.getById(id)
    return reply.send({ success: true, data })
  }

  async update(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const dto = UpdatePrescriptionSchema.parse(request.body)
    const data = await this.service.update(id, dto)
    return reply.send({ success: true, data, message: 'Prescription updated' })
  }

  async discontinue(request: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const { reason } = request.body as any
    const data = await this.service.discontinue(id, reason)
    return reply.send({ success: true, data, message: 'Prescription discontinued' })
  }

  async delete(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const result = await this.service.delete(id)
    return reply.send({ success: true, message: 'Prescription deleted', data: result })
  }
}

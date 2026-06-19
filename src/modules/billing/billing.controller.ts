import type { FastifyRequest, FastifyReply } from 'fastify'
import { BillingService } from './billing.service'
import { ProcedureCodeSchema, CreateBillingRecordSchema } from './billing.schema'
import { z } from 'zod'

const UpdateStatusSchema = z.object({
  status: z.string().min(1),
  paid_date: z.string().optional().nullable(),
})

export class BillingController {
  constructor(private service: BillingService) {}

  async getProcedureCodes(
    request: FastifyRequest<{ Querystring: { category?: string } }>,
    reply: FastifyReply
  ) {
    const { category } = request.query
    const data = await this.service.getProcedureCodes(category)
    return reply.send({ success: true, data })
  }

  async createProcedureCode(request: FastifyRequest, reply: FastifyReply) {
    const dto = ProcedureCodeSchema.parse(request.body)
    const data = await this.service.createProcedureCode(dto)
    return reply.status(201).send({ success: true, data, message: 'Procedure code created' })
  }

  async getRecords(
    request: FastifyRequest<{ Querystring: { patientId?: string; status?: string } }>,
    reply: FastifyReply
  ) {
    const { patientId, status } = request.query
    const data = await this.service.getBillingRecords(patientId, status)
    return reply.send({ success: true, data })
  }

  async getRecordById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const data = await this.service.getBillingRecordById(id)
    return reply.send({ success: true, data })
  }

  async createRecord(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateBillingRecordSchema.parse(request.body)
    const data = await this.service.createBillingRecord(dto)
    return reply.status(201).send({ success: true, data, message: 'Billing record created' })
  }

  async updateStatus(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const dto = UpdateStatusSchema.parse(request.body)
    const data = await this.service.updateBillingStatus(id, dto.status, dto.paid_date || undefined)
    return reply.send({ success: true, data, message: 'Billing status updated' })
  }

  async getPatientBalance(
    request: FastifyRequest<{ Params: { patientId: string } }>,
    reply: FastifyReply
  ) {
    const { patientId } = request.params
    const data = await this.service.getPatientBalance(patientId)
    return reply.send({ success: true, data })
  }
}
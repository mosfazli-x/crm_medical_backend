import type { FastifyRequest, FastifyReply } from 'fastify'
import { PatientUsageService } from './patient-usage.service'
import {
  PatientUsageSchema,
  PatientUsageListQuerySchema,
  SearchUsagePatientsSchema,
  SearchUsageVisitsSchema,
} from './patient-usage.schema'

export class PatientUsageController {
  constructor(private service: PatientUsageService) {}

  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = PatientUsageListQuerySchema.partial().parse(request.query)
    const data = await this.service.list(query)
    return reply.send({ success: true, data })
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const dto = PatientUsageSchema.parse(request.body)
    const user = request.user as { id: string }
    const data = await this.service.create(dto, user.id)
    return reply.status(201).send({ success: true, data, message: 'Patient usage recorded' })
  }

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string }
    const data = await this.service.remove(id)
    return reply.send({ success: true, data, message: 'Patient usage deleted' })
  }

  async searchPatients(request: FastifyRequest, reply: FastifyReply) {
    const query = SearchUsagePatientsSchema.parse(request.query)
    const data = await this.service.searchPatients(query)
    return reply.send({ success: true, data })
  }

  async searchVisits(request: FastifyRequest, reply: FastifyReply) {
    const query = SearchUsageVisitsSchema.parse(request.query)
    const data = await this.service.searchVisits(query)
    return reply.send({ success: true, data })
  }
}

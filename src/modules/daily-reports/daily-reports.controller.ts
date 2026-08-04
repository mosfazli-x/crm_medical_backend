import type { FastifyRequest, FastifyReply } from 'fastify'
import { DailyReportsService } from './daily-reports.service'
import {
  CreateDailyReportSchema,
  CreateDailyReportVisitTypeSchema,
  DailyReportVisitTypeQuerySchema,
  DailyReportsStatsQuerySchema,
  ListDailyReportsQuerySchema,
  UpdateDailyReportVisitTypeSchema,
} from './daily-reports.schema'

type ListQuery = FastifyRequest<{ Querystring: { reportDate?: string; from?: string; to?: string; paymentMethod?: string; procedure?: string; visitType?: string; patientId?: string } }>
type StatsQuery = FastifyRequest<{ Querystring: { from?: string; to?: string; paymentMethod?: string; procedure?: string; visitType?: string; patientId?: string } }>

export class DailyReportsController {
  constructor(private dailyReportsService: DailyReportsService) {}

  async create(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateDailyReportSchema.parse(request.body)
    const recordedById = request.user?.id
    const report = await this.dailyReportsService.create(dto, recordedById)
    return reply.status(201).send({ success: true, message: 'Daily report created successfully', data: report })
  }

  async list(request: ListQuery, reply: FastifyReply) {
    const query = ListDailyReportsQuerySchema.parse(request.query)
    const data = await this.dailyReportsService.list(query)
    return reply.status(200).send({ success: true, data })
  }

  async stats(request: StatsQuery, reply: FastifyReply) {
    const query = DailyReportsStatsQuerySchema.parse(request.query)
    const data = await this.dailyReportsService.stats(query)
    return reply.status(200).send({ success: true, data })
  }

  async delete(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    await this.dailyReportsService.delete(id)
    return reply.status(200).send({ success: true, message: 'Daily report deleted successfully' })
  }

  async listVisitTypes(request: FastifyRequest<{ Querystring: { includeInactive?: string } }>, reply: FastifyReply) {
    const query = DailyReportVisitTypeQuerySchema.parse(request.query)
    const data = await this.dailyReportsService.listVisitTypes(query.includeInactive === 'true')
    return reply.status(200).send({ success: true, data })
  }

  async createVisitType(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateDailyReportVisitTypeSchema.parse(request.body)
    const data = await this.dailyReportsService.createVisitType(dto)
    return reply.status(201).send({ success: true, message: 'Visit type created successfully', data })
  }

  async updateVisitType(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const dto = UpdateDailyReportVisitTypeSchema.parse(request.body)
    const data = await this.dailyReportsService.updateVisitType(id, dto)
    return reply.status(200).send({ success: true, message: 'Visit type updated successfully', data })
  }

  async deleteVisitType(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    await this.dailyReportsService.deleteVisitType(id)
    return reply.status(200).send({ success: true, message: 'Visit type deleted successfully' })
  }
}

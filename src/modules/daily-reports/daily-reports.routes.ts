import type { FastifyInstance } from 'fastify'
import { DailyReportsController } from './daily-reports.controller'
import { DailyReportsService } from './daily-reports.service'
import { requireRole } from '../../shared/middleware'

export async function dailyReportsRoutes(fastify: FastifyInstance) {
  const service = new DailyReportsService(fastify.db)
  const controller = new DailyReportsController(service)

  fastify.get<{ Querystring: { reportDate?: string; from?: string; to?: string; paymentMethod?: string; procedure?: string; visitType?: string; patientId?: string } }>(
    '/',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    (req, rep) => controller.list(req, rep)
  )

  fastify.post('/', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.create(req, rep))

  fastify.get<{ Querystring: { from?: string; to?: string; paymentMethod?: string; procedure?: string; visitType?: string; patientId?: string } }>(
    '/stats',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    (req, rep) => controller.stats(req, rep)
  )

  fastify.get<{ Querystring: { includeInactive?: string } }>(
    '/visit-types',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    (req, rep) => controller.listVisitTypes(req, rep)
  )

  fastify.post('/visit-types', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.createVisitType(req, rep))

  fastify.put<{ Params: { id: string } }>('/visit-types/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.updateVisitType(req, rep))

  fastify.delete<{ Params: { id: string } }>('/visit-types/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.deleteVisitType(req, rep))

  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.delete(req, rep))
}

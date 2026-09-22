import type { FastifyInstance } from 'fastify'
import { requireRole } from '../../shared/middleware'
import { DashboardLayoutController } from './dashboard-layout.controller'
import { DashboardLayoutService } from './dashboard-layout.service'

const DASHBOARD_ROLES = ['admin_doctor', 'doctor', 'lab', 'pharmacy'] as const

export async function dashboardLayoutRoutes(fastify: FastifyInstance) {
  const service = new DashboardLayoutService(fastify.db)
  const controller = new DashboardLayoutController(service)

  fastify.get<{ Params: { userId: string } }>(
    '/:userId',
    { preHandler: requireRole(...DASHBOARD_ROLES) },
    (req, rep) => controller.get(req, rep)
  )

  fastify.put<{ Params: { userId: string } }>(
    '/:userId',
    { preHandler: requireRole(...DASHBOARD_ROLES) },
    (req, rep) => controller.upsert(req, rep)
  )
}
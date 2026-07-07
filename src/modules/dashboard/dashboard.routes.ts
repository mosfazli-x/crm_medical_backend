import type { FastifyInstance } from 'fastify'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { authenticate } from '../../shared/middleware'

export async function dashboardRoutes(fastify: FastifyInstance) {
  const service = new DashboardService(fastify.db)
  const controller = new DashboardController(service)

  fastify.get('/', { preHandler: authenticate }, controller.index.bind(controller))
}

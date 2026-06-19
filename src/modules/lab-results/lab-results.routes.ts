import type { FastifyInstance } from 'fastify'
import { LabResultsController } from './lab-results.controller'
import { LabResultsService } from './lab-results.service'
import { requireRole } from '../../shared/middleware'

export async function labResultsRoutes(fastify: FastifyInstance) {
  const service = new LabResultsService(fastify.db)
  const controller = new LabResultsController(service)

  fastify.get<{ Params: { patientId: string }; Querystring: { category?: string } }>('/patient/:patientId', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getByPatient.bind(controller))
  fastify.get<{ Params: { patientId: string } }>('/patient/:patientId/categories', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getCategories.bind(controller))
  fastify.get<{ Params: { patientId: string }; Querystring: { testName: string } }>('/patient/:patientId/trend', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getTrend.bind(controller))
  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getById.bind(controller))
  fastify.post('/', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.create.bind(controller))
  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.delete.bind(controller))
}
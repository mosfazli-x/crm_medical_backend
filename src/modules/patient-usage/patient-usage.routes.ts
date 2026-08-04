import type { FastifyInstance } from 'fastify'
import { PatientUsageController } from './patient-usage.controller'
import { PatientUsageService } from './patient-usage.service'
import { requireRole } from '../../shared/middleware'

export async function patientUsageRoutes(fastify: FastifyInstance) {
  const service = new PatientUsageService(fastify.db)
  const controller = new PatientUsageController(service)

  fastify.get('/', { preHandler: requireRole('admin_doctor', 'pharmacy') }, (req, rep) => controller.list(req, rep))
  fastify.post('/', { preHandler: requireRole('admin_doctor', 'pharmacy') }, (req, rep) => controller.create(req, rep))

  fastify.get('/patients/search', { preHandler: requireRole('admin_doctor', 'pharmacy') }, (req, rep) => controller.searchPatients(req, rep))
  fastify.get('/visits/search', { preHandler: requireRole('admin_doctor', 'pharmacy') }, (req, rep) => controller.searchVisits(req, rep))

  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.remove(req, rep))
}

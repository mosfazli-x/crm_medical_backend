import type { FastifyInstance } from 'fastify'
import { PrescriptionController } from './prescriptions.controller'
import { PrescriptionService } from './prescriptions.service'
import { requireRole } from '../../shared/middleware'

export async function prescriptionRoutes(fastify: FastifyInstance) {
  const service = new PrescriptionService(fastify.db)
  const controller = new PrescriptionController(service)

  fastify.post('/', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.create(req, rep))

  fastify.get<{ Params: { patientId: string } }>('/patient/:patientId', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.getByPatient(req, rep))

  fastify.get<{ Params: { patientId: string } }>('/patient/:patientId/active', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.getActiveByPatient(req, rep))

  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.getById(req, rep))

  fastify.put<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.update(req, rep))

  fastify.post<{ Params: { id: string }; Body: { reason?: string } }>('/:id/discontinue', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.discontinue(req, rep))

  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.delete(req, rep))
}

import type { FastifyInstance } from 'fastify'
import { PatientNotesController } from './patient-notes.controller'
import { PatientNotesService } from './patient-notes.service'
import { requireRole } from '../../shared/middleware'

export async function patientNotesRoutes(fastify: FastifyInstance) {
  const service = new PatientNotesService(fastify.db)
  const controller = new PatientNotesController(service)

  fastify.get<{ Params: { patientId: string } }>(
    '/patient/:patientId',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    (req, rep) => controller.listByPatient(req, rep)
  )

  fastify.post<{ Params: { patientId: string }; Body: { content: string; eventType?: string; eventDate?: string } }>(
    '/patient/:patientId',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    (req, rep) => controller.create(req, rep)
  )

  fastify.put<{ Params: { id: string }; Body: { content?: string; eventType?: string; eventDate?: string } }>(
    '/:id',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    (req, rep) => controller.update(req, rep)
  )

  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    (req, rep) => controller.delete(req, rep)
  )
}

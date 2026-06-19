import type { FastifyInstance } from 'fastify'
import { PatientController } from './patients.controller'
import { PatientService } from './patients.service'
import { requireRole } from '../../shared/middleware'

export async function patientRoutes(fastify: FastifyInstance) {
  const service = new PatientService(fastify.db)
  const controller = new PatientController(service)

  fastify.post('/register', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.create(req, rep))

  fastify.get('/', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.findAll(req, rep))

  fastify.get('/search', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.search(req, rep))

  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.findById(req, rep))

  fastify.post<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.update(req, rep))

  fastify.post('/send-sms', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.sendSms(req, rep))

  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.delete(req, rep))

  fastify.delete<{ Params: { patientId: string; attachmentId: string } }>(
    '/:patientId/attachments/:attachmentId',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    (req, rep) => controller.deleteAttachment(req, rep)
  )
}

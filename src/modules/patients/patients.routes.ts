import type { FastifyInstance } from 'fastify'
import { PatientController } from './patients.controller'
import { PatientService } from './patients.service'
import { PatientProfileController } from './patient-profile.controller'
import { PatientProfileService } from './patient-profile.service'
import { authenticate, requireRole } from '../../shared/middleware'

export async function patientRoutes(fastify: FastifyInstance) {
  const service = new PatientService(fastify.db)
  const controller = new PatientController(service)
  const profileService = new PatientProfileService(fastify.db)
  const profileController = new PatientProfileController(profileService)

  fastify.post('/register', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.create(req, rep))

  fastify.get('/', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.findAll(req, rep))

  fastify.get('/search', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.search(req, rep))

  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.findById(req, rep))

  fastify.put<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.update(req, rep))

  fastify.post('/send-sms', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.sendSms(req, rep))

  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.delete(req, rep))

  fastify.delete<{ Params: { patientId: string; attachmentId: string } }>(
    '/:patientId/attachments/:attachmentId',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    (req, rep) => controller.deleteAttachment(req, rep)
  )

  fastify.patch(
    '/me',
    { preHandler: authenticate },
    (req, rep) => controller.updateMyProfile(req, rep)
  )

  fastify.get(
    '/doctors',
    { preHandler: authenticate },
    (req, rep) => controller.getDoctors(req, rep)
  )

  fastify.get<{ Params: { id: string } }>(
    '/:id/profile',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    (req, rep) => profileController.getProfile(req, rep)
  )

  fastify.get<{ Params: { attachmentId: string } }>(
    '/files/:attachmentId',
    { preHandler: authenticate },
    (req, rep) => controller.serveFile(req, rep)
  )
}

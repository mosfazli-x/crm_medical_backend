import type { FastifyInstance } from 'fastify'
import { DoctorProfileController } from './doctor-profiles.controller'
import { DoctorProfileService } from './doctor-profiles.service'
import { requireRole } from '../../shared/middleware'

export async function doctorProfileRoutes(fastify: FastifyInstance) {
  const service = new DoctorProfileService(fastify.db)
  const controller = new DoctorProfileController(service)

  fastify.get<{ Params: { doctorId: string } }>(
    '/:doctorId',
    (req, rep) => controller.getProfile(req, rep)
  )

  fastify.put<{ Params: { doctorId: string } }>(
    '/:doctorId',
    { preHandler: requireRole('admin_doctor') },
    (req, rep) => controller.upsert(req, rep)
  )

  fastify.post<{ Params: { doctorId: string } }>(
    '/:doctorId/photo',
    { preHandler: requireRole('admin_doctor') },
    (req, rep) => controller.uploadPhoto(req, rep)
  )

  fastify.get<{ Params: { doctorId: string } }>(
    '/:doctorId/photo',
    (req, rep) => controller.servePhoto(req, rep)
  )
}

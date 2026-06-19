import type { FastifyInstance } from 'fastify'
import { ReproductiveController } from './reproductive.controller'
import { ReproductiveService } from './reproductive.service'
import { requireRole } from '../../shared/middleware'

export async function reproductiveRoutes(fastify: FastifyInstance) {
  const service = new ReproductiveService(fastify.db)
  const controller = new ReproductiveController(service)

  fastify.get<{ Params: { patientId: string } }>(
    '/:patientId',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    controller.getBundle.bind(controller)
  )

  fastify.put<{ Params: { patientId: string } }>(
    '/:patientId/menstrual-history',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    controller.updateMenstrualHistory.bind(controller)
  )

  fastify.put<{ Params: { patientId: string } }>(
    '/:patientId/sexual-history',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    controller.updateSexualHistory.bind(controller)
  )

  fastify.put<{ Params: { patientId: string } }>(
    '/:patientId/surgeries',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    controller.syncSurgeries.bind(controller)
  )

  fastify.put<{ Params: { patientId: string } }>(
    '/:patientId/contraceptives',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    controller.syncContraceptives.bind(controller)
  )

  fastify.put<{ Params: { patientId: string } }>(
    '/:patientId/family-history',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    controller.syncFamilyHistory.bind(controller)
  )

  fastify.put<{ Params: { patientId: string } }>(
    '/:patientId/reproductive-summary',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    controller.updateReproductiveSummary.bind(controller)
  )
}
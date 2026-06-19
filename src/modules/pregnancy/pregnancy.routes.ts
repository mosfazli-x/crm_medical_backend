import type { FastifyInstance } from 'fastify'
import { PregnancyEnhancedController } from './pregnancy.controller'
import { PregnancyEnhancedService } from './pregnancy.service'
import { requireRole } from '../../shared/middleware'

export async function pregnancyRoutes(fastify: FastifyInstance) {
  const service = new PregnancyEnhancedService(fastify.db)
  const controller = new PregnancyEnhancedController(service)

  fastify.get<{ Params: { pregnancyId: string } }>('/:pregnancyId/prenatal-visits', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getPrenatalVisits.bind(controller))
  fastify.post('/prenatal-visits', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.createPrenatalVisit.bind(controller))
  fastify.put<{ Params: { id: string } }>('/prenatal-visits/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.updatePrenatalVisit.bind(controller))
  fastify.delete<{ Params: { id: string } }>('/prenatal-visits/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.deletePrenatalVisit.bind(controller))

  fastify.get<{ Params: { pregnancyId: string } }>('/:pregnancyId/fetal-measurements', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getFetalMeasurements.bind(controller))
  fastify.post('/fetal-measurements', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.createFetalMeasurement.bind(controller))
  fastify.delete<{ Params: { id: string } }>('/fetal-measurements/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.deleteFetalMeasurement.bind(controller))

  fastify.get<{ Params: { pregnancyId: string } }>('/:pregnancyId/postpartum-plan', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getPostpartumCarePlan.bind(controller))
  fastify.put('/postpartum-plan', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.upsertPostpartumCarePlan.bind(controller))
}
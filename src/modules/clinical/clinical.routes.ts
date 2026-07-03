import type { FastifyInstance } from 'fastify'
import { ClinicalController } from './clinical.controller'
import { ClinicalService } from './clinical.service'
import { requireRole } from '../../shared/middleware'

export async function clinicalRoutes(fastify: FastifyInstance) {
  const service = new ClinicalService(fastify.db)
  const controller = new ClinicalController(service)

  fastify.post('/assess/pcos-rotterdam', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.assessPcos(req, rep))
  fastify.post('/assess/menopause-score', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.menopauseScore(req, rep))
  fastify.post('/assess/bishop-score', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.bishopScore(req, rep))
  fastify.post('/assess/breast-cancer-risk', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.breastCancerRisk(req, rep))
  fastify.get<{ Params: { patientId: string }; Querystring: { type?: string } }>(
    '/history/:patientId',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    (req, rep) => controller.getHistory(req, rep)
  )
}
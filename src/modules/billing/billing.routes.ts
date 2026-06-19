import type { FastifyInstance } from 'fastify'
import { BillingController } from './billing.controller'
import { BillingService } from './billing.service'
import { requireRole } from '../../shared/middleware'

export async function billingRoutes(fastify: FastifyInstance) {
  const service = new BillingService(fastify.db)
  const controller = new BillingController(service)

  fastify.get<{ Querystring: { category?: string } }>('/procedure-codes', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getProcedureCodes.bind(controller))
  fastify.post('/procedure-codes', { preHandler: requireRole('admin_doctor') }, controller.createProcedureCode.bind(controller))

  fastify.get<{ Querystring: { patientId?: string; status?: string } }>('/records', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getRecords.bind(controller))
  fastify.get<{ Params: { id: string } }>('/records/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getRecordById.bind(controller))
  fastify.post('/records', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.createRecord.bind(controller))
  fastify.patch<{ Params: { id: string } }>('/records/:id/status', { preHandler: requireRole('admin_doctor') }, controller.updateStatus.bind(controller))
  fastify.get<{ Params: { patientId: string } }>('/patient/:patientId/balance', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getPatientBalance.bind(controller))
}
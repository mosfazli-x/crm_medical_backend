import type { FastifyInstance } from 'fastify'
import { SchedulingController } from './scheduling.controller'
import { SchedulingService } from './scheduling.service'
import { requireRole } from '../../shared/middleware'

export async function schedulingRoutes(fastify: FastifyInstance) {
  const service = new SchedulingService(fastify.db)
  const controller = new SchedulingController(service)

  fastify.get('/doctors', (req, rep) => controller.getDoctors(req, rep))

  fastify.get<{ Params: { doctorId: string } }>('/availability/:doctorId', (req, rep) => controller.getDoctorAvailability(req, rep))

  fastify.post('/availability', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.createAvailability(req, rep))

  fastify.put<{ Params: { id: string } }>('/availability/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.updateAvailability(req, rep))

  fastify.delete<{ Params: { id: string } }>('/availability/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.deleteAvailability(req, rep))

  fastify.get<{ Params: { doctorId: string }; Querystring: { date?: string } }>('/slots/:doctorId', (req, rep) => controller.getAvailableSlots(req, rep))

  fastify.post('/appointments', (req, rep) => controller.bookAppointment(req, rep))

  fastify.get<{ Querystring: { date?: string } }>('/appointments', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.getDoctorAppointments(req, rep))

  fastify.put<{ Params: { id: string } }>('/appointments/:id/status', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.updateAppointmentStatus(req, rep))

  fastify.post<{ Params: { id: string } }>('/appointments/:id/send-sms', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.sendAppointmentSms(req, rep))
}

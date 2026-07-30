import type { FastifyInstance } from 'fastify'
import { BookingController } from './booking.controller'
import { BookingService } from './booking.service'

export async function bookingRoutes(fastify: FastifyInstance) {
  const service = new BookingService(fastify.db)
  const controller = new BookingController(service)

  fastify.get<{ Querystring: { doctorId?: string } }>(
    '/services',
    (req, rep) => controller.getServices(req, rep)
  )

  fastify.get(
    '/doctors',
    (req, rep) => controller.getDoctors(req, rep)
  )

  fastify.get<{ Params: { doctorId: string }; Querystring: { date?: string } }>(
    '/slots/:doctorId',
    (req, rep) => controller.getAvailableSlots(req, rep)
  )

  fastify.post(
    '/appointments',
    (req, rep) => controller.bookAppointment(req, rep)
  )
}
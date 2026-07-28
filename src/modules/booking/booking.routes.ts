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
}

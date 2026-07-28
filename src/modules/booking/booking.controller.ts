import type { FastifyRequest, FastifyReply } from 'fastify'
import { BookingService } from './booking.service'
import { ServicesQuerySchema } from './booking.schema'

export class BookingController {
  constructor(private bookingService: BookingService) {}

  async getServices(
    request: FastifyRequest<{ Querystring: { doctorId?: string } }>,
    reply: FastifyReply
  ) {
    const { doctorId } = request.query
    const data = await this.bookingService.getServices(doctorId)
    return reply.status(200).send({ success: true, data })
  }
}

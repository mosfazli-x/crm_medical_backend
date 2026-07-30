import type { FastifyRequest, FastifyReply } from 'fastify'
import { BookingService } from './booking.service'
import { ServicesQuerySchema, SlotsQuerySchema, BookAppointmentSchema } from './booking.schema'
import { notificationService } from '../../shared/services'
import { gregorianToJalaliStr } from '../../shared/utils'

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

  async getDoctors(_request: FastifyRequest, reply: FastifyReply) {
    const data = await this.bookingService.getDoctors()
    return reply.status(200).send({ success: true, data })
  }

  async getAvailableSlots(
    request: FastifyRequest<{ Params: { doctorId: string }; Querystring: { date?: string } }>,
    reply: FastifyReply
  ) {
    const { doctorId } = request.params
    const { date } = SlotsQuerySchema.parse(request.query)

    const slots = await this.bookingService.getAvailableSlots(doctorId, date)
    return reply.status(200).send({ success: true, data: slots })
  }

  async bookAppointment(request: FastifyRequest, reply: FastifyReply) {
    const dto = BookAppointmentSchema.parse(request.body)
    const { appointment, doctorName } = await this.bookingService.bookAppointment(dto)

    if (appointment.patientPhone) {
      const jalaliDate = gregorianToJalaliStr(appointment.appointmentDate)
      const text = `نوبت شما در تاریخ ${jalaliDate} ساعت ${appointment.startTime} با دکتر ${doctorName} با موفقیت ثبت شد.\nآدرس کلینیک: تهران-پاسداران، بوستان ۸، ساختمان مهرا، طبقه پنجم واحد ده`
      const patientId = appointment.patientId || undefined
      if (patientId) {
        notificationService.notifyByPatient(patientId, text, appointment.patientPhone, 'appointment_book')
      } else {
        notificationService.notifyByPhone(appointment.patientPhone, text, undefined, 'appointment_book')
      }
    }

    return reply.status(201).send({
      success: true,
      message: 'Appointment booked successfully',
      data: appointment,
    })
  }
}
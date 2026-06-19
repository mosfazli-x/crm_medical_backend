import type { FastifyRequest, FastifyReply } from 'fastify'
import { SchedulingService } from './scheduling.service'
import {
  CreateAvailabilitySchema,
  UpdateAvailabilitySchema,
  BookAppointmentSchema,
  UpdateAppointmentStatusSchema,
} from './scheduling.schema'
import { smsService } from '../../shared/services'

export class SchedulingController {
  constructor(private schedulingService: SchedulingService) {}

  async getDoctors(_request: FastifyRequest, reply: FastifyReply) {
    const data = await this.schedulingService.getDoctors()
    return reply.status(200).send({ success: true, data })
  }

  async getDoctorAvailability(
    request: FastifyRequest<{ Params: { doctorId: string } }>,
    reply: FastifyReply
  ) {
    const { doctorId } = request.params
    const data = await this.schedulingService.getDoctorAvailability(doctorId)
    return reply.status(200).send({ success: true, data })
  }

  async createAvailability(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateAvailabilitySchema.parse(request.body)
    const doctorId = request.user.id
    const data = await this.schedulingService.createAvailability(doctorId, dto)
    return reply.status(201).send({ success: true, message: 'Availability created successfully', data })
  }

  async updateAvailability(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const dto = UpdateAvailabilitySchema.parse(request.body)
    const doctorId = request.user.id
    const data = await this.schedulingService.updateAvailability(id, doctorId, dto)
    return reply.status(200).send({ success: true, message: 'Availability updated successfully', data })
  }

  async deleteAvailability(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const doctorId = request.user.id
    await this.schedulingService.deleteAvailability(id, doctorId)
    return reply.status(200).send({ success: true, message: 'Availability deleted successfully' })
  }

  async getAvailableSlots(
    request: FastifyRequest<{ Params: { doctorId: string }; Querystring: { date?: string } }>,
    reply: FastifyReply
  ) {
    const { doctorId } = request.params
    const { date } = request.query

    if (!date) {
      return reply.status(400).send({ success: false, error: 'date query parameter is required (YYYY-MM-DD)' })
    }

    const slots = await this.schedulingService.getAvailableSlots(doctorId, date)
    return reply.status(200).send({ success: true, data: slots })
  }

  async bookAppointment(request: FastifyRequest, reply: FastifyReply) {
    const dto = BookAppointmentSchema.parse(request.body)
    const { appointment, doctorName } = await this.schedulingService.bookAppointment(dto)

    if (appointment.patientPhone) {
      smsService.send(
        appointment.patientPhone,
        `نوبت شما در تاریخ ${appointment.appointmentDate} ساعت ${appointment.startTime} با دکتر ${doctorName} با موفقیت ثبت شد.\nآدرس کلینیک: تهران-پاسداران، بستان ۸، ساختمان مهرب`
      )
    }

    return reply.status(201).send({
      success: true,
      message: 'Appointment booked successfully',
      data: appointment,
    })
  }

  async getDoctorAppointments(
    request: FastifyRequest<{ Querystring: { date?: string } }>,
    reply: FastifyReply
  ) {
    const doctorId = request.user.id
    const { date } = request.query
    const appointments = await this.schedulingService.getDoctorAppointments(doctorId, date)
    return reply.status(200).send({ success: true, data: appointments })
  }

  async updateAppointmentStatus(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const doctorId = request.user.id
    const dto = UpdateAppointmentStatusSchema.parse(request.body)
    const data = await this.schedulingService.updateAppointmentStatus(id, doctorId, dto)
    return reply.status(200).send({ success: true, message: 'Appointment status updated successfully', data })
  }
}

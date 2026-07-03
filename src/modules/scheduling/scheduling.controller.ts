import type { FastifyRequest, FastifyReply } from 'fastify'
import { SchedulingService } from './scheduling.service'
import {
  CreateAvailabilitySchema,
  UpdateAvailabilitySchema,
  BookAppointmentSchema,
  UpdateAppointmentStatusSchema,
  SendAppointmentSmsSchema,
} from './scheduling.schema'
import { notificationService, smsService } from '../../shared/services'

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
      const text = `نوبت شما در تاریخ ${appointment.appointmentDate} ساعت ${appointment.startTime} با دکتر ${doctorName} با موفقیت ثبت شد.\nآدرس کلینیک: تهران-پاسداران، بستان ۸، ساختمان مهرب`
      const patientId = appointment.patientId || undefined
      if (patientId) {
        notificationService.notifyByPatient(patientId, text, appointment.patientPhone)
      } else {
        notificationService.notifyByPhone(appointment.patientPhone, text)
      }
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
    const { appointment, doctorName } = await this.schedulingService.updateAppointmentStatus(id, doctorId, dto)

    if (appointment.patientPhone && (dto.status === 'confirmed' || dto.status === 'rejected')) {
      const message =
        dto.status === 'confirmed'
          ? `نوبت شما در تاریخ ${appointment.appointmentDate} ساعت ${appointment.startTime} با دکتر ${doctorName} تایید شد.`
          : `نوبت شما در تاریخ ${appointment.appointmentDate} ساعت ${appointment.startTime} با دکتر ${doctorName} رد شد.`
      const patientId = appointment.patientId || undefined
      if (patientId) {
        notificationService.notifyByPatient(patientId, message, appointment.patientPhone)
      } else {
        notificationService.notifyByPhone(appointment.patientPhone, message)
      }
    }

    return reply.status(200).send({ success: true, message: 'Appointment status updated successfully', data: appointment })
  }

  async sendAppointmentSms(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const doctorId = request.user.id
    const dto = SendAppointmentSmsSchema.parse(request.body)
    const info = await this.schedulingService.sendAppointmentSms(id, doctorId, dto)

    const patientId = info.patientId || undefined
    if (patientId) {
      notificationService.notifyByPatient(patientId, info.text, info.patientPhone)
    } else {
      notificationService.notifyByPhone(info.patientPhone, info.text)
    }

    return reply.status(200).send({
      success: true,
      message: 'SMS sent successfully',
      data: { phone: info.patientPhone },
    })
  }
}

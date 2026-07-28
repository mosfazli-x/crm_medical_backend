import type { FastifyRequest, FastifyReply } from 'fastify'
import { StaffService } from './staff.service'
import {
  CreateStaffSchema,
  UpdateStaffProfileSchema,
  CheckInSchema,
  CheckOutSchema,
  UpdateAttendanceSchema,
  BulkAttendanceSchema,
  AttendanceReportSchema,
  SetStaffScheduleSchema,
} from './staff.schema'

export class StaffController {
  constructor(private staffService: StaffService) {}

  async createStaff(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateStaffSchema.parse(request.body)
    const data = await this.staffService.createStaff(dto)
    return reply.status(201).send({
      success: true,
      message: 'کارمند با موفقیت ایجاد شد',
      data,
    })
  }

  async findAll(_request: FastifyRequest, reply: FastifyReply) {
    const data = await this.staffService.findAll()
    return reply.status(200).send({ success: true, data })
  }

  async findById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const data = await this.staffService.findById(id)
    return reply.status(200).send({ success: true, data })
  }

  async updateProfile(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const dto = UpdateStaffProfileSchema.parse(request.body)
    const data = await this.staffService.updateProfile(id, dto)
    return reply.status(200).send({
      success: true,
      message: 'پروفایل کارمند به‌روزرسانی شد',
      data,
    })
  }

  async deactivateStaff(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    await this.staffService.deactivateStaff(id)
    return reply.status(200).send({
      success: true,
      message: 'کارمند غیرفعال شد',
    })
  }

  async activateStaff(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    await this.staffService.activateStaff(id)
    return reply.status(200).send({
      success: true,
      message: 'کارمند فعال شد',
    })
  }

  async deleteStaff(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    await this.staffService.deleteStaff(id)
    return reply.status(200).send({
      success: true,
      message: 'کارمند حذف شد',
    })
  }

  async checkIn(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id
    const dto = CheckInSchema.parse(request.body)
    const data = await this.staffService.checkIn(userId, dto)
    return reply.status(201).send({
      success: true,
      message: 'ورود با موفقیت ثبت شد',
      data,
    })
  }

  async checkOut(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id
    const dto = CheckOutSchema.parse(request.body)
    const data = await this.staffService.checkOut(userId, dto)
    return reply.status(200).send({
      success: true,
      message: 'خروج با موفقیت ثبت شد',
      data,
    })
  }

  async getMyAttendance(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id
    const { month, year } = request.query as { month?: string; year?: string }
    const data = await this.staffService.getMyAttendance(userId, month, year)
    return reply.status(200).send({ success: true, data })
  }

  async getAttendanceReport(request: FastifyRequest, reply: FastifyReply) {
    const query = AttendanceReportSchema.parse(request.query)
    const data = await this.staffService.getAttendanceReport(query)
    return reply.status(200).send({ success: true, data })
  }

  async updateAttendance(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const dto = UpdateAttendanceSchema.parse(request.body)
    const data = await this.staffService.updateAttendance(id, dto)
    return reply.status(200).send({
      success: true,
      message: 'رکورد حضور و غیاب به‌روزرسانی شد',
      data,
    })
  }

  async bulkUpdateAttendance(request: FastifyRequest, reply: FastifyReply) {
    const dto = BulkAttendanceSchema.parse(request.body)
    const data = await this.staffService.bulkUpdateAttendance(dto)
    return reply.status(200).send({
      success: true,
      message: 'حضور و غیاب با موفقیت به‌روزرسانی شد',
      data,
    })
  }

  async getStaffSchedules(request: FastifyRequest<{ Params: { staffId: string } }>, reply: FastifyReply) {
    const { staffId } = request.params
    const data = await this.staffService.getStaffSchedules(staffId)
    return reply.status(200).send({ success: true, data })
  }

  async setStaffSchedule(request: FastifyRequest<{ Params: { staffId: string } }>, reply: FastifyReply) {
    const { staffId } = request.params
    const dto = SetStaffScheduleSchema.parse(request.body)
    const data = await this.staffService.setStaffSchedule(staffId, dto)
    return reply.status(200).send({
      success: true,
      message: 'برنامه هفتگی به‌روزرسانی شد',
      data,
    })
  }

  async getTodaySchedules(_request: FastifyRequest, reply: FastifyReply) {
    const data = await this.staffService.getTodaySchedules()
    return reply.status(200).send({ success: true, data })
  }
}

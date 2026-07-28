import type { FastifyInstance } from 'fastify'
import { StaffController } from './staff.controller'
import { StaffService } from './staff.service'
import { requireRole, authenticate } from '../../shared/middleware'

export async function staffRoutes(fastify: FastifyInstance) {
  const service = new StaffService(fastify.db)
  const controller = new StaffController(service)

  // Staff CRUD (admin only)
  fastify.post('/', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.createStaff(req, rep))
  fastify.get('/', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.findAll(req, rep))
  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.findById(req, rep))
  fastify.put<{ Params: { id: string } }>('/:id/profile', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.updateProfile(req, rep))
  fastify.post<{ Params: { id: string } }>('/:id/deactivate', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.deactivateStaff(req, rep))
  fastify.post<{ Params: { id: string } }>('/:id/activate', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.activateStaff(req, rep))
  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.deleteStaff(req, rep))

  // Attendance - self check-in/check-out (clinic_staff)
  fastify.post('/attendance/check-in', { preHandler: requireRole('clinic_staff') }, (req, rep) => controller.checkIn(req, rep))
  fastify.post('/attendance/check-out', { preHandler: requireRole('clinic_staff') }, (req, rep) => controller.checkOut(req, rep))
  fastify.get('/attendance/me', { preHandler: requireRole('clinic_staff') }, (req, rep) => controller.getMyAttendance(req, rep))

  // Attendance - admin
  fastify.get('/attendance/report', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.getAttendanceReport(req, rep))
  fastify.put<{ Params: { id: string } }>('/attendance/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.updateAttendance(req, rep))
  fastify.post('/attendance/bulk', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.bulkUpdateAttendance(req, rep))

  // Schedules
  fastify.get<{ Params: { staffId: string } }>('/schedules/:staffId', { preHandler: requireRole('admin_doctor', 'clinic_staff') }, (req, rep) => controller.getStaffSchedules(req, rep))
  fastify.put<{ Params: { staffId: string } }>('/schedules/:staffId', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.setStaffSchedule(req, rep))
  fastify.get('/schedules/today/all', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.getTodaySchedules(req, rep))
}

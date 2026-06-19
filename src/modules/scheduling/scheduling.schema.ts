import { z } from 'zod'

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

export const CreateAvailabilitySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(timePattern, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(timePattern, 'Invalid time format (HH:MM)'),
}).refine((data) => data.startTime < data.endTime, {
  message: 'startTime must be before endTime',
  path: ['startTime'],
})

export const UpdateAvailabilitySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: z.string().regex(timePattern, 'Invalid time format (HH:MM)').optional(),
  endTime: z.string().regex(timePattern, 'Invalid time format (HH:MM)').optional(),
  isActive: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
}).refine(
  (data) => {
    if (data.startTime && data.endTime) return data.startTime < data.endTime
    return true
  },
  { message: 'startTime must be before endTime', path: ['startTime'] }
)

export const BookAppointmentSchema = z.object({
  doctorId: z.string().uuid('Invalid doctor ID'),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  startTime: z.string().regex(timePattern, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(timePattern, 'Invalid time format (HH:MM)'),
  visitTypeId: z.string().uuid('Invalid visit type ID').optional(),
  patientFirstName: z.string().min(1, 'First name is required').max(100),
  patientLastName: z.string().min(1, 'Last name is required').max(100),
  patientNationalId: z.string().length(10, 'National ID must be exactly 10 characters').regex(/^\d{10}$/, 'National ID must be numeric'),
  patientPhone: z.string().min(1, 'Phone number is required').max(20),
}).refine((data) => data.startTime < data.endTime, {
  message: 'startTime must be before endTime',
  path: ['startTime'],
})

export const UpdateAppointmentStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'rejected', 'cancelled', 'completed']),
})

export type CreateAvailabilityDto = z.infer<typeof CreateAvailabilitySchema>
export type UpdateAvailabilityDto = z.infer<typeof UpdateAvailabilitySchema>
export type BookAppointmentDto = z.infer<typeof BookAppointmentSchema>
export type UpdateAppointmentStatusDto = z.infer<typeof UpdateAppointmentStatusSchema>

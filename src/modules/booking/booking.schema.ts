import { z } from 'zod'

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

export const ServicesQuerySchema = z.object({
  doctorId: z.string().uuid().optional(),
})

export const SlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
})

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

export type ServicesQueryDto = z.infer<typeof ServicesQuerySchema>
export type SlotsQueryDto = z.infer<typeof SlotsQuerySchema>
export type BookAppointmentDto = z.infer<typeof BookAppointmentSchema>

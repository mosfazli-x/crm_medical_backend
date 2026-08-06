import { z } from 'zod'

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const phonePattern = /^09\d{9}$/

export const InitDataSchema = z.object({
  initData: z.string().min(1, 'initData is required'),
})

export const PhoneLoginSchema = z.object({
  phone: z.string().regex(phonePattern, 'Invalid phone number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  initData: z.string().optional(),
})

export const SaveProfileSchema = z.object({
  nationalId: z.string().length(10, 'کد ملی باید ۱۰ رقم باشد').regex(/^\d{10}$/, 'کد ملی باید عددی باشد').optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  birthDate: z.string().regex(datePattern).nullable().optional(),
  phone: z.string().regex(phonePattern, 'Invalid phone number').optional(),
  address: z.string().max(500).optional(),
})

export const MiniAppBookSchema = z
  .object({
    doctorId: z.string().uuid('Invalid doctor ID'),
    appointmentDate: z.string().regex(datePattern, 'Invalid date format (YYYY-MM-DD)'),
    startTime: z.string().regex(timePattern, 'Invalid time format (HH:MM)'),
    endTime: z.string().regex(timePattern, 'Invalid time format (HH:MM)'),
    visitTypeId: z.string().uuid('Invalid visit type ID').optional(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: 'startTime must be before endTime',
    path: ['startTime'],
  })

export type PhoneLoginDto = z.infer<typeof PhoneLoginSchema>
export type SaveProfileDto = z.infer<typeof SaveProfileSchema>
export type MiniAppBookDto = z.infer<typeof MiniAppBookSchema>

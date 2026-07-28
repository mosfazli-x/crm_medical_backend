import { z } from 'zod'

export const CreateStaffSchema = z.object({
  fullName: z.string().min(2, 'نام باید حداقل ۲ کاراکتر باشد'),
  phone: z.string().regex(/^09\d{9}$/, 'شماره موبایل نامعتبر است'),
  password: z.string().min(6, 'رمز عبور باید حداقل ۶ کاراکتر باشد'),
  position: z.string().min(1, 'سمت شغلی الزامی است'),
  employmentDate: z.string().nullable().optional(),
  weeklySchedule: z.record(z.string(), z.object({
    start: z.string(),
    end: z.string(),
  })).optional(),
  notes: z.string().nullable().optional(),
})

export type CreateStaffDto = z.infer<typeof CreateStaffSchema>

export const UpdateStaffProfileSchema = z.object({
  position: z.string().min(1).optional(),
  employmentDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateStaffProfileDto = z.infer<typeof UpdateStaffProfileSchema>

export const CheckInSchema = z.object({
  workLocation: z.enum(['clinic', 'remote', 'field']).default('clinic'),
  notes: z.string().nullable().optional(),
})

export type CheckInDto = z.infer<typeof CheckInSchema>

export const CheckOutSchema = z.object({
  notes: z.string().nullable().optional(),
})

export type CheckOutDto = z.infer<typeof CheckOutSchema>

export const SessionInputSchema = z.object({
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/, 'زمان ورود نامعتبر است'),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/, 'زمان خروج نامعتبر است').optional(),
})

export type SessionInputDto = z.infer<typeof SessionInputSchema>

export const UpdateAttendanceSchema = z.object({
  status: z.enum(['present', 'absent', 'late', 'leave', 'holiday']).optional(),
  notes: z.string().nullable().optional(),
  adminNotes: z.string().nullable().optional(),
  workLocation: z.enum(['clinic', 'remote', 'field']).optional(),
  sessions: z.array(SessionInputSchema).optional(),
}).refine(
  (data) => data.status !== undefined || data.notes !== undefined || data.adminNotes !== undefined || data.workLocation !== undefined || data.sessions !== undefined,
  { message: 'حداقل یک فیلد برای به‌روزرسانی ارائه دهید' }
)

export type UpdateAttendanceDto = z.infer<typeof UpdateAttendanceSchema>

export const BulkAttendanceSchema = z.object({
  date: z.string(),
  records: z.array(z.object({
    staffId: z.string().uuid(),
    status: z.enum(['present', 'absent', 'late', 'leave', 'holiday']),
    notes: z.string().nullable().optional(),
    adminNotes: z.string().nullable().optional(),
    sessions: z.array(SessionInputSchema).optional(),
  })),
})

export type BulkAttendanceDto = z.infer<typeof BulkAttendanceSchema>

export const AttendanceReportSchema = z.object({
  staffId: z.string().uuid().optional(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(['present', 'absent', 'late', 'leave', 'holiday']).optional(),
})

export type AttendanceReportDto = z.infer<typeof AttendanceReportSchema>

export const CreateScheduleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
})

export const SetStaffScheduleSchema = z.object({
  schedules: z.array(CreateScheduleSchema),
})

export type SetStaffScheduleDto = z.infer<typeof SetStaffScheduleSchema>

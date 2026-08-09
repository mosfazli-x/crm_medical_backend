import { z } from 'zod'

const phoneSchema = z
  .string()
  .regex(/^09\d{9}$/, 'شماره موبایل باید با 09 شروع شده و ۱۱ رقم باشد')

const passwordSchema = z
  .string()
  .min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد')
  .max(128, 'رمز عبور باید حداکثر ۱۲۸ کاراکتر باشد')

export const LoginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(6, 'رمز عبور باید حداقل ۶ کاراکتر باشد'),
})

export const RegisterSchema = z.object({
  phone: phoneSchema,
  fullName: z.string().min(2, 'نام کامل باید حداقل ۲ کاراکتر باشد'),
  role: z.enum(['admin_doctor', 'doctor', 'lab', 'pharmacy', 'patient']),
  organizationName: z.string().min(1, 'نام سازمان الزامی است').optional(),
  password: passwordSchema,
})

export const ForgotPasswordSchema = z.object({
  phone: phoneSchema,
})

export const ResetPasswordSchema = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .length(5, 'کد تایید باید دقیقاً ۵ رقم باشد')
    .regex(/^\d{5}$/, 'کد تایید باید ۵ رقم باشد'),
  password: passwordSchema,
})

export const UpdateProfileSchema = z.object({
  fullName: z.string().min(2, 'نام کامل باید حداقل ۲ کاراکتر باشد').optional(),
  organizationName: z.string().min(1, 'نام سازمان الزامی است').optional(),
})

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'رمز عبور فعلی الزامی است'),
  newPassword: passwordSchema,
})

export type LoginDto = z.infer<typeof LoginSchema>
export type RegisterDto = z.infer<typeof RegisterSchema>
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>
export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>

export interface AuthResponse {
  token: string
  user: {
    id: string
    fullName: string | null
    role: string
    patientId: string | null
    requiresPasswordChange: boolean
  }
}

export interface UserProfileResponse {
  id: string
  phone: string
  fullName: string | null
  role: string
  organizationName: string | null
  patientId: string | null
  status: string
  requiresPasswordChange: boolean
  smsEnabled: boolean
  telegramEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

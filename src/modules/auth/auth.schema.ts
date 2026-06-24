import { z } from 'zod'

export const LoginSchema = z.object({
  phone: z
    .string()
    .regex(/^09\d{9}$/, 'Phone must start with 09 and be 11 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const RegisterSchema = z.object({
  phone: z
    .string()
    .regex(/^09\d{9}$/, 'Phone must start with 09 and be 11 digits'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  role: z.enum(['admin_doctor', 'doctor', 'lab', 'pharmacy', 'patient']),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const ForgotPasswordSchema = z.object({
  phone: z
    .string()
    .regex(/^09\d{9}$/, 'Phone must start with 09 and be 11 digits'),
})

export const ResetPasswordSchema = z.object({
  phone: z
    .string()
    .regex(/^09\d{9}$/, 'Phone must start with 09 and be 11 digits'),
  code: z
    .string()
    .length(5, 'OTP code must be exactly 5 digits')
    .regex(/^\d{5}$/, 'OTP code must be 5 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const UpdateProfileSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
  organizationName: z.string().min(1, 'Organization name is required').optional(),
})

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
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
  createdAt: Date
  updatedAt: Date
}

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

export type LoginDto = z.infer<typeof LoginSchema>
export type RegisterDto = z.infer<typeof RegisterSchema>

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

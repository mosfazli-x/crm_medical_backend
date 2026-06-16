import { z } from 'zod'

export const ApprovePatientSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  nationalId: z.string().length(10, 'National ID must be exactly 10 digits'),
  insuranceCode: z.string().optional().nullable(),
  insuranceType: z.enum(['social_security', 'health', 'armed_forces', 'relief_committee', 'iran', 'supplementary', 'other']).optional().nullable(),
  birthDate: z.string().nullable().optional(),
  address: z.string().optional().nullable(),
  maritalStatus: z.string().optional().nullable(),
})

export type ApprovePatientDto = z.infer<typeof ApprovePatientSchema>

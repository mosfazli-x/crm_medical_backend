import { z } from 'zod'

export const UpsertDoctorProfileSchema = z.object({
  specialty: z.string().max(255).nullable().optional(),
  bio: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  experienceYears: z.number().int().min(0).nullable().optional(),
  patientsCount: z.number().int().min(0).nullable().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  sortOrder: z.number().int().nullable().optional(),
  showOnLanding: z.boolean().optional(),
})

export type UpsertDoctorProfileDto = z.infer<typeof UpsertDoctorProfileSchema>

import { z } from 'zod'

export const CreateFaqSchema = z.object({
  question_fa: z.string().min(2).max(2000),
  answer_fa: z.string().min(2).max(10000),
  question_en: z.string().max(2000).optional().nullable(),
  answer_en: z.string().max(10000).optional().nullable(),
  category: z.enum([
    'general', 'billing', 'scheduling', 'clinical', 'patients',
    'prescriptions', 'lab_results', 'inventory', 'accounting',
    'staff', 'settings', 'other',
  ]).default('general'),
  tags: z.array(z.string().max(50)).max(10).optional(),
  source: z.enum(['manual', 'gemini', 'groq', 'user_confirmed', 'approved']).default('manual'),
  confidence: z.number().min(0).max(1).optional(),
})

export const UpdateFaqSchema = CreateFaqSchema.partial()

export const SearchFaqSchema = z.object({
  q: z.string().min(1).max(500),
  language: z.enum(['fa', 'en']).default('fa'),
  category: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(5),
})

export type CreateFaqDto = z.infer<typeof CreateFaqSchema>
export type UpdateFaqDto = z.infer<typeof UpdateFaqSchema>
export type SearchFaqDto = z.infer<typeof SearchFaqSchema>

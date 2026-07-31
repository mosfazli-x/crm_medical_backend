import { z } from 'zod'

export const LEAD_SOURCE_TYPES = [
  'instagram',
  'google_ads',
  'google_search',
  'website',
  'referral',
  'walk_in',
  'whatsapp',
  'telegram',
  'phone_call',
  'other',
] as const

export const LEAD_SOURCE_CATEGORIES = [
  'social',
  'paid_ads',
  'organic',
  'referral',
  'direct',
  'messaging',
  'other',
] as const

export const CreateLeadSourceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: z.enum(LEAD_SOURCE_TYPES),
  category: z.enum(LEAD_SOURCE_CATEGORIES).default('other'),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').optional(),
  sortOrder: z.number().int().min(0).default(0),
})

export const UpdateLeadSourceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(LEAD_SOURCE_TYPES).optional(),
  category: z.enum(LEAD_SOURCE_CATEGORIES).optional(),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
})

export type CreateLeadSourceDto = z.infer<typeof CreateLeadSourceSchema>
export type UpdateLeadSourceDto = z.infer<typeof UpdateLeadSourceSchema>

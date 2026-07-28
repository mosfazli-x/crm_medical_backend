import { z } from 'zod'

export const UpdateSettingSchema = z.object({
  value: z.string().min(0),
  description: z.string().optional(),
})

export const BulkUpdateSettingsSchema = z.object({
  settings: z.array(z.object({
    key: z.string().min(1),
    value: z.string(),
    description: z.string().optional(),
  })),
})

export type UpdateSettingDto = z.infer<typeof UpdateSettingSchema>
export type BulkUpdateSettingsDto = z.infer<typeof BulkUpdateSettingsSchema>

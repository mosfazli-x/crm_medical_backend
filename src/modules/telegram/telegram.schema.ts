import { z } from 'zod'

export const GenerateLinkCodeSchema = z.object({})

export const TelegramStatusSchema = z.object({
  linked: z.boolean(),
  username: z.string().optional(),
  firstName: z.string().optional(),
})

export const TelegramWebhookUpdateSchema = z.object({
  update_id: z.number(),
  message: z.object({
    message_id: z.number(),
    from: z.object({
      id: z.number(),
      is_bot: z.boolean(),
      first_name: z.string(),
      last_name: z.string().optional(),
      username: z.string().optional(),
    }).optional(),
    chat: z.object({
      id: z.number(),
      type: z.string(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      username: z.string().optional(),
    }),
    text: z.string().optional(),
    date: z.number(),
  }).optional(),
})

export type GenerateLinkCodeDto = z.infer<typeof GenerateLinkCodeSchema>
export type TelegramWebhookUpdate = z.infer<typeof TelegramWebhookUpdateSchema>

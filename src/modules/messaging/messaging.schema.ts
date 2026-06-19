import { z } from 'zod'

export const SendMessageSchema = z.object({
  receiver_id: z.string().optional().nullable(),
  receiver_role: z.enum(['admin_doctor', 'doctor', 'lab', 'pharmacy', 'patient']).optional().nullable(),
  patient_id: z.string().optional().nullable(),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().min(1).max(10000),
  is_confidential: z.boolean().optional().nullable(),
})

export const MessageSchema = z.object({
  id: z.string().optional(),
  sender_id: z.string(),
  receiver_id: z.string().optional().nullable(),
  receiver_role: z.string().optional().nullable(),
  patient_id: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
  body: z.string(),
  is_read: z.boolean().optional(),
  is_confidential: z.boolean().optional(),
})

export type SendMessageDto = z.infer<typeof SendMessageSchema>
export type MessageDto = z.infer<typeof MessageSchema>
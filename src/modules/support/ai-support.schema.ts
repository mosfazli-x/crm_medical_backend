import { z } from 'zod'

export const AskQuestionSchema = z.object({
  question: z.string().min(2).max(2000),
  language: z.enum(['fa', 'en']).default('fa'),
  category: z.string().optional(),
})

export const ConfirmAnswerSchema = z.object({
  ticket_id: z.string().uuid(),
  helpful: z.boolean(),
  feedback: z.string().max(1000).optional(),
})

export type AskQuestionDto = z.infer<typeof AskQuestionSchema>
export type ConfirmAnswerDto = z.infer<typeof ConfirmAnswerSchema>

import { z } from 'zod'

export const LoginHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  userId: z.string().uuid().optional(),
  event: z.enum(['login', 'logout']).optional(),
})

export const RevokeSessionSchema = z.object({
  sessionId: z.string().uuid(),
})

export type LoginHistoryQueryDto = z.infer<typeof LoginHistoryQuerySchema>
export type RevokeSessionDto = z.infer<typeof RevokeSessionSchema>

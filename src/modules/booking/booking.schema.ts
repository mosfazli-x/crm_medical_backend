import { z } from 'zod'

export const ServicesQuerySchema = z.object({
  doctorId: z.string().uuid().optional(),
})

export type ServicesQueryDto = z.infer<typeof ServicesQuerySchema>

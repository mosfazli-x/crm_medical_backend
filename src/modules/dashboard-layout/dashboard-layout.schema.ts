import { z } from 'zod'

export const DashboardSectionIdSchema = z.enum([
  'alerts',
  'quickActions',
  'keyMetrics',
  'insights',
  'dailyBreakdowns',
  'supplementary',
  'schedule',
])

export const DashboardSectionSizeSchema = z.enum(['small', 'medium', 'large'])

export const DashboardLayoutSchema = z
  .object({
    version: z.number().int().min(1).max(99).default(1),
    sections: z
      .array(
        z.object({
          id: DashboardSectionIdSchema,
          visible: z.boolean(),
          size: DashboardSectionSizeSchema,
          title: z.string().trim().max(40).nullable().optional(),
        })
      )
      .min(1)
      .max(12),
  })
  .strict()
  .superRefine((value, ctx) => {
    const required = [
      'alerts',
      'quickActions',
      'keyMetrics',
      'insights',
      'dailyBreakdowns',
      'supplementary',
      'schedule',
    ]
    const seen = new Set<string>()
    for (const section of value.sections) {
      if (seen.has(section.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate section id: ${section.id}`,
          path: ['sections'],
        })
      }
      seen.add(section.id)
    }
    for (const id of required) {
      if (!seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Missing section id: ${id}`,
          path: ['sections'],
        })
      }
    }
  })

export type DashboardLayoutDto = z.infer<typeof DashboardLayoutSchema>
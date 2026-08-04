import { z } from 'zod'

export const DashboardResponseSchema = z.object({
  sms_credit: z.object({
    sent: z.number().nullable(),
    remaining: z.number().nullable(),
  }).nullable(),
  storage: z.object({
    usedBytes: z.number(),
    usedFormatted: z.string(),
  }),
  patients: z.object({
    total: z.number(),
    yesterday: z.number(),
    today: z.number(),
    tomorrow: z.number(),
  }),
  appointments: z.object({
    yesterday: z.number(),
    today: z.number(),
    tomorrow: z.number(),
  }),
  messages: z.object({
    yesterday: z.number(),
    today: z.number(),
    tomorrow: z.number(),
    unread: z.number(),
  }),
  visits: z.object({
    total: z.number(),
    yesterday: z.number(),
    today: z.number(),
  }),
  billing: z.object({
    total: z.number(),
    pending: z.number(),
    paid: z.number(),
    total_revenue: z.number(),
    pending_revenue: z.number(),
  }),
  low_stock: z.object({
    count: z.number(),
    items: z.array(z.object({
      id: z.string(),
      name: z.string(),
      sku: z.string().nullable(),
      currentStock: z.string().nullable(),
      minStockLevel: z.string().nullable(),
      unit: z.string(),
    })),
  }).optional(),
})

export const PatientDashboardResponseSchema = z.object({
  patient: z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    nationalId: z.string(),
    insuranceCode: z.string().nullable(),
    insuranceType: z.string().nullable(),
    birthDate: z.string().nullable(),
    phone: z.string().nullable(),
    address: z.string().nullable(),
    maritalStatus: z.string().nullable(),
    smoking: z.string().nullable(),
    bmi: z.string().nullable(),
    exercise: z.string().nullable(),
    alcohol: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
    insurance: z.any().nullable(),
  }),
  messages: z.object({
    unread: z.number(),
    total: z.number(),
  }),
  appointments: z.array(z.object({
    id: z.string(),
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    status: z.string().nullable(),
    doctorName: z.string().nullable(),
  })),
})

export type DashboardResponse = z.infer<typeof DashboardResponseSchema>
export type PatientDashboardResponse = z.infer<typeof PatientDashboardResponseSchema>

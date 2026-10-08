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
  trend: z.array(z.object({
    date: z.string(),
    count: z.number(),
    revenue: z.number(),
  })),
  low_stock: z.object({
    count: z.number(),
    items: z.array(z.object({
      id: z.string(),
      name: z.string(),
      sku: z.string().nullable(),
      currentStock: z.string().nullable(),
      minStockLevel: z.number().nullable(),
      unit: z.string(),
    })),
  }).optional(),
})

export const DashboardStatsResponseSchema = z.object({
  overview: z.object({
    patientsTotal: z.number(),
    patientsThisMonth: z.number(),
    patientsThisWeek: z.number(),
    patientsToday: z.number(),
    visitsTotal: z.number(),
    visitsThisMonth: z.number(),
    visitsThisWeek: z.number(),
    visitsToday: z.number(),
    appointmentsTotal: z.number(),
    appointmentsPending: z.number(),
    appointmentsConfirmed: z.number(),
    appointmentsCompleted: z.number(),
    appointmentsToday: z.number(),
  }),
  clinical: z.object({
    prescriptionsTotal: z.number(),
    prescriptionsActive: z.number(),
    prescriptionsThisMonth: z.number(),
    labOrdersTotal: z.number(),
    labOrdersPending: z.number(),
    labOrdersCompleted: z.number(),
    labResultsTotal: z.number(),
    labResultsThisMonth: z.number(),
    labResultsAbnormal: z.number(),
    patientNotesTotal: z.number(),
    patientNotesThisMonth: z.number(),
    patientNotesThisWeek: z.number(),
  }),
  communication: z.object({
    smsSent: z.number().nullable(),
    messagesTotal: z.number(),
    messagesUnread: z.number(),
    messagesThisMonth: z.number(),
  }),
  financial: z.object({
    revenueThisMonth: z.number(),
    dailyReportsThisMonth: z.number(),
    billingTotal: z.number(),
    billingPaid: z.number(),
    billingPending: z.number(),
    billingPaidAmount: z.number(),
    billingPendingAmount: z.number(),
  }),
  leads: z.object({
    leadsTotal: z.number(),
    leadsNew: z.number(),
    leadsConverted: z.number(),
    leadsLost: z.number(),
    leadsThisMonth: z.number(),
    conversionRate: z.number(),
  }),
  trends: z.object({
    patientsByMonth: z.array(z.object({ month: z.string(), count: z.number() })),
    visitsByMonth: z.array(z.object({ month: z.string(), count: z.number() })),
    revenueByMonth: z.array(z.object({ month: z.string(), revenue: z.number() })),
  }),
  recent: z.object({
    recentPatients: z.array(z.object({
      id: z.string(),
      firstName: z.string().nullable(),
      lastName: z.string().nullable(),
      phone: z.string().nullable(),
      createdAt: z.date().nullable(),
    })),
    recentVisits: z.array(z.object({
      id: z.string(),
      patientName: z.string().nullable(),
      visitDate: z.date().nullable(),
      visitType: z.string().nullable(),
    })),
    recentNotes: z.array(z.object({
      id: z.string(),
      patientName: z.string().nullable(),
      content: z.string().nullable(),
      createdAt: z.date().nullable(),
    })),
  }),
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
export type DashboardStatsResponse = z.infer<typeof DashboardStatsResponseSchema>
export type PatientDashboardResponse = z.infer<typeof PatientDashboardResponseSchema>

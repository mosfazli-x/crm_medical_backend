import type { DB } from '../../db/client'
import { patients, appointments, messages, visits, billingRecords, users, dailyReports, prescriptions, labOrders, labResults, patientNotes, leads } from '../../db/schema'
import { sql, eq, and, desc, gte, lte } from 'drizzle-orm'
import { smsService, fileService } from '../../shared/services'
import { NotFoundError } from '../../shared/errors'
import { getInsuranceInfo } from '../../shared/constants/insurance'
import type { DashboardResponse, DashboardStatsResponse } from './dashboard.schema'

export class DashboardService {
  constructor(private db: DB) {}

  async getDashboard(): Promise<DashboardResponse> {
    const [smsCredit, storage, patientStats, appointmentStats, messageStats, visitStats, billingStats, trend] =
      await Promise.all([
        this.getSmsCredit(),
        this.getStorage(),
        this.getPatientStats(),
        this.getAppointmentStats(),
        this.getMessageStats(),
        this.getVisitStats(),
        this.getBillingStats(),
        this.getRevenueTrend(),
      ])

    return {
      sms_credit: smsCredit,
      storage,
      patients: patientStats,
      appointments: appointmentStats,
      messages: messageStats,
      visits: visitStats,
      billing: billingStats,
      trend,
    }
  }

  async getPatientDashboard(userId: string, patientId: string) {
    const [patientData, messageStats, upcomingAppointments] = await Promise.all([
      this.getPatientProfile(patientId),
      this.getPatientMessageStats(userId, patientId),
      this.getUpcomingAppointments(patientId),
    ])

    return {
      patient: patientData,
      messages: messageStats,
      appointments: upcomingAppointments,
    }
  }

  private async getPatientProfile(patientId: string) {
    const [patient] = await this.db
      .select({
        id: patients.id,
        firstName: patients.firstName,
        lastName: patients.lastName,
        nationalId: patients.nationalId,
        insuranceCode: patients.insuranceCode,
        insuranceType: patients.insuranceType,
        birthDate: patients.birthDate,
        phone: patients.phone,
        address: patients.address,
        maritalStatus: patients.maritalStatus,
        smoking: patients.smoking,
        bmi: patients.bmi,
        exercise: patients.exercise,
        alcohol: patients.alcohol,
        createdAt: patients.createdAt,
        updatedAt: patients.updatedAt,
      })
      .from(patients)
      .where(eq(patients.id, patientId))

    if (!patient) throw new NotFoundError('Patient')

    return {
      ...patient,
      insurance: getInsuranceInfo(patient.insuranceType),
    }
  }

  private async getPatientMessageStats(userId: string, patientId: string) {
    const [unreadResult] = await this.db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(messages)
      .where(
        and(
          eq(messages.isRead, false),
          eq(messages.patientId, patientId),
          sql`NOT (
            (${messages.senderId} = ${userId} AND ${messages.deletedBySender} = true)
            OR
            (${messages.receiverId} = ${userId} AND ${messages.deletedByReceiver} = true)
          )`,
        ),
      )

    const [totalResult] = await this.db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(messages)
      .where(
        and(
          eq(messages.patientId, patientId),
          sql`NOT (
            (${messages.senderId} = ${userId} AND ${messages.deletedBySender} = true)
            OR
            (${messages.receiverId} = ${userId} AND ${messages.deletedByReceiver} = true)
          )`,
        ),
      )

    const unreadCount = Number(unreadResult.count)
    const totalCount = Number(totalResult.count)

    return {
      unread: unreadCount,
      total: totalCount,
    }
  }

  private async getUpcomingAppointments(patientId: string) {
    const rows = await this.db
      .select({
        id: appointments.id,
        appointmentDate: appointments.appointmentDate,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        status: appointments.status,
        doctorName: users.fullName,
      })
      .from(appointments)
      .leftJoin(users, eq(appointments.doctorId, users.id))
      .where(
        and(
          eq(appointments.patientId, patientId),
          sql`${appointments.appointmentDate} >= CURRENT_DATE`,
          sql`${appointments.status} IN ('pending', 'confirmed')`,
        ),
      )
      .orderBy(appointments.appointmentDate, appointments.startTime)
      .limit(10)

    return rows.map((row) => ({
      id: row.id,
      date: row.appointmentDate,
      startTime: row.startTime,
      endTime: row.endTime,
      status: row.status,
      doctorName: row.doctorName,
    }))
  }

  private async getSmsCredit() {
    try {
      return await smsService.getCredit()
    } catch {
      return null
    }
  }

  private async getStorage() {
    try {
      return await fileService.getStorageUsage()
    } catch {
      return { usedBytes: 0, usedFormatted: '0 B' }
    }
  }

  private async getPatientStats() {
    const [result] = await this.db
      .select({
        total: sql<number>`count(*)`,
        yesterday:
          sql<number>`count(*) FILTER (WHERE ${patients.createdAt}::date = CURRENT_DATE - INTERVAL '1 day')`,
        today:
          sql<number>`count(*) FILTER (WHERE ${patients.createdAt}::date = CURRENT_DATE)`,
        tomorrow:
          sql<number>`count(*) FILTER (WHERE ${patients.createdAt}::date = CURRENT_DATE + INTERVAL '1 day')`,
      })
      .from(patients)
      .where(eq(patients.isDeleted, false))

    return {
      total: Number(result.total),
      yesterday: Number(result.yesterday),
      today: Number(result.today),
      tomorrow: Number(result.tomorrow),
    }
  }

  private async getAppointmentStats() {
    const [result] = await this.db
      .select({
        yesterday:
          sql<number>`count(*) FILTER (WHERE ${appointments.appointmentDate} = CURRENT_DATE - INTERVAL '1 day')`,
        today:
          sql<number>`count(*) FILTER (WHERE ${appointments.appointmentDate} = CURRENT_DATE)`,
        tomorrow:
          sql<number>`count(*) FILTER (WHERE ${appointments.appointmentDate} = CURRENT_DATE + INTERVAL '1 day')`,
      })
      .from(appointments)

    return {
      yesterday: Number(result.yesterday),
      today: Number(result.today),
      tomorrow: Number(result.tomorrow),
    }
  }

  private async getMessageStats() {
    const [result] = await this.db
      .select({
        yesterday:
          sql<number>`count(*) FILTER (WHERE ${messages.createdAt}::date = CURRENT_DATE - INTERVAL '1 day')`,
        today:
          sql<number>`count(*) FILTER (WHERE ${messages.createdAt}::date = CURRENT_DATE)`,
        tomorrow:
          sql<number>`count(*) FILTER (WHERE ${messages.createdAt}::date = CURRENT_DATE + INTERVAL '1 day')`,
        unread:
          sql<number>`count(*) FILTER (WHERE ${messages.isRead} = false)`,
      })
      .from(messages)

    return {
      yesterday: Number(result.yesterday),
      today: Number(result.today),
      tomorrow: Number(result.tomorrow),
      unread: Number(result.unread),
    }
  }

  private async getVisitStats() {
    const [result] = await this.db
      .select({
        total: sql<number>`count(*)`,
        yesterday:
          sql<number>`count(*) FILTER (WHERE ${visits.visitDate}::date = CURRENT_DATE - INTERVAL '1 day')`,
        today:
          sql<number>`count(*) FILTER (WHERE ${visits.visitDate}::date = CURRENT_DATE)`,
      })
      .from(visits)

    return {
      total: Number(result.total),
      yesterday: Number(result.yesterday),
      today: Number(result.today),
    }
  }

  private async getRevenueTrend() {
    const result = await this.db.execute(
      sql`SELECT ${dailyReports.reportDate}::text AS date,
                 COUNT(*)::int AS count,
                 COALESCE(SUM(${dailyReports.feeCollected}::numeric), 0)::text AS revenue
          FROM ${dailyReports}
          WHERE ${dailyReports.reportDate} >= CURRENT_DATE - INTERVAL '13 days'
          GROUP BY ${dailyReports.reportDate}
          ORDER BY ${dailyReports.reportDate}`
    )

    return (result.rows as Array<{ date: string; count: number; revenue: string }>).map((row) => ({
      date: row.date,
      count: Number(row.count),
      revenue: Number(row.revenue),
    }))
  }

  private async getBillingStats() {
    const [result] = await this.db
      .select({
        total: sql<number>`count(*)`,
        pending: sql<number>`count(*) FILTER (WHERE ${billingRecords.status} = 'pending')`,
        paid: sql<number>`count(*) FILTER (WHERE ${billingRecords.status} = 'paid')`,
        totalRevenue: sql<string>`COALESCE(SUM(${billingRecords.amount}) FILTER (WHERE ${billingRecords.status} = 'paid'), 0)`,
        pendingRevenue: sql<string>`COALESCE(SUM(${billingRecords.amount}) FILTER (WHERE ${billingRecords.status} = 'pending'), 0)`,
      })
      .from(billingRecords)

    return {
      total: Number(result.total),
      pending: Number(result.pending),
      paid: Number(result.paid),
      total_revenue: Number(result.totalRevenue),
      pending_revenue: Number(result.pendingRevenue),
    }
  }

  async getDashboardStats(): Promise<DashboardStatsResponse> {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfDay)
    startOfWeek.setDate(startOfWeek.getDate() - startOfDay.getDay())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    const overview = await this.getOverviewStats(startOfDay, startOfWeek, startOfMonth)
    const clinical = await this.getClinicalStats(startOfMonth)
    const communication = await this.getCommunicationStats(startOfMonth)
    const financial = await this.getFinancialStats(startOfMonth)
    const leadsStats = await this.getLeadsStats(startOfMonth)
    const trends = await this.getTrendsStats(startOfYear)
    const recent = await this.getRecentItems()

    return {
      overview,
      clinical,
      communication,
      financial,
      leads: leadsStats,
      trends,
      recent,
    }
  }

  private async getOverviewStats(startOfDay: Date, startOfWeek: Date, startOfMonth: Date) {
    const [patientsStats] = await this.db
      .select({
        patientsTotal: sql<number>`count(*)`,
        patientsThisMonth: sql<number>`count(*) FILTER (WHERE ${patients.createdAt} >= ${startOfMonth})`,
        patientsThisWeek: sql<number>`count(*) FILTER (WHERE ${patients.createdAt} >= ${startOfWeek})`,
        patientsToday: sql<number>`count(*) FILTER (WHERE ${patients.createdAt} >= ${startOfDay})`,
      })
      .from(patients)
      .where(eq(patients.isDeleted, false))

    const [visitsStats] = await this.db
      .select({
        visitsTotal: sql<number>`count(*)`,
        visitsThisMonth: sql<number>`count(*) FILTER (WHERE ${visits.visitDate} >= ${startOfMonth})`,
        visitsThisWeek: sql<number>`count(*) FILTER (WHERE ${visits.visitDate} >= ${startOfWeek})`,
        visitsToday: sql<number>`count(*) FILTER (WHERE ${visits.visitDate} >= ${startOfDay})`,
      })
      .from(visits)

    const [appointmentsStats] = await this.db
      .select({
        appointmentsTotal: sql<number>`count(*)`,
        appointmentsPending: sql<number>`count(*) FILTER (WHERE ${appointments.status} = 'pending')`,
        appointmentsConfirmed: sql<number>`count(*) FILTER (WHERE ${appointments.status} = 'confirmed')`,
        appointmentsCompleted: sql<number>`count(*) FILTER (WHERE ${appointments.status} = 'completed')`,
        appointmentsToday: sql<number>`count(*) FILTER (WHERE ${appointments.appointmentDate} = ${startOfDay.toISOString().split('T')[0]})`,
      })
      .from(appointments)

    return {
      patientsTotal: Number(patientsStats.patientsTotal),
      patientsThisMonth: Number(patientsStats.patientsThisMonth),
      patientsThisWeek: Number(patientsStats.patientsThisWeek),
      patientsToday: Number(patientsStats.patientsToday),
      visitsTotal: Number(visitsStats.visitsTotal),
      visitsThisMonth: Number(visitsStats.visitsThisMonth),
      visitsThisWeek: Number(visitsStats.visitsThisWeek),
      visitsToday: Number(visitsStats.visitsToday),
      appointmentsTotal: Number(appointmentsStats.appointmentsTotal),
      appointmentsPending: Number(appointmentsStats.appointmentsPending),
      appointmentsConfirmed: Number(appointmentsStats.appointmentsConfirmed),
      appointmentsCompleted: Number(appointmentsStats.appointmentsCompleted),
      appointmentsToday: Number(appointmentsStats.appointmentsToday),
    }
  }

  private async getClinicalStats(startOfMonth: Date) {
    const [prescriptionsStats] = await this.db
      .select({
        prescriptionsTotal: sql<number>`count(*)`,
        prescriptionsActive: sql<number>`count(*) FILTER (WHERE ${prescriptions.isActive} = true)`,
        prescriptionsThisMonth: sql<number>`count(*) FILTER (WHERE ${prescriptions.createdAt} >= ${startOfMonth})`,
      })
      .from(prescriptions)

    const [labOrdersStats] = await this.db
      .select({
        labOrdersTotal: sql<number>`count(*)`,
        labOrdersPending: sql<number>`count(*) FILTER (WHERE ${labOrders.status} = 'pending')`,
        labOrdersCompleted: sql<number>`count(*) FILTER (WHERE ${labOrders.status} = 'completed')`,
      })
      .from(labOrders)

    const [labResultsStats] = await this.db
      .select({
        labResultsTotal: sql<number>`count(*)`,
        labResultsThisMonth: sql<number>`count(*) FILTER (WHERE ${labResults.createdAt} >= ${startOfMonth})`,
        labResultsAbnormal: sql<number>`count(*) FILTER (WHERE ${labResults.isAbnormal} = true)`,
      })
      .from(labResults)

    const [notes] = await this.db
      .select({
        patientNotesTotal: sql<number>`count(*)`,
        patientNotesThisMonth: sql<number>`count(*) FILTER (WHERE ${patientNotes.createdAt} >= ${startOfMonth})`,
        patientNotesThisWeek: sql<number>`count(*) FILTER (WHERE ${patientNotes.createdAt} >= ${startOfMonth})`,
      })
      .from(patientNotes)
      .where(eq(patientNotes.isDeleted, false))

    return {
      prescriptionsTotal: Number(prescriptionsStats.prescriptionsTotal),
      prescriptionsActive: Number(prescriptionsStats.prescriptionsActive),
      prescriptionsThisMonth: Number(prescriptionsStats.prescriptionsThisMonth),
      labOrdersTotal: Number(labOrdersStats.labOrdersTotal),
      labOrdersPending: Number(labOrdersStats.labOrdersPending),
      labOrdersCompleted: Number(labOrdersStats.labOrdersCompleted),
      labResultsTotal: Number(labResultsStats.labResultsTotal),
      labResultsThisMonth: Number(labResultsStats.labResultsThisMonth),
      labResultsAbnormal: Number(labResultsStats.labResultsAbnormal),
      patientNotesTotal: Number(notes.patientNotesTotal),
      patientNotesThisMonth: Number(notes.patientNotesThisMonth),
      patientNotesThisWeek: Number(notes.patientNotesThisWeek),
    }
  }

  private async getCommunicationStats(startOfMonth: Date) {
    let smsSent: number | null = null
    try {
      const credit = await smsService.getCredit()
      smsSent = credit?.sent ?? null
    } catch {
      smsSent = null
    }

    const [messagesStats] = await this.db
      .select({
        messagesTotal: sql<number>`count(*)`,
        messagesUnread: sql<number>`count(*) FILTER (WHERE ${messages.isRead} = false)`,
        messagesThisMonth: sql<number>`count(*) FILTER (WHERE ${messages.createdAt} >= ${startOfMonth})`,
      })
      .from(messages)

    return {
      smsSent,
      messagesTotal: Number(messagesStats.messagesTotal),
      messagesUnread: Number(messagesStats.messagesUnread),
      messagesThisMonth: Number(messagesStats.messagesThisMonth),
    }
  }

  private async getFinancialStats(startOfMonth: Date) {
    const [dailyReportsSum] = await this.db
      .select({
        revenueThisMonth: sql<string>`COALESCE(SUM(${dailyReports.feeCollected}), 0)`,
        dailyReportsThisMonth: sql<number>`count(*)`,
      })
      .from(dailyReports)
      .where(gte(dailyReports.reportDate, startOfMonth.toISOString().split('T')[0]))

    const [billing] = await this.db
      .select({
        billingTotal: sql<number>`count(*)`,
        billingPaid: sql<number>`count(*) FILTER (WHERE ${billingRecords.status} = 'paid')`,
        billingPending: sql<number>`count(*) FILTER (WHERE ${billingRecords.status} = 'pending')`,
        billingPaidAmount: sql<string>`COALESCE(SUM(${billingRecords.amount}) FILTER (WHERE ${billingRecords.status} = 'paid'), 0)`,
        billingPendingAmount: sql<string>`COALESCE(SUM(${billingRecords.amount}) FILTER (WHERE ${billingRecords.status} = 'pending'), 0)`,
      })
      .from(billingRecords)

    return {
      revenueThisMonth: Number(dailyReportsSum.revenueThisMonth),
      dailyReportsThisMonth: Number(dailyReportsSum.dailyReportsThisMonth),
      billingTotal: Number(billing.billingTotal),
      billingPaid: Number(billing.billingPaid),
      billingPending: Number(billing.billingPending),
      billingPaidAmount: Number(billing.billingPaidAmount),
      billingPendingAmount: Number(billing.billingPendingAmount),
    }
  }

  private async getLeadsStats(startOfMonth: Date) {
    const [leadsStats] = await this.db
      .select({
        leadsTotal: sql<number>`count(*)`,
        leadsNew: sql<number>`count(*) FILTER (WHERE ${leads.status} = 'new')`,
        leadsConverted: sql<number>`count(*) FILTER (WHERE ${leads.status} = 'converted')`,
        leadsLost: sql<number>`count(*) FILTER (WHERE ${leads.status} = 'lost')`,
        leadsThisMonth: sql<number>`count(*) FILTER (WHERE ${leads.createdAt} >= ${startOfMonth})`,
      })
      .from(leads)
      .where(eq(leads.isDeleted, false))

    const converted = Number(leadsStats.leadsConverted)
    const total = Number(leadsStats.leadsTotal)
    const conversionRate = total > 0 ? (converted / total) * 100 : 0

    return {
      leadsTotal: total,
      leadsNew: Number(leadsStats.leadsNew),
      leadsConverted: converted,
      leadsLost: Number(leadsStats.leadsLost),
      leadsThisMonth: Number(leadsStats.leadsThisMonth),
      conversionRate: Math.round(conversionRate * 10) / 10,
    }
  }

  private async getTrendsStats(startOfYear: Date) {
    const patientsByMonth = await this.db.execute(
      sql`SELECT to_char(date_trunc('month', ${patients.createdAt}), 'YYYY-MM') AS month,
                 count(*)::int AS count
          FROM ${patients}
          WHERE ${patients.createdAt} >= ${startOfYear} AND ${patients.isDeleted} = false
          GROUP BY date_trunc('month', ${patients.createdAt})
          ORDER BY month ASC`
    )

    const visitsByMonth = await this.db.execute(
      sql`SELECT to_char(date_trunc('month', ${visits.visitDate}), 'YYYY-MM') AS month,
                 count(*)::int AS count
          FROM ${visits}
          WHERE ${visits.visitDate} >= ${startOfYear}
          GROUP BY date_trunc('month', ${visits.visitDate})
          ORDER BY month ASC`
    )

    const revenueByMonth = await this.db.execute(
      sql`SELECT to_char(date_trunc('month', ${dailyReports.reportDate}::date), 'YYYY-MM') AS month,
                 COALESCE(SUM(${dailyReports.feeCollected}::numeric), 0)::text AS revenue
          FROM ${dailyReports}
          WHERE ${dailyReports.reportDate} >= ${startOfYear.toISOString().split('T')[0]}
          GROUP BY date_trunc('month', ${dailyReports.reportDate}::date)
          ORDER BY month ASC`
    )

    return {
      patientsByMonth: (patientsByMonth.rows as Array<{ month: string; count: number }>).map((r) => ({
        month: r.month,
        count: Number(r.count),
      })),
      visitsByMonth: (visitsByMonth.rows as Array<{ month: string; count: number }>).map((r) => ({
        month: r.month,
        count: Number(r.count),
      })),
      revenueByMonth: (revenueByMonth.rows as Array<{ month: string; revenue: string }>).map((r) => ({
        month: r.month,
        revenue: Number(r.revenue),
      })),
    }
  }

  private async getRecentItems() {
    const recentPatients = await this.db
      .select({
        id: patients.id,
        firstName: patients.firstName,
        lastName: patients.lastName,
        phone: patients.phone,
        createdAt: patients.createdAt,
      })
      .from(patients)
      .where(eq(patients.isDeleted, false))
      .orderBy(desc(patients.createdAt))
      .limit(5)

    const recentVisits = await this.db
      .select({
        id: visits.id,
        visitDate: visits.visitDate,
        visitType: visits.visitType,
        patientName: sql<string>`COALESCE(${patients.firstName} || ' ' || ${patients.lastName}, '')`,
      })
      .from(visits)
      .leftJoin(patients, eq(visits.patientId, patients.id))
      .orderBy(desc(visits.visitDate))
      .limit(5)

    const recentNotes = await this.db
      .select({
        id: patientNotes.id,
        content: patientNotes.content,
        createdAt: patientNotes.createdAt,
        patientName: sql<string>`COALESCE(${patients.firstName} || ' ' || ${patients.lastName}, '')`,
      })
      .from(patientNotes)
      .leftJoin(patients, eq(patientNotes.patientId, patients.id))
      .where(eq(patientNotes.isDeleted, false))
      .orderBy(desc(patientNotes.createdAt))
      .limit(5)

    return {
      recentPatients,
      recentVisits,
      recentNotes,
    }
  }
}

import type { DB } from '../../db/client'
import { patients, appointments, messages, visits, billingRecords, users } from '../../db/schema'
import { sql, eq, and, desc } from 'drizzle-orm'
import { smsService, fileService } from '../../shared/services'
import { NotFoundError } from '../../shared/errors'
import { getInsuranceInfo } from '../../shared/constants/insurance'
import type { DashboardResponse } from './dashboard.schema'

export class DashboardService {
  constructor(private db: DB) {}

  async getDashboard(): Promise<DashboardResponse> {
    const [smsCredit, storage, patientStats, appointmentStats, messageStats, visitStats, billingStats] =
      await Promise.all([
        this.getSmsCredit(),
        this.getStorage(),
        this.getPatientStats(),
        this.getAppointmentStats(),
        this.getMessageStats(),
        this.getVisitStats(),
        this.getBillingStats(),
      ])

    return {
      sms_credit: smsCredit,
      storage,
      patients: patientStats,
      appointments: appointmentStats,
      messages: messageStats,
      visits: visitStats,
      billing: billingStats,
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
}

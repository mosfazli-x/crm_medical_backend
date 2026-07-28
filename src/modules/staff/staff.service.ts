import type { DB } from '../../db/client'
import { users, staffProfiles, staffAttendance, staffAttendanceSessions, staffSchedules } from '../../db/schema'
import { eq, and, desc, sql, gte, lte, count } from 'drizzle-orm'
import { NotFoundError, ValidationError } from '../../shared/errors'
import type {
  CreateStaffDto,
  UpdateStaffProfileDto,
  CheckInDto,
  CheckOutDto,
  UpdateAttendanceDto,
  AttendanceReportDto,
  BulkAttendanceDto,
  SetStaffScheduleDto,
} from './staff.schema'
import { getTodayJalali, jalaliToGregorianDate } from '../../shared/utils/date'
import { toJalaali, jalaaliMonthLength } from 'jalaali-js'
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12

export class StaffService {
  constructor(private db: DB) {}

  async createStaff(dto: CreateStaffDto) {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS)

    const result = await this.db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          phone: dto.phone,
          fullName: dto.fullName,
          passwordHash,
          role: 'clinic_staff',
          phoneConfirmed: true,
          status: 'approved',
          requiresPasswordChange: false,
        })
        .returning({
          id: users.id,
          phone: users.phone,
          fullName: users.fullName,
          role: users.role,
          status: users.status,
        })

      const [profile] = await tx
        .insert(staffProfiles)
        .values({
          userId: newUser.id,
          position: dto.position,
          employmentDate: dto.employmentDate ?? null,
          weeklySchedule: dto.weeklySchedule ?? null,
          notes: dto.notes ?? null,
        })
        .returning()

      return { user: newUser, profile }
    })

    return result
  }

  async findAll() {
    const staff = await this.db
      .select({
        id: users.id,
        phone: users.phone,
        fullName: users.fullName,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
        profileId: staffProfiles.id,
        position: staffProfiles.position,
        employmentDate: staffProfiles.employmentDate,
        isActive: staffProfiles.isActive,
      })
      .from(users)
      .leftJoin(staffProfiles, eq(users.id, staffProfiles.userId))
      .where(eq(users.role, 'clinic_staff'))
      .orderBy(desc(users.createdAt))

    return staff
  }

  async findById(id: string) {
    const [staff] = await this.db
      .select({
        id: users.id,
        phone: users.phone,
        fullName: users.fullName,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        profileId: staffProfiles.id,
        position: staffProfiles.position,
        employmentDate: staffProfiles.employmentDate,
        weeklySchedule: staffProfiles.weeklySchedule,
        notes: staffProfiles.notes,
        isActive: staffProfiles.isActive,
      })
      .from(users)
      .leftJoin(staffProfiles, eq(users.id, staffProfiles.userId))
      .where(and(eq(users.id, id), eq(users.role, 'clinic_staff')))

    if (!staff) throw new NotFoundError('کارمند یافت نشد')
    return staff
  }

  async updateProfile(id: string, dto: UpdateStaffProfileDto) {
    const [existing] = await this.db
      .select({ userId: staffProfiles.userId })
      .from(staffProfiles)
      .where(eq(staffProfiles.userId, id))

    if (!existing) throw new NotFoundError('پروفایل کارمند یافت نشد')

    const updateData: Record<string, unknown> = { updatedAt: new Date() }

    if (dto.position !== undefined) updateData.position = dto.position
    if (dto.employmentDate !== undefined) updateData.employmentDate = dto.employmentDate
    if (dto.notes !== undefined) updateData.notes = dto.notes
    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive
      await this.db
        .update(users)
        .set({
          status: dto.isActive ? 'approved' : 'rejected',
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
    }

    const [updated] = await this.db
      .update(staffProfiles)
      .set(updateData)
      .where(eq(staffProfiles.userId, id))
      .returning()

    if (!updated) throw new NotFoundError('کارمند یافت نشد')
    return updated
  }

  async deactivateStaff(id: string) {
    const [profile] = await this.db
      .select({ id: staffProfiles.id })
      .from(staffProfiles)
      .where(eq(staffProfiles.userId, id))

    if (!profile) throw new NotFoundError('کارمند یافت نشد')

    await this.db.transaction(async (tx) => {
      await tx
        .update(staffProfiles)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(staffProfiles.userId, id))

      await tx
        .update(users)
        .set({ status: 'rejected', updatedAt: new Date() })
        .where(eq(users.id, id))
    })

    return { success: true }
  }

  async activateStaff(id: string) {
    const [profile] = await this.db
      .select({ id: staffProfiles.id })
      .from(staffProfiles)
      .where(eq(staffProfiles.userId, id))

    if (!profile) throw new NotFoundError('کارمند یافت نشد')

    await this.db.transaction(async (tx) => {
      await tx
        .update(staffProfiles)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(staffProfiles.userId, id))

      await tx
        .update(users)
        .set({ status: 'approved', updatedAt: new Date() })
        .where(eq(users.id, id))
    })

    return { success: true }
  }

  async deleteStaff(id: string) {
    const [profile] = await this.db
      .select({ id: staffProfiles.id })
      .from(staffProfiles)
      .where(eq(staffProfiles.userId, id))

    if (!profile) throw new NotFoundError('کارمند یافت نشد')

    await this.db.delete(users).where(eq(users.id, id))
    return { success: true }
  }

  async checkIn(staffId: string, dto: CheckInDto) {
    const today = getTodayJalali()

    let [record] = await this.db
      .select()
      .from(staffAttendance)
      .where(and(
        eq(staffAttendance.staffId, staffId),
        eq(staffAttendance.date, today),
      ))

    if (!record) {
      [record] = await this.db
        .insert(staffAttendance)
        .values({
          staffId,
          date: today,
          status: 'present',
          workLocation: dto.workLocation ?? 'clinic',
          notes: dto.notes ?? null,
        })
        .returning()
    }

    const [session] = await this.db
      .insert(staffAttendanceSessions)
      .values({
        attendanceId: record.id,
        checkInTime: new Date(),
      })
      .returning()

    const allSessions = await this.db
      .select()
      .from(staffAttendanceSessions)
      .where(eq(staffAttendanceSessions.attendanceId, record.id))
      .orderBy(staffAttendanceSessions.checkInTime)

    return { ...record, sessions: allSessions }
  }

  async checkOut(staffId: string, dto: CheckOutDto) {
    const today = getTodayJalali()

    const [attendance] = await this.db
      .select()
      .from(staffAttendance)
      .where(and(
        eq(staffAttendance.staffId, staffId),
        eq(staffAttendance.date, today),
      ))

    if (!attendance) {
      throw new ValidationError('شما امروز هنوز ورود ثبت نکرده‌اید')
    }

    const [openSession] = await this.db
      .select()
      .from(staffAttendanceSessions)
      .where(and(
        eq(staffAttendanceSessions.attendanceId, attendance.id),
        sql`${staffAttendanceSessions.checkOutTime} IS NULL`,
      ))
      .orderBy(desc(staffAttendanceSessions.checkInTime))
      .limit(1)

    if (!openSession) {
      throw new ValidationError('هیچ جلسه بازی برای خروج وجود ندارد')
    }

    await this.db
      .update(staffAttendanceSessions)
      .set({
        checkOutTime: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(staffAttendanceSessions.id, openSession.id))

    const allSessions = await this.db
      .select()
      .from(staffAttendanceSessions)
      .where(eq(staffAttendanceSessions.attendanceId, attendance.id))
      .orderBy(staffAttendanceSessions.checkInTime)

    return { ...attendance, sessions: allSessions }
  }

  async getMyAttendance(staffId: string, month?: string, year?: string) {
    const now = new Date()
    const jNow = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate())
    const targetMonth = month ? parseInt(month) : jNow.jm
    const targetYear = year ? parseInt(year) : jNow.jy

    const daysInMonth = jalaaliMonthLength(targetYear, targetMonth)
    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
    const endDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

    const records = await this.db
      .select({
        id: staffAttendance.id,
        staffId: staffAttendance.staffId,
        date: staffAttendance.date,
        status: staffAttendance.status,
        workLocation: staffAttendance.workLocation,
        notes: staffAttendance.notes,
        adminNotes: staffAttendance.adminNotes,
        createdAt: staffAttendance.createdAt,
        updatedAt: staffAttendance.updatedAt,
      })
      .from(staffAttendance)
      .where(and(
        eq(staffAttendance.staffId, staffId),
        gte(staffAttendance.date, startDate),
        lte(staffAttendance.date, endDate),
      ))
      .orderBy(desc(staffAttendance.date))

    const attendanceIds = records.map(r => r.id)
    if (attendanceIds.length === 0) return []

    const sessions = await this.db
      .select()
      .from(staffAttendanceSessions)
      .where(sql`${staffAttendanceSessions.attendanceId} IN ${attendanceIds}`)
      .orderBy(staffAttendanceSessions.checkInTime)

    const sessionsByAttendance = new Map<string, typeof sessions>()
    for (const s of sessions) {
      const list = sessionsByAttendance.get(s.attendanceId) || []
      list.push(s)
      sessionsByAttendance.set(s.attendanceId, list)
    }

    return records.map(record => {
      const recordSessions = sessionsByAttendance.get(record.id) || []
      let totalWorkedMinutes = 0
      for (const s of recordSessions) {
        if (s.checkInTime && s.checkOutTime) {
          totalWorkedMinutes += Math.round((new Date(s.checkOutTime).getTime() - new Date(s.checkInTime).getTime()) / 60000)
        }
      }
      return {
        ...record,
        sessions: recordSessions.map(s => ({
          id: s.id,
          checkInTime: s.checkInTime,
          checkOutTime: s.checkOutTime,
        })),
        workedMinutes: totalWorkedMinutes,
      }
    })
  }

  async getAttendanceReport(query: AttendanceReportDto) {
    const conditions = [
      gte(staffAttendance.date, query.startDate),
      lte(staffAttendance.date, query.endDate),
    ]

    if (query.staffId) {
      conditions.push(eq(staffAttendance.staffId, query.staffId))
    }

    if (query.status) {
      conditions.push(eq(staffAttendance.status, query.status))
    }

    const records = await this.db
      .select({
        id: staffAttendance.id,
        staffId: staffAttendance.staffId,
        staffName: users.fullName,
        staffPosition: staffProfiles.position,
        date: staffAttendance.date,
        status: staffAttendance.status,
        workLocation: staffAttendance.workLocation,
        notes: staffAttendance.notes,
        adminNotes: staffAttendance.adminNotes,
      })
      .from(staffAttendance)
      .innerJoin(users, eq(staffAttendance.staffId, users.id))
      .leftJoin(staffProfiles, eq(users.id, staffProfiles.userId))
      .where(and(...conditions))
      .orderBy(desc(staffAttendance.date), users.fullName)

    const recordIds = records.map(r => r.id)
    const allSessions = recordIds.length > 0
      ? await this.db
          .select()
          .from(staffAttendanceSessions)
          .where(sql`${staffAttendanceSessions.attendanceId} IN ${recordIds}`)
          .orderBy(staffAttendanceSessions.checkInTime)
      : []

    const sessionsMap = new Map<string, typeof allSessions>()
    for (const s of allSessions) {
      const list = sessionsMap.get(s.attendanceId) || []
      list.push(s)
      sessionsMap.set(s.attendanceId, list)
    }

    const enrichedRecords = records.map(record => {
      const recordSessions = sessionsMap.get(record.id) || []
      let totalWorkedMinutes = 0
      for (const s of recordSessions) {
        if (s.checkInTime && s.checkOutTime) {
          totalWorkedMinutes += Math.round((new Date(s.checkOutTime).getTime() - new Date(s.checkInTime).getTime()) / 60000)
        }
      }
      return {
        ...record,
        sessions: recordSessions.map(s => ({
          id: s.id,
          checkInTime: s.checkInTime,
          checkOutTime: s.checkOutTime,
        })),
        workedMinutes: totalWorkedMinutes,
      }
    })

    const summaryResult = await this.db
      .select({
        staffId: staffAttendance.staffId,
        staffName: users.fullName,
        totalDays: count(staffAttendance.id),
        presentDays: sql<number>`count(*) filter (where ${staffAttendance.status} = 'present')`,
        absentDays: sql<number>`count(*) filter (where ${staffAttendance.status} = 'absent')`,
        lateDays: sql<number>`count(*) filter (where ${staffAttendance.status} = 'late')`,
        leaveDays: sql<number>`count(*) filter (where ${staffAttendance.status} = 'leave')`,
        holidayDays: sql<number>`count(*) filter (where ${staffAttendance.status} = 'holiday')`,
      })
      .from(staffAttendance)
      .innerJoin(users, eq(staffAttendance.staffId, users.id))
      .where(and(...conditions))
      .groupBy(staffAttendance.staffId, users.fullName)

    const summary = await Promise.all(summaryResult.map(async (s) => {
      const staffSessions = await this.db
        .select({
          totalMinutes: sql<number>`coalesce(sum(
            case when ${staffAttendanceSessions.checkOutTime} is not null and ${staffAttendanceSessions.checkInTime} is not null
            then extract(epoch from (${staffAttendanceSessions.checkOutTime} - ${staffAttendanceSessions.checkInTime})) / 60
            else 0 end
          ), 0)::int`,
        })
        .from(staffAttendanceSessions)
        .innerJoin(staffAttendance, eq(staffAttendanceSessions.attendanceId, staffAttendance.id))
        .where(and(
          eq(staffAttendance.staffId, s.staffId),
          gte(staffAttendance.date, query.startDate),
          lte(staffAttendance.date, query.endDate),
        ))

      return {
        ...s,
        totalWorkedMinutes: staffSessions[0]?.totalMinutes || 0,
      }
    }))

    return { records: enrichedRecords, summary }
  }

  async updateAttendance(recordId: string, dto: UpdateAttendanceDto) {
    const [existing] = await this.db
      .select({ id: staffAttendance.id })
      .from(staffAttendance)
      .where(eq(staffAttendance.id, recordId))

    if (!existing) throw new NotFoundError('رکورد حضور و غیاب یافت نشد')

    const updateData: Record<string, unknown> = { updatedAt: new Date() }

    if (dto.status !== undefined) updateData.status = dto.status
    if (dto.notes !== undefined) updateData.notes = dto.notes
    if (dto.adminNotes !== undefined) updateData.adminNotes = dto.adminNotes
    if (dto.workLocation !== undefined) updateData.workLocation = dto.workLocation

    const [updated] = await this.db
      .update(staffAttendance)
      .set(updateData)
      .where(eq(staffAttendance.id, recordId))
      .returning()

    if (dto.sessions) {
      await this.db
        .delete(staffAttendanceSessions)
        .where(eq(staffAttendanceSessions.attendanceId, recordId))

      if (dto.sessions.length > 0) {
        const dateStr = updated.date
        const gregorianDate = jalaliToGregorianDate(dateStr)

        await this.db.insert(staffAttendanceSessions).values(
          dto.sessions.map(s => {
            const [inH, inM] = s.checkInTime.split(':').map(Number)
            const checkIn = new Date(gregorianDate)
            checkIn.setHours(inH, inM, 0, 0)

            let checkOut: Date | null = null
            if (s.checkOutTime) {
              const [outH, outM] = s.checkOutTime.split(':').map(Number)
              checkOut = new Date(gregorianDate)
              checkOut.setHours(outH, outM, 0, 0)
            }

            return {
              attendanceId: recordId,
              checkInTime: checkIn,
              checkOutTime: checkOut,
            }
          })
        )
      }
    }

    return updated
  }

  async bulkUpdateAttendance(dto: BulkAttendanceDto) {
    const results = await this.db.transaction(async (tx) => {
      const inserted = []
      for (const record of dto.records) {
        const [existing] = await tx
          .select({ id: staffAttendance.id })
          .from(staffAttendance)
          .where(and(
            eq(staffAttendance.staffId, record.staffId),
            eq(staffAttendance.date, dto.date),
          ))

        let attendanceId: string

        if (existing) {
          await tx
            .update(staffAttendance)
            .set({
              status: record.status,
              notes: record.notes ?? null,
              adminNotes: record.adminNotes ?? null,
              updatedAt: new Date(),
            })
            .where(eq(staffAttendance.id, existing.id))
          attendanceId = existing.id
        } else {
          const [created] = await tx
            .insert(staffAttendance)
            .values({
              staffId: record.staffId,
              date: dto.date,
              status: record.status,
              notes: record.notes ?? null,
              adminNotes: record.adminNotes ?? null,
            })
            .returning()
          attendanceId = created.id
        }

        if (record.sessions && record.sessions.length > 0) {
          await tx
            .delete(staffAttendanceSessions)
            .where(eq(staffAttendanceSessions.attendanceId, attendanceId))

          const gregorianDate = jalaliToGregorianDate(dto.date)

          await tx.insert(staffAttendanceSessions).values(
            record.sessions.map(s => {
              const [inH, inM] = s.checkInTime.split(':').map(Number)
              const checkIn = new Date(gregorianDate)
              checkIn.setHours(inH, inM, 0, 0)

              let checkOut: Date | null = null
              if (s.checkOutTime) {
                const [outH, outM] = s.checkOutTime.split(':').map(Number)
                checkOut = new Date(gregorianDate)
                checkOut.setHours(outH, outM, 0, 0)
              }

              return {
                attendanceId,
                checkInTime: checkIn,
                checkOutTime: checkOut,
              }
            })
          )
        }

        inserted.push({ attendanceId, staffId: record.staffId })
      }
      return inserted
    })

    return results
  }

  async getStaffSchedules(staffId: string) {
    const schedules = await this.db
      .select()
      .from(staffSchedules)
      .where(eq(staffSchedules.staffId, staffId))
      .orderBy(staffSchedules.dayOfWeek)

    return schedules
  }

  async setStaffSchedule(staffId: string, dto: SetStaffScheduleDto) {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(staffSchedules)
        .where(eq(staffSchedules.staffId, staffId))

      if (dto.schedules.length > 0) {
        await tx
          .insert(staffSchedules)
          .values(
            dto.schedules.map((s) => ({
              staffId,
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              endTime: s.endTime,
            }))
          )
      }
    })

    return this.getStaffSchedules(staffId)
  }

  async getTodaySchedules() {
    const today = new Date().getDay()

    const schedules = await this.db
      .select({
        id: staffSchedules.id,
        staffId: staffSchedules.staffId,
        staffName: users.fullName,
        position: staffProfiles.position,
        startTime: staffSchedules.startTime,
        endTime: staffSchedules.endTime,
      })
      .from(staffSchedules)
      .innerJoin(users, eq(staffSchedules.staffId, users.id))
      .leftJoin(staffProfiles, eq(users.id, staffProfiles.userId))
      .where(and(
        eq(staffSchedules.dayOfWeek, today),
        eq(staffSchedules.isActive, true),
      ))
      .orderBy(staffSchedules.startTime)

    return schedules
  }
}

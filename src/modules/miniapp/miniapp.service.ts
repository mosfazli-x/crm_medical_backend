import type { DB } from '../../db/client'
import { users, patients, appointments, doctorVisitTypes, telegramLinks } from '../../db/schema'
import { eq, and, sql, asc, desc } from 'drizzle-orm'
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../shared/errors'
import { AuthService } from '../auth/auth.service'
import { BookingService } from '../booking/booking.service'
import { parseInitData, validateInitData } from './miniapp.initdata'
import type { ParsedInitData, TelegramUser } from './miniapp.initdata'

export interface MiniAppUser {
  id: string
  fullName: string | null
  role: string
  patientId: string | null
}

export interface MiniAppLoginResult {
  ok: boolean
  user?: MiniAppUser
  telegramUser?: TelegramUser
  needsLogin?: boolean
}

export class MiniAppService {
  private authService: AuthService
  private bookingService: BookingService

  constructor(private db: DB) {
    this.authService = new AuthService(db)
    this.bookingService = new BookingService(db)
  }

  private parseInitDataOrThrow(initData: string): ParsedInitData {
    if (!initData || !validateInitData(initData)) {
      throw new UnauthorizedError('Invalid Telegram init data')
    }
    const parsed = parseInitData(initData)
    if (!parsed.user) {
      throw new UnauthorizedError('Telegram user not found in init data')
    }
    return parsed
  }

  private toMiniAppUser(user: {
    id: string
    fullName: string | null
    role: string
    patientId: string | null
  }): MiniAppUser {
    return {
      id: user.id,
      fullName: user.fullName,
      role: user.role,
      patientId: user.patientId,
    }
  }

  async loginWithInitData(initData: string): Promise<MiniAppLoginResult> {
    const parsed = this.parseInitDataOrThrow(initData)
    const chatId = String(parsed.user!.id)

    const [link] = await this.db
      .select()
      .from(telegramLinks)
      .where(and(eq(telegramLinks.chatId, chatId), eq(telegramLinks.isActive, true)))
      .limit(1)

    if (!link) {
      return { ok: false, needsLogin: true, telegramUser: parsed.user! }
    }

    const [user] = await this.db
      .select({ id: users.id, fullName: users.fullName, role: users.role, patientId: users.patientId })
      .from(users)
      .where(eq(users.id, link.userId))
      .limit(1)

    if (!user) {
      return { ok: false, needsLogin: true, telegramUser: parsed.user! }
    }

    if (user.role !== 'patient') {
      throw new ForbiddenError('This Telegram account is linked to a staff account')
    }

    return { ok: true, user: this.toMiniAppUser(user), telegramUser: parsed.user! }
  }

  async loginWithPhone(dto: { phone: string; password: string }, initData?: string): Promise<MiniAppLoginResult> {
    const user = await this.authService.login(dto)

    let telegramUser: TelegramUser | undefined
    if (initData && validateInitData(initData)) {
      const parsed = parseInitData(initData)
      if (parsed.user) {
        telegramUser = parsed.user
        await this.linkTelegram(user.id, initData)
      }
    }

    return {
      ok: true,
      user: this.toMiniAppUser(user),
      telegramUser,
    }
  }

  async linkTelegram(userId: string, initData: string): Promise<TelegramUser> {
    const parsed = this.parseInitDataOrThrow(initData)
    const tgUser = parsed.user!
    const chatId = String(tgUser.id)

    const [existingChat] = await this.db
      .select({ userId: telegramLinks.userId })
      .from(telegramLinks)
      .where(eq(telegramLinks.chatId, chatId))
      .limit(1)

    if (existingChat && existingChat.userId !== userId) {
      throw new ConflictError('این حساب تلگرام قبلاً به کاربر دیگری متصل شده است.')
    }

    await this.db
      .insert(telegramLinks)
      .values({
        userId,
        chatId,
        username: tgUser.username ?? null,
        firstName: tgUser.first_name ?? null,
        lastName: tgUser.last_name ?? null,
      })
      .onConflictDoUpdate({
        target: telegramLinks.userId,
        set: {
          chatId,
          username: tgUser.username ?? null,
          firstName: tgUser.first_name ?? null,
          lastName: tgUser.last_name ?? null,
          isActive: true,
          updatedAt: new Date(),
        },
      })

    return tgUser
  }

  async getAuthStatus(userId: string): Promise<{ linked: boolean; username: string | null; firstName: string | null }> {
    const [link] = await this.db
      .select()
      .from(telegramLinks)
      .where(and(eq(telegramLinks.userId, userId), eq(telegramLinks.isActive, true)))
      .limit(1)

    if (!link) return { linked: false, username: null, firstName: null }
    return { linked: true, username: link.username, firstName: link.firstName }
  }

  async getProfile(userId: string): Promise<{ user: MiniAppUser; patient: typeof patients.$inferSelect | null }> {
    const [user] = await this.db
      .select({ id: users.id, fullName: users.fullName, role: users.role, patientId: users.patientId, phone: users.phone })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) throw new NotFoundError('User')

    let patient: typeof patients.$inferSelect | null = null
    if (user.patientId) {
      const [p] = await this.db
        .select()
        .from(patients)
        .where(and(eq(patients.id, user.patientId), eq(patients.isDeleted, false)))
        .limit(1)
      patient = p ?? null
    }

    return { user: this.toMiniAppUser(user), patient }
  }

  async savePatientProfile(
    userId: string,
    dto: {
      nationalId?: string
      firstName?: string
      lastName?: string
      birthDate?: string | null
      phone?: string
      address?: string
    }
  ) {
    const [user] = await this.db
      .select({ id: users.id, fullName: users.fullName, role: users.role, patientId: users.patientId, phone: users.phone })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) throw new NotFoundError('User')

    let patientId = user.patientId

    if (!patientId) {
      if (!dto.nationalId) {
        throw new ValidationError('کد ملی برای ایجاد پرونده بیمار الزامی است')
      }

      const [existing] = await this.db
        .select()
        .from(patients)
        .where(and(eq(patients.nationalId, dto.nationalId), eq(patients.isDeleted, false)))
        .limit(1)

      if (existing) {
        patientId = existing.id
      } else {
        const [firstName, ...rest] = (dto.firstName || user.fullName || 'بیمار').trim().split(/\s+/)
        const lastName = dto.lastName || rest.join(' ') || ''
        const [created] = await this.db
          .insert(patients)
          .values({
            firstName: firstName || 'بیمار',
            lastName: lastName || '',
            nationalId: dto.nationalId,
            phone: dto.phone || user.phone || null,
            birthDate: dto.birthDate ?? null,
            address: dto.address ?? null,
          })
          .returning()

        if (!created) throw new NotFoundError('Patient')
        patientId = created.id
      }

      await this.db.update(users).set({ patientId }).where(eq(users.id, userId))
    } else {
      const updateData: Record<string, unknown> = {}
      if (dto.firstName !== undefined) updateData.firstName = dto.firstName
      if (dto.lastName !== undefined) updateData.lastName = dto.lastName
      if (dto.nationalId !== undefined) updateData.nationalId = dto.nationalId
      if (dto.birthDate !== undefined) updateData.birthDate = dto.birthDate
      if (dto.phone !== undefined) updateData.phone = dto.phone
      if (dto.address !== undefined) updateData.address = dto.address
      updateData.updatedAt = new Date()

      await this.db.update(patients).set(updateData).where(eq(patients.id, patientId))
    }

    if (dto.phone) {
      await this.db.update(users).set({ phone: dto.phone }).where(eq(users.id, userId))
    }

    return this.getProfile(userId)
  }

  async getMyAppointments(userId: string) {
    const profile = await this.getProfile(userId)
    if (!profile.patient) return { upcoming: [], past: [] }

    const rows = await this.db
      .select({
        id: appointments.id,
        appointmentDate: appointments.appointmentDate,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        status: appointments.status,
        createdAt: appointments.createdAt,
        doctorName: users.fullName,
        visitTypeName: doctorVisitTypes.name,
        visitTypeColor: doctorVisitTypes.color,
      })
      .from(appointments)
      .innerJoin(users, eq(appointments.doctorId, users.id))
      .leftJoin(doctorVisitTypes, eq(appointments.visitTypeId, doctorVisitTypes.id))
      .where(eq(appointments.patientId, profile.patient.id))
      .orderBy(asc(appointments.appointmentDate), asc(appointments.startTime))

    const now = new Date()

    const upcoming = rows.filter((a) => {
      if (a.status === 'cancelled' || a.status === 'completed') return false
      const dt = new Date(`${a.appointmentDate}T${a.startTime}:00`)
      return dt >= now
    })

    const past = rows
      .filter((a) => {
        const dt = new Date(`${a.appointmentDate}T${a.startTime}:00`)
        return dt < now || a.status === 'cancelled' || a.status === 'completed'
      })
      .reverse()

    return { upcoming, past }
  }

  async bookAppointment(
    userId: string,
    dto: { doctorId: string; appointmentDate: string; startTime: string; endTime: string; visitTypeId?: string }
  ) {
    const profile = await this.getProfile(userId)
    const patient = profile.patient

    if (!patient) {
      throw new ValidationError('برای رزرو نوبت ابتدا مشخصات خود را در بخش پروفایل تکمیل کنید')
    }

    const [firstName] = patient.firstName.split(/\s+/)
    const lastName = patient.lastName || ''

    return this.bookingService.bookAppointment({
      doctorId: dto.doctorId,
      appointmentDate: dto.appointmentDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      visitTypeId: dto.visitTypeId,
      patientId: patient.id,
      patientFirstName: firstName || 'بیمار',
      patientLastName: lastName,
      patientNationalId: patient.nationalId,
      patientPhone: patient.phone || profile.user.fullName || '',
    })
  }

  async getServices(doctorId?: string) {
    return this.bookingService.getServices(doctorId)
  }

  async getDoctors() {
    return this.bookingService.getDoctors()
  }

  async getAvailableSlots(doctorId: string, date: string) {
    return this.bookingService.getAvailableSlots(doctorId, date)
  }
}

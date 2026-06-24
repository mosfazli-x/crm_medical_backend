import type { DB } from '../../db/client'
import { users, otpCodes } from '../../db/schema'
import { and, eq, gt, isNull, sql, ne } from 'drizzle-orm'
import { ConflictError, UnauthorizedError, ForbiddenError, NotFoundError, TooManyRequestsError, ValidationError } from '../../shared/errors'
import { smsService } from '../../shared/services'
import type { LoginDto, RegisterDto, ForgotPasswordDto, ResetPasswordDto, UpdateProfileDto, ChangePasswordDto } from './auth.schema'
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12

export class AuthService {
  constructor(private db: DB) { }

  async login(dto: LoginDto) {
    const [user] = await this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        role: users.role,
        passwordHash: users.passwordHash,
        patientId: users.patientId,
        requiresPasswordChange: users.requiresPasswordChange,
        status: users.status,
        phoneConfirmed: users.phoneConfirmed,
      })
      .from(users)
      .where(eq(users.phone, dto.phone))
      .limit(1)

    if (!user) {
      throw new UnauthorizedError('Invalid phone or password')
    }

    if (user.status !== 'approved') {
      throw new ForbiddenError('Account is not active')
    }

    if (!user.phoneConfirmed) {
      throw new ForbiddenError('Phone number not confirmed')
    }

    const match = await bcrypt.compare(dto.password, user.passwordHash)
    if (!match) {
      throw new UnauthorizedError('Invalid phone or password')
    }

    return {
      id: user.id,
      fullName: user.fullName,
      role: user.role,
      patientId: user.patientId,
      requiresPasswordChange: user.requiresPasswordChange,
    }
  }

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS)

    try {
      const [newUser] = await this.db
        .insert(users)
        .values({
          phone: dto.phone,
          fullName: dto.fullName,
          passwordHash,
          role: dto.role,
          phoneConfirmed: dto.role === 'patient',
          status: dto.role === 'patient' ? 'approved' : 'pending',
          requiresPasswordChange: false,
        })
        .returning({
          id: users.id,
          fullName: users.fullName,
          role: users.role,
          phone: users.phone,
        })



      const roleNames: Record<string, string> = {
        admin_doctor: 'مدیر ارشد',
        doctor: 'پزشک',
        lab: 'آزمایشگاه',
        pharmacy: 'داروخانه',
        patient: 'بیمار',
      }

      const message = `سلام ${dto.fullName} عزیز، ثبت‌نام شما در کلینیک تخصصی دکتر حسینی با نقش ${roleNames[dto.role] || dto.role} با موفقیت انجام شد.`
      smsService.send(dto.phone, message).catch(() => {})

      return newUser
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as Record<string, unknown>).code === '23505'
      ) {
        throw new ConflictError('Phone number already registered')
      }
      throw error
    }
  }

  async me(userId: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        phone: users.phone,
        fullName: users.fullName,
        role: users.role,
        organizationName: users.organizationName,
        patientId: users.patientId,
        status: users.status,
        requiresPasswordChange: users.requiresPasswordChange,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) {
      throw new NotFoundError('User not found')
    }

    return user
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (dto.fullName !== undefined) {
      updateData.fullName = dto.fullName
    }

    if (dto.organizationName !== undefined) {
      const [user] = await this.db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      if (!user) {
        throw new NotFoundError('User not found')
      }

      if (!['lab', 'pharmacy'].includes(user.role)) {
        throw new ValidationError('Organization name can only be set for lab or pharmacy roles')
      }

      updateData.organizationName = dto.organizationName
    }

    if (Object.keys(updateData).length === 1) {
      throw new ValidationError('No valid fields provided for update')
    }

    const [updated] = await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        phone: users.phone,
        fullName: users.fullName,
        role: users.role,
        organizationName: users.organizationName,
        patientId: users.patientId,
        status: users.status,
        requiresPasswordChange: users.requiresPasswordChange,
        updatedAt: users.updatedAt,
      })

    return updated
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const [user] = await this.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) {
      throw new NotFoundError('User not found')
    }

    const match = await bcrypt.compare(dto.currentPassword, user.passwordHash)
    if (!match) {
      throw new UnauthorizedError('Current password is incorrect')
    }

    const samePassword = await bcrypt.compare(dto.newPassword, user.passwordHash)
    if (samePassword) {
      throw new ValidationError('New password must be different from current password')
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS)

    await this.db
      .update(users)
      .set({
        passwordHash,
        requiresPasswordChange: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    return { success: true }
  }

  async requestOtp(dto: ForgotPasswordDto) {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, dto.phone))
      .limit(1)

    if (!user) {
      return { success: true }
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
    const [recentCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.phone, dto.phone),
          eq(otpCodes.type, 'password_reset'),
          gt(otpCodes.createdAt, tenMinutesAgo),
        )
      )

    if (recentCount.count >= 3) {
      throw new TooManyRequestsError('حد مجاز درخواست کد تایید. لطفاً بعداً تلاش کنید.')
    }

    await this.db
      .update(otpCodes)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(otpCodes.phone, dto.phone),
          eq(otpCodes.type, 'password_reset'),
          isNull(otpCodes.usedAt),
        )
      )

    const code = String(Math.floor(10000 + Math.random() * 90000))
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    await this.db.insert(otpCodes).values({
      phone: dto.phone,
      code,
      type: 'password_reset',
      expiresAt,
    })

    const message = `کد تایید تغییر رمز عبور شما: ${code}\nاین کد تا ۵ دقیقه معتبر است.`
    smsService.send(dto.phone, message).catch(() => {})

    return { success: true }
  }

  async resetPassword(dto: ResetPasswordDto) {
    const [otp] = await this.db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.phone, dto.phone),
          eq(otpCodes.code, dto.code),
          eq(otpCodes.type, 'password_reset'),
          isNull(otpCodes.usedAt),
          gt(otpCodes.expiresAt, new Date()),
        )
      )
      .limit(1)

    if (!otp) {
      const [latestOtp] = await this.db
        .select({ id: otpCodes.id })
        .from(otpCodes)
        .where(
          and(
            eq(otpCodes.phone, dto.phone),
            eq(otpCodes.type, 'password_reset'),
            isNull(otpCodes.usedAt),
          )
        )
        .limit(1)

      if (latestOtp) {
        await this.db
          .update(otpCodes)
          .set({ attempts: sql`attempts + 1` })
          .where(eq(otpCodes.id, latestOtp.id))
      }

      throw new UnauthorizedError('کد تایید نامعتبر یا منقضی شده است.')
    }

    if (otp.attempts >= 5) {
      await this.db
        .update(otpCodes)
        .set({ usedAt: new Date() })
        .where(eq(otpCodes.id, otp.id))

      throw new TooManyRequestsError('تعداد تلاش‌های ناموفق بیش از حد مجاز. لطفاً کد جدیدی درخواست کنید.')
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS)

    await this.db
      .update(otpCodes)
      .set({ usedAt: new Date() })
      .where(eq(otpCodes.id, otp.id))

    await this.db
      .update(users)
      .set({
        passwordHash,
        requiresPasswordChange: false,
        updatedAt: new Date(),
      })
      .where(eq(users.phone, dto.phone))

    return { success: true }
  }
}

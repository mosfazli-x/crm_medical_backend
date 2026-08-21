import type { FastifyRequest, FastifyReply } from 'fastify'
import { AuthService } from './auth.service'
import { LoginSchema, RegisterSchema, ForgotPasswordSchema, ResetPasswordSchema, UpdateProfileSchema, ChangePasswordSchema } from './auth.schema'
import type { JwtPayload } from '../../shared/types'
import { env } from '../../config/env'
import { getDb } from '../../db/client'
import { LoginHistoryService } from '../login-history/login-history.service'

let _loginHistoryService: LoginHistoryService | null = null
function getLoginHistoryService(): LoginHistoryService {
  if (!_loginHistoryService) {
    _loginHistoryService = new LoginHistoryService(getDb())
  }
  return _loginHistoryService
}

export class AuthController {
  constructor(private authService: AuthService) {}

  async login(request: FastifyRequest, reply: FastifyReply) {
    const dto = LoginSchema.parse(request.body)

    const user = await this.authService.login(dto)

    let session: { id: string } | null = null
    try {
      session = await getLoginHistoryService().logLogin({
        userId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      })
    } catch (err) {
      console.error('Failed to log login event:', err)
    }

    const payload: JwtPayload = {
      id: user.id,
      fullName: user.fullName,
      role: user.role,
      patientId: user.patientId,
      sessionId: session?.id,
    }

    const token = request.server.jwt.sign(payload, {
      expiresIn: env.JWT_EXPIRES_IN,
    })

    return reply.status(200).send({
      success: true,
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        role: user.role,
        patientId: user.patientId,
        requiresPasswordChange: user.requiresPasswordChange,
      },
    })
  }

  async register(request: FastifyRequest, reply: FastifyReply) {
    const dto = RegisterSchema.parse(request.body)

    const newUser = await this.authService.register(dto)

    let session: { id: string } | null = null
    try {
      session = await getLoginHistoryService().logLogin({
        userId: newUser.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      })
    } catch (err) {
      console.error('Failed to log login event:', err)
    }

    const payload: JwtPayload = {
      id: newUser.id,
      fullName: newUser.fullName,
      role: newUser.role,
      patientId: null,
      sessionId: session?.id,
    }

    const token = request.server.jwt.sign(payload, {
      expiresIn: env.JWT_EXPIRES_IN,
    })

    return reply.status(201).send({
      success: true,
      message: 'حساب شما با موفقیت ساخته شد',
      token,
      user: newUser,
    })
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    const user = await this.authService.me(request.user.id)

    return reply.send({
      success: true,
      user,
    })
  }

  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    const dto = ForgotPasswordSchema.parse(request.body)

    await this.authService.requestOtp(dto)

    return reply.send({
      success: true,
      message: 'در صورت وجود حساب، کد تایید ارسال شد.',
    })
  }

  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    const dto = ResetPasswordSchema.parse(request.body)

    await this.authService.resetPassword(dto)

    return reply.send({
      success: true,
      message: 'رمز عبور با موفقیت تغییر یافت.',
    })
  }

  async updateProfile(request: FastifyRequest, reply: FastifyReply) {
    const dto = UpdateProfileSchema.parse(request.body)

    const user = await this.authService.updateProfile(request.user.id, dto)

    return reply.send({
      success: true,
      message: 'پروفایل با موفقیت به‌روزرسانی شد.',
      user,
    })
  }

  async changePassword(request: FastifyRequest, reply: FastifyReply) {
    const dto = ChangePasswordSchema.parse(request.body)

    await this.authService.changePassword(request.user.id, dto)

    try {
      const user = request.user as any
      if (user?.sessionId) {
        await getLoginHistoryService().revokeAllUserSessionsExcept(user.id, user.sessionId)
      } else {
        await getLoginHistoryService().revokeAllUserSessionsExcept(user.id)
      }
    } catch (err) {
      console.error('Failed to revoke sessions on password change:', err)
    }

    return reply.send({
      success: true,
      message: 'رمز عبور با موفقیت تغییر یافت.',
    })
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as any
    try {
      await getLoginHistoryService().logLogout({
        userId: user.id,
        sessionId: user.sessionId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      })
    } catch (err) {
      console.error('Failed to log logout event:', err)
    }

    return reply.send({
      success: true,
      message: 'با موفقیت خارج شدید.',
    })
  }
}

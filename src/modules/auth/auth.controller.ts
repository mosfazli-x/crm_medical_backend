import type { FastifyRequest, FastifyReply } from 'fastify'
import { AuthService } from './auth.service'
import { LoginSchema, RegisterSchema, ForgotPasswordSchema, ResetPasswordSchema, UpdateProfileSchema, ChangePasswordSchema } from './auth.schema'
import type { JwtPayload } from '../../shared/types'
import { env } from '../../config/env'

export class AuthController {
  constructor(private authService: AuthService) {}

  async login(request: FastifyRequest, reply: FastifyReply) {
    const dto = LoginSchema.parse(request.body)

    const user = await this.authService.login(dto)

    const payload: JwtPayload = {
      id: user.id,
      fullName: user.fullName,
      role: user.role,
      patientId: user.patientId,
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

    const payload: JwtPayload = {
      id: newUser.id,
      fullName: newUser.fullName,
      role: newUser.role,
      patientId: null,
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

    return reply.send({
      success: true,
      message: 'رمز عبور با موفقیت تغییر یافت.',
    })
  }
}

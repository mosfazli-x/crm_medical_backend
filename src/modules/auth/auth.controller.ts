import type { FastifyRequest, FastifyReply } from 'fastify'
import { AuthService } from './auth.service'
import { LoginSchema, RegisterSchema } from './auth.schema'
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
}

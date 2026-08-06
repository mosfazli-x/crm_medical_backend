import type { FastifyRequest, FastifyReply } from 'fastify'
import { env } from '../../config/env'
import { MiniAppService } from './miniapp.service'
import {
  InitDataSchema,
  PhoneLoginSchema,
  SaveProfileSchema,
  MiniAppBookSchema,
} from './miniapp.schema'

export class MiniAppController {
  constructor(private service: MiniAppService) {}

  private signToken(
    reply: FastifyReply,
    user: { id: string; fullName: string | null; role: string; patientId: string | null }
  ) {
    return reply.server.jwt.sign(
      {
        id: user.id,
        fullName: user.fullName,
        role: user.role,
        patientId: user.patientId,
      },
      { expiresIn: env.JWT_EXPIRES_IN }
    )
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const { initData } = InitDataSchema.parse(request.body)
    const result = await this.service.loginWithInitData(initData)

    if (!result.ok || !result.user) {
      return reply.status(200).send({
        success: false,
        needsLogin: true,
        telegramUser: result.telegramUser ?? null,
      })
    }

    const token = this.signToken(reply, result.user)
    return reply.status(200).send({
      success: true,
      token,
      user: result.user,
      telegramUser: result.telegramUser ?? null,
    })
  }

  async phoneLogin(request: FastifyRequest, reply: FastifyReply) {
    const dto = PhoneLoginSchema.parse(request.body)
    const result = await this.service.loginWithPhone(dto, dto.initData)

    if (!result.user) {
      return reply.status(401).send({ success: false, error: 'Invalid phone or password' })
    }

    const token = this.signToken(reply, result.user)
    return reply.status(200).send({
      success: true,
      token,
      user: result.user,
      telegramUser: result.telegramUser ?? null,
    })
  }

  async link(request: FastifyRequest, reply: FastifyReply) {
    const { initData } = InitDataSchema.parse(request.body)
    const telegramUser = await this.service.linkTelegram(request.user.id, initData)
    return reply.status(200).send({ success: true, telegramUser })
  }

  async authStatus(request: FastifyRequest, reply: FastifyReply) {
    const status = await this.service.getAuthStatus(request.user.id)
    return reply.status(200).send({ success: true, ...status })
  }

  async profile(request: FastifyRequest, reply: FastifyReply) {
    const profile = await this.service.getProfile(request.user.id)
    return reply.status(200).send({ success: true, ...profile })
  }

  async saveProfile(request: FastifyRequest, reply: FastifyReply) {
    const dto = SaveProfileSchema.parse(request.body)
    const profile = await this.service.savePatientProfile(request.user.id, dto)

    const token = this.signToken(reply, profile.user)
    return reply.status(200).send({ success: true, token, ...profile })
  }

  async appointments(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.service.getMyAppointments(request.user.id)
    return reply.status(200).send({ success: true, ...result })
  }

  async book(request: FastifyRequest, reply: FastifyReply) {
    const dto = MiniAppBookSchema.parse(request.body)
    const result = await this.service.bookAppointment(request.user.id, dto)
    return reply.status(200).send({ success: true, appointment: result.appointment, doctorName: result.doctorName })
  }

  async services(request: FastifyRequest, reply: FastifyReply) {
    const doctorId = (request.query as { doctorId?: string })?.doctorId
    const data = await this.service.getServices(doctorId)
    return reply.status(200).send({ success: true, data })
  }

  async doctors(_request: FastifyRequest, reply: FastifyReply) {
    const data = await this.service.getDoctors()
    return reply.status(200).send({ success: true, data })
  }

  async slots(request: FastifyRequest, reply: FastifyReply) {
    const { doctorId } = request.params as { doctorId: string }
    const { date } = request.query as { date?: string }
    if (!date) {
      return reply.status(400).send({ success: false, error: 'date query param is required (YYYY-MM-DD)' })
    }
    const data = await this.service.getAvailableSlots(doctorId, date)
    return reply.status(200).send({ success: true, data })
  }
}

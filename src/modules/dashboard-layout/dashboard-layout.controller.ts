import type { FastifyReply, FastifyRequest } from 'fastify'
import { ForbiddenError } from '../../shared/errors'
import { DashboardLayoutSchema } from './dashboard-layout.schema'
import { DashboardLayoutService } from './dashboard-layout.service'

interface JwtUserPayload {
  id: string
  role: string
}

export class DashboardLayoutController {
  constructor(private dashboardLayoutService: DashboardLayoutService) {}

  private assertSelf(request: FastifyRequest, userId: string) {
    const user = request.user as JwtUserPayload | undefined
    if (!user?.id || user.id !== userId) {
      throw new ForbiddenError('You can only manage your own dashboard layout')
    }
  }

  async get(request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) {
    const { userId } = request.params
    this.assertSelf(request, userId)
    const data = await this.dashboardLayoutService.findByUserId(userId)
    return reply.status(200).send({ success: true, data })
  }

  async upsert(request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) {
    const { userId } = request.params
    this.assertSelf(request, userId)
    const dto = DashboardLayoutSchema.parse(request.body)
    const data = await this.dashboardLayoutService.upsert(userId, dto)
    return reply.status(200).send({
      success: true,
      message: 'Dashboard layout saved successfully',
      data,
    })
  }
}
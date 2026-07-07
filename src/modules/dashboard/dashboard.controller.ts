import type { FastifyRequest, FastifyReply } from 'fastify'
import { DashboardService } from './dashboard.service'

export class DashboardController {
  constructor(private service: DashboardService) {}

  async index(request: FastifyRequest, reply: FastifyReply) {
    const { role, id, patientId } = request.user

    if (role === 'patient') {
      if (!patientId) {
        return reply.status(400).send({ success: false, error: 'No patient profile linked to your account' })
      }
      const data = await this.service.getPatientDashboard(id, patientId)
      return reply.send({ success: true, data })
    }

    const data = await this.service.getDashboard()
    return reply.send({ success: true, data })
  }
}

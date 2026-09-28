import type { FastifyRequest, FastifyReply } from 'fastify'
import { VisitService } from './visits.service'
import { CreateVisitSchema, FollowUpListQuerySchema, UpdateVisitSchema } from './visits.schema'
import { AppError } from '../../shared/errors'

/** Operator-facing reasons for a failed reminder, mapped to HTTP status codes. */
const REMINDER_FAILURE_STATUS: Record<string, number> = {
  no_followup: 400,
  no_phone: 422,
  disabled: 409,
  sms_unavailable: 409,
  send_failed: 502,
}

export class VisitController {
  constructor(private visitService: VisitService) {}

  async getPatientList(_request: FastifyRequest, reply: FastifyReply) {
    const data = await this.visitService.getPatientList()
    return reply.status(200).send({ success: true, data })
  }

  async getCalendarEvents(_request: FastifyRequest, reply: FastifyReply) {
    const events = await this.visitService.getCalendarEvents()
    return reply.status(200).send(events)
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateVisitSchema.parse(request.body)
    const visit = await this.visitService.create(dto)
    return reply.status(201).send({
      success: true,
      message: 'Visit created successfully',
      visit,
    })
  }

  async update(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const dto = UpdateVisitSchema.parse(request.body)
    const visit = await this.visitService.update(id, dto)
    return reply.status(200).send({
      success: true,
      message: 'Visit updated successfully',
      visit,
    })
  }

  async getById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    const visit = await this.visitService.getById(id)
    return reply.status(200).send({ success: true, data: visit })
  }

  async delete(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params
    await this.visitService.delete(id)
    return reply.status(200).send({
      success: true,
      message: 'Visit deleted successfully',
    })
  }

  // ── Follow-up reminders ──

  async listFollowUps(request: FastifyRequest, reply: FastifyReply) {
    const query = FollowUpListQuerySchema.parse(request.query ?? {})
    const result = await this.visitService.listFollowUps(query)
    return reply.status(200).send({ success: true, ...result })
  }

  async getFollowUpSummary(_request: FastifyRequest, reply: FastifyReply) {
    const summary = await this.visitService.getFollowUpSummary()
    return reply.status(200).send({ success: true, data: summary })
  }

  /**
   * Manually (re)send a follow-up reminder. Always forced: the doctor explicitly
   * asked, so the already-sent and past-due guards are bypassed.
   */
  async sendFollowUpReminder(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const result = await this.visitService.sendFollowUpReminder(id, { force: true })

    if (!result.sent) {
      const reason = result.reason ?? 'send_failed'
      // Distinct codes so the UI can explain *why* instead of a generic failure:
      // 409 = configuration blocks sending, 422 = data is missing, 502 = provider error.
      throw new AppError(
        `Follow-up reminder not sent: ${reason}`,
        REMINDER_FAILURE_STATUS[reason] ?? 500,
        true
      )
    }

    return reply.status(200).send({
      success: true,
      message: 'Follow-up reminder sent',
      data: result,
    })
  }

  /**
   * Run the sweep on demand. Exposed so a clinic can backfill reminders after
   * downtime (e.g. a server that was off when the scheduler fired).
   */
  async runReminderSweep(_request: FastifyRequest, reply: FastifyReply) {
    const stats = await this.visitService.runFollowUpReminderSweep()
    return reply.status(200).send({ success: true, data: stats })
  }
}

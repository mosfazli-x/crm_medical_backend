import type { FastifyRequest, FastifyReply } from 'fastify'
import { LeadsService } from './leads.service'
import {
  CreateLeadSchema,
  UpdateLeadSchema,
  ListLeadsSchema,
  StatusChangeSchema,
  LostLeadSchema,
  ContactLeadSchema,
  AssignLeadSchema,
  AddLeadNoteSchema,
  ConvertLeadSchema,
  LEAD_STATUSES,
  LEAD_PRIORITIES,
  LEAD_LOST_REASONS,
  LEAD_ACTIVITY_TYPES,
} from './leads.schema'
import { auditService } from '../../shared/services'

export class LeadsController {
  constructor(private leadsService: LeadsService) {}

  private log(
    request: FastifyRequest,
    action: string,
    entityType: string,
    entityId: string | undefined,
    newValues?: Record<string, unknown>
  ) {
    return auditService.log({
      userId: (request.user as any)?.id,
      action,
      entityType,
      entityId,
      newValues,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    })
  }

  async options(_request: FastifyRequest, reply: FastifyReply) {
    return reply.status(200).send({
      success: true,
      data: {
        statuses: LEAD_STATUSES,
        priorities: LEAD_PRIORITIES,
        lostReasons: LEAD_LOST_REASONS,
        activityTypes: LEAD_ACTIVITY_TYPES,
      },
    })
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateLeadSchema.parse(request.body)
    const data = await this.leadsService.create(dto, (request.user as any)?.id)

    await this.log(request, 'create', 'lead', data.id, {
      firstName: data.firstName,
      lastName: data.lastName,
      sourceId: data.sourceId,
      status: data.status,
    })

    return reply.status(201).send({ success: true, message: 'Lead created successfully', data })
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const dto = ListLeadsSchema.parse(request.query)
    const { data, total } = await this.leadsService.list(dto)
    return reply.status(200).send({
      success: true,
      data,
      pagination: {
        page: dto.page,
        limit: dto.limit,
        total,
        totalPages: Math.ceil(total / dto.limit),
      },
    })
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const data = await this.leadsService.findById(id)
    return reply.status(200).send({ success: true, data })
  }

  async update(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const dto = UpdateLeadSchema.parse(request.body)
    const data = await this.leadsService.update(id, dto)

    await this.log(request, 'update', 'lead', id, { ...dto })

    return reply.status(200).send({ success: true, message: 'Lead updated successfully', data })
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const data = await this.leadsService.softDelete(id)

    await this.log(request, 'delete', 'lead', id, { ...data })

    return reply.status(200).send({ success: true, message: 'Lead deleted successfully (soft delete)', data })
  }

  async changeStatus(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const dto = StatusChangeSchema.parse(request.body)
    const data = await this.leadsService.changeStatus(id, (request.user as any)?.id, dto)

    await this.log(request, 'status_change', 'lead', id, { from: dto, to: { status: data.status } })

    return reply.status(200).send({ success: true, message: 'Lead status updated', data })
  }

  async markLost(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const dto = LostLeadSchema.parse(request.body)
    const data = await this.leadsService.markLost(id, (request.user as any)?.id, dto)

    await this.log(request, 'lost', 'lead', id, { reason: dto.reason })

    return reply.status(200).send({ success: true, message: 'Lead marked as lost', data })
  }

  async recordContact(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const dto = ContactLeadSchema.parse(request.body)
    const data = await this.leadsService.recordContact(id, (request.user as any)?.id, dto)

    await this.log(request, 'contact', 'lead', id, { note: dto.note ?? null })

    return reply.status(200).send({ success: true, message: 'Contact recorded', data })
  }

  async assign(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const dto = AssignLeadSchema.parse(request.body)
    const data = await this.leadsService.assign(id, (request.user as any)?.id, dto)

    await this.log(request, 'assign', 'lead', id, { ...dto })

    return reply.status(200).send({ success: true, message: 'Lead assigned successfully', data })
  }

  async addNote(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const dto = AddLeadNoteSchema.parse(request.body)
    const data = await this.leadsService.addNote(id, (request.user as any)?.id, dto)

    await this.log(request, 'note', 'lead', id, { noteId: data.id })

    return reply.status(201).send({ success: true, message: 'Note added', data })
  }

  async convert(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const dto = ConvertLeadSchema.parse(request.body)
    const data = await this.leadsService.convert(id, (request.user as any)?.id, dto)

    await this.log(request, 'convert', 'lead', id, {
      patientId: data.patientId,
      patientCreated: data.patientCreated,
    })
    await this.log(request, 'create', 'patient', data.patientId, {
      fromLead: id,
      patientCreated: data.patientCreated,
    })

    return reply.status(200).send({
      success: true,
      message: data.patientCreated
        ? 'Lead converted to patient successfully'
        : 'Lead linked to existing patient',
      data,
    })
  }

  async summary(_request: FastifyRequest, reply: FastifyReply) {
    const data = await this.leadsService.summary()
    return reply.status(200).send({ success: true, data })
  }
}

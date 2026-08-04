import type { FastifyRequest, FastifyReply } from 'fastify'
import { ScheduleService } from './schedule.service'
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  ListTasksSchema,
  StatusChangeSchema,
} from './schedule.schema'
import { auditService } from '../../shared/services'

export class ScheduleController {
  constructor(private scheduleService: ScheduleService) {}

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

  async listAssignees(_request: FastifyRequest, reply: FastifyReply) {
    const data = await this.scheduleService.listAssignees()
    return reply.status(200).send({ success: true, data })
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const dto = CreateTaskSchema.parse(request.body)
    const data = await this.scheduleService.create(dto, (request.user as any)?.id)

    await this.log(request, 'create', 'task', data.id, {
      title: data.title,
      assigneeId: data.assigneeId,
      priority: data.priority,
      status: data.status,
    })

    return reply.status(201).send({ success: true, message: 'Task created successfully', data })
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const dto = ListTasksSchema.parse(request.query)
    const user = request.user as any
    const { data, total } = await this.scheduleService.list(dto, user?.id, user?.role)

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
    const data = await this.scheduleService.findById(id)
    return reply.status(200).send({ success: true, data })
  }

  async update(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const dto = UpdateTaskSchema.parse(request.body)
    const data = await this.scheduleService.update(id, dto)

    await this.log(request, 'update', 'task', id, { ...dto })

    return reply.status(200).send({ success: true, message: 'Task updated successfully', data })
  }

  async changeStatus(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const user = request.user as any
    const dto = StatusChangeSchema.parse(request.body)
    const data = await this.scheduleService.changeStatus(id, user?.id, user?.role, dto)

    await this.log(request, 'status_change', 'task', id, { status: dto.status })

    return reply.status(200).send({ success: true, message: 'Task status updated', data })
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params
    const data = await this.scheduleService.delete(id)

    await this.log(request, 'delete', 'task', id, { ...data })

    return reply.status(200).send({ success: true, message: 'Task deleted successfully', data })
  }
}

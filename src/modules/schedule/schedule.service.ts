import type { DB } from '../../db/client'
import { clinicTasks, users, staffProfiles } from '../../db/schema'
import { alias } from 'drizzle-orm/pg-core'
import { and, or, eq, ilike, asc, desc, gt, lt, notInArray, sql } from 'drizzle-orm'
import { NotFoundError, ForbiddenError, ValidationError } from '../../shared/errors'
import { getTodayJalali } from '../../shared/utils/date'
import type {
  CreateTaskDto,
  UpdateTaskDto,
  ListTasksDto,
  StatusChangeDto,
} from './schedule.schema'

const ASSIGNABLE_ROLES = ['admin_doctor', 'doctor', 'lab', 'pharmacy', 'clinic_staff']

const assigneeUser = alias(users, 'assignee_user')
const creatorUser = alias(users, 'creator_user')

const TASK_SELECT = {
  id: clinicTasks.id,
  title: clinicTasks.title,
  description: clinicTasks.description,
  assigneeId: clinicTasks.assigneeId,
  assigneeName: assigneeUser.fullName,
  assigneePhone: assigneeUser.phone,
  assigneeRole: assigneeUser.role,
  assigneePosition: staffProfiles.position,
  createdById: clinicTasks.createdById,
  createdByName: creatorUser.fullName,
  status: clinicTasks.status,
  priority: clinicTasks.priority,
  dueDate: clinicTasks.dueDate,
  notes: clinicTasks.notes,
  completedAt: clinicTasks.completedAt,
  cancelledAt: clinicTasks.cancelledAt,
  createdAt: clinicTasks.createdAt,
  updatedAt: clinicTasks.updatedAt,
}

const ORDER_MAP: Record<string, ReturnType<typeof desc>[]> = {
  created_at_desc: [desc(clinicTasks.createdAt)],
  created_at_asc: [asc(clinicTasks.createdAt)],
  due_date_asc: [asc(clinicTasks.dueDate), desc(clinicTasks.createdAt)],
  due_date_desc: [desc(clinicTasks.dueDate), desc(clinicTasks.createdAt)],
}

export class ScheduleService {
  constructor(private db: DB) {}

  private async validateAssignee(assigneeId: string) {
    const [assignee] = await this.db
      .select({ id: users.id, role: users.role, patientId: users.patientId, status: users.status })
      .from(users)
      .where(eq(users.id, assigneeId))
      .limit(1)

    if (!assignee) throw new NotFoundError('Assignee user')
    if (!ASSIGNABLE_ROLES.includes(assignee.role) || assignee.patientId) {
      throw new ValidationError('Assignee must be a clinic member (patients cannot be assigned tasks)')
    }
    return assignee
  }

  private async getTaskRow(id: string) {
    const [task] = await this.db
      .select()
      .from(clinicTasks)
      .where(eq(clinicTasks.id, id))
      .limit(1)

    if (!task) throw new NotFoundError('Task')
    return task
  }

  async create(dto: CreateTaskDto, createdById: string) {
    await this.validateAssignee(dto.assigneeId)

    const [task] = await this.db
      .insert(clinicTasks)
      .values({
        title: dto.title,
        description: dto.description ?? null,
        assigneeId: dto.assigneeId,
        createdById,
        priority: dto.priority ?? 'medium',
        dueDate: dto.dueDate ?? null,
        notes: dto.notes ?? null,
      })
      .returning({ id: clinicTasks.id })

    return this.findById(task.id)
  }

  async list(dto: ListTasksDto, userId: string, role: string) {
    const conditions: any[] = []
    const isAdmin = role === 'admin_doctor'

    if (!isAdmin) {
      conditions.push(eq(clinicTasks.assigneeId, userId))
    } else {
      if (dto.assignedToMe === 'true') conditions.push(eq(clinicTasks.assigneeId, userId))
      if (dto.assigneeId) conditions.push(eq(clinicTasks.assigneeId, dto.assigneeId))
    }

    if (dto.status) conditions.push(eq(clinicTasks.status, dto.status))
    if (dto.priority) conditions.push(eq(clinicTasks.priority, dto.priority))

    if (dto.due) {
      const today = getTodayJalali()
      const open = notInArray(clinicTasks.status, ['done', 'cancelled'])
      if (dto.due === 'overdue') {
        conditions.push(lt(clinicTasks.dueDate, today), open)
      } else if (dto.due === 'today') {
        conditions.push(eq(clinicTasks.dueDate, today), open)
      } else if (dto.due === 'upcoming') {
        conditions.push(gt(clinicTasks.dueDate, today), open)
      }
    }

    if (dto.q) {
      const pattern = `%${dto.q}%`
      conditions.push(or(ilike(clinicTasks.title, pattern), ilike(clinicTasks.description, pattern)))
    }

    const where = conditions.length ? and(...conditions) : undefined
    const offset = (dto.page - 1) * dto.limit

    const [rows, countResult] = await Promise.all([
      this.db
        .select(TASK_SELECT)
        .from(clinicTasks)
        .leftJoin(assigneeUser, eq(clinicTasks.assigneeId, assigneeUser.id))
        .leftJoin(creatorUser, eq(clinicTasks.createdById, creatorUser.id))
        .leftJoin(staffProfiles, eq(clinicTasks.assigneeId, staffProfiles.userId))
        .where(where)
        .orderBy(...ORDER_MAP[dto.sort])
        .limit(dto.limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(clinicTasks)
        .where(where),
    ])

    return { data: rows, total: countResult[0]?.count ?? 0 }
  }

  async findById(id: string) {
    const [task] = await this.db
      .select(TASK_SELECT)
      .from(clinicTasks)
      .leftJoin(assigneeUser, eq(clinicTasks.assigneeId, assigneeUser.id))
      .leftJoin(creatorUser, eq(clinicTasks.createdById, creatorUser.id))
      .leftJoin(staffProfiles, eq(clinicTasks.assigneeId, staffProfiles.userId))
      .where(eq(clinicTasks.id, id))
      .limit(1)

    if (!task) throw new NotFoundError('Task')
    return task
  }

  async update(id: string, dto: UpdateTaskDto) {
    await this.getTaskRow(id)
    if (dto.assigneeId) await this.validateAssignee(dto.assigneeId)

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (dto.title !== undefined) updates.title = dto.title
    if (dto.description !== undefined) updates.description = dto.description
    if (dto.assigneeId !== undefined) updates.assigneeId = dto.assigneeId
    if (dto.priority !== undefined) updates.priority = dto.priority
    if (dto.dueDate !== undefined) updates.dueDate = dto.dueDate
    if (dto.notes !== undefined) updates.notes = dto.notes

    await this.db
      .update(clinicTasks)
      .set(updates)
      .where(eq(clinicTasks.id, id))

    return this.findById(id)
  }

  async changeStatus(id: string, userId: string, role: string, dto: StatusChangeDto) {
    const task = await this.getTaskRow(id)

    if (role !== 'admin_doctor' && task.assigneeId !== userId) {
      throw new ForbiddenError('Only the assignee or a manager can update this task')
    }

    const updates: Record<string, unknown> = { status: dto.status, updatedAt: new Date() }
    if (dto.status === 'done') {
      updates.completedAt = task.completedAt ?? new Date()
      updates.cancelledAt = null
    } else if (dto.status === 'cancelled') {
      updates.cancelledAt = task.cancelledAt ?? new Date()
      updates.completedAt = null
    } else {
      updates.completedAt = null
      updates.cancelledAt = null
    }

    await this.db
      .update(clinicTasks)
      .set(updates)
      .where(eq(clinicTasks.id, id))

    return this.findById(id)
  }

  async delete(id: string) {
    await this.getTaskRow(id)
    await this.db.delete(clinicTasks).where(eq(clinicTasks.id, id))
    return { id }
  }

  async listAssignees() {
    return this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
        role: users.role,
        position: staffProfiles.position,
        isActive: staffProfiles.isActive,
      })
      .from(users)
      .leftJoin(staffProfiles, eq(users.id, staffProfiles.userId))
      .where(and(
        notInArray(users.role, ['patient']),
        sql`${users.patientId} IS NULL`,
        eq(users.status, 'approved'),
      ))
      .orderBy(asc(sql`COALESCE(${users.fullName}, ${users.phone})`))
  }
}

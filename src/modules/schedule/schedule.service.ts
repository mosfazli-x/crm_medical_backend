import type { DB } from '../../db/client'
import { clinicTasks, taskAssignees, users, staffProfiles } from '../../db/schema'
import { alias } from 'drizzle-orm/pg-core'
import { and, or, eq, ilike, asc, desc, gt, lt, notInArray, inArray, sql } from 'drizzle-orm'
import { NotFoundError, ForbiddenError, ValidationError } from '../../shared/errors'
import { getTodayJalali } from '../../shared/utils/date'
import type {
  CreateTaskDto,
  UpdateTaskDto,
  ListTasksDto,
  StatusChangeDto,
} from './schedule.schema'

const ASSIGNABLE_ROLES = ['admin_doctor', 'doctor', 'lab', 'pharmacy', 'clinic_staff']

const creatorUser = alias(users, 'creator_user')

const TASK_SELECT = {
  id: clinicTasks.id,
  title: clinicTasks.title,
  description: clinicTasks.description,
  createdById: clinicTasks.createdById,
  createdByName: creatorUser.fullName,
  status: clinicTasks.status,
  priority: clinicTasks.priority,
  dueDate: clinicTasks.dueDate,
  estimatedMinutes: clinicTasks.estimatedMinutes,
  spentMinutes: clinicTasks.spentMinutes,
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

type TaskRow = typeof TASK_SELECT
type AssigneeRow = {
  taskId: string
  id: string
  fullName: string | null
  phone: string
  role: string
  position: string | null
  isActive: boolean | null
}

export class ScheduleService {
  constructor(private db: DB) {}

  private async validateAssignees(assigneeIds: string[]) {
    if (!assigneeIds.length) {
      throw new ValidationError('At least one assignee is required')
    }
    const unique = [...new Set(assigneeIds)]
    const rows = await this.db
      .select({ id: users.id, role: users.role, patientId: users.patientId, status: users.status })
      .from(users)
      .where(inArray(users.id, unique))

    const found = new Set(rows.map((r) => r.id))
    for (const id of unique) {
      if (!found.has(id)) throw new NotFoundError('Assignee user')
    }
    for (const row of rows) {
      if (!ASSIGNABLE_ROLES.includes(row.role) || row.patientId) {
        throw new ValidationError('Assignee must be a clinic member (patients cannot be assigned tasks)')
      }
    }
    return unique
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

  private async buildAssignees(taskIds: string[]): Promise<Map<string, AssigneeRow[]>> {
    if (!taskIds.length) return new Map()
    const rows = await this.db
      .select({
        taskId: taskAssignees.taskId,
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
        role: users.role,
        position: staffProfiles.position,
        isActive: staffProfiles.isActive,
      })
      .from(taskAssignees)
      .innerJoin(users, eq(taskAssignees.userId, users.id))
      .leftJoin(staffProfiles, eq(taskAssignees.userId, staffProfiles.userId))
      .where(inArray(taskAssignees.taskId, taskIds))
      .orderBy(asc(users.fullName), asc(users.phone))

    const map = new Map<string, AssigneeRow[]>()
    for (const row of rows) {
      const list = map.get(row.taskId) || []
      list.push(row)
      map.set(row.taskId, list)
    }
    return map
  }

  private async attachAssignees<T extends { id: string }>(rows: T[]): Promise<(T & { assignees: AssigneeRow[] })[]> {
    const map = await this.buildAssignees(rows.map((r) => r.id))
    return rows.map((row) => ({ ...row, assignees: map.get(row.id) || [] }))
  }

  async create(dto: CreateTaskDto, createdById: string) {
    const assigneeIds = await this.validateAssignees(dto.assignees)

    const [task] = await this.db
      .insert(clinicTasks)
      .values({
        title: dto.title,
        description: dto.description ?? null,
        createdById,
        status: dto.status ?? 'pending',
        priority: dto.priority ?? 'medium',
        dueDate: dto.dueDate ?? null,
        estimatedMinutes: dto.estimatedMinutes ?? null,
        spentMinutes: dto.spentMinutes ?? 0,
        notes: dto.notes ?? null,
      })
      .returning({ id: clinicTasks.id })

    if (assigneeIds.length) {
      await this.db
        .insert(taskAssignees)
        .values(assigneeIds.map((userId) => ({ taskId: task.id, userId })))
    }

    return this.findById(task.id)
  }

  async list(dto: ListTasksDto, userId: string, role: string) {
    const conditions: any[] = []
    const isAdmin = role === 'admin_doctor'

    const assignedTo = (uid: string) =>
      this.db.select({ taskId: taskAssignees.taskId }).from(taskAssignees).where(eq(taskAssignees.userId, uid))

    if (!isAdmin) {
      conditions.push(inArray(clinicTasks.id, assignedTo(userId)))
    } else {
      if (dto.assignedToMe === 'true') conditions.push(inArray(clinicTasks.id, assignedTo(userId)))
      if (dto.assigneeId) conditions.push(inArray(clinicTasks.id, assignedTo(dto.assigneeId)))
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
        .leftJoin(creatorUser, eq(clinicTasks.createdById, creatorUser.id))
        .where(where)
        .orderBy(...ORDER_MAP[dto.sort])
        .limit(dto.limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(clinicTasks)
        .where(where),
    ])

    const withAssignees = await this.attachAssignees(rows)
    return { data: withAssignees, total: countResult[0]?.count ?? 0 }
  }

  async findById(id: string) {
    const [task] = await this.db
      .select(TASK_SELECT)
      .from(clinicTasks)
      .leftJoin(creatorUser, eq(clinicTasks.createdById, creatorUser.id))
      .where(eq(clinicTasks.id, id))
      .limit(1)

    if (!task) throw new NotFoundError('Task')
    const [withAssignees] = await this.attachAssignees([task])
    return withAssignees
  }

  async update(id: string, dto: UpdateTaskDto) {
    await this.getTaskRow(id)
    let assigneeIds: string[] | undefined
    if (dto.assignees) assigneeIds = await this.validateAssignees(dto.assignees)

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (dto.title !== undefined) updates.title = dto.title
    if (dto.description !== undefined) updates.description = dto.description
    if (dto.priority !== undefined) updates.priority = dto.priority
    if (dto.dueDate !== undefined) updates.dueDate = dto.dueDate
    if (dto.estimatedMinutes !== undefined) updates.estimatedMinutes = dto.estimatedMinutes
    if (dto.spentMinutes !== undefined) updates.spentMinutes = dto.spentMinutes
    if (dto.notes !== undefined) updates.notes = dto.notes

    await this.db
      .update(clinicTasks)
      .set(updates)
      .where(eq(clinicTasks.id, id))

    if (assigneeIds) {
      await this.db.delete(taskAssignees).where(eq(taskAssignees.taskId, id))
      await this.db
        .insert(taskAssignees)
        .values(assigneeIds.map((userId) => ({ taskId: id, userId })))
    }

    return this.findById(id)
  }

  async changeStatus(id: string, userId: string, role: string, dto: StatusChangeDto) {
    const task = await this.getTaskRow(id)

    if (role !== 'admin_doctor') {
      const [assignment] = await this.db
        .select({ taskId: taskAssignees.taskId })
        .from(taskAssignees)
        .where(and(eq(taskAssignees.taskId, id), eq(taskAssignees.userId, userId)))
        .limit(1)
      if (!assignment) {
        throw new ForbiddenError('Only an assignee or a manager can update this task')
      }
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

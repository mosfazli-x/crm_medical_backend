import { z } from 'zod'

export const TASK_STATUSES = ['pending', 'in_progress', 'done', 'cancelled'] as const
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const

const jalaliDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format')
  .optional()
  .nullable()

export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  description: z.string().max(2000).optional().nullable(),
  assignees: z.array(z.string().uuid('Invalid assignee')).min(1, 'At least one assignee is required'),
  status: z.enum(TASK_STATUSES).default('pending'),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  dueDate: jalaliDateField,
  estimatedMinutes: z.coerce.number().int().min(0).nullable().optional(),
  spentMinutes: z.coerce.number().int().min(0).optional(),
  notes: z.string().max(2000).optional().nullable(),
})

export const UpdateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300).optional(),
  description: z.string().max(2000).nullable().optional(),
  assignees: z.array(z.string().uuid('Invalid assignee')).min(1, 'At least one assignee is required').optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate: jalaliDateField,
  estimatedMinutes: z.coerce.number().int().min(0).nullable().optional(),
  spentMinutes: z.coerce.number().int().min(0).optional(),
  notes: z.string().max(2000).nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
})

export const StatusChangeSchema = z.object({
  status: z.enum(TASK_STATUSES),
})

export const ListTasksSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeId: z.string().uuid('Invalid assignee').optional(),
  assignedToMe: z.enum(['true', 'false']).optional(),
  due: z.enum(['overdue', 'today', 'upcoming']).optional(),
  q: z.string().max(100).optional(),
  sort: z.enum(['created_at_desc', 'created_at_asc', 'due_date_asc', 'due_date_desc']).default('created_at_desc'),
})

export type CreateTaskDto = z.infer<typeof CreateTaskSchema>
export type UpdateTaskDto = z.infer<typeof UpdateTaskSchema>
export type StatusChangeDto = z.infer<typeof StatusChangeSchema>
export type ListTasksDto = z.infer<typeof ListTasksSchema>

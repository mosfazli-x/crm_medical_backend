import { z } from 'zod'

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'appointment_booked',
  'visited',
  'converted',
  'lost',
] as const

export const LEAD_PRIORITIES = ['low', 'medium', 'high'] as const

export const LEAD_LOST_REASONS = [
  'not_interested',
  'budget',
  'competitor',
  'unreachable',
  'wrong_number',
  'duplicate',
  'other',
] as const

export const LEAD_ACTIVITY_TYPES = [
  'created',
  'contacted',
  'note_added',
  'status_changed',
  'assigned',
  'qualified',
  'appointment_booked',
  'visit_completed',
  'converted',
  'lost',
] as const

const dateField = (message: string) =>
  z.string().refine((value) => !Number.isNaN(Date.parse(value)), { message })

export const CreateLeadSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().max(20).optional(),
  nationalId: z.string().max(10).optional(),

  sourceId: z.string().uuid('Invalid source').optional(),
  campaignName: z.string().max(150).optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
  referrerUrl: z.string().max(2000).optional(),
  landingUrl: z.string().max(2000).optional(),

  priority: z.enum(LEAD_PRIORITIES).default('medium'),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),

  expectedServiceId: z.string().uuid('Invalid service').optional(),
  expectedVisitTypeId: z.string().uuid('Invalid visit type').optional(),
  expectedValue: z.number().nonnegative().max(999999999).optional(),

  assignedStaffId: z.string().uuid('Invalid staff').optional(),
  assignedDoctorId: z.string().uuid('Invalid doctor').optional(),

  nextFollowUpAt: dateField('Invalid follow-up date').optional(),
  note: z.string().max(5000).optional(),
  marketingConsent: z.boolean().default(false),
})

export const UpdateLeadSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).nullable().optional(),
  nationalId: z.string().max(10).nullable().optional(),

  sourceId: z.string().uuid('Invalid source').nullable().optional(),
  campaignName: z.string().max(150).nullable().optional(),
  utmSource: z.string().max(100).nullable().optional(),
  utmMedium: z.string().max(100).nullable().optional(),
  utmCampaign: z.string().max(100).nullable().optional(),
  referrerUrl: z.string().max(2000).nullable().optional(),
  landingUrl: z.string().max(2000).nullable().optional(),

  priority: z.enum(LEAD_PRIORITIES).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).nullable().optional(),

  expectedServiceId: z.string().uuid('Invalid service').nullable().optional(),
  expectedVisitTypeId: z.string().uuid('Invalid visit type').nullable().optional(),
  expectedValue: z.number().nonnegative().max(999999999).nullable().optional(),

  assignedStaffId: z.string().uuid('Invalid staff').nullable().optional(),
  assignedDoctorId: z.string().uuid('Invalid doctor').nullable().optional(),

  nextFollowUpAt: dateField('Invalid follow-up date').nullable().optional(),
  note: z.string().max(5000).nullable().optional(),
  marketingConsent: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
})

export const ListLeadsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(LEAD_STATUSES).optional(),
  priority: z.enum(LEAD_PRIORITIES).optional(),
  sourceId: z.string().uuid('Invalid source').optional(),
  assignedStaffId: z.string().uuid('Invalid staff').optional(),
  assignedDoctorId: z.string().uuid('Invalid doctor').optional(),
  tag: z.string().max(50).optional(),
  q: z.string().max(100).optional(),
  dueFollowUp: z.enum(['overdue', 'today', 'upcoming']).optional(),
  sort: z.enum([
    'created_at_desc',
    'created_at_asc',
    'last_activity_at_desc',
    'next_follow_up_at_asc',
    'expected_value_desc',
  ]).default('created_at_desc'),
})

export const StatusChangeSchema = z.object({
  status: z.enum(LEAD_STATUSES),
  note: z.string().max(5000).optional(),
  lostReason: z.enum(LEAD_LOST_REASONS).optional(),
})

export const LostLeadSchema = z.object({
  reason: z.enum(LEAD_LOST_REASONS),
  note: z.string().max(5000).optional(),
})

export const ContactLeadSchema = z.object({
  note: z.string().max(5000).optional(),
})

export const AssignLeadSchema = z.object({
  assignedStaffId: z.string().uuid('Invalid staff').nullable().optional(),
  assignedDoctorId: z.string().uuid('Invalid doctor').nullable().optional(),
}).refine((data) => data.assignedStaffId !== undefined || data.assignedDoctorId !== undefined, {
  message: 'Provide at least one assignment',
})

export const AddLeadNoteSchema = z.object({
  body: z.string().min(1, 'Note is required').max(5000),
})

export const ConvertLeadSchema = z.object({
  nationalId: z.string().regex(/^\d{10}$/, 'National ID must be exactly 10 digits').optional(),
  insuranceCode: z.string().max(50).nullable().optional(),
  insuranceType: z.string().max(50).nullable().optional(),
  birthDate: dateField('Invalid birth date').nullable().optional(),
  address: z.string().max(1000).nullable().optional(),
  maritalStatus: z.string().max(20).nullable().optional(),
  note: z.string().max(5000).optional(),
})

export type CreateLeadDto = z.infer<typeof CreateLeadSchema>
export type UpdateLeadDto = z.infer<typeof UpdateLeadSchema>
export type ListLeadsDto = z.infer<typeof ListLeadsSchema>
export type StatusChangeDto = z.infer<typeof StatusChangeSchema>
export type LostLeadDto = z.infer<typeof LostLeadSchema>
export type ContactLeadDto = z.infer<typeof ContactLeadSchema>
export type AssignLeadDto = z.infer<typeof AssignLeadSchema>
export type AddLeadNoteDto = z.infer<typeof AddLeadNoteSchema>
export type ConvertLeadDto = z.infer<typeof ConvertLeadSchema>

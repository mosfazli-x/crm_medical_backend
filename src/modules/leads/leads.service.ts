import type { DB } from '../../db/client'
import {
  leads,
  leadSources,
  leadActivities,
  leadNotes,
  users,
  patients,
  procedureCodes,
  doctorVisitTypes,
} from '../../db/schema'
import { alias } from 'drizzle-orm/pg-core'
import {
  and,
  or,
  eq,
  ilike,
  asc,
  desc,
  gt,
  gte,
  lt,
  notInArray,
  sql,
} from 'drizzle-orm'
import bcrypt from 'bcrypt'
import { NotFoundError, ConflictError, ValidationError } from '../../shared/errors'
import type {
  CreateLeadDto,
  UpdateLeadDto,
  ListLeadsDto,
  StatusChangeDto,
  LostLeadDto,
  ContactLeadDto,
  AssignLeadDto,
  AddLeadNoteDto,
  ConvertLeadDto,
} from './leads.schema'

const staffUser = alias(users, 'staff_user')
const doctorUser = alias(users, 'doctor_user')
const converterUser = alias(users, 'converter_user')
const activityUser = alias(users, 'activity_user')
const noteUser = alias(users, 'note_user')

export const TRANSITIONS: Record<string, string[]> = {
  new: ['contacted', 'lost'],
  contacted: ['qualified', 'lost'],
  qualified: ['appointment_booked', 'lost'],
  appointment_booked: ['visited', 'lost'],
  visited: ['lost'],
  lost: ['new', 'contacted', 'qualified', 'appointment_booked', 'visited'],
  converted: [],
}

const STATUS_ACTIVITY: Record<string, string> = {
  contacted: 'contacted',
  qualified: 'qualified',
  appointment_booked: 'appointment_booked',
  visited: 'visit_completed',
  lost: 'lost',
}

const LEAD_SELECT = {
  id: leads.id,
  firstName: leads.firstName,
  lastName: leads.lastName,
  phone: leads.phone,
  nationalId: leads.nationalId,
  sourceId: leads.sourceId,
  sourceName: leadSources.name,
  sourceType: leadSources.type,
  sourceCategory: leadSources.category,
  campaignName: leads.campaignName,
  status: leads.status,
  priority: leads.priority,
  tags: leads.tags,
  expectedServiceId: leads.expectedServiceId,
  expectedServiceCode: procedureCodes.code,
  expectedServiceName: procedureCodes.description,
  expectedVisitTypeId: leads.expectedVisitTypeId,
  expectedVisitTypeName: doctorVisitTypes.name,
  expectedValue: leads.expectedValue,
  assignedStaffId: leads.assignedStaffId,
  assignedStaffName: staffUser.fullName,
  assignedDoctorId: leads.assignedDoctorId,
  assignedDoctorName: doctorUser.fullName,
  firstContactAt: leads.firstContactAt,
  lastContactAt: leads.lastContactAt,
  nextFollowUpAt: leads.nextFollowUpAt,
  lastActivityAt: leads.lastActivityAt,
  convertedPatientId: leads.convertedPatientId,
  conversionDate: leads.conversionDate,
  convertedById: leads.convertedById,
  convertedByName: converterUser.fullName,
  lostReason: leads.lostReason,
  lostAt: leads.lostAt,
  note: leads.note,
  marketingConsent: leads.marketingConsent,
  createdAt: leads.createdAt,
  updatedAt: leads.updatedAt,
}

const ORDER_MAP: Record<string, ReturnType<typeof desc>[]> = {
  created_at_desc: [desc(leads.createdAt)],
  created_at_asc: [asc(leads.createdAt)],
  last_activity_at_desc: [desc(leads.lastActivityAt)],
  next_follow_up_at_asc: [asc(leads.nextFollowUpAt)],
  expected_value_desc: [desc(leads.expectedValue)],
}

export class LeadsService {
  constructor(private db: DB) {}

  private async getLeadRow(id: string) {
    const [lead] = await this.db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.isDeleted, false)))
      .limit(1)

    if (!lead) throw new NotFoundError('Lead')
    return lead
  }

  async create(dto: CreateLeadDto, createdById: string) {
    return this.db.transaction(async (tx) => {
      const [lead] = await tx
        .insert(leads)
        .values({
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone ?? null,
          nationalId: dto.nationalId ?? null,
          sourceId: dto.sourceId ?? null,
          campaignName: dto.campaignName ?? null,
          utmSource: dto.utmSource ?? null,
          utmMedium: dto.utmMedium ?? null,
          utmCampaign: dto.utmCampaign ?? null,
          referrerUrl: dto.referrerUrl ?? null,
          landingUrl: dto.landingUrl ?? null,
          priority: dto.priority ?? 'medium',
          tags: dto.tags ?? [],
          expectedServiceId: dto.expectedServiceId ?? null,
          expectedVisitTypeId: dto.expectedVisitTypeId ?? null,
          expectedValue: dto.expectedValue !== undefined ? String(dto.expectedValue) : null,
          assignedStaffId: dto.assignedStaffId ?? null,
          assignedDoctorId: dto.assignedDoctorId ?? null,
          nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : null,
          note: dto.note ?? null,
          marketingConsent: dto.marketingConsent ?? false,
          marketingConsentAt: dto.marketingConsent ? new Date() : null,
          lastActivityAt: new Date(),
        })
        .returning()

      await tx.insert(leadActivities).values({
        leadId: lead.id,
        type: 'created',
        performedBy: createdById,
        metadata: { sourceId: lead.sourceId },
      })

      return lead
    })
  }

  async list(dto: ListLeadsDto) {
    const conditions: any[] = [eq(leads.isDeleted, false)]

    if (dto.status) conditions.push(eq(leads.status, dto.status))
    if (dto.priority) conditions.push(eq(leads.priority, dto.priority))
    if (dto.sourceId) conditions.push(eq(leads.sourceId, dto.sourceId))
    if (dto.assignedStaffId) conditions.push(eq(leads.assignedStaffId, dto.assignedStaffId))
    if (dto.assignedDoctorId) conditions.push(eq(leads.assignedDoctorId, dto.assignedDoctorId))

    if (dto.q) {
      const pattern = `%${dto.q}%`
      conditions.push(
        or(
          ilike(leads.firstName, pattern),
          ilike(leads.lastName, pattern),
          ilike(leads.phone, pattern),
          ilike(leads.nationalId, pattern),
        )
      )
    }

    if (dto.tag) conditions.push(sql`${leads.tags} ? ${dto.tag}`)

    const now = new Date()
    if (dto.dueFollowUp === 'overdue') {
      conditions.push(lt(leads.nextFollowUpAt, now))
      conditions.push(notInArray(leads.status, ['converted', 'lost']))
    } else if (dto.dueFollowUp === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      conditions.push(gte(leads.nextFollowUpAt, start))
      conditions.push(lt(leads.nextFollowUpAt, end))
    } else if (dto.dueFollowUp === 'upcoming') {
      conditions.push(gt(leads.nextFollowUpAt, now))
    }

    const where = and(...conditions)
    const offset = (dto.page - 1) * dto.limit

    const [rows, countResult] = await Promise.all([
      this.db
        .select(LEAD_SELECT)
        .from(leads)
        .leftJoin(leadSources, eq(leads.sourceId, leadSources.id))
        .leftJoin(procedureCodes, eq(leads.expectedServiceId, procedureCodes.id))
        .leftJoin(doctorVisitTypes, eq(leads.expectedVisitTypeId, doctorVisitTypes.id))
        .leftJoin(staffUser, eq(leads.assignedStaffId, staffUser.id))
        .leftJoin(doctorUser, eq(leads.assignedDoctorId, doctorUser.id))
        .leftJoin(converterUser, eq(leads.convertedById, converterUser.id))
        .where(where)
        .orderBy(...ORDER_MAP[dto.sort])
        .limit(dto.limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(where),
    ])

    return { data: rows, total: countResult[0]?.count ?? 0 }
  }

  async findById(id: string) {
    const [lead] = await this.db
      .select({
        ...LEAD_SELECT,
        utmSource: leads.utmSource,
        utmMedium: leads.utmMedium,
        utmCampaign: leads.utmCampaign,
        referrerUrl: leads.referrerUrl,
        landingUrl: leads.landingUrl,
        marketingConsent: leads.marketingConsent,
        marketingConsentAt: leads.marketingConsentAt,
        conversionNote: leads.conversionNote,
        convertedById: leads.convertedById,
        convertedByName: converterUser.fullName,
      })
      .from(leads)
      .leftJoin(leadSources, eq(leads.sourceId, leadSources.id))
      .leftJoin(procedureCodes, eq(leads.expectedServiceId, procedureCodes.id))
      .leftJoin(doctorVisitTypes, eq(leads.expectedVisitTypeId, doctorVisitTypes.id))
      .leftJoin(staffUser, eq(leads.assignedStaffId, staffUser.id))
      .leftJoin(doctorUser, eq(leads.assignedDoctorId, doctorUser.id))
      .leftJoin(converterUser, eq(leads.convertedById, converterUser.id))
      .where(and(eq(leads.id, id), eq(leads.isDeleted, false)))
      .limit(1)

    if (!lead) throw new NotFoundError('Lead')

    const [activities, notes] = await Promise.all([
      this.db
        .select({
          id: leadActivities.id,
          type: leadActivities.type,
          note: leadActivities.note,
          oldStatus: leadActivities.oldStatus,
          newStatus: leadActivities.newStatus,
          metadata: leadActivities.metadata,
          createdAt: leadActivities.createdAt,
          performedBy: leadActivities.performedBy,
          performedByName: activityUser.fullName,
        })
        .from(leadActivities)
        .leftJoin(activityUser, eq(leadActivities.performedBy, activityUser.id))
        .where(eq(leadActivities.leadId, id))
        .orderBy(asc(leadActivities.createdAt)),
      this.db
        .select({
          id: leadNotes.id,
          body: leadNotes.body,
          createdAt: leadNotes.createdAt,
          authorId: leadNotes.authorId,
          authorName: noteUser.fullName,
        })
        .from(leadNotes)
        .leftJoin(noteUser, eq(leadNotes.authorId, noteUser.id))
        .where(eq(leadNotes.leadId, id))
        .orderBy(desc(leadNotes.createdAt)),
    ])

    return { ...lead, activities, notes }
  }

  async update(id: string, dto: UpdateLeadDto) {
    const existing = await this.getLeadRow(id)

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (dto.firstName !== undefined) updates.firstName = dto.firstName
    if (dto.lastName !== undefined) updates.lastName = dto.lastName
    if (dto.phone !== undefined) updates.phone = dto.phone
    if (dto.nationalId !== undefined) updates.nationalId = dto.nationalId
    if (dto.sourceId !== undefined) updates.sourceId = dto.sourceId
    if (dto.campaignName !== undefined) updates.campaignName = dto.campaignName
    if (dto.utmSource !== undefined) updates.utmSource = dto.utmSource
    if (dto.utmMedium !== undefined) updates.utmMedium = dto.utmMedium
    if (dto.utmCampaign !== undefined) updates.utmCampaign = dto.utmCampaign
    if (dto.referrerUrl !== undefined) updates.referrerUrl = dto.referrerUrl
    if (dto.landingUrl !== undefined) updates.landingUrl = dto.landingUrl
    if (dto.priority !== undefined) updates.priority = dto.priority
    if (dto.tags !== undefined) updates.tags = dto.tags ?? []
    if (dto.expectedServiceId !== undefined) updates.expectedServiceId = dto.expectedServiceId
    if (dto.expectedVisitTypeId !== undefined) updates.expectedVisitTypeId = dto.expectedVisitTypeId
    if (dto.expectedValue !== undefined) {
      updates.expectedValue = dto.expectedValue === null ? null : String(dto.expectedValue)
    }
    if (dto.assignedStaffId !== undefined) updates.assignedStaffId = dto.assignedStaffId
    if (dto.assignedDoctorId !== undefined) updates.assignedDoctorId = dto.assignedDoctorId
    if (dto.nextFollowUpAt !== undefined) {
      updates.nextFollowUpAt = dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : null
    }
    if (dto.note !== undefined) updates.note = dto.note
    if (dto.marketingConsent !== undefined) {
      updates.marketingConsent = dto.marketingConsent
      updates.marketingConsentAt = dto.marketingConsent
        ? (existing.marketingConsentAt ?? new Date())
        : null
    }

    const [updated] = await this.db
      .update(leads)
      .set(updates)
      .where(eq(leads.id, id))
      .returning()

    return updated
  }

  async softDelete(id: string) {
    const existing = await this.getLeadRow(id)
    if (existing.isDeleted) throw new ConflictError('Lead already deleted')

    const [deleted] = await this.db
      .update(leads)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning({ id: leads.id, firstName: leads.firstName, lastName: leads.lastName, isDeleted: leads.isDeleted })

    return deleted
  }

  async changeStatus(leadId: string, userId: string, dto: StatusChangeDto) {
    return this.db.transaction(async (tx) => {
      const [lead] = await tx
        .select()
        .from(leads)
        .where(eq(leads.id, leadId))
        .limit(1)

      if (!lead) throw new NotFoundError('Lead')
      if (lead.convertedPatientId) throw new ConflictError('Converted leads cannot change status')
      if (lead.status === dto.status) throw new ConflictError(`Lead is already ${dto.status}`)

      const allowed = TRANSITIONS[lead.status]
      if (!allowed || !allowed.includes(dto.status)) {
        throw new ValidationError(`Cannot move lead from "${lead.status}" to "${dto.status}"`)
      }

      if (dto.status === 'lost' && !dto.lostReason) {
        throw new ValidationError('lostReason is required when moving a lead to lost')
      }

      const activityType =
        lead.status === 'lost' ? 'status_changed' : (STATUS_ACTIVITY[dto.status] ?? 'status_changed')

      const now = new Date()
      const updates: Record<string, unknown> = {
        status: dto.status,
        lastActivityAt: now,
        updatedAt: now,
      }
      if (dto.status === 'lost') {
        updates.lostReason = dto.lostReason
        updates.lostAt = now
        updates.nextFollowUpAt = null
      } else {
        updates.lostReason = null
        updates.lostAt = null
      }

      const [updated] = await tx
        .update(leads)
        .set(updates)
        .where(eq(leads.id, leadId))
        .returning()

      await tx.insert(leadActivities).values({
        leadId,
        type: activityType,
        note: dto.note ?? null,
        performedBy: userId,
        oldStatus: lead.status,
        newStatus: dto.status,
        metadata: dto.status === 'lost' ? { lostReason: dto.lostReason } : null,
      })

      return updated
    })
  }

  async markLost(leadId: string, userId: string, dto: LostLeadDto) {
    return this.changeStatus(leadId, userId, { status: 'lost', note: dto.note, lostReason: dto.reason })
  }

  async recordContact(leadId: string, userId: string, dto: ContactLeadDto) {
    return this.db.transaction(async (tx) => {
      const [lead] = await tx
        .select()
        .from(leads)
        .where(eq(leads.id, leadId))
        .limit(1)

      if (!lead) throw new NotFoundError('Lead')
      if (lead.convertedPatientId) throw new ConflictError('Converted leads cannot be contacted')

      const now = new Date()
      const [updated] = await tx
        .update(leads)
        .set({
          firstContactAt: lead.firstContactAt ?? now,
          lastContactAt: now,
          lastActivityAt: now,
          updatedAt: now,
        })
        .where(eq(leads.id, leadId))
        .returning()

      await tx.insert(leadActivities).values({
        leadId,
        type: 'contacted',
        note: dto.note ?? null,
        performedBy: userId,
      })

      return updated
    })
  }

  async assign(leadId: string, userId: string, dto: AssignLeadDto) {
    return this.db.transaction(async (tx) => {
      const [lead] = await tx
        .select()
        .from(leads)
        .where(eq(leads.id, leadId))
        .limit(1)

      if (!lead) throw new NotFoundError('Lead')

      const updates: Record<string, unknown> = { lastActivityAt: new Date(), updatedAt: new Date() }
      if (dto.assignedStaffId !== undefined) updates.assignedStaffId = dto.assignedStaffId
      if (dto.assignedDoctorId !== undefined) updates.assignedDoctorId = dto.assignedDoctorId

      const [updated] = await tx
        .update(leads)
        .set(updates)
        .where(eq(leads.id, leadId))
        .returning()

      await tx.insert(leadActivities).values({
        leadId,
        type: 'assigned',
        performedBy: userId,
        metadata: {
          staffId: dto.assignedStaffId ?? null,
          doctorId: dto.assignedDoctorId ?? null,
        },
      })

      return updated
    })
  }

  async addNote(leadId: string, userId: string, dto: AddLeadNoteDto) {
    return this.db.transaction(async (tx) => {
      const [lead] = await tx
        .select()
        .from(leads)
        .where(eq(leads.id, leadId))
        .limit(1)

      if (!lead) throw new NotFoundError('Lead')

      const [note] = await tx
        .insert(leadNotes)
        .values({ leadId, body: dto.body, authorId: userId })
        .returning()

      await tx
        .update(leads)
        .set({ lastActivityAt: new Date(), updatedAt: new Date() })
        .where(eq(leads.id, leadId))

      await tx.insert(leadActivities).values({
        leadId,
        type: 'note_added',
        note: dto.body,
        performedBy: userId,
      })

      return note
    })
  }

  async convert(leadId: string, userId: string, dto: ConvertLeadDto) {
    return this.db.transaction(async (tx) => {
      const [lead] = await tx
        .select()
        .from(leads)
        .where(eq(leads.id, leadId))
        .limit(1)

      if (!lead) throw new NotFoundError('Lead')
      if (lead.convertedPatientId) throw new ConflictError('Lead is already converted')

      const nationalId = dto.nationalId ?? lead.nationalId
      if (!nationalId) {
        throw new ValidationError('National ID is required for conversion (provide it or set it on the lead)')
      }

      const [existingPatient] = await tx
        .select({ id: patients.id })
        .from(patients)
        .where(and(eq(patients.nationalId, nationalId), eq(patients.isDeleted, false)))
        .limit(1)

      let patientId = existingPatient?.id
      let patientCreated = false

      if (!patientId) {
        const [newPatient] = await tx
          .insert(patients)
          .values({
            firstName: lead.firstName,
            lastName: lead.lastName,
            nationalId,
            phone: lead.phone ?? null,
            insuranceCode: dto.insuranceCode ?? null,
            insuranceType: dto.insuranceType ?? null,
            birthDate: dto.birthDate ?? null,
            address: dto.address ?? null,
            maritalStatus: dto.maritalStatus ?? null,
          })
          .returning({ id: patients.id })

        patientId = newPatient.id
        patientCreated = true
      }

      if (lead.phone) {
        const [existingUser] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.phone, lead.phone))
          .limit(1)

        if (!existingUser) {
          const passwordHash = await bcrypt.hash(nationalId, 12)
          await tx.insert(users).values({
            phone: lead.phone,
            passwordHash,
            role: 'patient',
            patientId,
            fullName: `${lead.firstName} ${lead.lastName}`,
            phoneConfirmed: true,
            status: 'approved',
            requiresPasswordChange: true,
          })
        }
      }

      const [updated] = await tx
        .update(leads)
        .set({
          convertedPatientId: patientId,
          conversionDate: new Date(),
          convertedById: userId,
          conversionNote: dto.note ?? null,
          status: 'converted',
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(leads.id, leadId), sql`${leads.convertedPatientId} IS NULL`))
        .returning()

      if (!updated) throw new ConflictError('Lead is already converted')

      await tx.insert(leadActivities).values({
        leadId,
        type: 'converted',
        note: dto.note ?? null,
        performedBy: userId,
        oldStatus: lead.status,
        newStatus: 'converted',
        metadata: { patientId, patientCreated, nationalId },
      })

      return { lead: updated, patientId, patientCreated }
    })
  }

  async summary() {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

    const [
      totalResult,
      pipelineResult,
      bySourceResult,
      byCategoryResult,
      convertedResult,
      lostResult,
      followUpsResult,
      avgResult,
      totalValueResult,
      convertedValueResult,
    ] = await Promise.all([
      this.db.execute(sql`SELECT count(*)::int AS count FROM leads WHERE is_deleted = false`),
      this.db.execute(sql`
        SELECT status, count(*)::int AS count
        FROM leads
        WHERE is_deleted = false
        GROUP BY status
      `),
      this.db.execute(sql`
        SELECT s.id, s.name, s.type, s.category, count(l.id)::int AS count
        FROM leads l
        LEFT JOIN lead_sources s ON l.source_id = s.id
        WHERE l.is_deleted = false
        GROUP BY s.id, s.name, s.type, s.category
        ORDER BY count DESC
      `),
      this.db.execute(sql`
        SELECT COALESCE(s.category, 'other') AS category, count(*)::int AS count
        FROM leads l
        LEFT JOIN lead_sources s ON l.source_id = s.id
        WHERE l.is_deleted = false
        GROUP BY s.category
        ORDER BY count DESC
      `),
      this.db.execute(sql`SELECT count(*)::int AS count FROM leads WHERE is_deleted = false AND status = 'converted'`),
      this.db.execute(sql`SELECT count(*)::int AS count FROM leads WHERE is_deleted = false AND status = 'lost'`),
      this.db.execute(sql`
        SELECT
          count(*) FILTER (WHERE next_follow_up_at < ${now} AND status NOT IN ('converted', 'lost')) AS overdue,
          count(*) FILTER (WHERE next_follow_up_at >= ${startOfToday} AND next_follow_up_at < ${endOfToday}) AS today,
          count(*) FILTER (WHERE next_follow_up_at > ${now}) AS upcoming
        FROM leads
        WHERE is_deleted = false
      `),
      this.db.execute(sql`
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (conversion_date - created_at)) / 86400.0)::numeric, 2) AS avg
        FROM leads
        WHERE is_deleted = false AND status = 'converted' AND conversion_date IS NOT NULL
      `),
      this.db.execute(sql`SELECT COALESCE(SUM(expected_value)::numeric, 0) AS total FROM leads WHERE is_deleted = false`),
      this.db.execute(sql`SELECT COALESCE(SUM(expected_value)::numeric, 0) AS total FROM leads WHERE is_deleted = false AND status = 'converted'`),
    ])

    const rows = (result: any) => (result.rows ?? []) as Array<Record<string, any>>
    const num = (value: any) => (value === null || value === undefined ? 0 : Number(value))

    const total = num(rows(totalResult)[0]?.count)
    const converted = num(rows(convertedResult)[0]?.count)
    const lost = num(rows(lostResult)[0]?.count)

    const statusOrder = ['new', 'contacted', 'qualified', 'appointment_booked', 'visited', 'converted', 'lost']
    const pipelineCounts: Record<string, number> = {}
    for (const row of rows(pipelineResult)) pipelineCounts[row.status] = num(row.count)
    const pipeline = statusOrder.map((status) => ({ status, count: pipelineCounts[status] ?? 0 }))

    return {
      totalLeads: total,
      activeLeads: total - converted - lost,
      convertedLeads: converted,
      lostLeads: lost,
      conversionRate: total > 0 ? Math.round((converted / total) * 10000) / 100 : 0,
      avgDaysToConvert: rows(avgResult)[0]?.avg ?? null,
      expectedValue: {
        total: num(rows(totalValueResult)[0]?.total),
        converted: num(rows(convertedValueResult)[0]?.total),
      },
      pipeline,
      bySource: rows(bySourceResult).map((row) => ({
        sourceId: row.id,
        sourceName: row.name,
        sourceType: row.type,
        category: row.category,
        count: num(row.count),
      })),
      byCategory: rows(byCategoryResult).map((row) => ({
        category: row.category,
        count: num(row.count),
      })),
      followUps: {
        overdue: num(rows(followUpsResult)[0]?.overdue),
        today: num(rows(followUpsResult)[0]?.today),
        upcoming: num(rows(followUpsResult)[0]?.upcoming),
      },
    }
  }
}

import type { DB } from '../../db/client'
import { patients, visits } from '../../db/schema'
import { eq, sql } from 'drizzle-orm'
import { NotFoundError } from '../../shared/errors'
import type { CreateVisitDto, UpdateVisitDto } from './visits.schema'

export class VisitService {
  constructor(private db: DB) {}

  async getPatientList() {
    return this.db
      .select({
        id: patients.id,
        fullName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`.as('full_name'),
        nationalId: patients.nationalId,
      })
      .from(patients)
      .where(eq(patients.isDeleted, false))
      .orderBy(patients.lastName)
  }

  async getCalendarEvents() {
    const appointments = await this.db
      .select({
        id: visits.id,
        title: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`.as('full_name'),
        start: visits.visitDate,
        visitType: visits.visitType,
        notes: visits.notes,
        patientId: visits.patientId,
        durationMinutes: visits.durationMinutes,
      })
      .from(visits)
      .innerJoin(patients, eq(visits.patientId, patients.id))
      .where(eq(patients.isDeleted, false))

    return appointments.map((apt) => {
      const start = apt.start
      const end = new Date(start.getTime() + (apt.durationMinutes || 30) * 60_000)

      return {
        id: apt.id,
        title: `${apt.visitType || 'Visit'} - ${apt.title}`,
        start: start.toISOString(),
        end: end.toISOString(),
        backgroundColor: getVisitColor(apt.visitType),
        borderColor: getVisitBorderColor(apt.visitType),
        textColor: '#ffffff',
        extendedProps: {
          patientId: apt.patientId,
          notes: apt.notes || '',
          type: apt.visitType || 'Visit',
        },
      }
    })
  }

  async create(dto: CreateVisitDto) {
    const [newVisit] = await this.db
      .insert(visits)
      .values({
        patientId: dto.patientId,
        visitType: dto.visitType || '\u0648\u06CC\u0632\u06CC\u062A \u0627\u0648\u0644\u06CC\u0647',
        visitReason: dto.visitReason || null,
        notes: dto.notes || null,
        visitDate: new Date(dto.visitDate),
        durationMinutes: dto.durationMinutes,
      })
      .returning()

    return newVisit
  }

  async update(id: string, dto: UpdateVisitDto) {
    const updates: Record<string, unknown> = {}
    if (dto.patientId !== undefined) updates.patientId = dto.patientId
    if (dto.visitDate !== undefined) updates.visitDate = new Date(dto.visitDate)
    if (dto.visitType !== undefined) updates.visitType = dto.visitType ?? '\u0648\u06CC\u0632\u06CC\u062A \u0627\u0648\u0644\u06CC\u0647'
    if (dto.visitReason !== undefined) updates.visitReason = dto.visitReason
    if (dto.notes !== undefined) updates.notes = dto.notes
    if (dto.durationMinutes !== undefined) updates.durationMinutes = dto.durationMinutes

    const [updatedVisit] = await this.db
      .update(visits)
      .set(updates)
      .where(eq(visits.id, id))
      .returning()

    if (!updatedVisit) throw new NotFoundError('Visit')

    return updatedVisit
  }

  async delete(id: string) {
    const [deletedVisit] = await this.db
      .delete(visits)
      .where(eq(visits.id, id))
      .returning()

    if (!deletedVisit) throw new NotFoundError('Visit')

    return deletedVisit
  }
}

function getVisitColor(type: string | null): string {
  switch (type) {
    case '\u0648\u06CC\u0632\u06CC\u062A \u0627\u0648\u0644\u06CC\u0647': return '#3b82f6'
    case '\u0686\u06A9\u0627\u067E \u0628\u0627\u0631\u062F\u0627\u0631\u06CC': return '#10b981'
    case '\u067E\u06CC\u06AF\u06CC\u0631\u06CC': return '#f59e0b'
    case '\u0627\u0648\u0631\u0698\u0627\u0646\u0633\u06CC': return '#ef4444'
    default: return '#6366f1'
  }
}

function getVisitBorderColor(type: string | null): string {
  switch (type) {
    case '\u0648\u06CC\u0632\u06CC\u062A \u0627\u0648\u0644\u06CC\u0647': return '#2563eb'
    case '\u0686\u06A9\u0627\u067E \u0628\u0627\u0631\u062F\u0627\u0631\u06CC': return '#059669'
    case '\u067E\u06CC\u06AF\u06CC\u0631\u06CC': return '#d97706'
    case '\u0627\u0648\u0631\u0698\u0627\u0646\u0633\u06CC': return '#dc2626'
    default: return '#4f46e5'
  }
}

import type { DB } from '../../db/client'
import { patientNotes, users } from '../../db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { NotFoundError } from '../../shared/errors'

export class PatientNotesService {
  constructor(private db: DB) {}

  async listByPatient(patientId: string) {
    return this.db
      .select({
        id: patientNotes.id,
        patientId: patientNotes.patientId,
        doctorId: patientNotes.doctorId,
        doctorName: users.fullName,
        content: patientNotes.content,
        eventType: patientNotes.eventType,
        eventDate: patientNotes.eventDate,
        createdAt: patientNotes.createdAt,
        updatedAt: patientNotes.updatedAt,
      })
      .from(patientNotes)
      .leftJoin(users, eq(patientNotes.doctorId, users.id))
      .where(and(eq(patientNotes.patientId, patientId), eq(patientNotes.isDeleted, false)))
      .orderBy(desc(patientNotes.eventDate), desc(patientNotes.createdAt))
  }

  async create(patientId: string, doctorId: string, data: { content: string; eventType?: string; eventDate?: string }) {
    const [note] = await this.db
      .insert(patientNotes)
      .values({
        patientId,
        doctorId,
        content: data.content,
        eventType: data.eventType || null,
        eventDate: data.eventDate ? new Date(data.eventDate) : null,
      })
      .returning()

    return note
  }

  async update(id: string, doctorId: string, data: { content?: string; eventType?: string; eventDate?: string }) {
    const [existing] = await this.db
      .select()
      .from(patientNotes)
      .where(and(eq(patientNotes.id, id), eq(patientNotes.isDeleted, false)))
      .limit(1)

    if (!existing) throw new NotFoundError('Patient note')

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (data.content !== undefined) updateData.content = data.content
    if (data.eventType !== undefined) updateData.eventType = data.eventType
    if (data.eventDate !== undefined) updateData.eventDate = data.eventDate ? new Date(data.eventDate) : null

    const [updated] = await this.db
      .update(patientNotes)
      .set(updateData)
      .where(eq(patientNotes.id, id))
      .returning()

    return updated
  }

  async softDelete(id: string) {
    const [existing] = await this.db
      .select()
      .from(patientNotes)
      .where(and(eq(patientNotes.id, id), eq(patientNotes.isDeleted, false)))
      .limit(1)

    if (!existing) throw new NotFoundError('Patient note')

    await this.db
      .update(patientNotes)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(patientNotes.id, id))

    return { id, deleted: true }
  }
}

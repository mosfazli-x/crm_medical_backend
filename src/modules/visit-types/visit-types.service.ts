import type { DB } from '../../db/client'
import { doctorVisitTypes } from '../../db/schema'
import { and, eq } from 'drizzle-orm'
import { NotFoundError } from '../../shared/errors'
import type { CreateVisitTypeDto, UpdateVisitTypeDto } from './visit-types.schema'

export class VisitTypesService {
  constructor(private db: DB) {}

  async getByDoctor(doctorId: string) {
    return this.db
      .select()
      .from(doctorVisitTypes)
      .where(
        and(
          eq(doctorVisitTypes.doctorId, doctorId),
          eq(doctorVisitTypes.isActive, true)
        )
      )
      .orderBy(doctorVisitTypes.name)
  }

  async getById(id: string) {
    const [visitType] = await this.db
      .select()
      .from(doctorVisitTypes)
      .where(eq(doctorVisitTypes.id, id))
      .limit(1)

    if (!visitType) throw new NotFoundError('Visit type')
    return visitType
  }

  async create(doctorId: string, dto: CreateVisitTypeDto) {
    const [visitType] = await this.db
      .insert(doctorVisitTypes)
      .values({
        doctorId,
        name: dto.name,
        description: dto.description ?? null,
        durationMinutes: dto.durationMinutes ?? 30,
        price: dto.price ? String(dto.price) : null,
        color: dto.color ?? null,
      })
      .returning()

    return visitType
  }

  async update(id: string, doctorId: string, dto: UpdateVisitTypeDto) {
    const existing = await this.db
      .select()
      .from(doctorVisitTypes)
      .where(
        and(eq(doctorVisitTypes.id, id), eq(doctorVisitTypes.doctorId, doctorId))
      )
      .limit(1)

    if (!existing.length) throw new NotFoundError('Visit type')

    const updates: Record<string, unknown> = {}
    if (dto.name !== undefined) updates.name = dto.name
    if (dto.description !== undefined) updates.description = dto.description
    if (dto.durationMinutes !== undefined) updates.durationMinutes = dto.durationMinutes
    if (dto.price !== undefined) updates.price = String(dto.price)
    if (dto.color !== undefined) updates.color = dto.color
    if (dto.isActive !== undefined) updates.isActive = dto.isActive

    const [updated] = await this.db
      .update(doctorVisitTypes)
      .set(updates)
      .where(eq(doctorVisitTypes.id, id))
      .returning()

    return updated
  }

  async delete(id: string, doctorId: string) {
    const [deleted] = await this.db
      .delete(doctorVisitTypes)
      .where(
        and(eq(doctorVisitTypes.id, id), eq(doctorVisitTypes.doctorId, doctorId))
      )
      .returning()

    if (!deleted) throw new NotFoundError('Visit type')
    return deleted
  }
}

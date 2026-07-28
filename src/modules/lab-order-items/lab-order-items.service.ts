import type { DB } from '../../db/client'
import { labOrderItems, labOrders } from '../../db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { NotFoundError, ForbiddenError } from '../../shared/errors'
import type { CreateLabOrderItemDto, UpdateLabOrderItemDto } from './lab-order-items.schema'

export class LabOrderItemsService {
  constructor(private db: DB) {}

  async getByOrderId(labOrderId: string) {
    const [order] = await this.db
      .select({ id: labOrders.id })
      .from(labOrders)
      .where(eq(labOrders.id, labOrderId))
      .limit(1)
    if (!order) throw new NotFoundError('Lab order')

    return this.db
      .select()
      .from(labOrderItems)
      .where(eq(labOrderItems.labOrderId, labOrderId))
      .orderBy(labOrderItems.createdAt)
  }

  async getById(id: string) {
    const [item] = await this.db
      .select()
      .from(labOrderItems)
      .where(eq(labOrderItems.id, id))
      .limit(1)
    if (!item) throw new NotFoundError('Lab order item')
    return item
  }

  async create(dto: CreateLabOrderItemDto) {
    const [order] = await this.db
      .select({ id: labOrders.id })
      .from(labOrders)
      .where(eq(labOrders.id, dto.lab_order_id))
      .limit(1)
    if (!order) throw new NotFoundError('Lab order')

    const [item] = await this.db
      .insert(labOrderItems)
      .values({
        labOrderId: dto.lab_order_id,
        testName: dto.test_name,
        testCode: dto.test_code || null,
        category: dto.category || null,
        notes: dto.notes || null,
      })
      .returning()
    return item
  }

  async update(id: string, dto: UpdateLabOrderItemDto) {
    const existing = await this.getById(id)

    const updateData: Record<string, unknown> = {}
    if (dto.test_name !== undefined) updateData.testName = dto.test_name
    if (dto.test_code !== undefined) updateData.testCode = dto.test_code
    if (dto.category !== undefined) updateData.category = dto.category
    if (dto.notes !== undefined) updateData.notes = dto.notes

    if (Object.keys(updateData).length === 0) {
      return existing
    }

    const [updated] = await this.db
      .update(labOrderItems)
      .set(updateData)
      .where(eq(labOrderItems.id, id))
      .returning()

    if (!updated) throw new NotFoundError('Lab order item')
    return updated
  }

  async delete(id: string) {
    const [deleted] = await this.db
      .delete(labOrderItems)
      .where(eq(labOrderItems.id, id))
      .returning()
    if (!deleted) throw new NotFoundError('Lab order item')
    return deleted
  }
}

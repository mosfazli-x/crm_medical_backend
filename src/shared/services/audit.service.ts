import type { DB } from '../../db/client'
import { auditLogs } from '../../db/schema'
import { eq, and, desc } from 'drizzle-orm'

export class AuditService {
  constructor(private db: DB) {}

  async log(params: {
    userId?: string
    action: string
    entityType: string
    entityId?: string
    oldValues?: Record<string, unknown>
    newValues?: Record<string, unknown>
    ipAddress?: string
    userAgent?: string
  }) {
    await this.db.insert(auditLogs).values({
      userId: params.userId || null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId || null,
      oldValues: params.oldValues || null,
      newValues: params.newValues || null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
    })
  }

  async getByEntity(entityType: string, entityId: string) {
    return this.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
      .orderBy(desc(auditLogs.createdAt))
  }
}
import type { DB } from '../../db/client'
import { auditLogs } from '../../db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'

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
    try {
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
    } catch (err) {
      console.error('Audit log failed:', err)
    }
  }

  async getByEntity(entityType: string, entityId: string) {
    return this.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
      .orderBy(desc(auditLogs.createdAt))
  }

  async getAll(page = 1, limit = 50) {
    const offset = (page - 1) * limit
    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLogs),
    ])
    return { data, total: countResult[0]?.count || 0 }
  }
}

let _auditService: AuditService | null = null

export function getAuditService(): AuditService {
  if (!_auditService) {
    const { getDb } = require('../../db/client')
    _auditService = new AuditService(getDb())
  }
  return _auditService
}
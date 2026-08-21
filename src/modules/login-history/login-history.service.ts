import type { DB } from '../../db/client'
import { loginSessions } from '../../db/schema'
import { eq, and, desc, sql, count } from 'drizzle-orm'
import { NotFoundError } from '../../shared/errors'
import { parseUserAgent } from '../../shared/utils/user-agent'

export class LoginHistoryService {
  constructor(private db: DB) {}

  async logLogin(params: {
    userId: string
    ipAddress?: string
    userAgent?: string
  }) {
    const parsed = parseUserAgent(params.userAgent)

    const [session] = await this.db
      .insert(loginSessions)
      .values({
        userId: params.userId,
        event: 'login',
        browser: parsed.browser,
        browserVersion: parsed.browserVersion,
        os: parsed.os,
        osVersion: parsed.osVersion,
        device: parsed.device,
        deviceType: parsed.deviceType,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      })
      .returning({ id: loginSessions.id })

    return session
  }

  async logLogout(params: {
    userId: string
    sessionId?: string
    ipAddress?: string
    userAgent?: string
  }) {
    if (params.sessionId) {
      await this.db
        .update(loginSessions)
        .set({ endedAt: new Date() })
        .where(
          and(
            eq(loginSessions.id, params.sessionId),
            eq(loginSessions.userId, params.userId),
            eq(loginSessions.event, 'login'),
          )
        )
    }

    const parsed = parseUserAgent(params.userAgent)

    const [logoutSession] = await this.db
      .insert(loginSessions)
      .values({
        userId: params.userId,
        event: 'logout',
        browser: parsed.browser,
        browserVersion: parsed.browserVersion,
        os: parsed.os,
        osVersion: parsed.osVersion,
        device: parsed.device,
        deviceType: parsed.deviceType,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      })
      .returning({ id: loginSessions.id })

    return logoutSession
  }

  async revokeSession(sessionId: string) {
    const [session] = await this.db
      .select({ id: loginSessions.id, revoked: loginSessions.revoked })
      .from(loginSessions)
      .where(eq(loginSessions.id, sessionId))
      .limit(1)

    if (!session) throw new NotFoundError('Session not found')

    if (session.revoked) return { alreadyRevoked: true }

    await this.db
      .update(loginSessions)
      .set({ revoked: true, revokedAt: new Date() })
      .where(eq(loginSessions.id, sessionId))

    return { revoked: true }
  }

  async revokeAllUserSessionsExcept(userId: string, exceptSessionId?: string) {
    const conditions = [
      eq(loginSessions.userId, userId),
      eq(loginSessions.event, 'login'),
      eq(loginSessions.revoked, false),
    ]

    if (exceptSessionId) {
      conditions.push(sql`${loginSessions.id} != ${exceptSessionId}`)
    }

    await this.db
      .update(loginSessions)
      .set({ revoked: true, revokedAt: new Date() })
      .where(and(...conditions))
  }

  async getRevokedSessionIds(): Promise<string[]> {
    const sessions = await this.db
      .select({ id: loginSessions.id })
      .from(loginSessions)
      .where(eq(loginSessions.revoked, true))

    return sessions.map((s) => s.id)
  }

  async getByUserId(userId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit

    const [data, countResult] = await Promise.all([
      this.db
        .select({
          id: loginSessions.id,
          userId: loginSessions.userId,
          event: loginSessions.event,
          browser: loginSessions.browser,
          browserVersion: loginSessions.browserVersion,
          os: loginSessions.os,
          osVersion: loginSessions.osVersion,
          device: loginSessions.device,
          deviceType: loginSessions.deviceType,
          ipAddress: loginSessions.ipAddress,
          userAgent: loginSessions.userAgent,
          revoked: loginSessions.revoked,
          revokedAt: loginSessions.revokedAt,
          endedAt: loginSessions.endedAt,
          createdAt: loginSessions.createdAt,
        })
        .from(loginSessions)
        .where(eq(loginSessions.userId, userId))
        .orderBy(desc(loginSessions.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(loginSessions)
        .where(eq(loginSessions.userId, userId)),
    ])

    return {
      data,
      pagination: {
        page,
        limit,
        total: countResult[0]?.count || 0,
        totalPages: Math.ceil((countResult[0]?.count || 0) / limit),
      },
    }
  }

  async getAll(page = 1, limit = 50, filters?: { userId?: string; event?: string }) {
    const offset = (page - 1) * limit
    const conditions = []

    if (filters?.userId) {
      conditions.push(eq(loginSessions.userId, filters.userId))
    }
    if (filters?.event) {
      conditions.push(eq(loginSessions.event, filters.event))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [data, countResult] = await Promise.all([
      this.db
        .select({
          id: loginSessions.id,
          userId: loginSessions.userId,
          event: loginSessions.event,
          browser: loginSessions.browser,
          browserVersion: loginSessions.browserVersion,
          os: loginSessions.os,
          osVersion: loginSessions.osVersion,
          device: loginSessions.device,
          deviceType: loginSessions.deviceType,
          ipAddress: loginSessions.ipAddress,
          userAgent: loginSessions.userAgent,
          revoked: loginSessions.revoked,
          revokedAt: loginSessions.revokedAt,
          endedAt: loginSessions.endedAt,
          createdAt: loginSessions.createdAt,
        })
        .from(loginSessions)
        .where(where)
        .orderBy(desc(loginSessions.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(loginSessions)
        .where(where),
    ])

    return {
      data,
      pagination: {
        page,
        limit,
        total: countResult[0]?.count || 0,
        totalPages: Math.ceil((countResult[0]?.count || 0) / limit),
      },
    }
  }

  async getUserSessionSummary(userId: string) {
    const [summary] = await this.db
      .select({
        totalLogins: sql<number>`count(*) filter (where ${loginSessions.event} = 'login')::int`,
        activeSessions: sql<number>`count(*) filter (where ${loginSessions.event} = 'login' and ${loginSessions.revoked} = false and ${loginSessions.endedAt} IS NULL)::int`,
        lastLogin: sql<Date>`max(${loginSessions.createdAt}) filter (where ${loginSessions.event} = 'login')`,
      })
      .from(loginSessions)
      .where(eq(loginSessions.userId, userId))

    return summary
  }
}

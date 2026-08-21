import type { FastifyRequest, FastifyReply } from 'fastify'
import { UnauthorizedError } from '../errors'
import { loginSessions } from '../../db/schema'
import { eq } from 'drizzle-orm'

let revokedSessionIds: Set<string> = new Set()
let lastRefreshAt = 0
const REFRESH_INTERVAL_MS = 60_000

export function setRevokedSessionIds(ids: string[]) {
  revokedSessionIds = new Set(ids)
  lastRefreshAt = Date.now()
}

export async function refreshRevokedCache(db: any) {
  try {
    const sessions = await db
      .select({ id: loginSessions.id })
      .from(loginSessions)
      .where(eq(loginSessions.revoked, true))
    revokedSessionIds = new Set(sessions.map((s: any) => s.id))
    lastRefreshAt = Date.now()
  } catch (err) {
    console.error('Failed to refresh revoked sessions cache:', err)
  }
}

export async function checkRevocation(request: FastifyRequest, _reply: FastifyReply) {
  const user = request.user as any
  if (!user?.sessionId) return

  const now = Date.now()
  if (now - lastRefreshAt > REFRESH_INTERVAL_MS) {
    const db = (request.server as any).db
    if (db) {
      await refreshRevokedCache(db)
    }
  }

  if (revokedSessionIds.has(user.sessionId)) {
    throw new UnauthorizedError('Session has been revoked')
  }
}

export function initRevocationCache(db: any) {
  refreshRevokedCache(db)

  setInterval(() => {
    refreshRevokedCache(db)
  }, REFRESH_INTERVAL_MS)
}

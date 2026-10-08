import type { DB } from '../../db/client'
import { cashbookAccessGrants, users } from '../../db/schema'
import { and, asc, eq, inArray, ne } from 'drizzle-orm'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors'
import { getAuditService } from '../../shared/services'
import { isUniqueViolation } from '../../shared/utils'
import type { CashbookGrantDto } from './cashbook.schema'

export type CashbookLedgerAccess = {
  ownerId: string
  ownerName: string | null
  ownerRole: string
}

type GrantRow = {
  id: string
  ownerId: string
  granteeId: string
  createdAt: Date
}

/**
 * Owner-controlled access delegation for personal cashbooks.
 *
 * A ledger is private to its owner. Another user may only read it when the owner
 * has explicitly recorded a grant, so cross-account visibility is never implied by
 * role. Grants are one-directional (owner -> grantee) and read-only.
 */
export class CashbookAccessService {
  constructor(private db: DB) {}

  /**
   * Resolves the ledger an actor is allowed to act on.
   *
   * Self always resolves. Any other owner requires an explicit, still-present grant;
   * role is deliberately not consulted, because a clinic manager has no more claim
   * to a ledger than any other user until the owner hands it over.
   */
  async resolveOwnerId(actorId: string, requestedOwnerId?: string): Promise<string> {
    if (!requestedOwnerId || requestedOwnerId === actorId) return actorId

    const [grant] = await this.db
      .select({ id: cashbookAccessGrants.id })
      .from(cashbookAccessGrants)
      .where(and(
        eq(cashbookAccessGrants.ownerId, requestedOwnerId),
        eq(cashbookAccessGrants.granteeId, actorId),
      ))
      .limit(1)

    if (!grant) {
      throw new ForbiddenError('You do not have access to this ledger')
    }
    return requestedOwnerId
  }

  /**
   * Ledgers the actor may read: their own plus every ledger explicitly shared with
   * them. This is the authoritative list for the ledger switcher, so the UI can no
   * longer offer an owner the backend would refuse.
   */
  async listVisibleLedgers(actorId: string): Promise<CashbookLedgerAccess[]> {
    const grants = await this.db
      .select({ ownerId: cashbookAccessGrants.ownerId })
      .from(cashbookAccessGrants)
      .where(eq(cashbookAccessGrants.granteeId, actorId))

    const rows = await this.db
      .select({ id: users.id, fullName: users.fullName, role: users.role })
      .from(users)
      .where(and(
        eq(users.status, 'approved'),
        inArray(users.role, ['admin_doctor', 'doctor']),
        inArray(users.id, [actorId, ...grants.map((grant) => grant.ownerId)]),
      ))
      .orderBy(asc(users.fullName))

    return rows.map((row) => ({
      ownerId: row.id,
      ownerName: row.fullName,
      ownerRole: row.role,
    }))
  }

  async listGrants(ownerId: string) {
    const rows = await this.db
      .select({
        id: cashbookAccessGrants.id,
        granteeId: cashbookAccessGrants.granteeId,
        granteeName: users.fullName,
        granteeRole: users.role,
        createdAt: cashbookAccessGrants.createdAt,
      })
      .from(cashbookAccessGrants)
      .innerJoin(users, eq(cashbookAccessGrants.granteeId, users.id))
      .where(eq(cashbookAccessGrants.ownerId, ownerId))
      .orderBy(asc(users.fullName))

    return rows.map((row) => ({
      id: row.id,
      granteeId: row.granteeId,
      granteeName: row.granteeName,
      granteeRole: row.granteeRole,
      createdAt: row.createdAt,
    }))
  }

  async createGrant(ownerId: string, dto: CashbookGrantDto, actor: { ipAddress?: string; userAgent?: string }) {
    if (dto.granteeId === ownerId) {
      throw new ValidationError('You already own this ledger')
    }

    const [grantee] = await this.db
      .select({ id: users.id, fullName: users.fullName, role: users.role, status: users.status })
      .from(users)
      .where(eq(users.id, dto.granteeId))
      .limit(1)

    if (!grantee) throw new NotFoundError('User')
    if (grantee.status !== 'approved') {
      throw new ValidationError('Access can only be granted to an active user')
    }
    if (!['admin_doctor', 'doctor'].includes(grantee.role)) {
      throw new ValidationError('Access can only be granted to a clinic manager or physician')
    }

    const existing = await this.db
      .select({ id: cashbookAccessGrants.id })
      .from(cashbookAccessGrants)
      .where(and(
        eq(cashbookAccessGrants.ownerId, ownerId),
        eq(cashbookAccessGrants.granteeId, dto.granteeId),
      ))
      .limit(1)
    if (existing.length > 0) {
      throw new ConflictError('This user already has access to your ledger')
    }

    let created: GrantRow | undefined
    try {
      ;[created] = await this.db
        .insert(cashbookAccessGrants)
        .values({ ownerId, granteeId: dto.granteeId })
        .returning({
          id: cashbookAccessGrants.id,
          ownerId: cashbookAccessGrants.ownerId,
          granteeId: cashbookAccessGrants.granteeId,
          createdAt: cashbookAccessGrants.createdAt,
        })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('This user already has access to your ledger')
      }
      throw error
    }

    await getAuditService().log({
      userId: ownerId,
      action: 'cashbook.access.granted',
      entityType: 'cashbook_access_grant',
      entityId: created!.id,
      newValues: { ownerId, granteeId: dto.granteeId },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    })

    return {
      id: created!.id,
      ownerId,
      granteeId: created!.granteeId,
      granteeName: grantee.fullName,
      granteeRole: grantee.role,
      createdAt: created!.createdAt,
    }
  }

  async revokeGrant(actorId: string, grantId: string, actor: { ipAddress?: string; userAgent?: string }) {
    const [grant] = await this.db
      .select({
        id: cashbookAccessGrants.id,
        ownerId: cashbookAccessGrants.ownerId,
        granteeId: cashbookAccessGrants.granteeId,
      })
      .from(cashbookAccessGrants)
      .where(eq(cashbookAccessGrants.id, grantId))
      .limit(1)

    // A grant the caller does not own is reported as missing rather than forbidden,
    // so the endpoint cannot be used to probe for grant ids.
    if (!grant || grant.ownerId !== actorId) throw new NotFoundError('Cashbook access grant')

    await this.db
      .delete(cashbookAccessGrants)
      .where(eq(cashbookAccessGrants.id, grant.id))

    await getAuditService().log({
      userId: actorId,
      action: 'cashbook.access.revoked',
      entityType: 'cashbook_access_grant',
      entityId: grant.id,
      oldValues: { ownerId: grant.ownerId, granteeId: grant.granteeId },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    })

    return { id: grant.id }
  }

  /** Candidates the owner may still share with, i.e. approved staff not yet granted. */
  async listGrantableUsers(ownerId: string) {
    const grants = await this.db
      .select({ granteeId: cashbookAccessGrants.granteeId })
      .from(cashbookAccessGrants)
      .where(eq(cashbookAccessGrants.ownerId, ownerId))

    const granted = new Set(grants.map((grant) => grant.granteeId))
    granted.add(ownerId)

    const rows = await this.db
      .select({ id: users.id, fullName: users.fullName, role: users.role })
      .from(users)
      .where(and(
        eq(users.status, 'approved'),
        inArray(users.role, ['admin_doctor', 'doctor']),
        ne(users.id, ownerId),
      ))
      .orderBy(asc(users.fullName))

    return rows
      .filter((row) => !granted.has(row.id))
      .map((row) => ({ id: row.id, fullName: row.fullName, role: row.role }))
  }
}
import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { DB } from '../../db/client'
import {
  cashbookAccounts,
  cashbookCategories,
  cashbookEntries,
  financeIngestTokens,
  financeMessages,
  financeSources,
} from '../../db/schema'
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../shared/errors'
import { isUniqueViolation } from '../../shared/utils'
import { buildDedupeInput, parseBankSms, type ParsedSms } from './sms-parser'
import type {
  ApproveMessageDto,
  CreateSourceDto,
  CreateTokenDto,
  MessageListQuery,
  SmsMessageInput,
  UpdateSourceDto,
} from './finance-ingest.schema'

/** Messages below this parser confidence are queued for a human instead of posted. */
const AUTO_POST_MIN_CONFIDENCE = 70
const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000

const FALLBACK_CATEGORY_NAMES = {
  income: ['سایر درآمد', 'سایر', 'متفرقه', 'other income'],
  expense: ['سایر هزینه', 'سایر', 'متفرقه', 'other expense'],
} as const

const FALLBACK_CATEGORY_DEFAULT = {
  income: { name: 'سایر درآمد', color: '#10b981' },
  expense: { name: 'سایر هزینه', color: '#f43f5e' },
} as const

type SourceRow = typeof financeSources.$inferSelect
type MessageRow = typeof financeMessages.$inferSelect
type TokenRow = typeof financeIngestTokens.$inferSelect

export interface IngestResult {
  messageId: string | null
  status: 'posted' | 'review' | 'duplicate' | 'ignored' | 'failed'
  entryId: string | null
  reason: string | null
  parserId: string
  bankCode: string | null
  direction: 'income' | 'expense' | null
  amountRial: string | null
  confidence: number
}

interface IngestContext {
  userId: string
  tokenId: string | null
  channel: string
  sourceId?: string | null
}

export class FinanceIngestService {
  constructor(private db: DB) {}

  /* ─────────────────────────── Device auth ─────────────────────────── */

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex')
  }

  async authenticateDeviceToken(rawToken: string): Promise<TokenRow> {
    const token = (rawToken ?? '').trim()
    if (!token) throw new UnauthorizedError('Missing ingest token')

    const [row] = await this.db
      .select()
      .from(financeIngestTokens)
      .where(eq(financeIngestTokens.tokenHash, this.hashToken(token)))
      .limit(1)

    if (!row || row.isRevoked) throw new UnauthorizedError('Invalid or revoked ingest token')
    return row
  }

  /* ─────────────────────────── Ingest pipeline ─────────────────────────── */

  async ingestWithToken(rawToken: string, messages: SmsMessageInput[]): Promise<IngestResult[]> {
    const token = await this.authenticateDeviceToken(rawToken)
    const results = await this.ingestMessages(
      { userId: token.userId, tokenId: token.id, channel: 'sms' },
      messages,
    )
    await this.db
      .update(financeIngestTokens)
      .set({
        lastSeenAt: new Date(),
        messageCount: sql`${financeIngestTokens.messageCount} + ${messages.length}`,
      })
      .where(eq(financeIngestTokens.id, token.id))
    return results
  }

  async pasteForUser(userId: string, text: string, sender?: string, sourceId?: string): Promise<IngestResult> {
    const [result] = await this.ingestMessages(
      { userId, tokenId: null, channel: 'manual', sourceId: sourceId ?? null },
      [{ text, sender: sender ?? null }],
    )
    return result!
  }

  private async ingestMessages(ctx: IngestContext, messages: SmsMessageInput[]): Promise<IngestResult[]> {
    const results: IngestResult[] = []
    for (const message of messages) {
      results.push(await this.ingestOne(ctx, message))
    }
    return results
  }

  private async ingestOne(ctx: IngestContext, message: SmsMessageInput): Promise<IngestResult> {
    const receivedAt = message.receivedAt ?? new Date()
    const sender = message.sender ?? null
    const parsed = parseBankSms({ text: message.text, sender, receivedAt })
    const dedupeKey = createHash('sha256').update(buildDedupeInput(parsed, message.text)).digest('hex')

    const duplicate = await this.findDuplicate(ctx.userId, dedupeKey, message.clientId)
    if (duplicate) {
      return this.toResult(parsed, 'duplicate', duplicate.id, null, 'duplicate')
    }

    const source = ctx.sourceId
      ? await this.loadSource(ctx.userId, ctx.sourceId)
      : await this.matchSource(ctx.userId, parsed, sender)

    let status: IngestResult['status'] = 'review'
    let entryId: string | null = null
    let reason: string | null = null

    if (parsed.outcome === 'ignored') {
      status = 'ignored'
      reason = parsed.reason
    } else if (parsed.outcome === 'failed') {
      status = 'failed'
      reason = parsed.reason
    } else if (!source) {
      status = 'review'
      reason = 'no_source'
    } else if (!source.autoPost) {
      status = 'review'
      reason = 'auto_post_disabled'
    } else if (parsed.confidence < AUTO_POST_MIN_CONFIDENCE) {
      status = 'review'
      reason = 'low_confidence'
    } else {
      const posted = await this.postEntry({ userId: ctx.userId, source, parsed, receivedAt, rawText: message.text })
      if (posted.entryId) {
        status = 'posted'
        entryId = posted.entryId
      } else {
        status = 'review'
        reason = posted.reason
      }
    }

    try {
      const [row] = await this.db
        .insert(financeMessages)
        .values({
          userId: ctx.userId,
          ingestTokenId: ctx.tokenId,
          sourceId: source?.id ?? null,
          cashbookEntryId: entryId,
          clientMessageId: message.clientId ?? null,
          dedupeKey,
          channel: ctx.channel,
          sender,
          rawText: message.text,
          receivedAt,
          parsed: this.serializeParsed(parsed),
          parserId: parsed.parserId,
          confidence: parsed.confidence,
          direction: parsed.direction,
          amountRial: parsed.amountRial ? BigInt(parsed.amountRial) : null,
          balanceRial: parsed.balanceRial ? BigInt(parsed.balanceRial) : null,
          cardLast4: parsed.cardLast4,
          externalRef: parsed.externalRef,
          status,
          rejectionReason: reason,
        })
        .returning({ id: financeMessages.id })

      return this.toResult(parsed, status, row!.id, entryId, reason)
    } catch (error) {
      if (isUniqueViolation(error)) {
        const existing = await this.findDuplicate(ctx.userId, dedupeKey, message.clientId)
        return this.toResult(parsed, 'duplicate', existing?.id ?? null, null, 'duplicate')
      }
      throw error
    }
  }

  private toResult(
    parsed: ParsedSms,
    status: IngestResult['status'],
    messageId: string | null,
    entryId: string | null,
    reason: string | null,
  ): IngestResult {
    return {
      messageId,
      status,
      entryId,
      reason,
      parserId: parsed.parserId,
      bankCode: parsed.bankCode,
      direction: parsed.direction,
      amountRial: parsed.amountRial,
      confidence: parsed.confidence,
    }
  }

  private serializeParsed(parsed: ParsedSms) {
    return { ...parsed, occurredAt: parsed.occurredAt ? parsed.occurredAt.toISOString() : null }
  }

  private async findDuplicate(userId: string, dedupeKey: string, clientId?: string) {
    const [row] = await this.db
      .select({ id: financeMessages.id })
      .from(financeMessages)
      .where(and(eq(financeMessages.userId, userId), eq(financeMessages.dedupeKey, dedupeKey)))
      .limit(1)
    if (row) return row
    if (!clientId) return null
    const [byClient] = await this.db
      .select({ id: financeMessages.id })
      .from(financeMessages)
      .where(and(eq(financeMessages.userId, userId), eq(financeMessages.clientMessageId, clientId)))
      .limit(1)
    return byClient ?? null
  }

  /* ─────────────────────────── Source matching ─────────────────────────── */

  private async matchSource(userId: string, parsed: ParsedSms, sender: string | null): Promise<SourceRow | null> {
    const rows = await this.db
      .select()
      .from(financeSources)
      .where(and(eq(financeSources.userId, userId), eq(financeSources.isActive, true)))

    if (rows.length === 0) return null
    const senderNorm = (sender ?? '').toLowerCase()

    let best: { row: SourceRow; score: number } | null = null
    for (const row of rows) {
      if (parsed.bankCode && row.bankCode && row.bankCode !== parsed.bankCode) continue

      let score = 0
      if (parsed.bankCode && row.bankCode === parsed.bankCode) score += 30
      if (parsed.cardLast4 && row.cardLast4 && row.cardLast4 === parsed.cardLast4) score += 50

      const patterns = Array.isArray(row.senderPatterns) ? (row.senderPatterns as string[]) : []
      if (senderNorm && patterns.some((pattern) => senderNorm.includes(String(pattern).toLowerCase()))) {
        score += 20
      }

      if (!best || score > best.score) best = { row, score }
    }

    return best && best.score > 0 ? best.row : null
  }

  private async loadSource(userId: string, sourceId: string): Promise<SourceRow> {
    const [row] = await this.db
      .select()
      .from(financeSources)
      .where(and(eq(financeSources.id, sourceId), eq(financeSources.userId, userId)))
      .limit(1)
    if (!row) throw new NotFoundError('Finance source')
    return row
  }

  /* ─────────────────────────── Posting ─────────────────────────── */

  private async postEntry(params: {
    userId: string
    source: SourceRow | null
    parsed: ParsedSms
    receivedAt: Date
    rawText: string
    overrides?: ApproveMessageDto
  }): Promise<{ entryId: string | null; reason: string | null }> {
    const { userId, source, parsed, receivedAt, rawText, overrides } = params

    const kind = overrides?.kind ?? parsed.direction
    if (kind !== 'income' && kind !== 'expense') return { entryId: null, reason: 'direction_unknown' }

    const amountRial = overrides?.amountRial
      ?? (parsed.amountRial ? BigInt(parsed.amountRial) : null)
    if (!amountRial || amountRial <= 0n) return { entryId: null, reason: 'amount_missing' }

    const accountId = overrides?.accountId ?? source?.accountId
    if (!accountId) return { entryId: null, reason: 'no_account' }

    const categoryId = overrides?.categoryId
      ?? (kind === 'income' ? source?.incomeCategoryId : source?.expenseCategoryId)
    if (!categoryId) return { entryId: null, reason: 'no_category' }

    const [category] = await this.db
      .select({ id: cashbookCategories.id, kind: cashbookCategories.kind, isArchived: cashbookCategories.isArchived })
      .from(cashbookCategories)
      .where(and(eq(cashbookCategories.id, categoryId), eq(cashbookCategories.userId, userId)))
      .limit(1)
    if (!category) return { entryId: null, reason: 'invalid_category' }
    if (category.kind !== kind) return { entryId: null, reason: 'category_mismatch' }
    if (category.isArchived) return { entryId: null, reason: 'category_archived' }

    const [account] = await this.db
      .select({ id: cashbookAccounts.id, isArchived: cashbookAccounts.isArchived })
      .from(cashbookAccounts)
      .where(and(eq(cashbookAccounts.id, accountId), eq(cashbookAccounts.userId, userId)))
      .limit(1)
    if (!account) return { entryId: null, reason: 'invalid_account' }
    if (account.isArchived) return { entryId: null, reason: 'account_archived' }

    const entryDate = overrides?.entryDate ?? tehranDateString(toDate(parsed.occurredAt) ?? receivedAt)
    const description = (overrides?.description ?? parsed.description ?? rawText).slice(0, 500)

    try {
      const [entry] = await this.db
        .insert(cashbookEntries)
        .values({
          userId,
          entryDate,
          kind,
          amountRial,
          categoryId,
          accountId,
          description,
          reference: parsed.externalRef ? parsed.externalRef.slice(0, 100) : null,
          sourceId: source?.id ?? null,
          externalRef: parsed.externalRef ?? null,
        })
        .returning({ id: cashbookEntries.id })

      return { entryId: entry!.id, reason: null }
    } catch (error) {
      if (isUniqueViolation(error)) return { entryId: null, reason: 'duplicate_entry' }
      throw error
    }
  }

  /* ─────────────────────────── Sources ─────────────────────────── */

  async listSources(userId: string) {
    return this.db
      .select({
        id: financeSources.id,
        label: financeSources.label,
        channel: financeSources.channel,
        bankCode: financeSources.bankCode,
        senderPatterns: financeSources.senderPatterns,
        cardLast4: financeSources.cardLast4,
        accountId: financeSources.accountId,
        accountName: cashbookAccounts.name,
        incomeCategoryId: financeSources.incomeCategoryId,
        expenseCategoryId: financeSources.expenseCategoryId,
        autoPost: financeSources.autoPost,
        isActive: financeSources.isActive,
        createdAt: financeSources.createdAt,
      })
      .from(financeSources)
      .innerJoin(cashbookAccounts, eq(financeSources.accountId, cashbookAccounts.id))
      .where(eq(financeSources.userId, userId))
      .orderBy(desc(financeSources.isActive), desc(financeSources.createdAt))
  }

  async createSource(userId: string, dto: CreateSourceDto) {
    await this.assertAccount(userId, dto.accountId)
    if (dto.incomeCategoryId) await this.assertCategory(userId, dto.incomeCategoryId, 'income')
    if (dto.expenseCategoryId) await this.assertCategory(userId, dto.expenseCategoryId, 'expense')

    const defaults = await this.ensureFallbackCategories(userId)

    const [row] = await this.db
      .insert(financeSources)
      .values({
        userId,
        label: dto.label,
        channel: dto.channel,
        bankCode: dto.bankCode.toLowerCase(),
        senderPatterns: dto.senderPatterns,
        cardLast4: dto.cardLast4 ?? null,
        accountId: dto.accountId,
        incomeCategoryId: dto.incomeCategoryId ?? defaults.incomeCategoryId,
        expenseCategoryId: dto.expenseCategoryId ?? defaults.expenseCategoryId,
        autoPost: dto.autoPost,
        isActive: dto.isActive,
      })
      .returning()

    return row!
  }

  async updateSource(userId: string, sourceId: string, dto: UpdateSourceDto) {
    await this.loadSource(userId, sourceId)
    if (dto.accountId) await this.assertAccount(userId, dto.accountId)
    if (dto.incomeCategoryId) await this.assertCategory(userId, dto.incomeCategoryId, 'income')
    if (dto.expenseCategoryId) await this.assertCategory(userId, dto.expenseCategoryId, 'expense')

    const values: Partial<typeof financeSources.$inferInsert> = { updatedAt: new Date() }
    if (dto.label !== undefined) values.label = dto.label
    if (dto.channel !== undefined) values.channel = dto.channel
    if (dto.bankCode !== undefined) values.bankCode = dto.bankCode.toLowerCase()
    if (dto.senderPatterns !== undefined) values.senderPatterns = dto.senderPatterns
    if (dto.cardLast4 !== undefined) values.cardLast4 = dto.cardLast4
    if (dto.accountId !== undefined) values.accountId = dto.accountId
    if (dto.incomeCategoryId !== undefined) values.incomeCategoryId = dto.incomeCategoryId
    if (dto.expenseCategoryId !== undefined) values.expenseCategoryId = dto.expenseCategoryId
    if (dto.autoPost !== undefined) values.autoPost = dto.autoPost
    if (dto.isActive !== undefined) values.isActive = dto.isActive

    const [row] = await this.db
      .update(financeSources)
      .set(values)
      .where(and(eq(financeSources.id, sourceId), eq(financeSources.userId, userId)))
      .returning()

    if (!row) throw new NotFoundError('Finance source')
    return row
  }

  async deleteSource(userId: string, sourceId: string) {
    await this.loadSource(userId, sourceId)
    const [row] = await this.db
      .update(financeSources)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(financeSources.id, sourceId), eq(financeSources.userId, userId)))
      .returning({ id: financeSources.id })
    if (!row) throw new NotFoundError('Finance source')
    return { id: row.id, isActive: false }
  }

  private async assertAccount(userId: string, accountId: string) {
    const [account] = await this.db
      .select({ id: cashbookAccounts.id })
      .from(cashbookAccounts)
      .where(and(eq(cashbookAccounts.id, accountId), eq(cashbookAccounts.userId, userId)))
      .limit(1)
    if (!account) throw new ValidationError('Account does not belong to this ledger')
  }

  private async assertCategory(userId: string, categoryId: string, kind: 'income' | 'expense') {
    const [category] = await this.db
      .select({ id: cashbookCategories.id, kind: cashbookCategories.kind })
      .from(cashbookCategories)
      .where(and(eq(cashbookCategories.id, categoryId), eq(cashbookCategories.userId, userId)))
      .limit(1)
    if (!category) throw new ValidationError('Category does not belong to this ledger')
    if (category.kind !== kind) throw new ValidationError(`Category must be of kind ${kind}`)
  }

  /** Ensures a generic income/expense category exists so ingestion can always post. */
  async ensureFallbackCategories(userId: string): Promise<{ incomeCategoryId: string; expenseCategoryId: string }> {
    const existing = await this.db
      .select({ id: cashbookCategories.id, name: cashbookCategories.name, kind: cashbookCategories.kind })
      .from(cashbookCategories)
      .where(and(eq(cashbookCategories.userId, userId), eq(cashbookCategories.isArchived, false)))

    const pick = (kind: 'income' | 'expense'): string | null => {
      const names = FALLBACK_CATEGORY_NAMES[kind] as readonly string[]
      const match = existing.find((c) => c.kind === kind && names.includes(c.name))
      return match?.id ?? null
    }

    let incomeCategoryId = pick('income')
    let expenseCategoryId = pick('expense')

    for (const kind of ['income', 'expense'] as const) {
      const current = kind === 'income' ? incomeCategoryId : expenseCategoryId
      if (current) continue
      const fallback = FALLBACK_CATEGORY_DEFAULT[kind]
      const [created] = await this.db
        .insert(cashbookCategories)
        .values({ userId, name: fallback.name, kind, color: fallback.color })
        .onConflictDoNothing()
        .returning({ id: cashbookCategories.id })

      let id = created?.id ?? null
      if (!id) {
        const [row] = await this.db
          .select({ id: cashbookCategories.id })
          .from(cashbookCategories)
          .where(and(
            eq(cashbookCategories.userId, userId),
            eq(cashbookCategories.kind, kind),
            eq(cashbookCategories.name, fallback.name),
          ))
          .limit(1)
        id = row?.id ?? null
      }
      if (!id) throw new ConflictError('Could not provision a fallback category')
      if (kind === 'income') incomeCategoryId = id
      else expenseCategoryId = id
    }

    return { incomeCategoryId: incomeCategoryId!, expenseCategoryId: expenseCategoryId! }
  }

  /* ─────────────────────────── Device tokens ─────────────────────────── */

  async listTokens(userId: string) {
    return this.db
      .select({
        id: financeIngestTokens.id,
        label: financeIngestTokens.label,
        platform: financeIngestTokens.platform,
        tokenPrefix: financeIngestTokens.tokenPrefix,
        lastSeenAt: financeIngestTokens.lastSeenAt,
        messageCount: financeIngestTokens.messageCount,
        isRevoked: financeIngestTokens.isRevoked,
        revokedAt: financeIngestTokens.revokedAt,
        createdAt: financeIngestTokens.createdAt,
      })
      .from(financeIngestTokens)
      .where(eq(financeIngestTokens.userId, userId))
      .orderBy(desc(financeIngestTokens.createdAt))
  }

  async createToken(userId: string, dto: CreateTokenDto) {
    const raw = `bsi_${randomBytes(24).toString('base64url')}`
    const [row] = await this.db
      .insert(financeIngestTokens)
      .values({
        userId,
        label: dto.label,
        platform: dto.platform,
        tokenHash: this.hashToken(raw),
        tokenPrefix: raw.slice(0, 12),
      })
      .returning()

    // The plaintext token is returned exactly once and never stored.
    return {
      id: row!.id,
      label: row!.label,
      platform: row!.platform,
      tokenPrefix: row!.tokenPrefix,
      token: raw,
      createdAt: row!.createdAt,
    }
  }

  async revokeToken(userId: string, tokenId: string) {
    const [row] = await this.db
      .update(financeIngestTokens)
      .set({ isRevoked: true, revokedAt: new Date() })
      .where(and(eq(financeIngestTokens.id, tokenId), eq(financeIngestTokens.userId, userId)))
      .returning({ id: financeIngestTokens.id })
    if (!row) throw new NotFoundError('Ingest token')
    return { id: row.id, isRevoked: true }
  }

  /* ─────────────────────────── Inbox ─────────────────────────── */

  async listMessages(userId: string, query: MessageListQuery) {
    const conditions = [eq(financeMessages.userId, userId)]
    if (query.status) conditions.push(eq(financeMessages.status, query.status))
    if (query.direction) conditions.push(eq(financeMessages.direction, query.direction))
    const where = and(...conditions)!

    const offset = (query.page - 1) * query.limit
    const [rows, countRows] = await Promise.all([
      this.db
        .select({
          id: financeMessages.id,
          sender: financeMessages.sender,
          rawText: financeMessages.rawText,
          receivedAt: financeMessages.receivedAt,
          status: financeMessages.status,
          rejectionReason: financeMessages.rejectionReason,
          direction: financeMessages.direction,
          amountRial: financeMessages.amountRial,
          balanceRial: financeMessages.balanceRial,
          cardLast4: financeMessages.cardLast4,
          externalRef: financeMessages.externalRef,
          parserId: financeMessages.parserId,
          confidence: financeMessages.confidence,
          cashbookEntryId: financeMessages.cashbookEntryId,
          sourceId: financeMessages.sourceId,
          sourceLabel: financeSources.label,
          accountName: cashbookAccounts.name,
          reviewedAt: financeMessages.reviewedAt,
          createdAt: financeMessages.createdAt,
        })
        .from(financeMessages)
        .leftJoin(financeSources, eq(financeMessages.sourceId, financeSources.id))
        .leftJoin(cashbookAccounts, eq(financeSources.accountId, cashbookAccounts.id))
        .where(where)
        .orderBy(desc(financeMessages.receivedAt), desc(financeMessages.createdAt))
        .limit(query.limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(financeMessages)
        .where(where),
    ])

    const total = countRows[0]?.count ?? 0
    return {
      data: rows.map((row) => ({
        ...row,
        amountRial: row.amountRial?.toString() ?? null,
        balanceRial: row.balanceRial?.toString() ?? null,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    }
  }

  async getMessage(userId: string, messageId: string): Promise<MessageRow> {
    const [row] = await this.db
      .select()
      .from(financeMessages)
      .where(and(eq(financeMessages.id, messageId), eq(financeMessages.userId, userId)))
      .limit(1)
    if (!row) throw new NotFoundError('Finance message')
    return row
  }

  async approveMessage(userId: string, messageId: string, dto: ApproveMessageDto) {
    const message = await this.getMessage(userId, messageId)
    if (message.status === 'posted') throw new ConflictError('Message already posted')
    if (message.status === 'ignored') throw new ValidationError('Ignored messages cannot be posted')

    const source = message.sourceId ? await this.loadSource(userId, message.sourceId) : null
    const parsed = (message.parsed ?? {}) as ParsedSms

    const posted = await this.postEntry({
      userId,
      source,
      parsed,
      receivedAt: message.receivedAt,
      rawText: message.rawText,
      overrides: dto,
    })
    if (!posted.entryId) throw new ValidationError(`Could not post message: ${posted.reason ?? 'unknown'}`)

    const [row] = await this.db
      .update(financeMessages)
      .set({
        status: 'posted',
        cashbookEntryId: posted.entryId,
        rejectionReason: null,
        direction: dto.kind ?? message.direction,
        amountRial: dto.amountRial ?? message.amountRial,
        reviewedBy: userId,
        reviewedAt: new Date(),
      })
      .where(and(eq(financeMessages.id, messageId), eq(financeMessages.userId, userId)))
      .returning({ id: financeMessages.id })

    return { messageId: row!.id, entryId: posted.entryId }
  }

  async ignoreMessage(userId: string, messageId: string) {
    await this.getMessage(userId, messageId)
    const [row] = await this.db
      .update(financeMessages)
      .set({ status: 'ignored', rejectionReason: 'manual', reviewedBy: userId, reviewedAt: new Date() })
      .where(and(eq(financeMessages.id, messageId), eq(financeMessages.userId, userId)))
      .returning({ id: financeMessages.id })
    return { messageId: row!.id, status: 'ignored' as const }
  }

  async stats(userId: string) {
    const rows = await this.db
      .select({ status: financeMessages.status, count: sql<number>`count(*)::int` })
      .from(financeMessages)
      .where(eq(financeMessages.userId, userId))
      .groupBy(financeMessages.status)

    const counts: Record<string, number> = { posted: 0, review: 0, duplicate: 0, ignored: 0, failed: 0 }
    for (const row of rows) counts[row.status] = row.count
    return counts
  }
}

/** Formats an instant as the Tehran-local calendar date (`YYYY-MM-DD`). */
export function tehranDateString(date: Date): string {
  return new Date(date.getTime() + TEHRAN_OFFSET_MS).toISOString().slice(0, 10)
}

/**
 * Parsed payloads round-trip through JSON, so `occurredAt` may come back as an
 * ISO string. Coerce defensively before using date arithmetic on it.
 */
function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

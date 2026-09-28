import ExcelJS from 'exceljs'
import type { DB } from '../../db/client'
import {
  cashbookAccounts,
  cashbookBudgets,
  cashbookCategories,
  cashbookEntries,
  cashbookReceipts,
} from '../../db/schema'
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors'
import { cashbookReceiptStorage } from './cashbook-receipt.service'
import type {
  CashbookAccountDto,
  CashbookBudgetDto,
  CashbookCategoryDto,
  CashbookExportQuery,
  CashbookKind,
  CashbookListQuery,
  CashbookStatus,
  CashbookSummaryQuery,
  CreateCashbookEntryDto,
  UpdateCashbookAccountDto,
  UpdateCashbookCategoryDto,
  UpdateCashbookEntryDto,
} from './cashbook.schema'

type DateRange = { from: string; to: string }

type EntryRow = {
  id: string
  userId: string
  entryDate: string
  kind: string
  amountRial: bigint
  categoryId: string
  categoryName: string
  categoryColor: string | null
  accountId: string
  accountName: string
  accountType: string
  description: string
  notes: string | null
  reference: string | null
  status: string
  voidReason: string | null
  voidedAt: Date | null
  createdAt: Date
  updatedAt: Date
  receiptId: string | null
  receiptOriginalName: string | null
  receiptMimeType: string | null
  receiptFileSize: number | null
}

function money(value: bigint | string | number | null | undefined): string {
  return String(value ?? 0n)
}

function spreadsheetAmount(value: string): number | string {
  const amount = BigInt(value)
  return amount <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(amount) : value
}

function dateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function todayString(): string {
  return dateString(new Date())
}

function addDays(date: Date, days: number): string {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return dateString(next)
}

function monthRange(month: string): DateRange {
  const [year, monthNumber] = month.split('-').map(Number)
  const from = new Date(Date.UTC(year, monthNumber - 1, 1))
  const to = new Date(Date.UTC(year, monthNumber, 0))
  return { from: dateString(from), to: dateString(to) }
}

function resolveRange(query: { from?: string; to?: string; month?: string }): DateRange {
  const month = query.month ? monthRange(query.month) : undefined
  const range = {
    from: query.from || month?.from || addDays(new Date(), -29),
    to: query.to || month?.to || todayString(),
  }

  if (range.from > range.to) {
    throw new ValidationError('The start date must not be after the end date')
  }

  return range
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; cause?: { code?: string } }
  return candidate.code === '23505' || candidate.cause?.code === '23505'
}

function mapCategory(row: {
  id: string
  name: string
  kind: string
  color: string | null
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    color: row.color,
    isArchived: row.isArchived,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapAccount(row: {
  id: string
  name: string
  type: string
  openingBalanceRial: bigint
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    openingBalanceRial: money(row.openingBalanceRial),
    isArchived: row.isArchived,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapReceipt(row: {
  id: string
  originalName: string
  mimeType: string
  fileSize: number
}) {
  return {
    id: row.id,
    originalName: row.originalName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
  }
}

function mapEntry(row: EntryRow) {
  return {
    id: row.id,
    userId: row.userId,
    entryDate: row.entryDate,
    kind: row.kind,
    amountRial: money(row.amountRial),
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categoryColor: row.categoryColor,
    accountId: row.accountId,
    accountName: row.accountName,
    accountType: row.accountType,
    description: row.description,
    notes: row.notes,
    reference: row.reference,
    status: row.status,
    voidReason: row.voidReason,
    voidedAt: row.voidedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    receipt: row.receiptId
      ? {
          id: row.receiptId,
          originalName: row.receiptOriginalName,
          mimeType: row.receiptMimeType,
          fileSize: row.receiptFileSize,
        }
      : null,
  }
}

export class CashbookService {
  constructor(private db: DB) {}

  resolveOwnerId(actorId: string, actorRole: string, requestedOwnerId?: string): string {
    if (!requestedOwnerId || requestedOwnerId === actorId) return actorId
    if (actorRole !== 'admin_doctor') {
      throw new ForbiddenError('You can only access your own cashbook')
    }
    return requestedOwnerId
  }

  private entrySelect() {
    return {
      id: cashbookEntries.id,
      userId: cashbookEntries.userId,
      entryDate: cashbookEntries.entryDate,
      kind: cashbookEntries.kind,
      amountRial: cashbookEntries.amountRial,
      categoryId: cashbookEntries.categoryId,
      categoryName: cashbookCategories.name,
      categoryColor: cashbookCategories.color,
      accountId: cashbookEntries.accountId,
      accountName: cashbookAccounts.name,
      accountType: cashbookAccounts.type,
      description: cashbookEntries.description,
      notes: cashbookEntries.notes,
      reference: cashbookEntries.reference,
      status: cashbookEntries.status,
      voidReason: cashbookEntries.voidReason,
      voidedAt: cashbookEntries.voidedAt,
      createdAt: cashbookEntries.createdAt,
      updatedAt: cashbookEntries.updatedAt,
      receiptId: cashbookReceipts.id,
      receiptOriginalName: cashbookReceipts.originalName,
      receiptMimeType: cashbookReceipts.mimeType,
      receiptFileSize: cashbookReceipts.fileSize,
    }
  }

  async getEntry(id: string, actorId: string, actorRole: string, requestedOwnerId?: string) {
    const ownerId = this.resolveOwnerId(actorId, actorRole, requestedOwnerId)
    const [row] = await this.db
      .select(this.entrySelect())
      .from(cashbookEntries)
      .innerJoin(cashbookCategories, eq(cashbookEntries.categoryId, cashbookCategories.id))
      .innerJoin(cashbookAccounts, eq(cashbookEntries.accountId, cashbookAccounts.id))
      .leftJoin(cashbookReceipts, eq(cashbookEntries.id, cashbookReceipts.entryId))
      .where(and(eq(cashbookEntries.id, id), eq(cashbookEntries.userId, ownerId)))
      .limit(1)

    if (!row) throw new NotFoundError('Cashbook entry')
    return mapEntry(row as EntryRow)
  }

  async listEntries(ownerId: string, query: CashbookListQuery) {
    const conditions: SQL[] = [eq(cashbookEntries.userId, ownerId)]
    if (query.from) conditions.push(gte(cashbookEntries.entryDate, query.from))
    if (query.to) conditions.push(lte(cashbookEntries.entryDate, query.to))
    if (query.kind) conditions.push(eq(cashbookEntries.kind, query.kind))
    if (query.status) conditions.push(eq(cashbookEntries.status, query.status))
    if (query.categoryId) conditions.push(eq(cashbookEntries.categoryId, query.categoryId))
    if (query.accountId) conditions.push(eq(cashbookEntries.accountId, query.accountId))
    if (query.search) {
      const search = `%${query.search}%`
      conditions.push(
        or(
          ilike(cashbookEntries.description, search),
          ilike(cashbookEntries.notes, search),
          ilike(cashbookEntries.reference, search),
        )!,
      )
    }

    const where = and(...conditions)!
    const offset = (query.page - 1) * query.limit
    const [rows, countRows] = await Promise.all([
      this.db
        .select(this.entrySelect())
        .from(cashbookEntries)
        .innerJoin(cashbookCategories, eq(cashbookEntries.categoryId, cashbookCategories.id))
        .innerJoin(cashbookAccounts, eq(cashbookEntries.accountId, cashbookAccounts.id))
        .leftJoin(cashbookReceipts, eq(cashbookEntries.id, cashbookReceipts.entryId))
        .where(where)
        .orderBy(desc(cashbookEntries.entryDate), desc(cashbookEntries.createdAt), desc(cashbookEntries.id))
        .limit(query.limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(cashbookEntries)
        .where(where),
    ])

    const total = countRows[0]?.count || 0
    return {
      data: rows.map((row) => mapEntry(row as EntryRow)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    }
  }

  private async allEntries(ownerId: string, query: Omit<CashbookListQuery, 'page' | 'limit'>) {
    const conditions: SQL[] = [eq(cashbookEntries.userId, ownerId)]
    if (query.from) conditions.push(gte(cashbookEntries.entryDate, query.from))
    if (query.to) conditions.push(lte(cashbookEntries.entryDate, query.to))
    if (query.kind) conditions.push(eq(cashbookEntries.kind, query.kind))
    if (query.status) conditions.push(eq(cashbookEntries.status, query.status))
    if (query.categoryId) conditions.push(eq(cashbookEntries.categoryId, query.categoryId))
    if (query.accountId) conditions.push(eq(cashbookEntries.accountId, query.accountId))
    if (query.search) {
      const search = `%${query.search}%`
      conditions.push(
        or(
          ilike(cashbookEntries.description, search),
          ilike(cashbookEntries.notes, search),
          ilike(cashbookEntries.reference, search),
        )!,
      )
    }
    const where = and(...conditions)!
    return this.db
      .select(this.entrySelect())
      .from(cashbookEntries)
      .innerJoin(cashbookCategories, eq(cashbookEntries.categoryId, cashbookCategories.id))
      .innerJoin(cashbookAccounts, eq(cashbookEntries.accountId, cashbookAccounts.id))
      .leftJoin(cashbookReceipts, eq(cashbookEntries.id, cashbookReceipts.entryId))
      .where(where)
      .orderBy(desc(cashbookEntries.entryDate), desc(cashbookEntries.createdAt), desc(cashbookEntries.id))
  }

  async createEntry(ownerId: string, dto: CreateCashbookEntryDto) {
    const category = await this.getCategoryOrThrow(ownerId, dto.categoryId)
    if (category.kind !== dto.kind) throw new ValidationError('Category type does not match entry type')
    if (category.isArchived) throw new ValidationError('Archived categories cannot be used for new entries')
    const account = await this.getAccountOrThrow(ownerId, dto.accountId)
    if (account.isArchived) throw new ValidationError('Archived accounts cannot be used for new entries')

    try {
      const [entry] = await this.db
        .insert(cashbookEntries)
        .values({
          userId: ownerId,
          entryDate: dto.entryDate,
          kind: dto.kind,
          amountRial: dto.amountRial,
          categoryId: dto.categoryId,
          accountId: dto.accountId,
          description: dto.description,
          notes: dto.notes ?? null,
          reference: dto.reference ?? null,
        })
        .returning({ id: cashbookEntries.id })

      return this.getEntry(entry!.id, ownerId, 'admin_doctor')
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError('Cashbook entry could not be created')
      throw error
    }
  }

  async updateEntry(id: string, ownerId: string, dto: UpdateCashbookEntryDto) {
    const current = await this.getEntry(id, ownerId, 'admin_doctor')
    if (current.status === 'voided') throw new ValidationError('Voided entries cannot be edited')
    if (Object.keys(dto).length === 0) throw new ValidationError('No fields to update')

    const nextKind = dto.kind ?? (current.kind as CashbookKind)
    const nextCategoryId = dto.categoryId || current.categoryId
    const nextAccountId = dto.accountId || current.accountId
    const category = await this.getCategoryOrThrow(ownerId, nextCategoryId)
    if (category.kind !== nextKind) throw new ValidationError('Category type does not match entry type')
    if (category.isArchived) throw new ValidationError('Archived categories cannot be used')
    const account = await this.getAccountOrThrow(ownerId, nextAccountId)
    if (account.isArchived) throw new ValidationError('Archived accounts cannot be used')

    const values: Record<string, unknown> = { updatedAt: new Date() }
    if (dto.entryDate !== undefined) values.entryDate = dto.entryDate
    if (dto.kind !== undefined) values.kind = dto.kind
    if (dto.amountRial !== undefined) values.amountRial = dto.amountRial
    if (dto.categoryId !== undefined) values.categoryId = dto.categoryId
    if (dto.accountId !== undefined) values.accountId = dto.accountId
    if (dto.description !== undefined) values.description = dto.description
    if (dto.notes !== undefined) values.notes = dto.notes
    if (dto.reference !== undefined) values.reference = dto.reference

    const [updated] = await this.db
      .update(cashbookEntries)
      .set(values)
      .where(and(
        eq(cashbookEntries.id, id),
        eq(cashbookEntries.userId, ownerId),
        eq(cashbookEntries.status, 'active'),
      ))
      .returning({ id: cashbookEntries.id })
    if (!updated) {
      const latest = await this.getEntry(id, ownerId, 'admin_doctor')
      if (latest.status === 'voided') throw new ValidationError('Voided entries cannot be edited')
      throw new NotFoundError('Cashbook entry')
    }
    return this.getEntry(id, ownerId, 'admin_doctor')
  }

  async voidEntry(id: string, ownerId: string, reason: string) {
    const [entry] = await this.db
      .select({ id: cashbookEntries.id, status: cashbookEntries.status })
      .from(cashbookEntries)
      .where(and(eq(cashbookEntries.id, id), eq(cashbookEntries.userId, ownerId)))
      .limit(1)
    if (!entry) throw new NotFoundError('Cashbook entry')
    if (entry.status === 'voided') return this.getEntry(id, ownerId, 'admin_doctor')

    const [updated] = await this.db
      .update(cashbookEntries)
      .set({ status: 'voided', voidReason: reason, voidedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(cashbookEntries.id, id),
        eq(cashbookEntries.userId, ownerId),
        eq(cashbookEntries.status, 'active'),
      ))
      .returning({ id: cashbookEntries.id })
    if (!updated) return this.getEntry(id, ownerId, 'admin_doctor')
    return this.getEntry(id, ownerId, 'admin_doctor')
  }

  async listCategories(ownerId: string, includeArchived = false) {
    const conditions: SQL[] = [eq(cashbookCategories.userId, ownerId)]
    if (!includeArchived) conditions.push(eq(cashbookCategories.isArchived, false))
    const rows = await this.db
      .select()
      .from(cashbookCategories)
      .where(and(...conditions))
      .orderBy(asc(cashbookCategories.kind), asc(cashbookCategories.name))
    return rows.map(mapCategory)
  }

  private async getCategoryOrThrow(ownerId: string, id: string) {
    const [category] = await this.db
      .select()
      .from(cashbookCategories)
      .where(and(eq(cashbookCategories.id, id), eq(cashbookCategories.userId, ownerId)))
      .limit(1)
    if (!category) throw new NotFoundError('Cashbook category')
    return category
  }

  async createCategory(ownerId: string, dto: CashbookCategoryDto) {
    try {
      const [category] = await this.db
        .insert(cashbookCategories)
        .values({ userId: ownerId, name: dto.name, kind: dto.kind, color: dto.color ?? null, isArchived: dto.isArchived ?? false })
        .returning()
      return mapCategory(category!)
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError('A category with this name already exists')
      throw error
    }
  }

  async updateCategory(id: string, ownerId: string, dto: UpdateCashbookCategoryDto) {
    const current = await this.getCategoryOrThrow(ownerId, id)
    if (Object.keys(dto).length === 0) throw new ValidationError('No fields to update')
    const nextKind = dto.kind || current.kind
    if (current.kind !== nextKind) {
      const [entryUsage, budgetUsage] = await Promise.all([
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(cashbookEntries)
          .where(and(eq(cashbookEntries.userId, ownerId), eq(cashbookEntries.categoryId, id))),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(cashbookBudgets)
          .where(and(eq(cashbookBudgets.userId, ownerId), eq(cashbookBudgets.categoryId, id))),
      ])
      if ((entryUsage[0]?.count || 0) > 0 || (budgetUsage[0]?.count || 0) > 0) {
        throw new ValidationError('A category with entries or budgets cannot change type')
      }
    }
    const values: Record<string, unknown> = { updatedAt: new Date() }
    if (dto.name !== undefined) values.name = dto.name
    if (dto.kind !== undefined) values.kind = dto.kind
    if (dto.color !== undefined) values.color = dto.color
    if (dto.isArchived !== undefined) values.isArchived = dto.isArchived
    try {
      const [category] = await this.db
        .update(cashbookCategories)
        .set(values)
        .where(and(eq(cashbookCategories.id, id), eq(cashbookCategories.userId, ownerId)))
        .returning()
      return mapCategory(category!)
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError('A category with this name already exists')
      throw error
    }
  }

  async listAccounts(ownerId: string, includeArchived = false) {
    const conditions: SQL[] = [eq(cashbookAccounts.userId, ownerId)]
    if (!includeArchived) conditions.push(eq(cashbookAccounts.isArchived, false))
    const rows = await this.db
      .select()
      .from(cashbookAccounts)
      .where(and(...conditions))
      .orderBy(asc(cashbookAccounts.name))
    return rows.map(mapAccount)
  }

  private async getAccountOrThrow(ownerId: string, id: string) {
    const [account] = await this.db
      .select()
      .from(cashbookAccounts)
      .where(and(eq(cashbookAccounts.id, id), eq(cashbookAccounts.userId, ownerId)))
      .limit(1)
    if (!account) throw new NotFoundError('Cashbook account')
    return account
  }

  async createAccount(ownerId: string, dto: CashbookAccountDto) {
    try {
      const [account] = await this.db
        .insert(cashbookAccounts)
        .values({
          userId: ownerId,
          name: dto.name,
          type: dto.type,
          openingBalanceRial: dto.openingBalanceRial,
          isArchived: dto.isArchived ?? false,
        })
        .returning()
      return mapAccount(account!)
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError('An account with this name already exists')
      throw error
    }
  }

  async updateAccount(id: string, ownerId: string, dto: UpdateCashbookAccountDto) {
    await this.getAccountOrThrow(ownerId, id)
    if (Object.keys(dto).length === 0) throw new ValidationError('No fields to update')
    const values: Record<string, unknown> = { updatedAt: new Date() }
    if (dto.name !== undefined) values.name = dto.name
    if (dto.type !== undefined) values.type = dto.type
    if (dto.openingBalanceRial !== undefined) values.openingBalanceRial = dto.openingBalanceRial
    if (dto.isArchived !== undefined) values.isArchived = dto.isArchived
    try {
      const [account] = await this.db
        .update(cashbookAccounts)
        .set(values)
        .where(and(eq(cashbookAccounts.id, id), eq(cashbookAccounts.userId, ownerId)))
        .returning()
      return mapAccount(account!)
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError('An account with this name already exists')
      throw error
    }
  }

  async getBudgets(ownerId: string, month: string, rangeOverride?: DateRange) {
    const range = rangeOverride || monthRange(month)
    if (range.from > range.to) {
      throw new ValidationError('The start date must not be after the end date')
    }
    const [budgetRows, actualRows] = await Promise.all([
      this.db
        .select({
          id: cashbookBudgets.id,
          categoryId: cashbookBudgets.categoryId,
          categoryName: cashbookCategories.name,
          kind: cashbookCategories.kind,
          color: cashbookCategories.color,
          month: cashbookBudgets.month,
          amountRial: cashbookBudgets.amountRial,
        })
        .from(cashbookBudgets)
        .innerJoin(cashbookCategories, eq(cashbookBudgets.categoryId, cashbookCategories.id))
        .where(and(eq(cashbookBudgets.userId, ownerId), eq(cashbookBudgets.month, month)))
        .orderBy(asc(cashbookCategories.name)),
      this.db
        .select({
          categoryId: cashbookEntries.categoryId,
          amountRial: sql<string>`coalesce(sum(${cashbookEntries.amountRial}), 0)::text`,
        })
        .from(cashbookEntries)
        .where(and(
          eq(cashbookEntries.userId, ownerId),
          eq(cashbookEntries.status, 'active'),
          eq(cashbookEntries.kind, 'expense'),
          gte(cashbookEntries.entryDate, range.from),
          lte(cashbookEntries.entryDate, range.to),
        ))
        .groupBy(cashbookEntries.categoryId),
    ])
    const actual = new Map(actualRows.map((row) => [row.categoryId, BigInt(row.amountRial)]))
    return budgetRows.map((row) => {
      const spentRial = actual.get(row.categoryId) || 0n
      const amountRial = row.amountRial
      return {
        id: row.id,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        kind: row.kind,
        color: row.color,
        month: row.month,
        amountRial: money(amountRial),
        spentRial: money(spentRial),
        remainingRial: money(amountRial - spentRial),
      }
    })
  }

  async upsertBudget(ownerId: string, dto: CashbookBudgetDto) {
    const category = await this.getCategoryOrThrow(ownerId, dto.categoryId)
    if (category.kind !== 'expense') throw new ValidationError('Budgets can only be set for expense categories')
    const [budget] = await this.db
      .insert(cashbookBudgets)
      .values({ userId: ownerId, categoryId: dto.categoryId, month: dto.month, amountRial: dto.amountRial })
      .onConflictDoUpdate({
        target: [cashbookBudgets.userId, cashbookBudgets.categoryId, cashbookBudgets.month],
        set: { amountRial: dto.amountRial, updatedAt: new Date() },
      })
      .returning({ id: cashbookBudgets.id })

    const savedBudget = (await this.getBudgets(ownerId, dto.month)).find((item) => item.id === budget!.id)
    if (!savedBudget) throw new NotFoundError('Cashbook budget')
    return savedBudget
  }

  async deleteBudget(id: string, ownerId: string) {
    const [deleted] = await this.db
      .delete(cashbookBudgets)
      .where(and(eq(cashbookBudgets.id, id), eq(cashbookBudgets.userId, ownerId)))
      .returning({ id: cashbookBudgets.id })
    if (!deleted) throw new NotFoundError('Cashbook budget')
    return deleted
  }

  async getSummary(ownerId: string, query: CashbookSummaryQuery) {
    const range = resolveRange(query)
    const conditions = and(
      eq(cashbookEntries.userId, ownerId),
      eq(cashbookEntries.status, 'active'),
      gte(cashbookEntries.entryDate, range.from),
      lte(cashbookEntries.entryDate, range.to),
    )!

    const [totalsRows, categoryRows, dayRows, accountRows] = await Promise.all([
      this.db
        .select({
          incomeRial: sql<string>`coalesce(sum(${cashbookEntries.amountRial}) filter (where ${cashbookEntries.kind} = 'income'), 0)::text`,
          expenseRial: sql<string>`coalesce(sum(${cashbookEntries.amountRial}) filter (where ${cashbookEntries.kind} = 'expense'), 0)::text`,
          entryCount: sql<number>`count(*)::int`,
        })
        .from(cashbookEntries)
        .where(conditions),
      this.db
        .select({
          categoryId: cashbookEntries.categoryId,
          categoryName: cashbookCategories.name,
          kind: cashbookEntries.kind,
          color: cashbookCategories.color,
          amountRial: sql<string>`coalesce(sum(${cashbookEntries.amountRial}), 0)::text`,
        })
        .from(cashbookEntries)
        .innerJoin(cashbookCategories, eq(cashbookEntries.categoryId, cashbookCategories.id))
        .where(conditions)
        .groupBy(cashbookEntries.categoryId, cashbookCategories.name, cashbookEntries.kind, cashbookCategories.color)
        .orderBy(desc(sql`sum(${cashbookEntries.amountRial})`)),
      this.db
        .select({
          date: cashbookEntries.entryDate,
          incomeRial: sql<string>`coalesce(sum(${cashbookEntries.amountRial}) filter (where ${cashbookEntries.kind} = 'income'), 0)::text`,
          expenseRial: sql<string>`coalesce(sum(${cashbookEntries.amountRial}) filter (where ${cashbookEntries.kind} = 'expense'), 0)::text`,
        })
        .from(cashbookEntries)
        .where(conditions)
        .groupBy(cashbookEntries.entryDate)
        .orderBy(asc(cashbookEntries.entryDate)),
      this.db
        .select({
          id: cashbookAccounts.id,
          name: cashbookAccounts.name,
          type: cashbookAccounts.type,
          openingBalanceRial: cashbookAccounts.openingBalanceRial,
          balanceRial: sql<string>`(${cashbookAccounts.openingBalanceRial} + coalesce(sum(case when ${cashbookEntries.kind} = 'income' then ${cashbookEntries.amountRial} else 0 end), 0) - coalesce(sum(case when ${cashbookEntries.kind} = 'expense' then ${cashbookEntries.amountRial} else 0 end), 0))::text`,
        })
        .from(cashbookAccounts)
        .leftJoin(
          cashbookEntries,
          and(
            eq(cashbookEntries.accountId, cashbookAccounts.id),
            eq(cashbookEntries.userId, ownerId),
            eq(cashbookEntries.status, 'active'),
          ),
        )
        .where(eq(cashbookAccounts.userId, ownerId))
        .groupBy(cashbookAccounts.id, cashbookAccounts.name, cashbookAccounts.type, cashbookAccounts.openingBalanceRial)
        .orderBy(asc(cashbookAccounts.name)),
    ])

    const totals = totalsRows[0] || { incomeRial: '0', expenseRial: '0', entryCount: 0 }
    const incomeRial = BigInt(totals.incomeRial)
    const expenseRial = BigInt(totals.expenseRial)
    const month = query.month || range.from.slice(0, 7)
    const budgets = await this.getBudgets(ownerId, month, range)

    return {
      period: range,
      totals: {
        incomeRial: money(incomeRial),
        expenseRial: money(expenseRial),
        netRial: money(incomeRial - expenseRial),
        entryCount: totals.entryCount,
      },
      byDay: dayRows.map((row) => ({ ...row })),
      byCategory: categoryRows.map((row) => ({ ...row, amountRial: money(row.amountRial) })),
      accounts: accountRows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        openingBalanceRial: money(row.openingBalanceRial),
        balanceRial: money(row.balanceRial),
      })),
      budgets,
    }
  }

  async uploadReceipt(entryId: string, actorId: string, actorRole: string, buffer: Buffer, originalName: string) {
    const [entry] = await this.db
      .select({ userId: cashbookEntries.userId, status: cashbookEntries.status })
      .from(cashbookEntries)
      .where(eq(cashbookEntries.id, entryId))
      .limit(1)
    if (!entry) throw new NotFoundError('Cashbook entry')
    if (entry.userId !== actorId) {
      throw new ForbiddenError('Only the owner can attach a receipt')
    }
    if (entry.status !== 'active') throw new ValidationError('Receipts cannot be attached to voided entries')

    const [existing] = await this.db
      .select({ id: cashbookReceipts.id })
      .from(cashbookReceipts)
      .where(eq(cashbookReceipts.entryId, entryId))
      .limit(1)
    if (existing) throw new ConflictError('This entry already has a receipt')

    const stored = await cashbookReceiptStorage.save(buffer, originalName)
    try {
      const receipt = await this.db.transaction(async (tx) => {
        const [lockedEntry] = await tx
          .select({ userId: cashbookEntries.userId, status: cashbookEntries.status })
          .from(cashbookEntries)
          .where(eq(cashbookEntries.id, entryId))
          .limit(1)
          .for('update')
        if (!lockedEntry) throw new NotFoundError('Cashbook entry')
        if (lockedEntry.userId !== actorId) throw new ForbiddenError('Only the owner can attach a receipt')
        if (lockedEntry.status !== 'active') throw new ValidationError('Receipts cannot be attached to voided entries')

        const [lockedReceipt] = await tx
          .select({ id: cashbookReceipts.id })
          .from(cashbookReceipts)
          .where(eq(cashbookReceipts.entryId, entryId))
          .limit(1)
        if (lockedReceipt) throw new ConflictError('This entry already has a receipt')

        const [created] = await tx.insert(cashbookReceipts).values({
          entryId,
          userId: lockedEntry.userId,
          storageKey: stored.storageKey,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          fileSize: stored.fileSize,
          fileHash: stored.fileHash,
        }).returning()
        return created!
      })
      return mapReceipt(receipt)
    } catch (error) {
      await cashbookReceiptStorage.remove(stored.storageKey)
      if (isUniqueViolation(error)) throw new ConflictError('This entry already has a receipt')
      throw error
    }
  }

  async getReceipt(receiptId: string, actorId: string, actorRole: string, requestedOwnerId?: string) {
    const [receipt] = await this.db
      .select()
      .from(cashbookReceipts)
      .where(eq(cashbookReceipts.id, receiptId))
      .limit(1)
    if (!receipt) throw new NotFoundError('Cashbook receipt')
    this.resolveOwnerId(actorId, actorRole, requestedOwnerId || receipt.userId)
    if (actorRole !== 'admin_doctor' && receipt.userId !== actorId) {
      throw new ForbiddenError('You can only access your own receipt')
    }
    const file = await cashbookReceiptStorage.open(receipt.storageKey)
    if (!file) throw new NotFoundError('Cashbook receipt file')
    return { receipt, file }
  }

  async exportEntries(ownerId: string, query: CashbookExportQuery) {
    const range = resolveRange(query)
    const rows = (await this.allEntries(ownerId, {
      from: range.from,
      to: range.to,
      kind: query.kind,
      status: query.status,
      categoryId: query.categoryId,
      accountId: query.accountId,
      search: query.search,
    })).map((row) => mapEntry(row as EntryRow))

    if (query.format === 'csv') {
      const header = ['Date', 'Type', 'Amount (Rial)', 'Category', 'Account', 'Description', 'Reference', 'Status']
      const lines = rows.map((row) => [
        row.entryDate,
        row.kind,
        row.amountRial,
        row.categoryName,
        row.accountName,
        row.description,
        row.reference || '',
        row.status,
      ].map(csvValue).join(','))
      return Buffer.concat([Buffer.from('\uFEFF'), Buffer.from([header.map(csvValue).join(','), ...lines].join('\n'), 'utf8')])
    }

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Medical CRM Cashbook'
    const sheet = workbook.addWorksheet('Cashbook')
    sheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Amount (Rial)', key: 'amount', width: 20 },
      { header: 'Category', key: 'category', width: 24 },
      { header: 'Account', key: 'account', width: 24 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Reference', key: 'reference', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
    ]
    rows.forEach((row) => sheet.addRow({
      date: row.entryDate,
      type: row.kind,
      amount: spreadsheetAmount(row.amountRial),
      category: row.categoryName,
      account: row.accountName,
      description: row.description,
      reference: row.reference || '',
      status: row.status,
    }))
    sheet.getRow(1).font = { bold: true }
    sheet.autoFilter = { from: 'A1', to: 'H1' }
    return Buffer.from(await workbook.xlsx.writeBuffer())
  }
}

function csvValue(value: unknown): string {
  const text = String(value ?? '')
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

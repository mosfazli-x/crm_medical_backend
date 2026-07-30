import type { DB } from '../../db/client'
import {
  chartOfAccounts,
  journalEntries,
  journalEntryLines,
  users,
} from '../../db/schema'
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm'
import { NotFoundError, ValidationError } from '../../shared/errors'
import type { AccountDto, JournalEntryDto } from './accounting.schema'

export class AccountingService {
  constructor(private db: DB) {}

  // ─── Chart of Accounts ───

  async getAccounts(type?: string) {
    const conditions: ReturnType<typeof eq>[] = [eq(chartOfAccounts.isActive, true)]
    if (type) conditions.push(eq(chartOfAccounts.type, type))
    return this.db
      .select()
      .from(chartOfAccounts)
      .where(and(...conditions))
      .orderBy(chartOfAccounts.code)
  }

  async getAccountById(id: string) {
    const [account] = await this.db
      .select()
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.id, id))
      .limit(1)
    if (!account) throw new NotFoundError('Account')
    return account
  }

  async createAccount(dto: AccountDto) {
    const [account] = await this.db
      .insert(chartOfAccounts)
      .values({
        code: dto.code,
        name: dto.name,
        type: dto.type,
        parentId: dto.parent_id || null,
        description: dto.description || null,
      })
      .returning()
    return account
  }

  async updateAccount(id: string, dto: Partial<AccountDto>) {
    const updates: Record<string, unknown> = {}
    if (dto.code !== undefined) updates.code = dto.code
    if (dto.name !== undefined) updates.name = dto.name
    if (dto.type !== undefined) updates.type = dto.type
    if (dto.parent_id !== undefined) updates.parentId = dto.parent_id
    if (dto.description !== undefined) updates.description = dto.description
    updates.updatedAt = new Date()

    const [account] = await this.db
      .update(chartOfAccounts)
      .set(updates)
      .where(eq(chartOfAccounts.id, id))
      .returning()
    if (!account) throw new NotFoundError('Account')
    return account
  }

  async deleteAccount(id: string) {
    const [account] = await this.db
      .update(chartOfAccounts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(chartOfAccounts.id, id))
      .returning()
    if (!account) throw new NotFoundError('Account')
    return account
  }

  // ─── Journal Entries ───

  async getJournalEntries(startDate?: string, endDate?: string, status?: string) {
    const conditions: ReturnType<typeof eq | typeof gte | typeof lte>[] = []
    if (startDate) conditions.push(gte(journalEntries.entryDate, startDate))
    if (endDate) conditions.push(lte(journalEntries.entryDate, endDate))
    if (status) conditions.push(eq(journalEntries.status, status))

    const query = this.db
      .select({
        id: journalEntries.id,
        entryNumber: journalEntries.entryNumber,
        entryDate: journalEntries.entryDate,
        description: journalEntries.description,
        reference: journalEntries.reference,
        referenceType: journalEntries.referenceType,
        status: journalEntries.status,
        createdAt: journalEntries.createdAt,
        createdBy: users.fullName,
        lineCount: sql<number>`(SELECT COUNT(*) FROM journal_entry_lines WHERE journal_entry_lines.journal_entry_id = journal_entries.id)`,
        totalDebit: sql<string>`COALESCE((SELECT SUM(debit) FROM journal_entry_lines WHERE journal_entry_lines.journal_entry_id = journal_entries.id), 0)`,
        totalCredit: sql<string>`COALESCE((SELECT SUM(credit) FROM journal_entry_lines WHERE journal_entry_lines.journal_entry_id = journal_entries.id), 0)`,
      })
      .from(journalEntries)
      .leftJoin(users, eq(journalEntries.createdById, users.id))
      .orderBy(desc(journalEntries.entryDate))

    if (conditions.length > 0) return query.where(and(...conditions))
    return query
  }

  async getJournalEntryById(id: string) {
    const [entry] = await this.db
      .select({
        id: journalEntries.id,
        entryNumber: journalEntries.entryNumber,
        entryDate: journalEntries.entryDate,
        description: journalEntries.description,
        reference: journalEntries.reference,
        referenceType: journalEntries.referenceType,
        status: journalEntries.status,
        createdById: journalEntries.createdById,
        createdAt: journalEntries.createdAt,
        updatedAt: journalEntries.updatedAt,
      })
      .from(journalEntries)
      .where(eq(journalEntries.id, id))
      .limit(1)
    if (!entry) throw new NotFoundError('Journal entry')

    const lines = await this.db
      .select({
        id: journalEntryLines.id,
        accountId: journalEntryLines.accountId,
        accountCode: chartOfAccounts.code,
        accountName: chartOfAccounts.name,
        accountType: chartOfAccounts.type,
        debit: journalEntryLines.debit,
        credit: journalEntryLines.credit,
        description: journalEntryLines.description,
      })
      .from(journalEntryLines)
      .leftJoin(chartOfAccounts, eq(journalEntryLines.accountId, chartOfAccounts.id))
      .where(eq(journalEntryLines.journalEntryId, id))

    return { ...entry, lines }
  }

  async createJournalEntry(dto: JournalEntryDto, userId: string) {
    const totalDebit = dto.lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = dto.lines.reduce((s, l) => s + l.credit, 0)

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new ValidationError('Journal entry is not balanced. Total debits must equal total credits.')
    }

    const entryNumber = await this.generateEntryNumber()

    const [entry] = await this.db
      .insert(journalEntries)
      .values({
        entryNumber,
        entryDate: dto.entry_date,
        description: dto.description,
        reference: dto.reference || null,
        referenceType: dto.reference_type || null,
        createdById: userId,
        status: 'posted',
      })
      .returning()

    if (dto.lines.length > 0) {
      await this.db.insert(journalEntryLines).values(
        dto.lines.map((line) => ({
          journalEntryId: entry.id,
          accountId: line.account_id,
          debit: String(line.debit),
          credit: String(line.credit),
          description: line.description || null,
        }))
      )
    }

    return this.getJournalEntryById(entry.id)
  }

  private async generateEntryNumber(): Promise<string> {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const prefix = `JE-${year}${month}${day}-`

    const [last] = await this.db
      .select({ num: journalEntries.entryNumber })
      .from(journalEntries)
      .where(sql`${journalEntries.entryNumber} LIKE ${prefix}%`)
      .orderBy(desc(journalEntries.entryNumber))
      .limit(1)

    let seq = 1
    if (last) {
      const parts = last.num.split('-')
      seq = parseInt(parts[parts.length - 1], 10) + 1
    }

    return `${prefix}${String(seq).padStart(4, '0')}`
  }

  // ─── Reports ───

  async getIncomeStatement(startDate: string, endDate: string) {
    const revenueAccounts = await this.db
      .select({
        id: chartOfAccounts.id,
        code: chartOfAccounts.code,
        name: chartOfAccounts.name,
        balance: sql<string>`COALESCE(SUM(journal_entry_lines.credit) - SUM(journal_entry_lines.debit), 0)`,
      })
      .from(chartOfAccounts)
      .leftJoin(journalEntryLines, eq(chartOfAccounts.id, journalEntryLines.accountId))
      .leftJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(chartOfAccounts.type, 'revenue'),
          eq(chartOfAccounts.isActive, true),
          gte(journalEntries.entryDate, startDate),
          lte(journalEntries.entryDate, endDate),
        )
      )
      .groupBy(chartOfAccounts.id, chartOfAccounts.code, chartOfAccounts.name)

    const expenseAccounts = await this.db
      .select({
        id: chartOfAccounts.id,
        code: chartOfAccounts.code,
        name: chartOfAccounts.name,
        balance: sql<string>`COALESCE(SUM(journal_entry_lines.debit) - SUM(journal_entry_lines.credit), 0)`,
      })
      .from(chartOfAccounts)
      .leftJoin(journalEntryLines, eq(chartOfAccounts.id, journalEntryLines.accountId))
      .leftJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(chartOfAccounts.type, 'expense'),
          eq(chartOfAccounts.isActive, true),
          gte(journalEntries.entryDate, startDate),
          lte(journalEntries.entryDate, endDate),
        )
      )
      .groupBy(chartOfAccounts.id, chartOfAccounts.code, chartOfAccounts.name)

    const totalRevenue = revenueAccounts.reduce((s, a) => s + Number(a.balance), 0)
    const totalExpense = expenseAccounts.reduce((s, a) => s + Number(a.balance), 0)
    const netIncome = totalRevenue - totalExpense

    return {
      startDate,
      endDate,
      revenue: { accounts: revenueAccounts, total: totalRevenue },
      expense: { accounts: expenseAccounts, total: totalExpense },
      netIncome,
    }
  }

  async getBalanceSheet(asOfDate: string) {
    const assetAccounts = await this.db
      .select({
        id: chartOfAccounts.id,
        code: chartOfAccounts.code,
        name: chartOfAccounts.name,
        balance: sql<string>`COALESCE(SUM(journal_entry_lines.debit) - SUM(journal_entry_lines.credit), 0)`,
      })
      .from(chartOfAccounts)
      .leftJoin(journalEntryLines, eq(chartOfAccounts.id, journalEntryLines.accountId))
      .leftJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(chartOfAccounts.type, 'asset'),
          eq(chartOfAccounts.isActive, true),
          lte(journalEntries.entryDate, asOfDate),
        )
      )
      .groupBy(chartOfAccounts.id, chartOfAccounts.code, chartOfAccounts.name)

    const liabilityAccounts = await this.db
      .select({
        id: chartOfAccounts.id,
        code: chartOfAccounts.code,
        name: chartOfAccounts.name,
        balance: sql<string>`COALESCE(SUM(journal_entry_lines.credit) - SUM(journal_entry_lines.debit), 0)`,
      })
      .from(chartOfAccounts)
      .leftJoin(journalEntryLines, eq(chartOfAccounts.id, journalEntryLines.accountId))
      .leftJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(chartOfAccounts.type, 'liability'),
          eq(chartOfAccounts.isActive, true),
          lte(journalEntries.entryDate, asOfDate),
        )
      )
      .groupBy(chartOfAccounts.id, chartOfAccounts.code, chartOfAccounts.name)

    const equityAccounts = await this.db
      .select({
        id: chartOfAccounts.id,
        code: chartOfAccounts.code,
        name: chartOfAccounts.name,
        balance: sql<string>`COALESCE(SUM(journal_entry_lines.credit) - SUM(journal_entry_lines.debit), 0)`,
      })
      .from(chartOfAccounts)
      .leftJoin(journalEntryLines, eq(chartOfAccounts.id, journalEntryLines.accountId))
      .leftJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(chartOfAccounts.type, 'equity'),
          eq(chartOfAccounts.isActive, true),
          lte(journalEntries.entryDate, asOfDate),
        )
      )
      .groupBy(chartOfAccounts.id, chartOfAccounts.code, chartOfAccounts.name)

    return {
      asOfDate,
      assets: { accounts: assetAccounts, total: assetAccounts.reduce((s, a) => s + Number(a.balance), 0) },
      liabilities: { accounts: liabilityAccounts, total: liabilityAccounts.reduce((s, a) => s + Number(a.balance), 0) },
      equity: { accounts: equityAccounts, total: equityAccounts.reduce((s, a) => s + Number(a.balance), 0) },
    }
  }

  async getTrialBalance(startDate?: string, endDate?: string) {
    const conditions: ReturnType<typeof eq | typeof gte | typeof lte>[] = [
      eq(chartOfAccounts.isActive, true),
    ]
    if (startDate) conditions.push(gte(journalEntries.entryDate, startDate))
    if (endDate) conditions.push(lte(journalEntries.entryDate, endDate))

    const accounts = await this.db
      .select({
        id: chartOfAccounts.id,
        code: chartOfAccounts.code,
        name: chartOfAccounts.name,
        type: chartOfAccounts.type,
        totalDebit: sql<string>`COALESCE(SUM(journal_entry_lines.debit), 0)`,
        totalCredit: sql<string>`COALESCE(SUM(journal_entry_lines.credit), 0)`,
        balance: sql<string>`COALESCE(SUM(journal_entry_lines.debit) - SUM(journal_entry_lines.credit), 0)`,
      })
      .from(chartOfAccounts)
      .leftJoin(journalEntryLines, eq(chartOfAccounts.id, journalEntryLines.accountId))
      .leftJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(and(...conditions))
      .groupBy(chartOfAccounts.id, chartOfAccounts.code, chartOfAccounts.name, chartOfAccounts.type)
      .orderBy(chartOfAccounts.code)

    return { accounts, generatedAt: new Date().toISOString() }
  }

  async getPeriodReport(period: string, startDate?: string, endDate?: string) {
    const now = new Date()
    let sDate: string
    let eDate: string

    if (period === 'custom' && startDate && endDate) {
      sDate = startDate
      eDate = endDate
    } else {
      const y = now.getFullYear()
      const m = now.getMonth()
      switch (period) {
        case 'daily': {
          sDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
          eDate = sDate
          break
        }
        case 'weekly': {
          const weekStart = new Date(now)
          weekStart.setDate(now.getDate() - now.getDay())
          sDate = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`
          eDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
          break
        }
        case 'annual': {
          sDate = `${y}-01-01`
          eDate = `${y}-12-31`
          break
        }
        case 'monthly':
        default: {
          sDate = `${y}-${String(m + 1).padStart(2, '0')}-01`
          const lastDay = new Date(y, m + 1, 0).getDate()
          eDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
          break
        }
      }
    }

    const incomeStatement = await this.getIncomeStatement(sDate, eDate)
    const trialBalance = await this.getTrialBalance(sDate, eDate)

    const entries = await this.db
      .select({
        id: journalEntries.id,
        entryNumber: journalEntries.entryNumber,
        entryDate: journalEntries.entryDate,
        description: journalEntries.description,
        status: journalEntries.status,
      })
      .from(journalEntries)
      .where(
        and(
          gte(journalEntries.entryDate, sDate),
          lte(journalEntries.entryDate, eDate),
        )
      )
      .orderBy(desc(journalEntries.entryDate))

    return {
      period,
      startDate: sDate,
      endDate: eDate,
      generatedAt: new Date().toISOString(),
      summary: {
        totalRevenue: incomeStatement.revenue.total,
        totalExpense: incomeStatement.expense.total,
        netIncome: incomeStatement.netIncome,
        transactionCount: entries.length,
      },
      entries,
      incomeStatement,
      trialBalance: trialBalance.accounts,
    }
  }

  // ─── Initial Seed Data ───

  async seedDefaultAccounts() {
    const existing = await this.db
      .select({ id: chartOfAccounts.id })
      .from(chartOfAccounts)
      .limit(1)
    if (existing.length > 0) return

    const defaultAccounts = [
      { code: '1000', name: 'وجوه نقد', type: 'asset' },
      { code: '1100', name: 'بانک', type: 'asset' },
      { code: '1200', name: 'حساب‌های دریافتنی', type: 'asset' },
      { code: '1300', name: 'موجودی کالا', type: 'asset' },
      { code: '1400', name: 'دارایی‌های ثابت', type: 'asset' },
      { code: '2000', name: 'حساب‌های پرداختنی', type: 'liability' },
      { code: '2100', name: 'تسهیلات بانکی', type: 'liability' },
      { code: '2200', name: 'مالیات پرداختنی', type: 'liability' },
      { code: '3000', name: 'سرمایه', type: 'equity' },
      { code: '3100', name: 'سود (زیان) انباشته', type: 'equity' },
      { code: '4000', name: 'درآمد ویزیت', type: 'revenue' },
      { code: '4100', name: 'درآمد جراحی', type: 'revenue' },
      { code: '4200', name: 'درآمد آزمایشگاه', type: 'revenue' },
      { code: '4300', name: 'درآمد سونوگرافی', type: 'revenue' },
      { code: '4400', name: 'سایر درآمدها', type: 'revenue' },
      { code: '5000', name: 'حقوق و دستمزد', type: 'expense' },
      { code: '5100', name: 'اجاره محل', type: 'expense' },
      { code: '5200', name: 'قبوض و انرژی', type: 'expense' },
      { code: '5300', name: 'هزینه‌های اداری', type: 'expense' },
      { code: '5400', name: 'هزینه مواد مصرفی', type: 'expense' },
      { code: '5500', name: 'استهلاک', type: 'expense' },
      { code: '5600', name: 'سایر هزینه‌ها', type: 'expense' },
    ]

    await this.db.insert(chartOfAccounts).values(
      defaultAccounts.map((a) => ({
        code: a.code,
        name: a.name,
        type: a.type as 'asset' | 'liability' | 'equity' | 'revenue' | 'expense',
      }))
    )
  }
}

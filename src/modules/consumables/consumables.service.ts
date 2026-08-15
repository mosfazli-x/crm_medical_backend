import ExcelJS from 'exceljs'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { DB } from '../../db/client'
import { consumableExpenses, consumableItems } from '../../db/schema'
import { NotFoundError } from '../../shared/errors'
import type { BulkUpsertExpensesDto, ConsumableItemDto } from './consumables.schema'

const DEFAULT_ITEMS: string[] = [
  'کیسه زباله',
  'دستمال کاغذی',
  'ملزومات چاپ',
  'پیک',
  'چای',
  'لیوان یکبارمصرف',
  'آب معدنی',
  'مایع دستشویی',
  'مایع ظرفشویی',
  'وایتکس',
  'شارژ ساختمان',
  'پیش‌پرداخت',
  'نظافت دفتر',
  'ملزومات خط زیبایی',
  'سفارش غذا',
  'تجهیزات',
  'تعمیرات',
  'روکش',
  'لوازم تحریر',
  'سایر',
]

export class ConsumablesService {
  constructor(private db: DB) {}

  async ensureDefaults() {
    const [existing] = await this.db
      .select({ id: consumableItems.id })
      .from(consumableItems)
      .limit(1)

    if (existing) return

    await this.db
      .insert(consumableItems)
      .values(DEFAULT_ITEMS.map((name, index) => ({ name, sortOrder: index })))
  }

  async listItems() {
    return this.db
      .select()
      .from(consumableItems)
      .orderBy(consumableItems.sortOrder, consumableItems.name)
  }

  async createItem(dto: ConsumableItemDto) {
    const [max] = await this.db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${consumableItems.sortOrder}), -1)` })
      .from(consumableItems)

    const [item] = await this.db
      .insert(consumableItems)
      .values({ name: dto.name, sortOrder: dto.sort_order ?? (max?.maxOrder ?? -1) + 1 })
      .returning()
    return item
  }

  async updateItem(id: string, dto: Partial<ConsumableItemDto>) {
    const existing = await this.db
      .select()
      .from(consumableItems)
      .where(eq(consumableItems.id, id))
      .limit(1)
    if (!existing.length) throw new NotFoundError('Consumable item')

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (dto.name !== undefined) updates.name = dto.name
    if (dto.sort_order !== undefined) updates.sortOrder = dto.sort_order
    if (dto.is_active !== undefined) updates.isActive = dto.is_active

    const [updated] = await this.db
      .update(consumableItems)
      .set(updates)
      .where(eq(consumableItems.id, id))
      .returning()
    return updated
  }

  async deleteItem(id: string) {
    const existing = await this.db
      .select()
      .from(consumableItems)
      .where(eq(consumableItems.id, id))
      .limit(1)
    if (!existing.length) throw new NotFoundError('Consumable item')

    const [deleted] = await this.db
      .update(consumableItems)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(consumableItems.id, id))
      .returning()
    return deleted
  }

  async getMonthReport(month: string) {
    const rows = await this.db
      .select({
        id: consumableItems.id,
        name: consumableItems.name,
        sortOrder: consumableItems.sortOrder,
        isActive: consumableItems.isActive,
        amount: consumableExpenses.amount,
        notes: consumableExpenses.notes,
      })
      .from(consumableItems)
      .leftJoin(
        consumableExpenses,
        and(
          eq(consumableExpenses.itemId, consumableItems.id),
          eq(consumableExpenses.month, month)
        )
      )
      .orderBy(consumableItems.sortOrder, consumableItems.name)

    let total = 0
    let recordedCount = 0
    const items = rows.map((row) => {
      const amount = row.amount == null ? 0 : Number(row.amount)
      total += amount
      if (row.amount != null) recordedCount += 1
      return {
        id: row.id,
        name: row.name,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
        amount,
        notes: row.notes ?? null,
      }
    })

    return { month, total, recordedCount, items }
  }

  async bulkUpsertExpenses(dto: BulkUpsertExpensesDto) {
    const { month, items } = dto

    const validIds = new Set(
      (await this.db.select({ id: consumableItems.id }).from(consumableItems)).map((row) => row.id)
    )

    for (const entry of items) {
      if (!validIds.has(entry.item_id)) throw new NotFoundError('Consumable item')

      if (entry.amount === 0) {
        await this.db
          .delete(consumableExpenses)
          .where(and(
            eq(consumableExpenses.itemId, entry.item_id),
            eq(consumableExpenses.month, month)
          ))
        continue
      }

      await this.db
        .insert(consumableExpenses)
        .values({
          itemId: entry.item_id,
          month,
          amount: String(entry.amount),
          notes: entry.notes || null,
        })
        .onConflictDoUpdate({
          target: [consumableExpenses.itemId, consumableExpenses.month],
          set: {
            amount: String(entry.amount),
            notes: entry.notes || null,
            updatedAt: new Date(),
          },
        })
    }

    return this.getMonthReport(month)
  }

  async listMonths() {
    const rows = await this.db
      .select({
        month: consumableExpenses.month,
        total: sql<string>`COALESCE(SUM(${consumableExpenses.amount}::numeric), 0)`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(consumableExpenses)
      .groupBy(consumableExpenses.month)
      .orderBy(desc(consumableExpenses.month))

    return rows.map((row) => ({ month: row.month, total: Number(row.total), count: row.count }))
  }

  async exportMonth(month: string) {
    const report = await this.getMonthReport(month)

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Clinic CRM'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet(`Consumables-${month}`, {
      views: [{ rightToLeft: true }],
    })

    sheet.columns = [
      { key: 'index', width: 8 },
      { key: 'name', width: 34 },
      { key: 'amount', width: 24 },
      { key: 'notes', width: 46 },
    ]

    const titleRow = sheet.addRow([`گزارش مخارج و مواد مصرفی کلینیک — ماه ${month}`])
    sheet.mergeCells(titleRow.number, 1, titleRow.number, 4)
    const titleCell = titleRow.getCell(1)
    titleCell.font = { bold: true, size: 14 }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    titleRow.height = 26

    const headerRow = sheet.addRow(['ردیف', 'قلم مصرفی', 'مبلغ (تومان)', 'توضیحات'])
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF3730A3' } } }
    })
    headerRow.height = 20

    report.items.forEach((item, index) => {
      const row = sheet.addRow([index + 1, item.name, item.amount, item.notes ?? ''])
      row.getCell(3).numFmt = '#,##0'
      if (!item.isActive) {
        row.eachCell((cell) => {
          cell.font = { color: { argb: 'FF9CA3AF' } }
        })
      }
    })

    const totalRow = sheet.addRow(['', 'جمع کل', report.total, ''])
    totalRow.getCell(3).numFmt = '#,##0'
    totalRow.eachCell((cell) => {
      cell.font = { bold: true }
      cell.border = { top: { style: 'thin', color: { argb: 'FF4F46E5' } } }
    })
    totalRow.height = 20

    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }
}

import { describe, expect, it } from 'vitest'
import {
  DailyReportSheetParamsSchema,
  DailyReportSheetQuerySchema,
  PutDailyReportSheetRowSchema,
  SHEET_CATEGORIES,
} from '../modules/daily-reports/daily-reports.schema'

const row = {
  reportDate: '2024-02-29',
  patientId: 'b7083978-33b4-40ed-96ed-29c4c8ec44a6',
  visitType: 'Follow-up',
  category: 'visit',
  bankAmount: 0,
  posAmount: 123.45,
  cashAmount: 9999999999.99,
}

describe('Daily report sheet validation (no database)', () => {
  it('accepts a complete row, zero, decimal and maximum amounts', () => {
    expect(PutDailyReportSheetRowSchema.parse(row)).toEqual(row)
  })

  it.each(SHEET_CATEGORIES)('accepts the dedicated category %s', (category) => {
    expect(PutDailyReportSheetRowSchema.safeParse({ ...row, category }).success).toBe(true)
  })

  it.each(['colonoscopy', 'co2_test', 'other', '', 'unknown'])('rejects category %s', (category) => {
    expect(PutDailyReportSheetRowSchema.safeParse({ ...row, category }).success).toBe(false)
  })

  it.each(['2023-02-29', '1900-02-29', '2024-04-31', '2024-13-01', '2024-00-01',
    '2024-01-00', '2024-1-01', '0000-01-01', 'not-a-date', '2024-02-29T00:00:00Z'])('rejects invalid date %s in query and body', (date) => {
    expect(DailyReportSheetQuerySchema.safeParse({ date }).success).toBe(false)
    expect(PutDailyReportSheetRowSchema.safeParse({ ...row, reportDate: date }).success).toBe(false)
  })

  it.each(['2000-02-29', '2024-02-29', '2026-11-04', '0099-01-01'])('accepts calendar date %s', (date) => {
    expect(DailyReportSheetQuerySchema.parse({ date })).toEqual({ date })
  })

  it('requires the date query parameter', () => {
    expect(DailyReportSheetQuerySchema.safeParse({}).success).toBe(false)
    expect(DailyReportSheetQuerySchema.safeParse({ reportDate: row.reportDate }).success).toBe(false)
  })

  describe.each(['bankAmount', 'posAmount', 'cashAmount'])('%s', (field) => {
    it.each([-1, -0.01, 10000000000, 9999999999.999, 1.001, 0.001, 1e-7,
      NaN, Infinity, -Infinity, '12.34', null, true])('rejects invalid amount %s', (value) => {
      expect(PutDailyReportSheetRowSchema.safeParse({ ...row, [field]: value }).success).toBe(false)
    })

    it.each([0, 0.01, 0.1, 0.29, 1.1, 12.34, 9999999999.99])('accepts amount %s without floating-point scaling errors', (value) => {
      expect(PutDailyReportSheetRowSchema.safeParse({ ...row, [field]: value }).success).toBe(true)
    })
  })

  it.each(Object.keys(row))('requires field %s on PUT', (field) => {
    const partial: Record<string, unknown> = { ...row }
    delete partial[field]
    expect(PutDailyReportSheetRowSchema.safeParse(partial).success).toBe(false)
  })

  it.each(['', '   ', 'x'.repeat(101)])('rejects empty or oversized visitType', (visitType) => {
    expect(PutDailyReportSheetRowSchema.safeParse({ ...row, visitType }).success).toBe(false)
  })

  it('validates both client row IDs and patient IDs as UUIDs', () => {
    expect(DailyReportSheetParamsSchema.parse({ id: row.patientId })).toEqual({ id: row.patientId })
    expect(DailyReportSheetParamsSchema.safeParse({ id: 'invalid' }).success).toBe(false)
    expect(PutDailyReportSheetRowSchema.safeParse({ ...row, patientId: 'invalid' }).success).toBe(false)
  })

  it('does not accept client-supplied audit fields into the DTO', () => {
    expect(PutDailyReportSheetRowSchema.parse({
      ...row, id: row.patientId, recordedBy: row.patientId, createdAt: '2000-01-01', updatedAt: '2000-01-01',
    })).toEqual(row)
  })
})

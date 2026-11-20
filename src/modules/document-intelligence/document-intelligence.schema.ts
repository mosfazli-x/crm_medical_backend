import { z } from 'zod'
import { toGregorian } from 'jalaali-js'

export const LAB_CATEGORIES = [
  'hormone',
  'hematology',
  'biochemistry',
  'tumor_marker',
  'microbiology',
  'urinalysis',
  'genetics',
  'cytology',
  'pathology',
  'molecular',
  'other',
] as const

export type LabCategory = (typeof LAB_CATEGORIES)[number]

export const EXTRACTION_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
  'confirmed',
] as const

export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number]

const stringLike = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .nullable()
  .optional()

function toConfidence(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return Math.max(0, Math.min(1, value))
  }
  const raw = String(value).trim()
  const percent = raw.endsWith('%')
  const parsed = Number(raw.replace('%', '').replace(',', '.'))
  if (!Number.isFinite(parsed)) return null
  const normalized = percent ? parsed / 100 : parsed
  return Math.max(0, Math.min(1, normalized))
}

const confidenceLike = z
  .union([z.number(), z.string()])
  .transform((value) => toConfidence(value))
  .nullable()
  .optional()

const booleanLike = z
  .union([z.boolean(), z.string(), z.number()])
  .transform((value) => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === 'yes' || normalized === '1' || normalized === 'بله'
  })
  .nullable()
  .optional()

const pageLike = z
  .union([z.number(), z.string()])
  .transform((value) => {
    const parsed = Number(String(value).replace(/[^0-9]/g, ''))
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null
  })
  .nullable()
  .optional()

export const ExtractedTestSchema = z.object({
  name: z.string().min(1),
  nameEn: stringLike,
  category: z.string().nullable().optional(),
  value: stringLike,
  unit: stringLike,
  referenceLow: stringLike,
  referenceHigh: stringLike,
  abnormalFlag: booleanLike,
  confidence: confidenceLike,
  page: pageLike,
  notes: z.string().nullable().optional(),
})

export const ExtractedDocumentSchema = z.object({
  documentType: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  rawText: z.string().nullable().optional(),
  patient: z
    .object({
      fullName: z.string().nullable().optional(),
      nationalId: z.string().nullable().optional(),
      birthDate: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  provider: z
    .object({
      labName: z.string().nullable().optional(),
      doctorName: z.string().nullable().optional(),
      reportDate: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  tests: z
    .array(ExtractedTestSchema)
    .nullable()
    .optional()
    .transform((tests) => tests ?? []),
  medications: z
    .array(
      z.object({
        name: z.string(),
        dosage: z.string().nullable().optional(),
        frequency: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    )
    .nullable()
    .optional()
    .transform((items) => items ?? []),
  diagnoses: z
    .array(
      z.object({
        name: z.string(),
        notes: z.string().nullable().optional(),
      }),
    )
    .nullable()
    .optional()
    .transform((items) => items ?? []),
  notes: z.string().nullable().optional(),
  warnings: z
    .array(z.string())
    .nullable()
    .optional()
    .transform((items) => items ?? []),
  confidence: confidenceLike,
})

export type ExtractedTest = z.infer<typeof ExtractedTestSchema>
export type ExtractedDocument = z.infer<typeof ExtractedDocumentSchema>

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

export function normalizeDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (char) => String(PERSIAN_DIGITS.indexOf(char)))
    .replace(/[٠-٩]/g, (char) => String(ARABIC_DIGITS.indexOf(char)))
    .replace(/٫/g, '.')
    .replace(/٬/g, '')
}

export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const withoutFences = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    return JSON.parse(withoutFences)
  } catch {
    const start = withoutFences.indexOf('{')
    const end = withoutFences.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(withoutFences.slice(start, end + 1))
    }
    throw new Error('Extraction response did not contain a JSON object')
  }
}

export function normalizeDateToIso(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = normalizeDigits(String(value)).trim()
  if (!normalized) return null

  const match = normalized.match(/(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (year < 1700) {
    try {
      const gregorian = toGregorian(year, month, day)
      return validateIso(gregorian.gy, gregorian.gm, gregorian.gd)
    } catch {
      return null
    }
  }

  return validateIso(year, month, day)
}

function validateIso(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const CATEGORY_ALIASES: Record<string, LabCategory> = {
  hormone: 'hormone',
  hormones: 'hormone',
  hematology: 'hematology',
  haematology: 'hematology',
  cbc: 'hematology',
  biochemistry: 'biochemistry',
  chemistry: 'biochemistry',
  tumor_marker: 'tumor_marker',
  tumor_markers: 'tumor_marker',
  tumour_marker: 'tumor_marker',
  tumour_markers: 'tumor_marker',
  oncology: 'tumor_marker',
  microbiology: 'microbiology',
  urinalysis: 'urinalysis',
  urine: 'urinalysis',
  genetics: 'genetics',
  genetic: 'genetics',
  cytology: 'cytology',
  pathology: 'pathology',
  molecular: 'molecular',
  other: 'other',
}

export function normalizeCategory(value: string | null | undefined): LabCategory {
  if (!value) return 'other'
  const key = value
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
  return CATEGORY_ALIASES[key] ?? (LAB_CATEGORIES.includes(key as LabCategory) ? (key as LabCategory) : 'other')
}

function parseNumeric(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const normalized = normalizeDigits(String(value))
    .replace(/,/g, '')
    .replace(/[^0-9.+-]/g, '')
  if (!normalized || normalized === '-' || normalized === '+' || normalized === '.') return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function computeAbnormal(
  value: string | null | undefined,
  low: string | null | undefined,
  high: string | null | undefined,
): boolean | null {
  const numericValue = parseNumeric(value)
  if (numericValue === null) return null
  const numericLow = parseNumeric(low)
  const numericHigh = parseNumeric(high)
  if (numericLow === null && numericHigh === null) return null
  if (numericLow !== null && numericValue < numericLow) return true
  if (numericHigh !== null && numericValue > numericHigh) return true
  return false
}

function normalizeTest(test: ExtractedTest): ExtractedTest | null {
  const name = normalizeDigits(test.name || '').trim()
  if (!name) return null

  const value = test.value ? normalizeDigits(test.value).trim() : null
  const referenceLow = test.referenceLow ? normalizeDigits(test.referenceLow).trim() : null
  const referenceHigh = test.referenceHigh ? normalizeDigits(test.referenceHigh).trim() : null

  return {
    ...test,
    name,
    value,
    unit: test.unit ? normalizeDigits(test.unit).trim() : null,
    referenceLow,
    referenceHigh,
    abnormalFlag:
      test.abnormalFlag === null || test.abnormalFlag === undefined
        ? computeAbnormal(value, referenceLow, referenceHigh)
        : test.abnormalFlag,
    category: normalizeCategory(test.category),
  }
}

export function normalizeExtractedDocument(document: ExtractedDocument): ExtractedDocument {
  return {
    ...document,
    documentType: document.documentType
      ? normalizeDigits(document.documentType).trim().toLowerCase().replace(/[\s-]+/g, '_')
      : null,
    patient: document.patient
      ? {
          ...document.patient,
          fullName: document.patient.fullName ? normalizeDigits(document.patient.fullName).trim() : null,
          nationalId: document.patient.nationalId ? normalizeDigits(document.patient.nationalId).replace(/\D/g, '') : null,
          birthDate: normalizeDateToIso(document.patient.birthDate),
          phone: document.patient.phone ? normalizeDigits(document.patient.phone).replace(/[^\d+]/g, '') : null,
        }
      : document.patient,
    provider: document.provider
      ? {
          ...document.provider,
          reportDate: normalizeDateToIso(document.provider.reportDate),
        }
      : document.provider,
    tests: document.tests
      .map((test) => normalizeTest(test))
      .filter((test): test is ExtractedTest => test !== null),
    rawText: document.rawText ? normalizeDigits(document.rawText) : document.rawText,
  }
}

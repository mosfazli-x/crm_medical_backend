import { env } from '../../config/env'
import { AppError } from '../../shared/errors'
import {
  ExtractedDocumentSchema,
  normalizeDigits,
  normalizeExtractedDocument,
  type ExtractedDocument,
  type LabCategory,
} from './document-intelligence.schema'
import type {
  DocumentExtractionInput,
  DocumentExtractionProvider,
  DocumentExtractionResult,
} from './document-extraction.types'

interface MedicalDocumentAiLabResult {
  test_name: string
  result?: string | null
  unit?: string | null
  reference_range?: string | null
  flag_as_reported?: string | null
  collection_date?: string | null
  source_ref?: string | null
}

interface MedicalDocumentAiMedication {
  name: string
  strength?: string | null
  dose?: string | null
  route?: string | null
  frequency?: string | null
  duration?: string | null
  status_as_documented?: string | null
}

interface MedicalDocumentAiMention {
  name: string
  details_as_documented?: string | null
  date_as_documented?: string | null
  source_ref?: string | null
}

interface MedicalDocumentAiProcessing {
  filename?: string
  file_type?: string
  file_size_bytes?: number
  source_units?: number
  extraction_methods?: string[]
  ocr_used?: boolean
  extracted_characters?: number
  average_ocr_confidence?: number | null
  low_confidence_ocr_words?: number
  chunks_analyzed?: number
  model?: string
  processing_time_ms?: number
  warnings?: string[]
}

export interface MedicalDocumentAiResponse {
  schema_version?: string
  status?: string
  document_type?: string
  language?: string
  patient?: {
    patient_name?: string | null
    patient_identifier?: string | null
    date_of_birth?: string | null
    sex_as_documented?: string | null
  }
  summary?: string
  medical_history?: MedicalDocumentAiMention[]
  medications?: MedicalDocumentAiMedication[]
  laboratory_results?: MedicalDocumentAiLabResult[]
  radiology_reports?: Array<{
    modality?: string | null
    body_region?: string | null
    report_date?: string | null
    findings_as_reported?: string | null
    impression_as_reported?: string | null
    source_ref?: string | null
  }>
  diagnoses_mentioned?: MedicalDocumentAiMention[]
  procedures_mentioned?: MedicalDocumentAiMention[]
  allergies_mentioned?: MedicalDocumentAiMention[]
  follow_up_mentions?: Array<{
    description_as_documented: string
    date_as_documented?: string | null
    source_ref?: string | null
  }>
  uncertainties?: Array<{ issue: string; source_ref?: string | null }>
  processing?: MedicalDocumentAiProcessing
  limitations?: string[]
}

const CATEGORY_KEYWORDS: Array<[RegExp, LabCategory]> = [
  [
    /\b(wbc|rbc|hemoglobin|haemoglobin|hgb|hct|hematocrit|platelet|plt|mcv|mch|mchc|rdw|neutrophil|lymphocyte|monocyte|eosinophil|basophil|esr|inr|pt|aptt)\b/i,
    'hematology',
  ],
  [/\b(tsh|t3|t4|ft3|ft4|fsh|lh|prolactin|testosterone|estrogen|estradiol|progesterone|cortisol|acth)\b/i, 'hormone'],
  [/\b(psa|cea|afp|ca[\s-]?125|ca[\s-]?19[\s-]?9|ca[\s-]?15[\s-]?3|her2)\b/i, 'tumor_marker'],
  [/\b(urine|urinalysis|specific gravity|nitrite|leukocyte esterase)\b/i, 'urinalysis'],
  [/\b(culture|gram stain|sensitivity|hiv|hbsag|hcv)\b/i, 'microbiology'],
  [
    /\b(glucose|fasting|fbs|cholesterol|hdl|ldl|triglyceride|creatinine|urea|bun|alt|ast|alp|bilirubin|albumin|protein|sodium|potassium|calcium|magnesium|phosphorus|uric acid|hba1c|crp)\b/i,
    'biochemistry',
  ],
]

function normalizeWhitespace(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const normalized = value.trim()
  return normalized ? normalized : null
}

function mapDocumentType(value: string | null | undefined): string | null {
  const normalized = normalizeWhitespace(value)?.toLowerCase().replace(/[\s-]+/g, '_')
  if (!normalized) return null

  const aliases: Record<string, string> = {
    laboratory_report: 'lab_report',
    laboratory_results: 'lab_report',
    lab_result: 'lab_report',
    lab_results: 'lab_report',
    lab_report: 'lab_report',
    radiology_report: 'imaging_report',
    imaging_report: 'imaging_report',
    discharge_summary: 'discharge_summary',
    prescription: 'prescription',
    invoice: 'invoice',
  }

  return aliases[normalized] ?? normalized
}

function mapLanguage(value: string | null | undefined): string | null {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized || normalized === 'unknown') return null
  if (normalized.startsWith('en')) return 'en'
  if (normalized.startsWith('fa') || normalized.includes('persian') || normalized.includes('farsi')) {
    return 'fa'
  }
  return normalized
}

function inferCategory(name: string): LabCategory {
  for (const [pattern, category] of CATEGORY_KEYWORDS) {
    if (pattern.test(name)) return category
  }
  return 'other'
}

export function parseReferenceRange(range: string | null | undefined): {
  low: string | null
  high: string | null
} {
  const normalized = normalizeWhitespace(range ? normalizeDigits(range) : null)
  if (!normalized) return { low: null, high: null }

  const text = normalized.replace(/[–—−]/g, '-')

  const upperOnly = text.match(/^\s*(?:<|≤|<=)\s*([+-]?\d+(?:[.,]\d+)?)/)
  if (upperOnly) return { low: null, high: upperOnly[1].replace(',', '.') }

  const lowerOnly = text.match(/^\s*(?:>|≥|>=)\s*([+-]?\d+(?:[.,]\d+)?)/)
  if (lowerOnly) return { low: lowerOnly[1].replace(',', '.'), high: null }

  const numbers = [...text.matchAll(/\d+(?:[.,]\d+)?/g)].map((match) =>
    match[0].replace(',', '.'),
  )

  if (numbers.length >= 2) return { low: numbers[0], high: numbers[1] }
  return { low: null, high: null }
}

export function parseReportedFlag(flag: string | null | undefined): boolean | null {
  const normalized = normalizeWhitespace(flag)?.toLowerCase()
  if (!normalized) return null

  if (['high', 'h', 'above', '↑', 'abnormal', 'positive'].includes(normalized)) return true
  if (['low', 'l', 'below', '↓'].includes(normalized)) return true
  if (['normal', 'n', 'within range', 'negative'].includes(normalized)) return false
  return null
}

function parsePage(sourceRef: string | null | undefined): number | null {
  const match = sourceRef?.match(/(\d+)\s*$/)
  if (!match) return null
  const page = Number(match[1])
  return Number.isFinite(page) && page > 0 ? page : null
}

function toConfidence(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  const normalized = value > 1 ? value / 100 : value
  return Math.max(0, Math.min(1, normalized))
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))]
}

export function mapMedicalDocumentAiResponse(payload: MedicalDocumentAiResponse): ExtractedDocument {
  const labResults = Array.isArray(payload.laboratory_results) ? payload.laboratory_results : []

  const tests = labResults
    .filter((result) => Boolean(result.test_name?.trim()))
    .map((result) => {
      const range = parseReferenceRange(result.reference_range)
      return {
        name: result.test_name,
        nameEn: null,
        category: inferCategory(result.test_name),
        value: result.result ?? null,
        unit: result.unit ?? null,
        referenceLow: range.low,
        referenceHigh: range.high,
        abnormalFlag: parseReportedFlag(result.flag_as_reported),
        confidence: null,
        page: parsePage(result.source_ref),
        notes: null,
      }
    })

  const medications = (payload.medications ?? [])
    .filter((medication) => Boolean(medication.name?.trim()))
    .map((medication) => ({
      name: medication.name,
      dosage:
        [medication.strength, medication.dose, medication.route]
          .filter((part): part is string => Boolean(part))
          .join(' ') || null,
      frequency: medication.frequency ?? null,
      notes:
        [medication.duration, medication.status_as_documented]
          .filter((part): part is string => Boolean(part))
          .join(' · ') || null,
    }))

  const diagnoses = (payload.diagnoses_mentioned ?? [])
    .filter((mention) => Boolean(mention.name?.trim()))
    .map((mention) => ({
      name: mention.name,
      notes: mention.details_as_documented ?? mention.date_as_documented ?? null,
    }))

  const historyNotes = (payload.medical_history ?? [])
    .filter((mention) => Boolean(mention.name?.trim()))
    .map((mention) => [mention.name, mention.details_as_documented].filter(Boolean).join(': '))

  const reportDate =
    labResults.find((result) => result.collection_date)?.collection_date ??
    (payload.radiology_reports ?? []).find((report) => report.report_date)?.report_date ??
    null

  const warnings = uniqueStrings([
    ...(payload.processing?.warnings ?? []),
    ...(payload.uncertainties ?? []).map((uncertainty) => uncertainty.issue),
    ...(payload.limitations ?? []),
  ])

  if (tests.length === 0) {
    warnings.push('No laboratory results were detected in this document.')
  }

  return {
    documentType: mapDocumentType(payload.document_type),
    language: mapLanguage(payload.language),
    rawText: payload.summary ?? '',
    patient: payload.patient
      ? {
          fullName: payload.patient.patient_name ?? null,
          nationalId: payload.patient.patient_identifier ?? null,
          birthDate: payload.patient.date_of_birth ?? null,
          phone: null,
        }
      : null,
    provider: {
      labName: null,
      doctorName: null,
      reportDate,
    },
    tests,
    medications,
    diagnoses,
    notes: [payload.summary, ...historyNotes].filter(Boolean).join('\n') || null,
    warnings,
    confidence: toConfidence(payload.processing?.average_ocr_confidence),
  }
}

function getErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const error = (payload as { error?: { message?: unknown } }).error
  return typeof error?.message === 'string' ? error.message : null
}

export class MedicalDocumentAiProvider implements DocumentExtractionProvider {
  isAvailable(): boolean {
    return Boolean(env.MEDICAL_DOCUMENT_AI_URL && env.MEDICAL_DOCUMENT_AI_API_KEY)
  }

  async extract(input: DocumentExtractionInput): Promise<DocumentExtractionResult> {
    if (!env.MEDICAL_DOCUMENT_AI_URL || !env.MEDICAL_DOCUMENT_AI_API_KEY) {
      throw new AppError('Medical Document AI service is not configured', 503)
    }

    const endpoint = `${env.MEDICAL_DOCUMENT_AI_URL.replace(/\/+$/, '')}/v1/documents/analyze`
    const form = new FormData()
    form.append(
      'file',
      new Blob([Uint8Array.from(input.buffer)], { type: input.mimeType }),
      input.fileName,
    )

    let response: Response
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'X-API-Key': env.MEDICAL_DOCUMENT_AI_API_KEY,
        },
        body: form,
        signal: AbortSignal.timeout(env.DOCUMENT_AI_REQUEST_TIMEOUT_MS),
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new AppError('Document AI service timed out', 504)
      }
      throw new AppError('Failed to reach the Document AI service', 502)
    }

    const text = await response.text()
    let payload: MedicalDocumentAiResponse | null = null
    try {
      payload = text ? (JSON.parse(text) as MedicalDocumentAiResponse) : null
    } catch {
      payload = null
    }

    if (!response.ok) {
      const serviceMessage = getErrorMessage(payload)
      if (response.status === 429) {
        throw new AppError(serviceMessage ?? 'Document AI service is busy; retry later', 503)
      }
      if (response.status === 401 || response.status === 403) {
        throw new AppError('Document AI service authentication failed', 502)
      }
      throw new AppError(serviceMessage ?? `Document AI service error (${response.status})`, 502)
    }

    if (!payload || typeof payload !== 'object') {
      throw new AppError('Invalid response from the Document AI service', 502)
    }

    if (payload.status && payload.status !== 'completed') {
      throw new AppError('Document AI service did not complete the analysis', 502)
    }

    let data: ExtractedDocument
    try {
      data = normalizeExtractedDocument(
        ExtractedDocumentSchema.parse(mapMedicalDocumentAiResponse(payload)),
      )
    } catch {
      throw new AppError('Document AI service returned an unexpected structure', 502)
    }

    return {
      data,
      rawText: data.rawText ?? '',
      model: payload.processing?.model || env.DOCUMENT_AI_MODEL || 'medgemma-1.5-4b',
    }
  }
}

export const medicalDocumentAiProvider = new MedicalDocumentAiProvider()

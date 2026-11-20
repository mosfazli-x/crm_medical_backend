import { describe, expect, it } from 'vitest'
import {
  ExtractedDocumentSchema,
  computeAbnormal,
  normalizeCategory,
  normalizeDateToIso,
  normalizeDigits,
  normalizeExtractedDocument,
  parseJsonObject,
} from '../modules/document-intelligence/document-intelligence.schema'
import {
  mapMedicalDocumentAiResponse,
  parseReferenceRange,
  parseReportedFlag,
} from '../modules/document-intelligence/medical-document-ai.provider'

describe('document intelligence schema', () => {
  it('normalizes Persian and Arabic digits', () => {
    expect(normalizeDigits('۱۲۳۴۵۶۷۸۹')).toBe('123456789')
    expect(normalizeDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789')
    expect(normalizeDigits('۱۲٫۵')).toBe('12.5')
  })

  it('converts Jalali dates to Gregorian ISO', () => {
    expect(normalizeDateToIso('1403-05-12')).toBe('2024-08-02')
    expect(normalizeDateToIso('۱۴۰۳/۰۵/۱۲')).toBe('2024-08-02')
    expect(normalizeDateToIso('2024-08-02')).toBe('2024-08-02')
  })

  it('rejects invalid dates', () => {
    expect(normalizeDateToIso('2024-02-31')).toBeNull()
    expect(normalizeDateToIso('not a date')).toBeNull()
    expect(normalizeDateToIso('')).toBeNull()
  })

  it('normalizes lab categories', () => {
    expect(normalizeCategory('CBC')).toBe('hematology')
    expect(normalizeCategory('tumor markers')).toBe('tumor_marker')
    expect(normalizeCategory('unknown')).toBe('other')
    expect(normalizeCategory(null)).toBe('other')
  })

  it('computes abnormal flags from numeric ranges', () => {
    expect(computeAbnormal('12', '4', '10')).toBe(true)
    expect(computeAbnormal('3', '4', '10')).toBe(true)
    expect(computeAbnormal('7', '4', '10')).toBe(false)
    expect(computeAbnormal('normal', '4', '10')).toBeNull()
    expect(computeAbnormal('7', null, null)).toBeNull()
  })

  it('parses JSON wrapped in markdown fences', () => {
    expect(parseJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseJsonObject('prefix {"a":1} suffix')).toEqual({ a: 1 })
  })

  it('normalizes an extracted document end to end', () => {
    const parsed = ExtractedDocumentSchema.parse({
      documentType: 'LAB_REPORT',
      provider: { reportDate: '۱۴۰۳/۰۵/۱۲' },
      tests: [
        {
          name: 'TSH',
          category: 'CBC',
          value: '۱۲',
          unit: 'mIU/L',
          referenceLow: '0.4',
          referenceHigh: '4.0',
        },
      ],
      rawText: 'TSH ۱۲',
    })

    const normalized = normalizeExtractedDocument(parsed)

    expect(normalized.documentType).toBe('lab_report')
    expect(normalized.provider?.reportDate).toBe('2024-08-02')
    expect(normalized.rawText).toBe('TSH 12')
    expect(normalized.tests).toHaveLength(1)
    expect(normalized.tests[0]).toMatchObject({
      name: 'TSH',
      category: 'hematology',
      value: '12',
      abnormalFlag: true,
    })
  })

  it('drops tests without a usable name', () => {
    const parsed = ExtractedDocumentSchema.parse({
      tests: [{ name: '   ', value: '1' }, { name: 'Glucose', value: '90' }],
    })
    const normalized = normalizeExtractedDocument(parsed)
    expect(normalized.tests).toHaveLength(1)
    expect(normalized.tests[0].name).toBe('Glucose')
  })
})

describe('medical document ai provider mapping', () => {
  it('parses printed reference ranges', () => {
    expect(parseReferenceRange('4.0 - 10.0')).toEqual({ low: '4.0', high: '10.0' })
    expect(parseReferenceRange('0.4-4.0')).toEqual({ low: '0.4', high: '4.0' })
    expect(parseReferenceRange('< 200')).toEqual({ low: null, high: '200' })
    expect(parseReferenceRange('> 1.2')).toEqual({ low: '1.2', high: null })
    expect(parseReferenceRange('not available')).toEqual({ low: null, high: null })
  })

  it('parses reported high and low flags', () => {
    expect(parseReportedFlag('HIGH')).toBe(true)
    expect(parseReportedFlag('↓')).toBe(true)
    expect(parseReportedFlag('Normal')).toBe(false)
    expect(parseReportedFlag(null)).toBeNull()
  })

  it('maps an analysis response to the internal extraction shape', () => {
    const mapped = mapMedicalDocumentAiResponse({
      schema_version: '1.0',
      status: 'completed',
      document_type: 'laboratory_report',
      language: 'English',
      patient: {
        patient_name: null,
        patient_identifier: null,
        date_of_birth: null,
        sex_as_documented: null,
      },
      summary: 'Laboratory report for a fasting sample.',
      laboratory_results: [
        {
          test_name: 'WBC',
          result: '7.2',
          unit: 'x10^4/L',
          reference_range: '4.0 - 10.0',
          flag_as_reported: null,
          collection_date: '2024-08-02',
          source_ref: 'image:1',
        },
        {
          test_name: 'TSH',
          result: '4.8',
          unit: 'mlU/L',
          reference_range: '0.4-4.0',
          flag_as_reported: 'HIGH',
          collection_date: '2024-08-02',
          source_ref: 'image:1',
        },
        {
          test_name: 'Total Cholesterol',
          result: '185',
          unit: 'mg/dL',
          reference_range: '< 200',
          flag_as_reported: null,
          collection_date: '2024-08-02',
          source_ref: 'image:1',
        },
      ],
      processing: {
        average_ocr_confidence: 90.7,
        model: 'medgemma-1.5-4b',
        warnings: ['3 low-confidence OCR words in image; verify numeric fields'],
      },
      limitations: ['All extracted values must be checked against the original document.'],
    })

    const normalized = normalizeExtractedDocument(mapped)

    expect(normalized.documentType).toBe('lab_report')
    expect(normalized.language).toBe('en')
    expect(normalized.rawText).toBe('Laboratory report for a fasting sample.')
    expect(normalized.provider?.reportDate).toBe('2024-08-02')
    expect(normalized.confidence).toBeCloseTo(0.907)
    expect(normalized.tests).toHaveLength(3)
    expect(normalized.tests[0]).toMatchObject({
      name: 'WBC',
      category: 'hematology',
      value: '7.2',
      referenceLow: '4.0',
      referenceHigh: '10.0',
      abnormalFlag: false,
      page: 1,
    })
    expect(normalized.tests[1]).toMatchObject({
      name: 'TSH',
      category: 'hormone',
      abnormalFlag: true,
    })
    expect(normalized.tests[2]).toMatchObject({
      name: 'Total Cholesterol',
      category: 'biochemistry',
      referenceLow: null,
      referenceHigh: '200',
      abnormalFlag: false,
    })
    expect(normalized.warnings).toEqual([
      '3 low-confidence OCR words in image; verify numeric fields',
      'All extracted values must be checked against the original document.',
    ])
  })

  it('warns when a document has no laboratory results', () => {
    const mapped = mapMedicalDocumentAiResponse({
      status: 'completed',
      document_type: 'prescription',
      laboratory_results: [],
      processing: { model: 'medgemma-1.5-4b' },
    })

    expect(mapped.tests).toHaveLength(0)
    expect(mapped.warnings).toContain('No laboratory results were detected in this document.')
  })
})

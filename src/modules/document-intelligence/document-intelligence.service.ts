import fs from 'node:fs/promises'
import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import type { DB } from '../../db/client'
import {
  attachments,
  documentExtractions,
  documentProcessingJobs,
  labResults,
} from '../../db/schema'
import { env } from '../../config/env'
import { AppError, ConflictError, NotFoundError } from '../../shared/errors'
import { fileService } from '../../shared/services'
import {
  ExtractedDocumentSchema,
  computeAbnormal,
  normalizeCategory,
  normalizeExtractedDocument,
  type ExtractedDocument,
} from './document-intelligence.schema'
import { documentExtractionProvider } from './document-extraction.provider'
import type { DocumentExtractionProvider } from './document-extraction.types'

const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'application/pdf',
])

const EXTENSION_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.pdf': 'application/pdf',
}

type AttachmentRow = typeof attachments.$inferSelect
type ExtractionRow = typeof documentExtractions.$inferSelect

export interface ExtractionView {
  attachment: {
    id: string
    fileName: string
    fileType: string
    mimeType: string
    fileSize: number
    createdAt: Date | null
  }
  extraction: ExtractionRow | null
}

export class DocumentExtractionService {
  constructor(
    private db: DB,
    private provider: DocumentExtractionProvider = documentExtractionProvider,
  ) {}

  isEnabled(): boolean {
    return env.DOCUMENT_AI_ENABLED && this.provider.isAvailable()
  }

  /**
   * Queue extraction for freshly uploaded attachments.
   * Safe to call repeatedly: duplicate extractions/jobs are ignored.
   */
  async enqueueForAttachmentIds(patientId: string, attachmentIds: string[]): Promise<number> {
    if (!this.isEnabled() || attachmentIds.length === 0) return 0

    let queued = 0
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: attachments.id,
          mimeType: attachments.mimeType,
          fileName: attachments.fileName,
          isDeleted: attachments.isDeleted,
        })
        .from(attachments)
        .where(and(eq(attachments.patientId, patientId), inArray(attachments.id, attachmentIds)))

      for (const row of rows) {
        if (row.isDeleted) continue
        if (!this.resolveMimeType(row.mimeType, row.fileName)) continue

        await tx
          .insert(documentExtractions)
          .values({ attachmentId: row.id, patientId, status: 'pending' })
          .onConflictDoNothing()

        await tx
          .insert(documentProcessingJobs)
          .values({ attachmentId: row.id })
          .onConflictDoNothing()

        queued++
      }
    })

    return queued
  }

  /**
   * Queue extraction for files identified by hash (used by the patient
   * create/update flows where attachment ids are not returned directly).
   */
  async enqueueForFileHashes(patientId: string, fileHashes: string[], since: Date): Promise<number> {
    const hashes = fileHashes.filter(Boolean)
    if (!this.isEnabled() || hashes.length === 0) return 0

    const rows = await this.db
      .select({ id: attachments.id })
      .from(attachments)
      .where(
        and(
          eq(attachments.patientId, patientId),
          eq(attachments.isDeleted, false),
          inArray(attachments.fileHash, hashes),
          gte(attachments.createdAt, since),
        ),
      )

    return this.enqueueForAttachmentIds(patientId, rows.map((row) => row.id))
  }

  async getByAttachment(patientId: string, attachmentId: string): Promise<ExtractionView> {
    const [row] = await this.db
      .select({
        attachmentId: attachments.id,
        fileName: attachments.fileName,
        fileType: attachments.fileType,
        mimeType: attachments.mimeType,
        fileSize: attachments.fileSize,
        createdAt: attachments.createdAt,
        extraction: documentExtractions,
      })
      .from(attachments)
      .leftJoin(documentExtractions, eq(documentExtractions.attachmentId, attachments.id))
      .where(
        and(
          eq(attachments.id, attachmentId),
          eq(attachments.patientId, patientId),
          eq(attachments.isDeleted, false),
        ),
      )

    if (!row) throw new NotFoundError('Attachment')

    return {
      attachment: {
        id: row.attachmentId,
        fileName: row.fileName,
        fileType: row.fileType,
        mimeType: row.mimeType,
        fileSize: row.fileSize,
        createdAt: row.createdAt,
      },
      extraction: row.extraction ?? null,
    }
  }

  async updateExtraction(
    patientId: string,
    attachmentId: string,
    structuredData: unknown,
    userId?: string,
  ): Promise<ExtractionRow> {
    const extraction = await this.getExtractionOrThrow(patientId, attachmentId)

    if (extraction.status === 'confirmed') {
      throw new ConflictError('This extraction has already been confirmed')
    }
    if (extraction.status !== 'completed') {
      throw new AppError('The document has not been processed successfully yet', 400)
    }

    const parsed = ExtractedDocumentSchema.parse(structuredData)
    const normalized = normalizeExtractedDocument(parsed)

    const [updated] = await this.db
      .update(documentExtractions)
      .set({
        structuredData: normalized,
        documentType: normalized.documentType ?? extraction.documentType,
        confidence: normalized.confidence !== null && normalized.confidence !== undefined
          ? String(normalized.confidence)
          : extraction.confidence,
        reviewedById: userId ?? null,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documentExtractions.id, extraction.id))
      .returning()

    return updated
  }

  async confirmExtraction(
    patientId: string,
    attachmentId: string,
    structuredData: unknown | undefined,
    userId?: string,
  ): Promise<{ extraction: ExtractionRow; labResults: Array<typeof labResults.$inferSelect> }> {
    const extraction = await this.getExtractionOrThrow(patientId, attachmentId)

    if (extraction.status === 'confirmed') {
      throw new ConflictError('This extraction has already been confirmed')
    }
    if (extraction.status !== 'completed') {
      throw new AppError('The document has not been processed successfully yet', 400)
    }

    const source = structuredData ?? extraction.structuredData
    if (!source) {
      throw new AppError('No extracted data is available to confirm', 400)
    }

    const parsed = ExtractedDocumentSchema.parse(source)
    const normalized = normalizeExtractedDocument(parsed)

    if (normalized.tests.length === 0) {
      throw new AppError('No lab tests were found in this document', 400)
    }

    const performedDate = this.resolvePerformedDate(normalized, extraction)

    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(documentExtractions)
        .set({
          structuredData: normalized,
          status: 'confirmed',
          documentType: normalized.documentType ?? extraction.documentType,
          confidence: normalized.confidence !== null && normalized.confidence !== undefined
            ? String(normalized.confidence)
            : extraction.confidence,
          reviewedById: userId ?? null,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(documentExtractions.id, extraction.id),
            eq(documentExtractions.status, 'completed'),
          ),
        )
        .returning()

      if (!updated) {
        throw new ConflictError('This extraction has already been confirmed')
      }

      // Defensive: remove any previous draft rows for this extraction.
      await tx.delete(labResults).where(eq(labResults.extractionId, extraction.id))

      const rows = normalized.tests.map((test) => ({
        patientId,
        category: normalizeCategory(test.category),
        testName: test.name,
        testCode: null,
        value: test.value ?? null,
        unit: test.unit ?? null,
        referenceRangeLow: test.referenceLow ?? null,
        referenceRangeHigh: test.referenceHigh ?? null,
        isAbnormal: test.abnormalFlag ?? computeAbnormal(test.value, test.referenceLow, test.referenceHigh),
        reportType: 'simple',
        reportData: {
          extractionId: extraction.id,
          sourceAttachmentId: attachmentId,
          confidence: test.confidence ?? null,
          page: test.page ?? null,
          nameEn: test.nameEn ?? null,
        },
        performedDate,
        performedBy: normalized.provider?.labName || normalized.provider?.doctorName || null,
        notes: test.notes ?? null,
        sourceAttachmentId: attachmentId,
        extractionId: extraction.id,
        reviewStatus: 'ai_confirmed',
        validatedById: userId ?? null,
        validatedAt: userId ? new Date() : null,
      }))

      const inserted = await tx.insert(labResults).values(rows).returning()

      return { extraction: updated, labResults: inserted }
    })
  }

  async reprocess(patientId: string, attachmentId: string): Promise<ExtractionRow> {
    const extraction = await this.findExtraction(patientId, attachmentId)

    if (!extraction) {
      if (!this.isEnabled()) {
        throw new AppError('Document AI is not enabled', 503)
      }
      const queued = await this.enqueueForAttachmentIds(patientId, [attachmentId])
      if (queued === 0) {
        throw new AppError('This document type cannot be processed', 400)
      }
      const created = await this.findExtraction(patientId, attachmentId)
      if (!created) {
        throw new AppError('Failed to queue document extraction', 500)
      }
      return created
    }

    if (extraction.status === 'confirmed') {
      throw new ConflictError('Confirmed extractions cannot be reprocessed')
    }
    if (extraction.status === 'processing') {
      throw new ConflictError('This extraction is already being processed')
    }

    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(documentExtractions)
        .set({
          status: 'pending',
          error: null,
          attempts: 0,
          processedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(documentExtractions.id, extraction.id))
        .returning()

      await tx
        .insert(documentProcessingJobs)
        .values({ attachmentId })
        .onConflictDoUpdate({
          target: documentProcessingJobs.attachmentId,
          set: {
            status: 'queued',
            attempts: 0,
            nextAttemptAt: new Date(),
            lockedAt: null,
            lastError: null,
          },
        })

      return updated
    })
  }

  /**
   * Re-queues jobs left in `processing` after a crash or forced restart.
   */
  async recoverStaleJobs(maxAgeMs = 10 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMs)

    const stale = await this.db
      .update(documentProcessingJobs)
      .set({ status: 'queued', lockedAt: null, nextAttemptAt: new Date() })
      .where(
        and(
          eq(documentProcessingJobs.status, 'processing'),
          or(
            isNull(documentProcessingJobs.lockedAt),
            lte(documentProcessingJobs.lockedAt, cutoff),
          ),
        ),
      )
      .returning({ attachmentId: documentProcessingJobs.attachmentId })

    if (stale.length === 0) return 0

    await this.db
      .update(documentExtractions)
      .set({ status: 'pending', updatedAt: new Date() })
      .where(
        inArray(
          documentExtractions.attachmentId,
          stale.map((row) => row.attachmentId),
        ),
      )

    return stale.length
  }

  /**
   * Claims and processes a single queued job.
   * Returns true when a job was found (even if processing failed).
   */
  async processNextJob(): Promise<boolean> {
    if (!this.isEnabled()) return false

    const job = await this.claimNextJob()
    if (!job) return false

    try {
      const [attachment] = await this.db
        .select()
        .from(attachments)
        .where(eq(attachments.id, job.attachmentId))

      if (!attachment || attachment.isDeleted) {
        throw new Error('Attachment is no longer available')
      }

      const [extraction] = await this.db
        .select()
        .from(documentExtractions)
        .where(eq(documentExtractions.attachmentId, job.attachmentId))

      if (!extraction) {
        throw new Error('Extraction record is missing')
      }

      await this.db
        .update(documentExtractions)
        .set({ status: 'processing', error: null, updatedAt: new Date() })
        .where(eq(documentExtractions.id, extraction.id))

      const mimeType = this.resolveMimeType(attachment.mimeType, attachment.fileName)
      if (!mimeType) {
        throw new Error(`Unsupported document type: ${attachment.mimeType}`)
      }

      const maxBytes = env.DOCUMENT_AI_MAX_FILE_MB * 1024 * 1024
      if (attachment.fileSize > maxBytes) {
        throw new Error(`Document exceeds the ${env.DOCUMENT_AI_MAX_FILE_MB} MB processing limit`)
      }

      const buffer = await this.readFileBuffer(attachment)
      if (buffer.length === 0) {
        throw new Error('Stored file is empty')
      }
      if (buffer.length > maxBytes) {
        throw new Error(`Document exceeds the ${env.DOCUMENT_AI_MAX_FILE_MB} MB processing limit`)
      }

      const result = await this.provider.extract({
        buffer,
        mimeType,
        fileName: attachment.fileName,
      })

      await this.db
        .update(documentExtractions)
        .set({
          status: 'completed',
          documentType: result.data.documentType ?? null,
          rawText: result.rawText,
          structuredData: result.data,
          confidence: result.data.confidence !== null && result.data.confidence !== undefined
            ? String(result.data.confidence)
            : null,
          model: result.model,
          promptVersion: env.DOCUMENT_AI_PROMPT_VERSION,
          pageCount: result.data.tests.length > 0
            ? Math.max(...result.data.tests.map((test) => test.page ?? 1))
            : null,
          error: null,
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(documentExtractions.id, extraction.id))

      await this.db
        .update(documentProcessingJobs)
        .set({ status: 'completed', lockedAt: null, lastError: null })
        .where(eq(documentProcessingJobs.id, job.id))

      return true
    } catch (error) {
      await this.handleJobFailure(job, error)
      return true
    }
  }

  private async claimNextJob(): Promise<typeof documentProcessingJobs.$inferSelect | null> {
    return this.db.transaction(async (tx) => {
      const [candidate] = await tx
        .select()
        .from(documentProcessingJobs)
        .where(
          and(
            eq(documentProcessingJobs.status, 'queued'),
            lte(documentProcessingJobs.nextAttemptAt, new Date()),
          ),
        )
        .orderBy(asc(documentProcessingJobs.createdAt))
        .limit(1)
        .for('update', { skipLocked: true })

      if (!candidate) return null

      const [claimed] = await tx
        .update(documentProcessingJobs)
        .set({
          status: 'processing',
          lockedAt: new Date(),
          attempts: sql`${documentProcessingJobs.attempts} + 1`,
        })
        .where(eq(documentProcessingJobs.id, candidate.id))
        .returning()

      return claimed ?? null
    })
  }

  private async handleJobFailure(
    job: typeof documentProcessingJobs.$inferSelect,
    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : 'Unknown extraction error'
    const attempts = job.attempts
    const maxAttempts = env.DOCUMENT_AI_MAX_ATTEMPTS
    const exhausted = attempts >= maxAttempts

    await this.db
      .update(documentExtractions)
      .set({
        status: exhausted ? 'failed' : 'pending',
        error: message,
        attempts,
        updatedAt: new Date(),
      })
      .where(eq(documentExtractions.attachmentId, job.attachmentId))

    if (exhausted) {
      await this.db
        .update(documentProcessingJobs)
        .set({ status: 'failed', lockedAt: null, lastError: message })
        .where(eq(documentProcessingJobs.id, job.id))
      return
    }

    const busy = error instanceof AppError && error.statusCode === 503
    const delayMs = busy
      ? 5 * 60_000
      : Math.min(60_000, 1_000 * 2 ** Math.max(0, attempts - 1))
    await this.db
      .update(documentProcessingJobs)
      .set({
        status: 'queued',
        lockedAt: null,
        lastError: message,
        nextAttemptAt: new Date(Date.now() + delayMs),
      })
      .where(eq(documentProcessingJobs.id, job.id))
  }

  private async findExtraction(
    patientId: string,
    attachmentId: string,
  ): Promise<ExtractionRow | null> {
    const [row] = await this.db
      .select({ extraction: documentExtractions })
      .from(documentExtractions)
      .innerJoin(attachments, eq(attachments.id, documentExtractions.attachmentId))
      .where(
        and(
          eq(documentExtractions.attachmentId, attachmentId),
          eq(documentExtractions.patientId, patientId),
          eq(attachments.isDeleted, false),
        ),
      )

    return row?.extraction ?? null
  }

  private async getExtractionOrThrow(
    patientId: string,
    attachmentId: string,
  ): Promise<ExtractionRow> {
    const extraction = await this.findExtraction(patientId, attachmentId)
    if (!extraction) throw new NotFoundError('Document extraction')
    return extraction
  }

  private resolveMimeType(mimeType: string, fileName: string): string | null {
    if (SUPPORTED_MIME_TYPES.has(mimeType)) return mimeType
    const extension = Object.keys(EXTENSION_TO_MIME).find((ext) =>
      fileName.toLowerCase().endsWith(ext),
    )
    return extension ? EXTENSION_TO_MIME[extension] : null
  }

  private resolvePerformedDate(data: ExtractedDocument, extraction: ExtractionRow): Date {
    const reportDate = data.provider?.reportDate
    if (reportDate) {
      const parsed = new Date(`${reportDate}T00:00:00.000Z`)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
    return extraction.processedAt ?? extraction.createdAt ?? new Date()
  }

  private async readFileBuffer(attachment: AttachmentRow): Promise<Buffer> {
    const target = attachment.storagePath || attachment.filePath.replace('/uploads/', '')
    if (!target) throw new Error('Attachment has no storage path')

    if (env.STORAGE_DRIVER === 'local') {
      return fs.readFile(fileService.getAbsolutePath(target))
    }

    const result = await fileService.getFileStream(target)
    if (!result) throw new Error('Stored file was not found')

    const stream = result.stream as unknown as {
      readFile?: () => Promise<Buffer>
      [Symbol.asyncIterator]?: () => AsyncIterator<Buffer>
    }

    if (typeof stream.readFile === 'function') {
      return stream.readFile()
    }

    if (typeof stream[Symbol.asyncIterator] === 'function') {
      const chunks: Buffer[] = []
      for await (const chunk of stream as AsyncIterable<Buffer>) {
        chunks.push(Buffer.from(chunk))
      }
      return Buffer.concat(chunks)
    }

    throw new Error('Unable to read the stored file')
  }
}

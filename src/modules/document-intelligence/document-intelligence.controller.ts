import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../../shared/errors'
import { auditService } from '../../shared/services'
import { DocumentExtractionService } from './document-intelligence.service'

type AttachmentParams = {
  patientId: string
  attachmentId: string
}

type PatientParams = {
  patientId: string
}

type OverviewQuery = {
  search?: string
  status?: string
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function ensureUuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw new AppError(`Invalid ${label}`, 400)
  }
  return value
}

function ensureUuidList(values: unknown[], label: string): string[] {
  return values.map((value) => ensureUuid(value, label))
}

export class DocumentIntelligenceController {
  constructor(private service: DocumentExtractionService) {}

  async overview(
    request: FastifyRequest<{ Querystring: OverviewQuery }>,
    reply: FastifyReply,
  ) {
    const data = await this.service.getOverview({
      search: request.query?.search,
      status: request.query?.status,
    })
    return reply.status(200).send({ success: true, data })
  }

  async patientDocuments(
    request: FastifyRequest<{ Params: PatientParams }>,
    reply: FastifyReply,
  ) {
    const patientId = ensureUuid(request.params.patientId, 'patient ID')
    const data = await this.service.listPatientDocuments(patientId)
    return reply.status(200).send({ success: true, data })
  }

  async queue(
    request: FastifyRequest<{ Body: { patientIds?: string[]; force?: boolean } }>,
    reply: FastifyReply,
  ) {
    const rawPatientIds = request.body?.patientIds
    if (!Array.isArray(rawPatientIds) || rawPatientIds.length === 0) {
      throw new AppError('At least one patient must be selected', 400)
    }
    const patientIds = ensureUuidList(rawPatientIds, 'patient ID')

    const userId = (request.user as { id?: string } | undefined)?.id
    const data = await this.service.queuePatients(patientIds, {
      force: Boolean(request.body?.force),
    })

    await auditService.log({
      userId,
      action: 'queue',
      entityType: 'document_extraction',
      entityId: patientIds.length === 1 ? patientIds[0] : undefined,
      newValues: {
        patientIds,
        queued: data.queued,
        skipped: data.skipped,
        force: Boolean(request.body?.force),
      },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    })

    return reply.status(200).send({
      success: true,
      data,
      message:
        data.queued > 0
          ? `${data.queued} document(s) queued for analysis`
          : 'No documents were eligible for analysis',
    })
  }

  async confirmPatient(
    request: FastifyRequest<{
      Params: PatientParams
      Body: { attachmentIds?: string[] }
    }>,
    reply: FastifyReply,
  ) {
    const patientId = ensureUuid(request.params.patientId, 'patient ID')
    const rawAttachmentIds = request.body?.attachmentIds
    const attachmentIds =
      Array.isArray(rawAttachmentIds) && rawAttachmentIds.length > 0
        ? ensureUuidList(rawAttachmentIds, 'attachment ID')
        : undefined
    const userId = (request.user as { id?: string } | undefined)?.id

    const data = await this.service.confirmPatientExtractions(
      patientId,
      attachmentIds,
      userId,
    )

    await auditService.log({
      userId,
      action: 'confirm',
      entityType: 'document_extraction',
      entityId: patientId,
      newValues: {
        patientId,
        confirmed: data.confirmed,
        failed: data.failed,
        skipped: data.skipped,
      },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    })

    return reply.status(200).send({
      success: true,
      data,
      message:
        data.confirmed > 0
          ? `${data.confirmed} document(s) recorded into lab results`
          : 'No completed extractions were available to record',
    })
  }

  async get(
    request: FastifyRequest<{ Params: AttachmentParams }>,
    reply: FastifyReply,
  ) {
    const { patientId, attachmentId } = request.params
    const data = await this.service.getByAttachment(patientId, attachmentId)
    return reply.status(200).send({ success: true, data })
  }

  async update(
    request: FastifyRequest<{ Params: AttachmentParams; Body: { structuredData?: unknown } }>,
    reply: FastifyReply,
  ) {
    const { patientId, attachmentId } = request.params
    const { structuredData } = request.body ?? {}

    if (!structuredData) {
      throw new AppError('structuredData is required', 400)
    }

    const userId = (request.user as { id?: string } | undefined)?.id
    const data = await this.service.updateExtraction(patientId, attachmentId, structuredData, userId)

    await auditService.log({
      userId,
      action: 'update',
      entityType: 'document_extraction',
      entityId: data.id,
      newValues: { status: data.status, documentType: data.documentType },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    })

    return reply.status(200).send({ success: true, data })
  }

  async confirm(
    request: FastifyRequest<{ Params: AttachmentParams; Body: { structuredData?: unknown } }>,
    reply: FastifyReply,
  ) {
    const { patientId, attachmentId } = request.params
    const { structuredData } = request.body ?? {}
    const userId = (request.user as { id?: string } | undefined)?.id

    const result = await this.service.confirmExtraction(
      patientId,
      attachmentId,
      structuredData,
      userId,
    )

    await auditService.log({
      userId,
      action: 'confirm',
      entityType: 'document_extraction',
      entityId: result.extraction.id,
      newValues: {
        status: result.extraction.status,
        documentType: result.extraction.documentType,
        labResultCount: result.labResults.length,
      },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    })

    return reply.status(200).send({
      success: true,
      data: result,
      message: 'Extracted data confirmed and added to lab results',
    })
  }

  async reprocess(
    request: FastifyRequest<{ Params: AttachmentParams }>,
    reply: FastifyReply,
  ) {
    const { patientId, attachmentId } = request.params
    const userId = (request.user as { id?: string } | undefined)?.id

    const data = await this.service.reprocess(patientId, attachmentId)

    await auditService.log({
      userId,
      action: 'reprocess',
      entityType: 'document_extraction',
      entityId: data.id,
      newValues: { status: data.status },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    })

    return reply.status(200).send({ success: true, data })
  }
}

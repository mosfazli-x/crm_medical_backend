import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../../shared/errors'
import { auditService } from '../../shared/services'
import { DocumentExtractionService } from './document-intelligence.service'

type AttachmentParams = {
  patientId: string
  attachmentId: string
}

export class DocumentIntelligenceController {
  constructor(private service: DocumentExtractionService) {}

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

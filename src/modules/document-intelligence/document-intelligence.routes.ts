import type { FastifyInstance } from 'fastify'
import { requireRole } from '../../shared/middleware'
import { DocumentExtractionService } from './document-intelligence.service'
import { DocumentIntelligenceController } from './document-intelligence.controller'

type AttachmentParams = {
  patientId: string
  attachmentId: string
}

export async function documentIntelligenceRoutes(fastify: FastifyInstance) {
  const service = new DocumentExtractionService(fastify.db)
  const controller = new DocumentIntelligenceController(service)

  fastify.get<{ Params: AttachmentParams }>(
    '/:patientId/attachments/:attachmentId/extraction',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    (request, reply) => controller.get(request, reply),
  )

  fastify.patch<{ Params: AttachmentParams; Body: { structuredData?: unknown } }>(
    '/:patientId/attachments/:attachmentId/extraction',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    (request, reply) => controller.update(request, reply),
  )

  fastify.post<{ Params: AttachmentParams; Body: { structuredData?: unknown } }>(
    '/:patientId/attachments/:attachmentId/extraction/confirm',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    (request, reply) => controller.confirm(request, reply),
  )

  fastify.post<{ Params: AttachmentParams }>(
    '/:patientId/attachments/:attachmentId/extraction/reprocess',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    (request, reply) => controller.reprocess(request, reply),
  )
}

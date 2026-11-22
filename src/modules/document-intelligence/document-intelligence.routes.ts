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

/**
 * Workspace endpoints, registered under `/api/document-intelligence`.
 * Kept separate from the per-attachment routes above so the static
 * `/overview` path cannot be mistaken for a patient id.
 */
export async function documentIntelligenceWorkspaceRoutes(fastify: FastifyInstance) {
  const service = new DocumentExtractionService(fastify.db)
  const controller = new DocumentIntelligenceController(service)

  fastify.get<{ Querystring: { search?: string; status?: string } }>(
    '/overview',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    (request, reply) => controller.overview(request, reply),
  )

  fastify.get<{ Params: { patientId: string } }>(
    '/patients/:patientId/documents',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    (request, reply) => controller.patientDocuments(request, reply),
  )

  fastify.post<{ Body: { patientIds?: string[]; force?: boolean } }>(
    '/queue',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    (request, reply) => controller.queue(request, reply),
  )

  fastify.post<{ Params: { patientId: string }; Body: { attachmentIds?: string[] } }>(
    '/patients/:patientId/confirm',
    { preHandler: requireRole('admin_doctor', 'doctor') },
    (request, reply) => controller.confirmPatient(request, reply),
  )
}

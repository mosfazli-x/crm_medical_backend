import type { FastifyInstance } from 'fastify'
import { FaqController } from './faq.controller'
import { FaqService } from './faq.service'
import { requireRole } from '../../shared/middleware'

export async function faqRoutes(fastify: FastifyInstance) {
  const service = new FaqService(fastify.db)
  const controller = new FaqController(service)

  // Admin routes — MUST come before /:id to avoid conflict
  fastify.get('/admin/pending', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.getPendingApprovals(req, rep))

  // Public routes
  fastify.get('/search', (req, rep) => controller.search(req, rep))
  fastify.get('/search/fallback', (req, rep) => controller.searchFallback(req, rep))
  fastify.get('/', (req, rep) => controller.list(req, rep))

  // Parameterized routes — last
  fastify.get<{ Params: { id: string } }>('/:id', (req, rep) => controller.getById(req, rep))
  fastify.post('/', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.create(req, rep))
  fastify.patch<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.update(req, rep))
  fastify.patch<{ Params: { id: string } }>('/:id/approve', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.approve(req, rep))
  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.delete(req, rep))
}

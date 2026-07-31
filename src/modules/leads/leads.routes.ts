import type { FastifyInstance } from 'fastify'
import { LeadsController } from './leads.controller'
import { LeadsService } from './leads.service'
import { requireRole } from '../../shared/middleware'

export async function leadsRoutes(fastify: FastifyInstance) {
  const service = new LeadsService(fastify.db)
  const controller = new LeadsController(service)

  fastify.get('/options', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.options(req, rep))
  fastify.get('/summary', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.summary(req, rep))
  fastify.get('/', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.list(req, rep))
  fastify.post('/', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.create(req, rep))

  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.getById(req, rep))
  fastify.put<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.update(req, rep))
  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: requireRole('admin_doctor') }, (req, rep) => controller.delete(req, rep))

  fastify.post<{ Params: { id: string } }>('/:id/status', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.changeStatus(req, rep))
  fastify.post<{ Params: { id: string } }>('/:id/lost', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.markLost(req, rep))
  fastify.post<{ Params: { id: string } }>('/:id/contact', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.recordContact(req, rep))
  fastify.post<{ Params: { id: string } }>('/:id/assign', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.assign(req, rep))
  fastify.post<{ Params: { id: string } }>('/:id/notes', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.addNote(req, rep))
  fastify.post<{ Params: { id: string } }>('/:id/convert', { preHandler: requireRole('admin_doctor', 'doctor') }, (req, rep) => controller.convert(req, rep))
}

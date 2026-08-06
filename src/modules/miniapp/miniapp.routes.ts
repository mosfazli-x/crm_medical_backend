import type { FastifyInstance } from 'fastify'
import { MiniAppController } from './miniapp.controller'
import { MiniAppService } from './miniapp.service'
import { authenticate } from '../../shared/middleware'
import { authRateLimit } from '../../shared/middleware/rate-limit.middleware'

export async function miniAppRoutes(fastify: FastifyInstance) {
  const service = new MiniAppService(fastify.db)
  const controller = new MiniAppController(service)

  fastify.post('/auth/login', { preHandler: authRateLimit }, controller.login.bind(controller))
  fastify.post('/auth/phone-login', { preHandler: authRateLimit }, controller.phoneLogin.bind(controller))
  fastify.post('/auth/link', { preHandler: authenticate }, controller.link.bind(controller))
  fastify.get('/auth/status', { preHandler: authenticate }, controller.authStatus.bind(controller))

  fastify.get('/services', controller.services.bind(controller))
  fastify.get('/doctors', controller.doctors.bind(controller))
  fastify.get<{ Params: { doctorId: string } }>('/slots/:doctorId', controller.slots.bind(controller))

  fastify.get('/profile', { preHandler: authenticate }, controller.profile.bind(controller))
  fastify.put('/profile', { preHandler: authenticate }, controller.saveProfile.bind(controller))
  fastify.get('/appointments', { preHandler: authenticate }, controller.appointments.bind(controller))
  fastify.post('/book', { preHandler: authenticate }, controller.book.bind(controller))
}

import type { FastifyInstance } from 'fastify'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { authenticate } from '../../shared/middleware'

export async function authRoutes(fastify: FastifyInstance) {
  const service = new AuthService(fastify.db)
  const controller = new AuthController(service)

  fastify.post('/login', controller.login.bind(controller))
  fastify.post('/register', controller.register.bind(controller))
  fastify.post('/forgot-password', controller.forgotPassword.bind(controller))
  fastify.post('/reset-password', controller.resetPassword.bind(controller))
  fastify.get('/me', { preHandler: authenticate }, controller.me.bind(controller))
  fastify.patch('/profile', { preHandler: authenticate }, controller.updateProfile.bind(controller))
  fastify.patch('/change-password', { preHandler: authenticate }, controller.changePassword.bind(controller))
}

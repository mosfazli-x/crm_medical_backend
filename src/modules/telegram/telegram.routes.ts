import type { FastifyInstance } from 'fastify'
import { TelegramController } from './telegram.controller'
import { TelegramBotService } from './telegram.service'
import { authenticate } from '../../shared/middleware'

export async function telegramRoutes(fastify: FastifyInstance) {
  const service = new TelegramBotService(fastify.db)
  const controller = new TelegramController(service)

  fastify.post('/webhook', controller.webhook.bind(controller))

  fastify.post('/generate-link-code', { preHandler: authenticate }, controller.generateLinkCode.bind(controller))
  fastify.get('/status', { preHandler: authenticate }, controller.getStatus.bind(controller))
  fastify.post('/unlink', { preHandler: authenticate }, controller.unlink.bind(controller))
  fastify.post('/menu-button', { preHandler: authenticate }, controller.setMenuButton.bind(controller))
}

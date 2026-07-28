import type { FastifyInstance } from 'fastify'
import { SettingsController } from './settings.controller'
import { SettingsService } from './settings.service'
import { requireRole } from '../../shared/middleware'

export async function settingsRoutes(fastify: FastifyInstance) {
  const service = new SettingsService(fastify.db)
  const controller = new SettingsController(service)

  // Core settings
  fastify.get('/', { preHandler: requireRole('admin_doctor') }, controller.getAll.bind(controller))
  fastify.get('/sms-stats', { preHandler: requireRole('admin_doctor', 'doctor') }, controller.getSmsStats.bind(controller))
  fastify.get('/:key', { preHandler: requireRole('admin_doctor') }, controller.getByKey.bind(controller))
  fastify.put('/:key', { preHandler: requireRole('admin_doctor') }, controller.update.bind(controller))
  fastify.put('/', { preHandler: requireRole('admin_doctor') }, controller.bulkUpdate.bind(controller))

  // Notification settings
  fastify.get('/notifications/all', { preHandler: requireRole('admin_doctor') }, controller.getNotificationSettings.bind(controller))
  fastify.put('/notifications/:eventKey', { preHandler: requireRole('admin_doctor') }, controller.updateNotificationSetting.bind(controller))
  fastify.put('/notifications', { preHandler: requireRole('admin_doctor') }, controller.bulkUpdateNotifications.bind(controller))
}

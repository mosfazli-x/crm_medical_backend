import type { FastifyRequest, FastifyReply } from 'fastify'
import { SettingsService } from './settings.service'

export class SettingsController {
  constructor(private service: SettingsService) {}

  async getAll(request: FastifyRequest, reply: FastifyReply) {
    const settings = await this.service.getAll()
    return reply.send({ success: true, data: settings })
  }

  async getByKey(request: FastifyRequest, reply: FastifyReply) {
    const { key } = request.params as { key: string }
    const setting = await this.service.getByKey(key)
    if (!setting) {
      return reply.status(404).send({ success: false, error: 'Setting not found' })
    }
    return reply.send({ success: true, data: setting })
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { key } = request.params as { key: string }
    const { value, description } = request.body as { value: string; description?: string }
    const updated = await this.service.set(key, value, description)
    return reply.send({ success: true, data: updated, message: 'Setting updated' })
  }

  async bulkUpdate(request: FastifyRequest, reply: FastifyReply) {
    const { settings } = request.body as { settings: { key: string; value: string; description?: string }[] }
    const results = await this.service.bulkUpdate(settings)
    return reply.send({ success: true, data: results, message: 'Settings updated' })
  }

  async getSmsStats(request: FastifyRequest, reply: FastifyReply) {
    const stats = await this.service.getSmsStats()
    return reply.send({ success: true, data: stats })
  }

  async getNotificationSettings(request: FastifyRequest, reply: FastifyReply) {
    const data = await this.service.getNotificationSettings()
    return reply.send({ success: true, data })
  }

  async updateNotificationSetting(request: FastifyRequest, reply: FastifyReply) {
    const { eventKey } = request.params as { eventKey: string }
    const { channel, enabled } = request.body as { channel: string; enabled: boolean }
    if (channel !== 'sms' && channel !== 'telegram') {
      return reply.status(400).send({ success: false, error: 'channel must be sms or telegram' })
    }
    const key = `notif_${channel}_${eventKey}`
    await this.service.set(key, String(enabled))
    return reply.send({ success: true, message: 'Notification setting updated' })
  }

  async bulkUpdateNotifications(request: FastifyRequest, reply: FastifyReply) {
    const { settings } = request.body as { settings: { eventKey: string; channel: string; enabled: boolean }[] }
    const items = settings.map((s) => ({
      key: `notif_${s.channel}_${s.eventKey}`,
      value: String(s.enabled),
    }))
    await this.service.bulkUpdate(items)
    return reply.send({ success: true, message: 'Notification settings updated' })
  }
}

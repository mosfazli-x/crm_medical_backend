import { smsService } from './sms.service'
import { telegramService } from './telegram.service'
import type { DB } from '../../db/client'
import { getDb } from '../../db/client'
import { telegramLinks, users, clinicSettings } from '../../db/schema'
import { eq } from 'drizzle-orm'

export class NotificationService {
  private ensureDb(): DB {
    return getDb()
  }

  /**
   * Check if a notification channel is enabled for a given event.
   * Reads from clinic_settings table. Returns true if the setting is missing (fail-open).
   */
  async isChannelEnabled(eventKey: string, channel: 'sms' | 'telegram'): Promise<boolean> {
    try {
      const db = this.ensureDb()
      const settingKey = `notif_${channel}_${eventKey}`
      const [row] = await db
        .select({ value: clinicSettings.value })
        .from(clinicSettings)
        .where(eq(clinicSettings.key, settingKey))
        .limit(1)
      if (!row) return true
      return row.value === 'true'
    } catch {
      return true
    }
  }

  async notifyByUser(userId: string, text: string, eventKey?: string): Promise<void> {
    const db = this.ensureDb()

    const [user] = await db
      .select({ phone: users.phone, smsEnabled: users.smsEnabled, telegramEnabled: users.telegramEnabled })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) return

    if (user.phone && user.smsEnabled) {
      const smsAllowed = eventKey ? await this.isChannelEnabled(eventKey, 'sms') : true
      if (smsAllowed) {
        smsService.send(user.phone, text)
      }
    }

    if (user.telegramEnabled && telegramService.isConfigured()) {
      const tgAllowed = eventKey ? await this.isChannelEnabled(eventKey, 'telegram') : true
      if (tgAllowed) {
        const [link] = await db
          .select({ chatId: telegramLinks.chatId })
          .from(telegramLinks)
          .where(eq(telegramLinks.userId, userId))
          .limit(1)

        if (link) {
          telegramService.sendMessage(link.chatId, text)
        }
      }
    }
  }

  async notifyByPatient(patientId: string, text: string, phone?: string, eventKey?: string): Promise<void> {
    const db = this.ensureDb()

    const [user] = await db
      .select({ id: users.id, phone: users.phone, smsEnabled: users.smsEnabled, telegramEnabled: users.telegramEnabled })
      .from(users)
      .where(eq(users.patientId, patientId))
      .limit(1)

    if (user) {
      if (user.phone && user.smsEnabled) {
        const smsAllowed = eventKey ? await this.isChannelEnabled(eventKey, 'sms') : true
        if (smsAllowed) {
          smsService.send(user.phone, text)
        }
      }

      if (user.telegramEnabled && telegramService.isConfigured()) {
        const tgAllowed = eventKey ? await this.isChannelEnabled(eventKey, 'telegram') : true
        if (tgAllowed) {
          const [link] = await db
            .select({ chatId: telegramLinks.chatId })
            .from(telegramLinks)
            .where(eq(telegramLinks.userId, user.id))
            .limit(1)

          if (link) {
            telegramService.sendMessage(link.chatId, text)
          }
        }
      }
      return
    }

    if (phone) {
      const smsAllowed = eventKey ? await this.isChannelEnabled(eventKey, 'sms') : true
      if (smsAllowed) {
        smsService.send(phone, text)
      }
    }
  }

  async notifyByPhone(phone: string, text: string, userId?: string, eventKey?: string): Promise<void> {
    if (userId) {
      const db = this.ensureDb()
      const [user] = await db
        .select({ smsEnabled: users.smsEnabled, telegramEnabled: users.telegramEnabled })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      if (user) {
        if (user.smsEnabled) {
          const smsAllowed = eventKey ? await this.isChannelEnabled(eventKey, 'sms') : true
          if (smsAllowed) {
            smsService.send(phone, text)
          }
        }

        if (user.telegramEnabled && telegramService.isConfigured()) {
          const tgAllowed = eventKey ? await this.isChannelEnabled(eventKey, 'telegram') : true
          if (tgAllowed) {
            const [link] = await db
              .select({ chatId: telegramLinks.chatId })
              .from(telegramLinks)
              .where(eq(telegramLinks.userId, userId))
              .limit(1)

            if (link) {
              telegramService.sendMessage(link.chatId, text)
            }
          }
        }
        return
      }
    }

    const smsAllowed = eventKey ? await this.isChannelEnabled(eventKey, 'sms') : true
    if (smsAllowed) {
      smsService.send(phone, text)
    }

    if (userId && telegramService.isConfigured()) {
      const tgAllowed = eventKey ? await this.isChannelEnabled(eventKey, 'telegram') : true
      if (tgAllowed) {
        const db = this.ensureDb()
        const [link] = await db
          .select({ chatId: telegramLinks.chatId })
          .from(telegramLinks)
          .where(eq(telegramLinks.userId, userId))
          .limit(1)

        if (link) {
          telegramService.sendMessage(link.chatId, text)
        }
      }
    }
  }
}

export const notificationService = new NotificationService()

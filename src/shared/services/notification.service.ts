import { smsService } from './sms.service'
import { telegramService } from './telegram.service'
import type { DB } from '../../db/client'
import { getDb } from '../../db/client'
import { telegramLinks, users } from '../../db/schema'
import { eq } from 'drizzle-orm'

export class NotificationService {
  private ensureDb(): DB {
    return getDb()
  }

  async notifyByUser(userId: string, text: string): Promise<void> {
    const db = this.ensureDb()

    const [user] = await db
      .select({ phone: users.phone, smsEnabled: users.smsEnabled, telegramEnabled: users.telegramEnabled })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) return

    if (user.phone && user.smsEnabled) {
      smsService.send(user.phone, text)
    }

    if (user.telegramEnabled && telegramService.isConfigured()) {
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

  async notifyByPatient(patientId: string, text: string, phone?: string): Promise<void> {
    const db = this.ensureDb()

    const [user] = await db
      .select({ id: users.id, phone: users.phone, smsEnabled: users.smsEnabled, telegramEnabled: users.telegramEnabled })
      .from(users)
      .where(eq(users.patientId, patientId))
      .limit(1)

    if (user) {
      if (user.phone && user.smsEnabled) {
        smsService.send(user.phone, text)
      }

      if (user.telegramEnabled && telegramService.isConfigured()) {
        const [link] = await db
          .select({ chatId: telegramLinks.chatId })
          .from(telegramLinks)
          .where(eq(telegramLinks.userId, user.id))
          .limit(1)

        if (link) {
          telegramService.sendMessage(link.chatId, text)
        }
      }
      return
    }

    if (phone) {
      smsService.send(phone, text)
    }
  }

  async notifyByPhone(phone: string, text: string, userId?: string): Promise<void> {
    if (userId) {
      const db = this.ensureDb()
      const [user] = await db
        .select({ smsEnabled: users.smsEnabled, telegramEnabled: users.telegramEnabled })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      if (user) {
        if (user.smsEnabled) {
          smsService.send(phone, text)
        }

        if (user.telegramEnabled && telegramService.isConfigured()) {
          const [link] = await db
            .select({ chatId: telegramLinks.chatId })
            .from(telegramLinks)
            .where(eq(telegramLinks.userId, userId))
            .limit(1)

          if (link) {
            telegramService.sendMessage(link.chatId, text)
          }
        }
        return
      }
    }

    smsService.send(phone, text)

    if (userId && telegramService.isConfigured()) {
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

export const notificationService = new NotificationService()

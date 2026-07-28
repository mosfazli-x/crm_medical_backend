import type { DB } from '../../db/client'
import { clinicSettings } from '../../db/schema'
import { eq, sql } from 'drizzle-orm'
import { NOTIFICATION_EVENTS, getSettingKeyForEvent } from '../../shared/constants/notification-events'

export class SettingsService {
  constructor(private db: DB) {}

  async getAll() {
    return this.db.select().from(clinicSettings)
  }

  async getByKey(key: string) {
    const [setting] = await this.db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.key, key))
      .limit(1)
    return setting || null
  }

  async getNumericValue(key: string): Promise<number | null> {
    const setting = await this.getByKey(key)
    if (!setting) return null
    const num = Number(setting.value)
    return isNaN(num) ? null : num
  }

  async getBooleanValue(key: string): Promise<boolean> {
    const setting = await this.getByKey(key)
    if (!setting) return true
    return setting.value === 'true'
  }

  async set(key: string, value: string, description?: string) {
    const existing = await this.getByKey(key)
    if (existing) {
      const [updated] = await this.db
        .update(clinicSettings)
        .set({
          value,
          description: description ?? existing.description,
          updatedAt: new Date(),
        })
        .where(eq(clinicSettings.key, key))
        .returning()
      return updated
    }
    const [created] = await this.db
      .insert(clinicSettings)
      .values({ key, value, description })
      .returning()
    return created
  }

  async bulkUpdate(items: { key: string; value: string; description?: string }[]) {
    const results: Awaited<ReturnType<SettingsService['set']>>[] = []
    for (const item of items) {
      results.push(await this.set(item.key, item.value, item.description))
    }
    return results
  }

  /**
   * Check if a notification event is enabled for a given channel.
   * Returns true by default (fail-open) if the setting doesn't exist.
   */
  async isNotificationEnabled(eventKey: string, channel: 'sms' | 'telegram'): Promise<boolean> {
    const settingKey = getSettingKeyForEvent(eventKey, channel)
    return this.getBooleanValue(settingKey)
  }

  async getNotificationSettings() {
    const rows = await this.db.select().from(clinicSettings)
      .where(sql`${clinicSettings.key} LIKE 'notif_%'`)
    const map: Record<string, string> = {}
    for (const row of rows) {
      map[row.key] = row.value
    }

    return NOTIFICATION_EVENTS.map((event) => ({
      key: event.key,
      label: event.label,
      description: event.description,
      category: event.category,
      channels: event.channels,
      critical: event.critical ?? false,
      sms: map[getSettingKeyForEvent(event.key, 'sms')] !== 'false',
      telegram: map[getSettingKeyForEvent(event.key, 'telegram')] !== 'false',
    }))
  }

  async initDefaults() {
    // Core SMS settings
    const coreDefaults = [
      { key: 'sms_credit', value: '1000', description: 'اعتبار باقی‌مانده پیامک (تعداد پیامک)' },
      { key: 'sms_sent', value: '0', description: 'تعداد پیامک‌های ارسال شده' },
      { key: 'sms_enabled', value: 'true', description: 'فعال/غیرفعال بودن ارسال پیامک' },
    ]
    for (const d of coreDefaults) {
      const existing = await this.getByKey(d.key)
      if (!existing) {
        await this.set(d.key, d.value, d.description)
      }
    }

    // Notification event defaults — all enabled by default
    for (const event of NOTIFICATION_EVENTS) {
      for (const channel of event.channels) {
        const settingKey = getSettingKeyForEvent(event.key, channel)
        const existing = await this.getByKey(settingKey)
        if (!existing) {
          const label = channel === 'sms' ? 'پیامک' : 'تلگرام'
          await this.set(settingKey, 'true', `${event.label} — ارسال از طریق ${label}`)
        }
      }
    }
  }

  async deductSmsCredit(): Promise<boolean> {
    const credit = await this.getNumericValue('sms_credit')
    if (credit === null || credit <= 0) return false

    await this.db
      .update(clinicSettings)
      .set({
        value: String(credit - 1),
        updatedAt: new Date(),
      })
      .where(eq(clinicSettings.key, 'sms_credit'))

    const sent = await this.getNumericValue('sms_sent')
    await this.db
      .update(clinicSettings)
      .set({
        value: String((sent || 0) + 1),
        updatedAt: new Date(),
      })
      .where(eq(clinicSettings.key, 'sms_sent'))

    return true
  }

  async getSmsStats() {
    const credit = await this.getNumericValue('sms_credit')
    const sent = await this.getNumericValue('sms_sent')
    return {
      remaining: credit ?? 0,
      sent: sent ?? 0,
      total: (credit ?? 0) + (sent ?? 0),
    }
  }

  async hasSmsCredit(): Promise<boolean> {
    const credit = await this.getNumericValue('sms_credit')
    return credit !== null && credit > 0
  }
}

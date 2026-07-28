import axios from 'axios'
import { env } from '../../config/env'
import { getDb } from '../../db/client'
import { clinicSettings } from '../../db/schema'
import { eq } from 'drizzle-orm'

interface SmsConfig {
  username: string
  password: string
  line: string
  baseUrl: string
}

export class SmsService {
  private config: SmsConfig | null = null

  private getConfig(): SmsConfig {
    if (!this.config) {
      if (!env.SMS_USERNAME || !env.SMS_PASSWORD || !env.SMS_LINE) {
        throw new Error('SMS credentials not configured')
      }
      this.config = {
        username: env.SMS_USERNAME,
        password: env.SMS_PASSWORD,
        line: env.SMS_LINE,
        baseUrl: env.SMS_API_BASE_URL,
      }
    }
    return this.config
  }

  private async getSettingValue(key: string): Promise<string | null> {
    try {
      const db = getDb()
      const [row] = await db
        .select({ value: clinicSettings.value })
        .from(clinicSettings)
        .where(eq(clinicSettings.key, key))
        .limit(1)
      return row?.value ?? null
    } catch {
      return null
    }
  }

  private async incrementSetting(key: string, amount: number = 1): Promise<void> {
    try {
      const current = await this.getSettingValue(key)
      const num = Number(current) || 0
      const db = getDb()
      await db
        .update(clinicSettings)
        .set({ value: String(num + amount), updatedAt: new Date() })
        .where(eq(clinicSettings.key, key))
    } catch {
      // Non-critical — log but don't block
    }
  }

  async hasCredit(): Promise<boolean> {
    const val = await this.getSettingValue('sms_credit')
    if (val === null) return true // no setting means unlimited
    return Number(val) > 0
  }

  async send(mobile: string, text: string): Promise<boolean> {
    if (!env.SMS_ENABLED) {
      return true
    }

    const smsEnabled = await this.getSettingValue('sms_enabled')
    if (smsEnabled === 'false') {
      return true
    }

    if (!(await this.hasCredit())) {
      console.warn(`SMS blocked: no credit remaining. mobile=${mobile}`)
      return false
    }

    try {
      const cfg = this.getConfig()
      const response = await axios.get(cfg.baseUrl, {
        params: {
          username: cfg.username,
          password: cfg.password,
          line: cfg.line,
          mobile,
          text,
        },
        timeout: 10000,
      })
      const success = response.status === 200
      if (success) {
        await this.incrementSetting('sms_sent', 1)
        await this.incrementSetting('sms_credit', -1)
      }
      return success
    } catch (error) {
      console.error('SMS send failed:', error instanceof Error ? error.message : error)
      return false
    }
  }

  async getCredit(): Promise<{ sent: number | null; remaining: number | null } | null> {
    try {
      const remaining = await this.getSettingValue('sms_credit')
      const sent = await this.getSettingValue('sms_sent')
      return {
        remaining: remaining !== null ? Number(remaining) : null,
        sent: sent !== null ? Number(sent) : null,
      }
    } catch {
      return null
    }
  }
}

export const smsService = new SmsService()

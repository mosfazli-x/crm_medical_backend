import axios from 'axios'
import { env } from '../../config/env'
import { getDb } from '../../db/client'
import { clinicSettings } from '../../db/schema'
import { eq, sql } from 'drizzle-orm'

interface SmsConfig {
  username: string
  password: string
  line: string
  baseUrl: string
}

export interface SmsDeliveryResult {
  /** True only when the provider accepted the message. */
  ok: boolean
  /** True when no delivery was attempted because the SMS channel is switched off. */
  skipped: boolean
  /** Human-readable provider/transport error, when the delivery failed. */
  error: string | null
}

const DISABLED_RESULT: SmsDeliveryResult = {
  ok: false,
  skipped: true,
  error: 'SMS channel is disabled',
}

/**
 * Normalise an Iranian mobile number to the canonical `09XXXXXXXXX` format
 * expected by the SMS provider. Returns null for anything that is not a valid
 * mobile number, so callers never send to a malformed destination.
 */
export function normalizeMobile(input: string | null | undefined): string | null {
  if (!input) return null

  let value = String(input).replace(/[\s\-()_.]/g, '')
  if (!value) return null

  if (value.startsWith('0098')) value = `0${value.slice(4)}`
  else if (value.startsWith('+98')) value = `0${value.slice(3)}`
  else if (value.startsWith('98') && value.length === 12) value = `0${value.slice(2)}`
  else if (value.startsWith('9') && value.length === 10) value = `0${value}`

  return /^09\d{9}$/.test(value) ? value : null
}

/**
 * sms.ir returns HTTP 200 with `{ status: 1 }` on success and a non-1 status
 * for provider-side failures, so HTTP status alone is not enough to know
 * whether a message was accepted.
 */
export function isProviderSuccess(httpStatus: number, payload: unknown): boolean {
  if (httpStatus < 200 || httpStatus >= 300) return false
  if (payload && typeof payload === 'object' && 'status' in payload) {
    return Number((payload as { status: unknown }).status) === 1
  }
  return true
}

export function extractProviderError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const message = (payload as { message?: unknown }).message
  return typeof message === 'string' && message.trim() ? message.trim() : null
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
      const db = getDb()
      // Atomic increment so concurrent sends inside a broadcast cannot lose
      // updates through a read-modify-write race.
      await db
        .update(clinicSettings)
        .set({
          value: sql`(COALESCE(${clinicSettings.value}, '0')::numeric + ${amount})::text`,
          updatedAt: new Date(),
        })
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

  /**
   * Whether a real SMS delivery would actually be attempted right now.
   *
   * `send()` is intentionally fail-open (it returns true when the channel is off)
   * so non-critical notifications never surface as failures. Callers that must
   * distinguish "delivered" from "silently skipped" — such as broadcasts and
   * follow-up reminder bookkeeping — should use `sendDetailed()` instead.
   */
  async isEnabled(): Promise<boolean> {
    if (!env.SMS_ENABLED) return false
    if (!env.SMS_USERNAME || !env.SMS_PASSWORD || !env.SMS_LINE) return false
    const smsEnabled = await this.getSettingValue('sms_enabled')
    if (smsEnabled === 'false') return false
    return this.hasCredit()
  }

  /** Diagnose why SMS delivery is not available (used for UI feedback). */
  async getStatus(): Promise<{ enabled: boolean; reason: 'disabled' | 'no_credit' | null }> {
    if (!env.SMS_ENABLED) return { enabled: false, reason: 'disabled' }
    if (!env.SMS_USERNAME || !env.SMS_PASSWORD || !env.SMS_LINE) {
      return { enabled: false, reason: 'disabled' }
    }
    const smsEnabled = await this.getSettingValue('sms_enabled')
    if (smsEnabled === 'false') return { enabled: false, reason: 'disabled' }
    if (!(await this.hasCredit())) return { enabled: false, reason: 'no_credit' }
    return { enabled: true, reason: null }
  }

  /**
   * Send one SMS and report the real outcome, including the provider's own
   * error text. Unlike `send()`, a disabled channel is reported as skipped
   * rather than a success.
   */
  async sendDetailed(mobile: string, text: string): Promise<SmsDeliveryResult> {
    if (!env.SMS_ENABLED) return DISABLED_RESULT
    if (!env.SMS_USERNAME || !env.SMS_PASSWORD || !env.SMS_LINE) return DISABLED_RESULT

    const smsEnabled = await this.getSettingValue('sms_enabled')
    if (smsEnabled === 'false') return DISABLED_RESULT

    const normalized = normalizeMobile(mobile)
    if (!normalized) {
      return { ok: false, skipped: false, error: 'Invalid mobile number' }
    }

    if (!(await this.hasCredit())) {
      console.warn(`SMS blocked: no credit remaining. mobile=${normalized}`)
      return { ok: false, skipped: false, error: 'SMS credit exhausted' }
    }

    try {
      const cfg = this.getConfig()
      const response = await axios.get(cfg.baseUrl, {
        params: {
          username: cfg.username,
          password: cfg.password,
          line: cfg.line,
          mobile: normalized,
          text,
        },
        timeout: 15000,
      })

      if (!isProviderSuccess(response.status, response.data)) {
        return {
          ok: false,
          skipped: false,
          error: extractProviderError(response.data) ?? 'SMS provider rejected the message',
        }
      }

      await this.incrementSetting('sms_sent', 1)
      await this.incrementSetting('sms_credit', -1)
      return { ok: true, skipped: false, error: null }
    } catch (error) {
      const providerError = axios.isAxiosError(error)
        ? extractProviderError(error.response?.data) ??
          (error.response?.status ? `SMS provider error (HTTP ${error.response.status})` : null)
        : null
      const message = providerError ?? (error instanceof Error ? error.message : 'SMS delivery failed')
      console.error('SMS send failed:', message)
      return { ok: false, skipped: false, error: message }
    }
  }

  /**
   * Backwards-compatible boolean send. Disabled channels still resolve `true`
   * (fail-open) so unrelated notification flows keep working; callers that need
   * accuracy should use `sendDetailed()`.
   */
  async send(mobile: string, text: string): Promise<boolean> {
    const result = await this.sendDetailed(mobile, text)
    return result.ok || result.skipped
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

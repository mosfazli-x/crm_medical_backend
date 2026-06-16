import axios from 'axios'
import { env } from '../../config/env'

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

  async send(mobile: string, text: string): Promise<boolean> {
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
      return response.status === 200
    } catch (error) {
      console.error('SMS send failed:', error instanceof Error ? error.message : error)
      return false
    }
  }
}

export const smsService = new SmsService()

import axios from 'axios'
import { env } from '../../config/env'

export class TelegramService {
  private baseUrl: string | null = null
  private botToken: string | null = null
  private botUsername: string | null = null

  async getBotUsername(): Promise<string | null> {
    if (this.botUsername) return this.botUsername
    if (env.TELEGRAM_BOT_USERNAME) {
      this.botUsername = env.TELEGRAM_BOT_USERNAME
      return this.botUsername
    }
    try {
      const api = this.getApi()
      const res = await axios.get(`${api}/getMe`, { timeout: 10000 })
      if (res.data?.ok && res.data?.result?.username) {
        this.botUsername = res.data.result.username
        return this.botUsername
      }
    } catch (error) {
      console.error('Telegram getMe failed:', error instanceof Error ? error.message : error)
    }
    return null
  }

  private getApi(): string {
    if (!this.botToken) {
      if (!env.TELEGRAM_BOT_TOKEN) {
        throw new Error('Telegram bot token not configured')
      }
      this.botToken = env.TELEGRAM_BOT_TOKEN
      this.baseUrl = `https://api.telegram.org/bot${this.botToken}`
    }
    return this.baseUrl!
  }

  async sendMessage(chatId: number | string, text: string, parseMode?: 'HTML' | 'Markdown'): Promise<boolean> {
    try {
      const api = this.getApi()
      const params: Record<string, unknown> = { chat_id: chatId, text }
      if (parseMode) params.parse_mode = parseMode
      const response = await axios.post(`${api}/sendMessage`, params, { timeout: 10000 })
      return response.status === 200
    } catch (error) {
      console.error('Telegram sendMessage failed:', error instanceof Error ? error.message : error)
      return false
    }
  }

  async setWebhook(): Promise<boolean> {
    try {
      const api = this.getApi()
      if (!env.TELEGRAM_WEBHOOK_URL) {
        console.warn('TELEGRAM_WEBHOOK_URL not configured, skipping webhook setup')
        return false
      }
      const webhookUrl = `${env.TELEGRAM_WEBHOOK_URL.replace(/\/+$/, '')}/api/telegram/webhook`
      const secretToken = env.TELEGRAM_WEBHOOK_SECRET || this.generateSecret()
      await axios.post(`${api}/setWebhook`, {
        url: webhookUrl,
        secret_token: secretToken,
        allowed_updates: ['message'],
      }, { timeout: 15000 })
      console.log(`Telegram webhook set to ${webhookUrl}`)
      return true
    } catch (error) {
      console.error('Telegram setWebhook failed:', error instanceof Error ? error.message : error)
      return false
    }
  }

  isConfigured(): boolean {
    return !!env.TELEGRAM_BOT_TOKEN
  }

  hasWebhookUrl(): boolean {
    return !!env.TELEGRAM_WEBHOOK_URL
  }

  private generateSecret(): string {
    return Math.random().toString(36).substring(2, 18)
  }
}

export const telegramService = new TelegramService()

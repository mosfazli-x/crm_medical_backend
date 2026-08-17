import { env } from '../../config/env'
import { telegramService } from '../../shared/services'

export class TelegramEscalationService {
  private supportChatId: string | null = null

  constructor() {
    this.supportChatId = env.TELEGRAM_SUPPORT_CHAT_ID || null
  }

  async escalateToAdmin(params: {
    ticketId: string
    question: string
    language: string
    aiAttempts: Array<{ provider: string; response?: string; error?: string }>
    userId: string
    userName?: string
  }): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!this.supportChatId) {
      return { success: false, error: 'Telegram support chat ID not configured' }
    }

    if (!telegramService.isConfigured()) {
      return { success: false, error: 'Telegram bot not configured' }
    }

    const langLabel = params.language === 'fa' ? 'فارسی' : 'English'
    const aiSummary = params.aiAttempts
      .map((a, i) => {
        const status = a.response ? '✅ پاسخ داد' : `❌ ${a.error || 'خطا'}`
        return `${i + 1}. ${a.provider}: ${status}`
      })
      .join('\n')

    const message = [
      `🚨 <b>سوال پشتیبانی - نیاز به بررسی</b>`,
      ``,
      `📋 <b>شناسه:</b> <code>${params.ticketId}</code>`,
      `👤 <b>کاربر:</b> ${params.userName || params.userId}`,
      `🌐 <b>زبان:</b> ${langLabel}`,
      ``,
      `❓ <b>سوال:</b>`,
      params.question,
      ``,
      `🤖 <b>تلاش‌های هوش مصنوعی:</b>`,
      aiSummary,
      ``,
      `💬 برای پاسخ، از CRM استفاده کنید.`,
    ].join('\n')

    try {
      // Send message using existing telegram service
      const success = await telegramService.sendMessage(
        this.supportChatId,
        message,
        'HTML',
      )

      if (success) {
        return { success: true }
      }

      return { success: false, error: 'Failed to send Telegram message' }
    } catch (error: any) {
      console.error('Telegram escalation error:', error?.message)
      return { success: false, error: error?.message || 'Telegram escalation failed' }
    }
  }

  async notifyResolution(params: {
    ticketId: string
    question: string
    answer: string
    resolvedBy: string
  }): Promise<boolean> {
    if (!this.supportChatId || !telegramService.isConfigured()) {
      return false
    }

    const message = [
      `✅ <b>پشتیبانی حل شد</b>`,
      ``,
      `📋 <b>شناسه:</b> <code>${params.ticketId}</code>`,
      `❓ <b>سوال:</b> ${params.question.substring(0, 100)}${params.question.length > 100 ? '...' : ''}`,
      `💬 <b>پاسخ:</b> ${params.answer.substring(0, 200)}${params.answer.length > 200 ? '...' : ''}`,
      `👤 <b>حل شده توسط:</b> ${params.resolvedBy}`,
    ].join('\n')

    return telegramService.sendMessage(this.supportChatId, message, 'HTML')
  }

  isConfigured(): boolean {
    return !!this.supportChatId && telegramService.isConfigured()
  }
}

export const telegramEscalationService = new TelegramEscalationService()

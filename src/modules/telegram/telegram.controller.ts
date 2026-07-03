import type { FastifyRequest, FastifyReply } from 'fastify'
import { TelegramBotService } from './telegram.service'
import { telegramService } from '../../shared/services'
import type { TelegramWebhookUpdate } from './telegram.schema'

export class TelegramController {
  constructor(private botService: TelegramBotService) {}

  async generateLinkCode(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id
    const code = await this.botService.generateLinkCode(userId)
    return reply.send({
      success: true,
      data: { code, expires_in_minutes: 10 },
      message: 'کد پیوند تلگرام با موفقیت تولید شد. کد تا ۱۰ دقیقه معتبر است.',
    })
  }

  async getStatus(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id
    const status = await this.botService.getStatus(userId)
    return reply.send({ success: true, data: status })
  }

  async unlink(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id
    await this.botService.unlink(userId)
    return reply.send({ success: true, message: 'حساب تلگرام با موفقیت جدا شد.' })
  }

  async webhook(request: FastifyRequest, reply: FastifyReply) {
    if (!telegramService.isConfigured()) {
      return reply.status(200).send({ ok: true })
    }

    const update = request.body as TelegramWebhookUpdate
    if (!update?.message || !update.message.text) {
      return reply.status(200).send({ ok: true })
    }

    const { chat, from } = update.message
    const text = update.message.text.trim()
    const chatId = String(chat.id)
    const userInfo = {
      username: from?.username,
      firstName: from?.first_name,
      lastName: from?.last_name,
    }

    try {
      await this.botService.handleCommand(chatId, text, userInfo)
    } catch (err) {
      console.error('Telegram webhook handler error:', err instanceof Error ? err.message : err)
      await telegramService.sendMessage(chatId, 'خطایی رخ داد. لطفاً بعداً تلاش کنید.')
    }

    return reply.status(200).send({ ok: true })
  }
}

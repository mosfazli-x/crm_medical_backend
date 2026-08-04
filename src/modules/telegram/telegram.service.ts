import type { DB } from '../../db/client'
import { telegramLinks, telegramLinkCodes, users } from '../../db/schema'
import { eq, and, isNull, gt } from 'drizzle-orm'
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors'
import { telegramService } from '../../shared/services'

const ROLE_NAMES: Record<string, string> = {
  admin_doctor: 'مدیر ارشد',
  doctor: 'پزشک',
  lab: 'آزمایشگاه',
  pharmacy: 'داروخانه',
  patient: 'بیمار',
}

export class TelegramBotService {
  constructor(private db: DB) {}

  async generateLinkCode(userId: string): Promise<{ code: string; botUsername: string | null; expiresInMinutes: number }> {
    const [existing] = await this.db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.userId, userId))
      .limit(1)

    if (existing?.isActive) {
      throw new ConflictError('Telegram already linked to this account')
    }

    const code = this.generateCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await this.db.insert(telegramLinkCodes).values({
      userId,
      code,
      expiresAt,
    })

    const botUsername = await telegramService.getBotUsername()

    return {
      code,
      botUsername,
      expiresInMinutes: 10,
    }
  }

  async unlink(userId: string): Promise<void> {
    const [deleted] = await this.db
      .delete(telegramLinks)
      .where(eq(telegramLinks.userId, userId))
      .returning()

    if (!deleted) {
      throw new NotFoundError('Telegram link not found')
    }
  }

  async getStatus(userId: string): Promise<{ linked: boolean; username: string | null; firstName: string | null }> {
    const [link] = await this.db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.userId, userId))
      .limit(1)

    if (!link) return { linked: false, username: null, firstName: null }
    return { linked: true, username: link.username, firstName: link.firstName }
  }

  async processLinkCode(code: string, chatId: string, userInfo: { username?: string; firstName?: string; lastName?: string }): Promise<string> {
    const [linkCode] = await this.db
      .select()
      .from(telegramLinkCodes)
      .where(
        and(
          eq(telegramLinkCodes.code, code.toUpperCase()),
          isNull(telegramLinkCodes.usedAt),
          gt(telegramLinkCodes.expiresAt, new Date())
        )
      )
      .limit(1)

    if (!linkCode) {
      throw new ValidationError('کد پیوند نامعتبر یا منقضی شده است.')
    }

    const [existingChat] = await this.db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.chatId, chatId))
      .limit(1)

    if (existingChat) {
      throw new ConflictError('این حساب تلگرام قبلاً به کاربر دیگری متصل شده است.')
    }

    await this.db.insert(telegramLinks).values({
      userId: linkCode.userId,
      chatId,
      username: userInfo.username || null,
      firstName: userInfo.firstName || null,
      lastName: userInfo.lastName || null,
    })

    await this.db
      .update(telegramLinkCodes)
      .set({ usedAt: new Date() })
      .where(eq(telegramLinkCodes.id, linkCode.id))

    const [user] = await this.db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, linkCode.userId))
      .limit(1)

    return user?.fullName || 'کاربر'
  }

  async isChatLinked(chatId: string): Promise<boolean> {
    const [link] = await this.db
      .select({ id: telegramLinks.id })
      .from(telegramLinks)
      .where(eq(telegramLinks.chatId, chatId))
      .limit(1)
    return !!link
  }

  async processUnlink(chatId: string): Promise<boolean> {
    const [deleted] = await this.db
      .delete(telegramLinks)
      .where(eq(telegramLinks.chatId, chatId))
      .returning()
    return !!deleted
  }

  async processProfile(chatId: string): Promise<{ fullName: string | null; phone: string; role: string } | null> {
    const [link] = await this.db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.chatId, chatId))
      .limit(1)

    if (!link) return null

    const [user] = await this.db
      .select({ fullName: users.fullName, phone: users.phone, role: users.role })
      .from(users)
      .where(eq(users.id, link.userId))
      .limit(1)

    return user || null
  }

  async handleCommand(
    chatId: string,
    text: string,
    userInfo: { username?: string; firstName?: string; lastName?: string },
  ): Promise<void> {
    const parts = text.split(/\s+/)
    const command = parts[0].toLowerCase()
    const args = parts.slice(1)

    switch (command) {
      case '/start': {
        if (args.length > 0) {
          const code = args[0]
          try {
            const name = await this.processLinkCode(code, chatId, userInfo)
            await telegramService.sendMessage(chatId,
              `🎉 حساب تلگرام شما با موفقیت به پنل کاربری "${name}" متصل شد!\n\n`
              + 'از این پس نوتیفیکیشن‌ها و پیام‌های مهم کلینیک را مستقیماً از طریق تلگرام دریافت خواهید کرد.'
            )
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'خطا در اتصال حساب تلگرام.'
            await telegramService.sendMessage(chatId, `⚠️ ${msg}`)
          }
          break
        }

        const linked = await this.isChatLinked(chatId)
        if (linked) {
          await telegramService.sendMessage(chatId, 'حساب تلگرام شما قبلاً به پنل کاربری متصل شده است. برای اطلاعات بیشتر از /profile استفاده کنید.')
        } else {
          await telegramService.sendMessage(chatId,
            'به ربات رسمی کلینیک تخصصی دکتر حسینی خوش آمدید. 🏥\n\n'
            + 'برای اتصال آسان حساب کاربری خود به پنل، کافی است در پروفایل خود در وب‌سایت روی دکمه **"اتصال مستقیم با تلگرام"** کلیک کنید.'
          )
        }
        break
      }

      case '/link': {
        if (!args.length) {
          await telegramService.sendMessage(chatId, 'لطفاً کد پیوند را وارد کنید:\n/link <کد ۶ رقمی>\n\nمثال: /link ABC123')
          return
        }
        try {
          const name = await this.processLinkCode(args[0], chatId, userInfo)
          await telegramService.sendMessage(chatId,
            `حساب تلگرام شما با موفقیت به پنل کاربری "${name}" متصل شد.\n`
            + 'از این پس نوتیفیکیشن‌های خود را از طریق تلگرام دریافت خواهید کرد.'
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'خطا در اتصال حساب تلگرام.'
          await telegramService.sendMessage(chatId, msg)
        }
        break
      }

      case '/unlink': {
        const unlinked = await this.processUnlink(chatId)
        await telegramService.sendMessage(chatId,
          unlinked
            ? 'حساب تلگرام شما با موفقیت از پنل کاربری جدا شد.'
            : 'حساب تلگرام شما به هیچ پنل کاربری متصل نیست.'
        )
        break
      }

      case '/profile': {
        const profile = await this.processProfile(chatId)
        if (!profile) {
          await telegramService.sendMessage(chatId, 'هیچ حسابی به این تلگرام متصل نیست.\nبرای اتصال از /link استفاده کنید.')
        } else {
          await telegramService.sendMessage(chatId,
            `اطلاعات حساب شما:\n`
            + `نام: ${profile.fullName || 'ثبت نشده'}\n`
            + `تلفن: ${profile.phone}\n`
            + `نقش: ${ROLE_NAMES[profile.role] || profile.role}`
          )
        }
        break
      }

      case '/help': {
        await telegramService.sendMessage(chatId,
          'دستورات موجود:\n'
          + '/link <کد> - اتصال حساب تلگرام به پنل کاربری\n'
          + '/unlink - قطع اتصال تلگرام\n'
          + '/profile - نمایش اطلاعات حساب متصل شده\n'
          + '/help - راهنما'
        )
        break
      }

      default: {
        await telegramService.sendMessage(chatId, 'دستور نامعتبر. برای راهنما /help را وارد کنید.')
        break
      }
    }
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  }
}

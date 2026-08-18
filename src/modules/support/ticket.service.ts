import type { DB } from '../../db/client'
import { supportTickets, users, faqEntries } from '../../db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { NotFoundError } from '../../shared/errors'
import { FaqService } from './faq.service'
import { aiSupportService } from './ai-support.service'
import { telegramEscalationService } from './telegram-escalation.service'
import type { AskQuestionDto } from './ai-support.schema'

export class TicketService {
  private faqService: FaqService

  constructor(private db: DB) {
    this.faqService = new FaqService(db)
  }

  async askQuestion(userId: string, userName: string | undefined, dto: AskQuestionDto) {
    const startTime = Date.now()
    const { question, language, category } = dto

    // Step 1: Try FAQ search first
    const faqResults = await this.faqService.search({
      q: question,
      language,
      category: category || undefined,
      limit: 1,
    })

    if (faqResults.length > 0 && faqResults[0].score >= 0.4) {
      const faq = faqResults[0]
      const elapsed = Date.now() - startTime

      // Create a ticket showing FAQ was used
      const [ticket] = await this.db
        .insert(supportTickets)
        .values({
          userId,
          question,
          questionLanguage: language,
          aiProvider: null,
          aiResponse: null,
          aiResponseFa: language === 'fa' ? faq.answerFa : null,
          aiResponseEn: language === 'en' ? faq.answerEn : null,
          resolved: true,
          resolvedBy: 'ai',
          resolvedAnswer: language === 'fa' ? faq.answerFa : faq.answerEn,
          responseTimeMs: elapsed,
        })
        .returning()

      return {
        ticket,
        source: 'faq',
        answer: language === 'fa' ? faq.answerFa : faq.answerEn,
        answerFa: faq.answerFa,
        answerEn: faq.answerEn,
        faqId: faq.id,
        confidence: 1.0,
        responseTimeMs: elapsed,
      }
    }

    // Step 2: Try Gemini
    let aiResponse: string | undefined
    let aiProvider: string | undefined
    let aiConfidence: number | undefined
    let aiAttempts = 0
    const aiAttemptLog: Array<{ provider: string; response?: string; error?: string }> = []

    if (aiSupportService.isGeminiAvailable()) {
      aiAttempts++
      const geminiResult = await aiSupportService.askGemini(question, language)
      aiAttemptLog.push({ provider: 'gemini', response: geminiResult.response, error: geminiResult.error })

      if (geminiResult.success && geminiResult.response) {
        aiResponse = geminiResult.response
        aiProvider = 'gemini'
        aiConfidence = geminiResult.confidence
      } else if (aiSupportService.isGroqAvailable()) {
        // Step 3: Gemini failed (rate limited, 404, key invalid, etc.) — try Groq
        aiAttempts++
        const groqResult = await aiSupportService.askGroq(question, language)
        aiAttemptLog.push({ provider: 'groq', response: groqResult.response, error: groqResult.error })

        if (groqResult.success && groqResult.response) {
          aiResponse = groqResult.response
          aiProvider = 'groq'
          aiConfidence = groqResult.confidence
        }
      }
    } else if (aiSupportService.isGroqAvailable()) {
      // Gemini not available, try Groq directly
      aiAttempts++
      const groqResult = await aiSupportService.askGroq(question, language)
      aiAttemptLog.push({ provider: 'groq', response: groqResult.response, error: groqResult.error })

      if (groqResult.success && groqResult.response) {
        aiResponse = groqResult.response
        aiProvider = 'groq'
        aiConfidence = groqResult.confidence
      }
    }

    const elapsed = Date.now() - startTime

    if (aiResponse) {
      // AI answered successfully
      const [ticket] = await this.db
        .insert(supportTickets)
        .values({
          userId,
          question,
          questionLanguage: language,
          aiProvider,
          aiModel: aiProvider === 'gemini' ? 'gemini-2.5-flash-lite' : 'llama-3.3-70b-versatile',
          aiResponse,
          aiConfidence,
          aiResponseFa: language === 'fa' ? aiResponse : null,
          aiResponseEn: language === 'en' ? aiResponse : null,
          aiAttempts,
          resolved: false,
          needsApproval: false,
          responseTimeMs: elapsed,
        })
        .returning()

      return {
        ticket,
        source: aiProvider as 'gemini' | 'groq',
        answer: aiResponse,
        answerFa: language === 'fa' ? aiResponse : null,
        answerEn: language === 'en' ? aiResponse : null,
        confidence: aiConfidence,
        responseTimeMs: elapsed,
        needsConfirmation: true,
      }
    }

    // Step 4: All AI failed — escalate to Telegram
    let telegramMessageId: number | undefined
    let escalated = false

    if (telegramEscalationService.isConfigured()) {
      const escalationResult = await telegramEscalationService.escalateToAdmin({
        ticketId: '', // Will be updated after insert
        question,
        language,
        aiAttempts: aiAttemptLog,
        userId,
        userName,
      })

      if (escalationResult.success) {
        escalated = true
        telegramMessageId = escalationResult.messageId
      }
    }

    const [ticket] = await this.db
      .insert(supportTickets)
      .values({
        userId,
        question,
        questionLanguage: language,
        aiProvider: null,
        aiResponse: null,
        aiAttempts,
        escalated,
        escalatedToTelegram: escalated,
        telegramMessageId: telegramMessageId || null,
        resolved: false,
        needsApproval: false,
        responseTimeMs: elapsed,
      })
      .returning()

    // Update Telegram message with ticket ID if sent
    if (escalated && ticket.id) {
      await telegramEscalationService.escalateToAdmin({
        ticketId: ticket.id,
        question,
        language,
        aiAttempts: aiAttemptLog,
        userId,
        userName,
      })
    }

    return {
      ticket,
      source: 'escalated' as const,
      answer: language === 'fa'
        ? 'متأسفانه سیستم هوش مصنوعی در حال حاضر در دسترس نیست. سوال شما ذخیره شد و به زودی پاسخ دریافت خواهید کرد.'
        : 'Unfortunately the AI system is currently unavailable. Your question has been saved and you will receive an answer shortly.',
      confidence: null,
      responseTimeMs: elapsed,
      escalated: true,
    }
  }

  async confirmAnswer(ticketId: string, userId: string, helpful: boolean, feedback?: string) {
    const [ticket] = await this.db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketId))
      .limit(1)

    if (!ticket) throw new NotFoundError('Support ticket')
    if (ticket.userId !== userId) throw new NotFoundError('Support ticket')

    if (helpful && ticket.aiResponse) {
      // User confirmed the answer — mark for approval
      const lang = ticket.questionLanguage || 'fa'

      // Create unpublished FAQ entry
      const [faqEntry] = await this.db
        .insert(faqEntries)
        .values({
          questionFa: lang === 'fa' ? ticket.question : ticket.question,
          answerFa: lang === 'fa' ? ticket.aiResponse : '',
          questionEn: lang === 'en' ? ticket.question : null,
          answerEn: lang === 'en' ? ticket.aiResponse : null,
          source: 'user_confirmed',
          sourceAiModel: ticket.aiModel,
          confidence: ticket.aiConfidence,
          isPublished: false,
          createdBy: userId,
        })
        .returning()

      // Update ticket
      await this.db
        .update(supportTickets)
        .set({
          resolved: true,
          resolvedAnswer: ticket.aiResponse,
          resolvedBy: 'user_confirmed',
          resolvedAt: new Date(),
          needsApproval: true,
          publishedFaqId: faqEntry.id,
        })
        .where(eq(supportTickets.id, ticketId))

      return {
        ticketId,
        resolved: true,
        publishedFaqId: faqEntry.id,
        needsApproval: true,
        message: 'Answer confirmed and submitted for admin approval',
      }
    }

    // Not helpful — mark resolved but no FAQ
    await this.db
      .update(supportTickets)
      .set({
        resolved: true,
        resolvedBy: 'user_confirmed',
        resolvedAt: new Date(),
        needsApproval: false,
      })
      .where(eq(supportTickets.id, ticketId))

    return {
      ticketId,
      resolved: true,
      needsApproval: false,
      message: feedback || 'Thank you for your feedback',
    }
  }

  async getTickets(page = 1, limit = 20, unresolvedOnly = false) {
    const offset = (page - 1) * limit
    const conditions = unresolvedOnly ? [eq(supportTickets.resolved, false)] : []

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [data, countResult] = await Promise.all([
      this.db
        .select({
          id: supportTickets.id,
          userId: supportTickets.userId,
          userName: users.fullName,
          question: supportTickets.question,
          questionLanguage: supportTickets.questionLanguage,
          aiProvider: supportTickets.aiProvider,
          aiResponse: supportTickets.aiResponse,
          aiConfidence: supportTickets.aiConfidence,
          escalated: supportTickets.escalated,
          resolved: supportTickets.resolved,
          needsApproval: supportTickets.needsApproval,
          publishedFaqId: supportTickets.publishedFaqId,
          responseTimeMs: supportTickets.responseTimeMs,
          createdAt: supportTickets.createdAt,
        })
        .from(supportTickets)
        .leftJoin(users, eq(supportTickets.userId, users.id))
        .where(whereClause)
        .orderBy(desc(supportTickets.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(supportTickets)
        .where(whereClause),
    ])

    return {
      data,
      pagination: {
        page,
        limit,
        total: Number(countResult[0]?.count || 0),
        totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limit),
      },
    }
  }

  async getTicketById(id: string) {
    const [ticket] = await this.db
      .select({
        id: supportTickets.id,
        userId: supportTickets.userId,
        userName: users.fullName,
        question: supportTickets.question,
        questionLanguage: supportTickets.questionLanguage,
        aiProvider: supportTickets.aiProvider,
        aiModel: supportTickets.aiModel,
        aiResponse: supportTickets.aiResponse,
        aiConfidence: supportTickets.aiConfidence,
        aiResponseFa: supportTickets.aiResponseFa,
        aiResponseEn: supportTickets.aiResponseEn,
        aiAttempts: supportTickets.aiAttempts,
        escalated: supportTickets.escalated,
        escalatedToTelegram: supportTickets.escalatedToTelegram,
        resolved: supportTickets.resolved,
        resolvedAnswer: supportTickets.resolvedAnswer,
        resolvedBy: supportTickets.resolvedBy,
        resolvedAt: supportTickets.resolvedAt,
        needsApproval: supportTickets.needsApproval,
        publishedFaqId: supportTickets.publishedFaqId,
        responseTimeMs: supportTickets.responseTimeMs,
        createdAt: supportTickets.createdAt,
      })
      .from(supportTickets)
      .leftJoin(users, eq(supportTickets.userId, users.id))
      .where(eq(supportTickets.id, id))
      .limit(1)

    if (!ticket) throw new NotFoundError('Support ticket')
    return ticket
  }

  async resolveByAdmin(ticketId: string, adminId: string, answer: string) {
    const [ticket] = await this.db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketId))
      .limit(1)

    if (!ticket) throw new NotFoundError('Support ticket')

    // Create FAQ entry
    const [faqEntry] = await this.db
      .insert(faqEntries)
      .values({
        questionFa: ticket.questionLanguage === 'fa' ? ticket.question : '',
        answerFa: ticket.questionLanguage === 'fa' ? answer : '',
        questionEn: ticket.questionLanguage === 'en' ? ticket.question : null,
        answerEn: ticket.questionLanguage === 'en' ? answer : null,
        source: 'approved',
        isPublished: true,
        createdBy: adminId,
        approvedBy: adminId,
      })
      .returning()

    await this.db
      .update(supportTickets)
      .set({
        resolved: true,
        resolvedAnswer: answer,
        resolvedBy: 'admin',
        resolvedAt: new Date(),
        needsApproval: false,
        publishedFaqId: faqEntry.id,
      })
      .where(eq(supportTickets.id, ticketId))

    // Notify via Telegram
    await telegramEscalationService.notifyResolution({
      ticketId,
      question: ticket.question,
      answer,
      resolvedBy: 'admin',
    })

    return { ticketId, faqEntryId: faqEntry.id, resolved: true }
  }

  async getStats() {
    const [stats] = await this.db
      .select({
        total: sql<number>`count(*)`,
        resolved: sql<number>`count(*) filter (where ${supportTickets.resolved} = true)`,
        pending: sql<number>`count(*) filter (where ${supportTickets.needsApproval} = true)`,
        escalated: sql<number>`count(*) filter (where ${supportTickets.escalated} = true)`,
        avgResponseTime: sql<number>`coalesce(avg(${supportTickets.responseTimeMs}), 0)`,
      })
      .from(supportTickets)

    return stats
  }
}

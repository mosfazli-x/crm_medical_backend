import type { DB } from '../../db/client'
import { supportTickets, users, faqEntries } from '../../db/schema'
import { eq, and, desc, sql, inArray } from 'drizzle-orm'
import { env } from '../../config/env'
import { NotFoundError } from '../../shared/errors'
import { FaqService } from './faq.service'
import { aiSupportService, type FaqContextEntry, type KnowledgeContextEntry } from './ai-support.service'
import { KnowledgeService, type SemanticMatch } from './knowledge.service'
import { telegramEscalationService } from './telegram-escalation.service'
import type { AskQuestionDto } from './ai-support.schema'

interface FusedFaqMatch {
  id: string
  questionFa: string | null
  answerFa: string | null
  questionEn: string | null
  answerEn: string | null
  /** Lexical score from keyword/trigram search, 0..1 */
  lexical: number
  /** Semantic relevance mapped from embedding cosine, 0..1 */
  semantic: number
  /** Fusion score: max(lexical, semantic) */
  combined: number
}

export class TicketService {
  private faqService: FaqService
  private knowledgeService: KnowledgeService

  constructor(private db: DB) {
    this.faqService = new FaqService(db)
    this.knowledgeService = new KnowledgeService(db)
  }

  /**
   * Map embedding cosine similarity to 0..1 relevance. Related text pairs on
   * text-embedding-004 typically land between 0.5 and 0.85.
   */
  private semanticRelevance(cosine: number): number {
    return Math.max(0, Math.min(1, (cosine - 0.5) / 0.35))
  }

  /**
   * Hybrid retrieval: lexical keyword search over curated FAQ entries fused
   * with semantic (embedding) search over the whole knowledge base
   * (FAQ + system docs + public site docs). One embedding call per question.
   */
  private async retrieveContext(question: string, language: 'fa' | 'en', category?: string): Promise<{
    faqMatches: FusedFaqMatch[]
    knowledgeEntries: KnowledgeContextEntry[]
  }> {
    const [lexicalResults, semanticMatches] = await Promise.all([
      this.faqService
        .search({ q: question, language, category: category || undefined, limit: 5 })
        .catch(() => []),
      this.knowledgeService
        .searchSemantic(question, 8)
        .catch(() => [] as SemanticMatch[]),
    ])

    const byId = new Map<string, FusedFaqMatch>()
    for (const r of lexicalResults) {
      byId.set(r.id, {
        id: r.id,
        questionFa: r.questionFa,
        answerFa: r.answerFa,
        questionEn: r.questionEn,
        answerEn: r.answerEn,
        lexical: r.score,
        semantic: 0,
        combined: 0,
      })
    }

    // Pull full entries for FAQ items found only semantically
    const missingIds = [...new Set(
      semanticMatches
        .filter(m => m.sourceType === 'faq' && m.sourceRef && !byId.has(m.sourceRef))
        .map(m => m.sourceRef as string),
    )]
    if (missingIds.length > 0) {
      const rows = await this.db
        .select({
          id: faqEntries.id,
          questionFa: faqEntries.questionFa,
          answerFa: faqEntries.answerFa,
          questionEn: faqEntries.questionEn,
          answerEn: faqEntries.answerEn,
        })
        .from(faqEntries)
        .where(and(inArray(faqEntries.id, missingIds), eq(faqEntries.isPublished, true)))
      for (const row of rows) {
        byId.set(row.id, { ...row, lexical: 0, semantic: 0, combined: 0 })
      }
    }

    for (const match of semanticMatches) {
      if (match.sourceType !== 'faq' || !match.sourceRef) continue
      const entry = byId.get(match.sourceRef)
      if (entry) entry.semantic = Math.max(entry.semantic, this.semanticRelevance(match.cosine))
    }

    const faqMatches = [...byId.values()]
      .map(entry => ({ ...entry, combined: Math.max(entry.lexical, entry.semantic) }))
      .sort((a, b) => b.combined - a.combined)

    const knowledgeEntries = semanticMatches
      .filter(m => m.sourceType === 'system' || m.sourceType === 'site')
      .map(m => ({ title: m.title, content: m.content }))

    return { faqMatches, knowledgeEntries }
  }

  async askQuestion(userId: string, userName: string | undefined, dto: AskQuestionDto) {
    const startTime = Date.now()
    const { question, language, category } = dto

    // Step 1: Hybrid retrieval — lexical keyword matching fused with
    // semantic search over curated FAQs + system + public-site knowledge.
    const { faqMatches, knowledgeEntries } = await this.retrieveContext(question, language, category || undefined)
    const best = faqMatches[0]

    // Step 2: Verbatim-first — serve the curated answer unchanged when the
    // match is strong lexically, or when both channels agree.
    if (best && (best.combined >= 0.75 || (best.semantic >= 0.65 && best.lexical >= 0.45))) {
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
          aiResponseFa: language === 'fa' ? best.answerFa : null,
          aiResponseEn: language === 'en' ? best.answerEn : null,
          resolved: true,
          resolvedBy: 'ai',
          resolvedAnswer: language === 'fa' ? best.answerFa : best.answerEn,
          responseTimeMs: elapsed,
        })
        .returning()

      return {
        ticket,
        source: 'faq',
        answer: language === 'fa' ? best.answerFa : best.answerEn,
        answerFa: best.answerFa,
        answerEn: best.answerEn,
        faqId: best.id,
        confidence: 1.0,
        responseTimeMs: elapsed,
      }
    }

    // Step 3: Grounded generation — strict system prompt allows answers only
    // from verified FAQ entries and reference knowledge; no free invention.
    const faqContext: FaqContextEntry[] = faqMatches.slice(0, 5)
      .map(m => ({
        question: language === 'fa' ? (m.questionFa || m.questionEn || '') : (m.questionEn || m.questionFa || ''),
        answer: language === 'fa' ? (m.answerFa || m.answerEn || '') : (m.answerEn || m.answerFa || ''),
      }))
      .filter(e => e.question && e.answer)

    // Step 4: Try Gemini
    let aiResponse: string | undefined
    let aiProvider: string | undefined
    let aiConfidence: number | undefined
    let aiAttempts = 0
    const aiAttemptLog: Array<{ provider: string; response?: string; error?: string }> = []

    if (aiSupportService.isGeminiAvailable()) {
      aiAttempts++
      const geminiResult = await aiSupportService.askGemini(
        question,
        language,
        faqContext.length > 0 ? faqContext : undefined,
        knowledgeEntries.length > 0 ? knowledgeEntries : undefined,
      )
      aiAttemptLog.push({ provider: 'gemini', response: geminiResult.response, error: geminiResult.error })

      if (geminiResult.success && geminiResult.response) {
        aiResponse = geminiResult.response
        aiProvider = 'gemini'
        aiConfidence = geminiResult.confidence
      } else if (aiSupportService.isGroqAvailable()) {
        // Step 5: Gemini failed (rate limited, 404, key invalid, etc.) — try Groq
        aiAttempts++
        const groqResult = await aiSupportService.askGroq(
          question,
          language,
          faqContext.length > 0 ? faqContext : undefined,
          knowledgeEntries.length > 0 ? knowledgeEntries : undefined,
        )
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
      const groqResult = await aiSupportService.askGroq(
        question,
        language,
        faqContext.length > 0 ? faqContext : undefined,
        knowledgeEntries.length > 0 ? knowledgeEntries : undefined,
      )
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
          aiModel: aiProvider === 'gemini' ? env.GEMINI_MODEL : 'llama-3.3-70b-versatile',
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

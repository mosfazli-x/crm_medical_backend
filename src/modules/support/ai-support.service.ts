import axios from 'axios'
import { env } from '../../config/env'
import { getSystemKnowledgeDoc } from './system-knowledge'
import { getSiteKnowledgeDoc } from './site-knowledge'

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>
      role: string
    }
    finishReason: string
  }>
}

interface GroqResponse {
  choices: Array<{
    message: { content: string }
    finish_reason: string
  }>
}

export interface FaqContextEntry {
  question: string
  answer: string
  score?: number
}

export interface KnowledgeContextEntry {
  title: string
  content: string
}

export class AiSupportService {
  private geminiKey: string | null = null
  private groqKey: string | null = null

  constructor() {
    this.geminiKey = env.GEMINI_API_KEY || null
    this.groqKey = env.GROQ_API_KEY || null
  }

  isGeminiAvailable(): boolean {
    return !!this.geminiKey
  }

  isGroqAvailable(): boolean {
    return !!this.groqKey
  }

  get geminiModel(): string {
    return env.GEMINI_MODEL
  }

  /**
   * Strictly grounded system prompt. The model must answer from the provided
   * knowledge base only; curated FAQ answers are to be reproduced faithfully
   * (verbatim-first policy), never blended with outside general knowledge.
   */
  private buildSystemPrompt(language: string, faqContext?: FaqContextEntry[], knowledgeContext?: KnowledgeContextEntry[]): string {
    const hasFaq = !!faqContext && faqContext.length > 0
    const hasKnowledge = !!knowledgeContext && knowledgeContext.length > 0

    const basePrompt = language === 'fa'
      ? `تو دستیار رسمی پشتیبانی پلتفرم کلینیک هستی حسینی هستی (هم وب‌سایت عمومی و هم سیستم CRM).

قوانین پاسخ‌دهی:
1. اگر یکی از «پاسخ‌های تأییدشده» زیر مستقیماً به سوال کاربر جواب می‌دهد، همان پاسخ را عیناً ارائه کن (فقط اصلاح جزئی قالب بلامانع است). متن تأییدشده را با دانش عمومی خود ترکیب نکن.
2. در غیر این صورت، فقط بر اساس «دانش مرجع» ارائه‌شده پاسخ بده. هیچ امکان، صفحه، قیمت، سیاست یا آدرسی که در دانش مرجع نیست را از خودت نساز.
3. اگر پاسخ سوال در دانش مرجع وجود ندارد، بگو که سوال را به پشتیبانی انسانی ارجاع می‌دهی — حدس نزن.
4. سوالات درمانی/بالینی خارج از حوزه توست؛ مؤدبانه اعلام کن که باید با پزشک در میان گذاشته شود.
5. پاسخ حتماً به زبان فارسی، مختصر و مرحله‌به‌مرحله باشد. مسیر دقیق صفحات را ذکر کن.

### دانش مرجع — اطلاعات کامل سیستم:
${getSystemKnowledgeDoc()}

### دانش مرجع — وب‌سایت عمومی کلینیک:
${getSiteKnowledgeDoc()}`
      : `You are the official support assistant for the Hasti Hosseini Clinic platform (both the public website and the CRM system).

Answering rules:
1. If one of the "verified answers" below directly addresses the user's question, reproduce that answer essentially unchanged (minor formatting fixes only). Do NOT blend verified content with your own general knowledge.
2. Otherwise, answer ONLY from the "reference knowledge" provided. Never invent features, pages, prices, policies, or URLs that are not in it.
3. If the reference knowledge does not cover the question, say you are escalating it to human support — do not guess.
4. Clinical/medical advice questions are out of scope; politely state they must be discussed with a physician.
5. Answer in English, concisely and step by step, citing exact page paths where relevant.

### Reference knowledge — complete system information:
${getSystemKnowledgeDoc()}

### Reference knowledge — public clinic website:
${getSiteKnowledgeDoc()}`

    let contextBlock = ''
    if (hasFaq) {
      const faqBlock = faqContext!
        .map((entry, i) => `${i + 1}. Q: ${entry.question}\n   A: ${entry.answer}`)
        .join('\n')

      contextBlock += language === 'fa'
        ? `\n\n### پاسخ‌های تأییدشده (اولویت مطلق):\n${faqBlock}`
        : `\n\n### Verified answers (absolute priority):\n${faqBlock}`
    }
    if (hasKnowledge) {
      const knowledgeBlock = knowledgeContext!
        .map(entry => `--- ${entry.title} ---\n${entry.content}`)
        .join('\n\n')

      contextBlock += language === 'fa'
        ? `\n\n### بخش‌های مرتبط از دانش مرجع:\n${knowledgeBlock}`
        : `\n\n### Relevant reference-knowledge excerpts:\n${knowledgeBlock}`
    }

    return basePrompt + contextBlock
  }

  async askGemini(question: string, language: string, faqContext?: FaqContextEntry[], knowledgeContext?: KnowledgeContextEntry[]): Promise<{
    success: boolean
    response?: string
    confidence?: number
    error?: string
    rateLimited?: boolean
  }> {
    if (!this.geminiKey) {
      return { success: false, error: 'Gemini API key not configured', rateLimited: false }
    }

    try {
      const systemPrompt = this.buildSystemPrompt(language, faqContext, knowledgeContext)

      const response = await axios.post<GeminiResponse>(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiKey}`,
        {
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: question }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
          },
        },
        { timeout: 20000 },
      )

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) {
        return { success: false, error: 'Empty response from Gemini' }
      }

      // Estimate confidence based on response characteristics
      let confidence = 0.7
      if (text.includes('مطمئن نیستم') || text.includes('I\'m not sure')) confidence = 0.4
      if (text.includes('ارجاع می‌دهم') || text.includes('escalat')) confidence = 0.35
      if (faqContext && faqContext.length > 0 && text.length > 200) confidence = 0.8

      return { success: true, response: text, confidence }
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 429) {
        return { success: false, error: 'Gemini rate limit exceeded', rateLimited: true }
      }
      console.error('Gemini API error:', error?.message || error)
      return { success: false, error: error?.message || 'Gemini request failed', rateLimited: false }
    }
  }

  async askGroq(question: string, language: string, faqContext?: FaqContextEntry[], knowledgeContext?: KnowledgeContextEntry[]): Promise<{
    success: boolean
    response?: string
    confidence?: number
    error?: string
    rateLimited?: boolean
  }> {
    if (!this.groqKey) {
      return { success: false, error: 'Groq API key not configured', rateLimited: false }
    }

    try {
      const systemPrompt = this.buildSystemPrompt(language, faqContext, knowledgeContext)

      const response = await axios.post<GroqResponse>(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question },
          ],
          temperature: 0.2,
          max_tokens: 1024,
        },
        {
          headers: { Authorization: `Bearer ${this.groqKey}` },
          timeout: 20000,
        },
      )

      const text = response.data?.choices?.[0]?.message?.content
      if (!text) {
        return { success: false, error: 'Empty response from Groq' }
      }

      let confidence = 0.65
      if (text.includes('مطمئن نیستم') || text.includes('I\'m not sure')) confidence = 0.35
      if (text.includes('ارجاع می‌دهم') || text.includes('escalat')) confidence = 0.3

      return { success: true, response: text, confidence }
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 429) {
        return { success: false, error: 'Groq rate limit exceeded', rateLimited: true }
      }
      console.error('Groq API error:', error?.message || error)
      return { success: false, error: error?.message || 'Groq request failed', rateLimited: false }
    }
  }
}

export const aiSupportService = new AiSupportService()

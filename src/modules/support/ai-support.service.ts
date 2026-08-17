import axios from 'axios'
import { env } from '../../config/env'

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

  async askGemini(question: string, language: string): Promise<{
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
      const systemPrompt = language === 'fa'
        ? `تو یک دستیار پشتیبانی سیستم CRM کلینیک پزشکی هستی. به سوالات کاربران در مورد استفاده از سیستم پاسخ بده.
- فقط به سوالات مربوط به استفاده از سیستم CRM پاسخ بده
- اگر سوال پزشکی بالینی است یا ربطی به سیستم ندارد، بگو که این سوال خارج از حوزه پشتیبانی سیستم است
- پاسخ‌ها را به زبان فارسی و مختصر و مفید بده
- اگر مطمئن نیستی، بگو که سوال را به پشتیبانی انسانی ارجاع می‌دهی`
        : `You are a support assistant for a medical clinic CRM system. Answer user questions about using the system.
- Only answer questions about using the CRM system
- If it's a clinical medical question or unrelated to the system, say it's outside system support scope
- Keep answers concise and helpful
- If unsure, say you'll escalate to human support`

      const response = await axios.post<GeminiResponse>(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiKey}`,
        {
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nQuestion: ${question}` }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        },
        { timeout: 15000 },
      )

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) {
        return { success: false, error: 'Empty response from Gemini' }
      }

      // Estimate confidence based on response characteristics
      let confidence = 0.7
      if (text.includes('مطمئن نیستم') || text.includes('I\'m not sure')) confidence = 0.4
      if (text.includes('خارج از حوزه') || text.includes('outside scope')) confidence = 0.3
      if (text.length > 200) confidence = 0.8

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

  async askGroq(question: string, language: string): Promise<{
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
      const systemPrompt = language === 'fa'
        ? `تو یک دستیار پشتیبانی سیستم CRM کلینیک پزشکی هستی. به سوالات کاربران در مورد استفاده از سیستم پاسخ بده.
- فقط به سوالات مربوط به استفاده از سیستم CRM پاسخ بده
- اگر سوال پزشکی بالینی است یا ربطی به سیستم ندارد، بگو که این سوال خارج از حوزه پشتیبانی سیستم است
- پاسخ‌ها را به زبان فارسی و مختصر و مفید بده
- اگر مطمئن نیستی، بگو که سوال را به پشتیبانی انسانی ارجاع می‌دهی`
        : `You are a support assistant for a medical clinic CRM system. Answer user questions about using the system.
- Only answer questions about using the CRM system
- If it's a clinical medical question or unrelated to the system, say it's outside system support scope
- Keep answers concise and helpful
- If unsure, say you'll escalate to human support`

      const response = await axios.post<GroqResponse>(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question },
          ],
          temperature: 0.3,
          max_tokens: 1024,
        },
        {
          headers: { Authorization: `Bearer ${this.groqKey}` },
          timeout: 15000,
        },
      )

      const text = response.data?.choices?.[0]?.message?.content
      if (!text) {
        return { success: false, error: 'Empty response from Groq' }
      }

      let confidence = 0.65
      if (text.includes('مطمئن نیستم') || text.includes('I\'m not sure')) confidence = 0.35
      if (text.includes('خارج از حوزه') || text.includes('outside scope')) confidence = 0.3
      if (text.length > 200) confidence = 0.75

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

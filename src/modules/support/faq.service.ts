import type { DB } from '../../db/client'
import { faqEntries } from '../../db/schema'
import { eq, and, desc, sql, ilike, or, SQL } from 'drizzle-orm'
import { NotFoundError } from '../../shared/errors'
import type { CreateFaqDto, UpdateFaqDto, SearchFaqDto } from './faq.schema'

export class FaqService {
  constructor(private db: DB) {}

  async search(dto: SearchFaqDto) {
    const { q, language, category, limit } = dto

    const searchColumn = language === 'fa' ? faqEntries.questionFa : faqEntries.questionEn

    const conditions: SQL[] = [
      eq(faqEntries.isPublished, true),
    ]

    if (category) {
      conditions.push(eq(faqEntries.category, category))
    }

    // Use ilike for fuzzy text matching (works without pg_trgm extension)
    // Split query into words and match each word
    const words = q.trim().split(/\s+/).filter(w => w.length > 1)

    if (words.length === 0) {
      return []
    }

    // Build conditions: match ALL words (AND)
    const wordConditions = words.map(word =>
      or(
        ilike(faqEntries.questionFa, `%${word}%`),
        ilike(faqEntries.questionEn, `%${word}%`),
        ilike(faqEntries.answerFa, `%${word}%`),
        ilike(faqEntries.answerEn, `%${word}%`),
      )
    )

    const results = await this.db
      .select({
        id: faqEntries.id,
        questionFa: faqEntries.questionFa,
        answerFa: faqEntries.answerFa,
        questionEn: faqEntries.questionEn,
        answerEn: faqEntries.answerEn,
        category: faqEntries.category,
        tags: faqEntries.tags,
        usageCount: faqEntries.usageCount,
        confidence: faqEntries.confidence,
      })
      .from(faqEntries)
      .where(and(...conditions, or(...wordConditions)))
      .orderBy(desc(faqEntries.usageCount))
      .limit(limit)

    // Score results by how many words matched
    const scored = results.map(r => {
      const text = `${r.questionFa || ''} ${r.questionEn || ''} ${r.answerFa || ''} ${r.answerEn || ''}`.toLowerCase()
      const matchCount = words.filter(w => text.includes(w.toLowerCase())).length
      const score = matchCount / words.length
      return { ...r, score }
    })

    // Filter results with minimum match threshold
    const filtered = scored.filter(r => r.score >= 0.3)

    // Sort by score then usage count
    filtered.sort((a, b) => (b.score - a.score) || (b.usageCount || 0) - (a.usageCount || 0))

    // Increment usage count for matched entries
    if (filtered.length > 0) {
      const ids = filtered.map(r => r.id)
      await this.db
        .update(faqEntries)
        .set({ usageCount: sql`${faqEntries.usageCount} + 1` })
        .where(sql`${faqEntries.id} IN ${ids}`)
    }

    return filtered
  }

  async getById(id: string) {
    const [entry] = await this.db
      .select()
      .from(faqEntries)
      .where(eq(faqEntries.id, id))
      .limit(1)

    if (!entry) throw new NotFoundError('FAQ entry')
    return entry
  }

  async list(language: string, category?: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit
    const conditions: SQL[] = []

    if (category) {
      conditions.push(eq(faqEntries.category, category))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(faqEntries)
        .where(whereClause)
        .orderBy(desc(faqEntries.usageCount))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(faqEntries)
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

  async create(dto: CreateFaqDto, createdBy?: string) {
    const [entry] = await this.db
      .insert(faqEntries)
      .values({
        questionFa: dto.question_fa,
        answerFa: dto.answer_fa,
        questionEn: dto.question_en || null,
        answerEn: dto.answer_en || null,
        category: dto.category,
        tags: dto.tags || [],
        source: dto.source,
        confidence: dto.confidence || 1.0,
        createdBy: createdBy || null,
        isPublished: true,
      })
      .returning()

    return entry
  }

  async update(id: string, dto: UpdateFaqDto, updatedBy?: string) {
    const existing = await this.getById(id)

    const updateData: Record<string, unknown> = {}
    if (dto.question_fa !== undefined) updateData.questionFa = dto.question_fa
    if (dto.answer_fa !== undefined) updateData.answerFa = dto.answer_fa
    if (dto.question_en !== undefined) updateData.questionEn = dto.question_en
    if (dto.answer_en !== undefined) updateData.answerEn = dto.answer_en
    if (dto.category !== undefined) updateData.category = dto.category
    if (dto.tags !== undefined) updateData.tags = dto.tags
    if (dto.source !== undefined) updateData.source = dto.source
    if (dto.confidence !== undefined) updateData.confidence = dto.confidence

    updateData.updatedAt = new Date()

    const [updated] = await this.db
      .update(faqEntries)
      .set(updateData)
      .where(eq(faqEntries.id, id))
      .returning()

    return updated
  }

  async approve(id: string, approvedBy: string) {
    const [updated] = await this.db
      .update(faqEntries)
      .set({
        isPublished: true,
        source: 'approved',
        approvedBy,
        updatedAt: new Date(),
      })
      .where(eq(faqEntries.id, id))
      .returning()

    if (!updated) throw new NotFoundError('FAQ entry')
    return updated
  }

  async delete(id: string) {
    const [deleted] = await this.db
      .delete(faqEntries)
      .where(eq(faqEntries.id, id))
      .returning()

    if (!deleted) throw new NotFoundError('FAQ entry')
    return { id: deleted.id, deleted: true }
  }

  async searchFallback(q: string, language: string, limit = 5) {
    return this.search({ q, language: (language as 'fa' | 'en'), limit })
  }

  async getPendingApprovals(page = 1, limit = 20) {
    const offset = (page - 1) * limit

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(faqEntries)
        .where(eq(faqEntries.isPublished, false))
        .orderBy(desc(faqEntries.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(faqEntries)
        .where(eq(faqEntries.isPublished, false)),
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
}

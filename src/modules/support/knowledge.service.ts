import type { DB } from '../../db/client'
import { knowledgeChunks, faqEntries } from '../../db/schema'
import { eq, sql } from 'drizzle-orm'
import { EmbeddingService } from './embedding.service'
import { getSystemKnowledgeDoc } from './system-knowledge'
import { getSiteKnowledgeDoc } from './site-knowledge'

export interface SemanticMatch {
  sourceType: 'faq' | 'system' | 'site'
  sourceRef: string | null
  title: string
  content: string
  /** Cosine similarity, -1..1 (typically 0..0.9 for related text). */
  cosine: number
}

interface CachedChunk {
  id: string
  sourceType: 'faq' | 'system' | 'site'
  sourceRef: string | null
  title: string
  content: string
  language: string
  embedding: number[]
}

const CHUNK_TARGET_CHARS = 900
const CACHE_TTL_MS = 10 * 60 * 1000

// Process-wide embedding cache — survives across service instances and is
// invalidated whenever the knowledge base is rebuilt.
let chunkCache: { chunks: CachedChunk[]; loadedAt: number } | null = null

export class KnowledgeService {
  private embeddingService: EmbeddingService

  constructor(private db: DB) {
    this.embeddingService = new EmbeddingService()
  }

  /**
   * Rebuild the whole knowledge base: published FAQ entries + system doc +
   * public site doc, chunked and embedded. Deletes previous chunks.
   */
  async rebuildKnowledgeBase(): Promise<{ chunks: number; faqEntries: number }> {
    type SourceChunk = {
      sourceType: 'faq' | 'system' | 'site'
      sourceRef: string | null
      title: string
      content: string
      language: 'fa' | 'en' | 'both'
    }
    const pending: SourceChunk[] = []

    // 1. Published curated FAQ entries — one chunk per language
    const faqRows = await this.db
      .select({
        id: faqEntries.id,
        questionFa: faqEntries.questionFa,
        answerFa: faqEntries.answerFa,
        questionEn: faqEntries.questionEn,
        answerEn: faqEntries.answerEn,
        category: faqEntries.category,
        tags: faqEntries.tags,
      })
      .from(faqEntries)
      .where(eq(faqEntries.isPublished, true))

    for (const row of faqRows) {
      const tagLine = row.tags && row.tags.length > 0 ? `\nTags: ${row.tags.join(', ')}` : ''
      pending.push({
        sourceType: 'faq',
        sourceRef: row.id,
        title: row.questionFa,
        content: `[FAQ · ${row.category}]\nسوال: ${row.questionFa}\nپاسخ: ${row.answerFa}${tagLine}`,
        language: 'fa',
      })
      if (row.questionEn && row.answerEn) {
        pending.push({
          sourceType: 'faq',
          sourceRef: row.id,
          title: row.questionEn,
          content: `[FAQ · ${row.category}]\nQ: ${row.questionEn}\nA: ${row.answerEn}${tagLine}`,
          language: 'en',
        })
      }
    }

    // 2. Static reference documents
    pending.push(...this.chunkDocument(getSystemKnowledgeDoc(), 'system', 'System Reference'))
    pending.push(...this.chunkDocument(getSiteKnowledgeDoc(), 'site', 'Public Website'))

    if (!this.embeddingService.isAvailable()) {
      throw new Error('Cannot rebuild knowledge base: GEMINI_API_KEY not configured')
    }

    // 3. Embed everything
    const vectors = await this.embeddingService.embedBatch(pending.map(c => c.content))

    // 4. Replace table contents atomically
    await this.db.transaction(async (tx) => {
      await tx.delete(knowledgeChunks)
      const rows = pending.map((chunk, i) => ({
        sourceType: chunk.sourceType,
        sourceRef: chunk.sourceRef,
        title: chunk.title.slice(0, 500),
        content: chunk.content,
        language: chunk.language,
        embedding: vectors[i],
        chunkIndex: 0,
        isActive: true,
      }))
      // Group per source so chunk_index stays unique within (source_type, source_ref)
      const counters = new Map<string, number>()
      for (const row of rows) {
        const key = `${row.sourceType}:${row.sourceRef ?? ''}`
        row.chunkIndex = counters.get(key) ?? 0
        counters.set(key, row.chunkIndex + 1)
      }
      for (let i = 0; i < rows.length; i += 50) {
        await tx.insert(knowledgeChunks).values(rows.slice(i, i + 50))
      }
    })

    this.invalidateCache()
    return { chunks: pending.length, faqEntries: faqRows.length }
  }

  /**
   * Semantic search over the knowledge base. Returns top-K matches above a
   * minimum cosine similarity. Falls back to an empty array when embeddings
   * are unavailable or the base has not been built yet.
   */
  async searchSemantic(question: string, limit = 8, minCosine = 0.5): Promise<SemanticMatch[]> {
    if (!this.embeddingService.isAvailable()) return []
    try {
      const chunks = await this.getCachedChunks()
      if (chunks.length === 0) return []

      const queryVector = await this.embeddingService.embedQuery(question)
      const scored = chunks
        .map(chunk => ({ chunk, cosine: this.cosine(queryVector, chunk.embedding) }))
        .filter(item => item.cosine >= minCosine)
        .sort((a, b) => b.cosine - a.cosine)
        .slice(0, limit)

      return scored.map(({ chunk, cosine }) => ({
        sourceType: chunk.sourceType,
        sourceRef: chunk.sourceRef,
        title: chunk.title,
        content: chunk.content,
        cosine,
      }))
    } catch (error) {
      console.error('Semantic search failed:', error instanceof Error ? error.message : error)
      return []
    }
  }

  invalidateCache(): void {
    chunkCache = null
  }

  private async getCachedChunks(): Promise<CachedChunk[]> {
    if (chunkCache && Date.now() - chunkCache.loadedAt < CACHE_TTL_MS) {
      return chunkCache.chunks
    }

    const rows = await this.db
      .select({
        id: knowledgeChunks.id,
        sourceType: knowledgeChunks.sourceType,
        sourceRef: knowledgeChunks.sourceRef,
        title: knowledgeChunks.title,
        content: knowledgeChunks.content,
        language: knowledgeChunks.language,
        embedding: knowledgeChunks.embedding,
      })
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.isActive, true))

    const chunks = rows
      .filter(r => Array.isArray(r.embedding) && r.embedding.length > 0)
      .map(r => ({
        id: r.id,
        sourceType: r.sourceType as CachedChunk['sourceType'],
        sourceRef: r.sourceRef,
        title: r.title,
        content: r.content,
        language: r.language,
        embedding: r.embedding as number[],
      }))

    chunkCache = { chunks, loadedAt: Date.now() }
    return chunks
  }

  /**
   * Split a markdown-ish document into titled chunks grouped around
   * headings/paragraphs, targeting CHUNK_TARGET_CHARS per chunk.
   */
  private chunkDocument(doc: string, sourceType: 'system' | 'site', fallbackTitle: string) {
    const lines = doc.split('\n')
    const sections: Array<{ title: string; body: string[] }> = [{ title: fallbackTitle, body: [] }]

    for (const line of lines) {
      const heading = line.match(/^#{2,4}\s+(.*)$/)
      if (heading) {
        sections.push({ title: heading[1].trim(), body: [] })
      } else {
        sections[sections.length - 1].body.push(line)
      }
    }

    const chunks: Array<{ sourceType: 'system' | 'site'; sourceRef: null; title: string; content: string; language: 'both' }> = []
    for (const section of sections) {
      const text = section.body.join('\n').trim()
      if (!text) continue
      for (const piece of this.splitIntoPieces(text, CHUNK_TARGET_CHARS)) {
        chunks.push({
          sourceType,
          sourceRef: null,
          title: `${fallbackTitle} — ${section.title}`,
          content: `${section.title}\n${piece}`,
          language: 'both',
        })
      }
    }
    return chunks
  }

  private splitIntoPieces(text: string, targetChars: number): string[] {
    if (text.length <= targetChars) return [text]
    const paragraphs = text.split(/\n{2,}/)
    const pieces: string[] = []
    let current = ''

    for (const paragraph of paragraphs) {
      if (current && current.length + paragraph.length + 2 > targetChars) {
        pieces.push(current.trim())
        current = ''
      }
      if (paragraph.length > targetChars) {
        // Hard-split oversized paragraphs on sentence boundaries
        if (current) {
          pieces.push(current.trim())
          current = ''
        }
        for (let i = 0; i < paragraph.length; i += targetChars) {
          pieces.push(paragraph.slice(i, i + targetChars).trim())
        }
        continue
      }
      current += (current ? '\n\n' : '') + paragraph
    }
    if (current.trim()) pieces.push(current.trim())
    return pieces.filter(Boolean)
  }

  private cosine(a: number[], b: number[]): number {
    let dot = 0
    let normA = 0
    let normB = 0
    const len = Math.min(a.length, b.length)
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB)
    return denom === 0 ? 0 : dot / denom
  }
}

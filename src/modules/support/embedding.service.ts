import axios from 'axios'
import { env } from '../../config/env'

interface EmbedContentResponse {
  embedding?: { values: number[] }
}

interface BatchEmbedContentsResponse {
  embeddings: Array<{ values: number[] }>
}

const BATCH_SIZE = 20
const MAX_RETRIES = 3

/**
 * Text embeddings via the Gemini API (text-embedding-004, 768 dimensions).
 * Uses the same GEMINI_API_KEY as the chat models.
 */
export class EmbeddingService {
  private apiKey: string | null

  constructor() {
    this.apiKey = env.GEMINI_API_KEY || null
  }

  isAvailable(): boolean {
    return !!this.apiKey
  }

  get model(): string {
    return env.GEMINI_EMBEDDING_MODEL
  }

  /**
   * Embed a batch of texts. Returns one vector per input text, in order.
   */
  async embedBatch(texts: string[], taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT'): Promise<number[][]> {
    if (!this.apiKey) throw new Error('Embedding service unavailable: GEMINI_API_KEY not configured')
    if (texts.length === 0) return []

    const vectors: number[][] = []
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE)
      const batchVectors = await this.embedChunkWithRetry(batch, taskType)
      vectors.push(...batchVectors)
    }
    return vectors
  }

  async embedQuery(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([text], 'RETRIEVAL_QUERY')
    return vector
  }

  private async embedChunkWithRetry(texts: string[], taskType: string): Promise<number[][]> {
    let lastError: unknown
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.embedChunk(texts, taskType)
      } catch (error: any) {
        lastError = error
        const status = error?.response?.status
        if (status === 429 || status >= 500) {
          // Exponential backoff for rate limits / transient errors
          await new Promise(resolve => setTimeout(resolve, attempt * 1500))
          continue
        }
        throw error
      }
    }
    throw lastError
  }

  private async embedChunk(texts: string[], taskType: string): Promise<number[][]> {
    const response = await axios.post<BatchEmbedContentsResponse>(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:batchEmbedContents?key=${this.apiKey}`,
      {
        requests: texts.map(text => ({
          model: `models/${this.model}`,
          content: { parts: [{ text }] },
          taskType,
        })),
      },
      { timeout: 30000 },
    )

    const embeddings = response.data?.embeddings
    if (!embeddings || embeddings.length !== texts.length) {
      throw new Error(`Embedding API returned ${embeddings?.length ?? 0} vectors for ${texts.length} inputs`)
    }
    return embeddings.map(e => e.values)
  }
}

/** Single-question embed helper used at query time. */
export async function embedQuestion(question: string): Promise<number[] | null> {
  const service = new EmbeddingService()
  if (!service.isAvailable()) return null
  try {
    return await service.embedQuery(question)
  } catch (error) {
    console.error('Question embedding failed:', error instanceof Error ? error.message : error)
    return null
  }
}

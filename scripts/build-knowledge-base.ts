/**
 * Rebuilds the AI knowledge base (knowledge_chunks table):
 * published FAQ entries + system reference + public website docs,
 * chunked and embedded with Gemini text-embedding-004.
 *
 * Usage:
 *   npm run kb:rebuild
 *
 * Requires DATABASE_URL and GEMINI_API_KEY in environment or .env file.
 */

import { resolve } from 'path'
import { config } from 'dotenv'

config({ path: resolve(__dirname, '../.env') })

import { getDb } from '../src/db/client'
import { KnowledgeService } from '../src/modules/support/knowledge.service'
import { env } from '../src/config/env'

async function main() {
  if (!env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set — cannot build knowledge base.')
    process.exit(1)
  }

  const db = getDb()
  const service = new KnowledgeService(db)

  console.log('Rebuilding knowledge base (chunking + embedding)...')
  const started = Date.now()
  const result = await service.rebuildKnowledgeBase()
  const seconds = ((Date.now() - started) / 1000).toFixed(1)

  console.log(`Done in ${seconds}s — ${result.chunks} chunks embedded from ${result.faqEntries} published FAQ entries + system/site docs.`)
  process.exit(0)
}

main().catch((error) => {
  console.error('Knowledge base rebuild failed:', error)
  process.exit(1)
})

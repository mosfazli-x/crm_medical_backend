/** ONE-OFF probe: find working auth style + embedding model. Prints status codes only. */
import { resolve } from 'path'
import axios from 'axios'
import { config } from 'dotenv'

config({ path: resolve(__dirname, '../.env') })
const key = process.env.GEMINI_API_KEY || ''
const base = 'https://generativelanguage.googleapis.com/v1beta'

async function attempt(label: string, url: string, headers: Record<string, string>, data: unknown) {
  try {
    const res = await axios.post(url, data, { headers, timeout: 20000 })
    const dims = JSON.stringify(res.data).includes('values')
    console.log(`${label}: ${res.status} OK (has vectors: ${dims})`)
  } catch (error: any) {
    const body = typeof error?.response?.data === 'string'
      ? error.response.data.slice(0, 120).replace(/\s+/g, ' ')
      : JSON.stringify(error?.response?.data)?.slice(0, 160)
    console.log(`${label}: ${error?.response?.status ?? 'ERR'} ${body ?? error.message}`)
  }
}

const single = { model: 'models/MODEL', content: { parts: [{ text: 'test' }] }, taskType: 'RETRIEVAL_QUERY' }
const batch = (model: string) => ({
  requests: [{ model: `models/${model}`, content: { parts: [{ text: 'test' }] }, taskType: 'RETRIEVAL_DOCUMENT' }],
})

async function main() {
  for (const model of ['text-embedding-004', 'gemini-embedding-001']) {
    await attempt(`batchEmbedContents header ${model}`, `${base}/models/${model}:batchEmbedContents`, { 'x-goog-api-key': key }, batch(model))
  }
  for (const model of ['text-embedding-004', 'gemini-embedding-001']) {
    await attempt(
      `embedContent header ${model}`,
      `${base}/models/${model}:embedContent`,
      { 'x-goog-api-key': key },
      { ...single, model: `models/${model}` },
    )
  }
  await attempt('generateContent header gemini-3.5-flash', `${base}/models/gemini-3.5-flash:generateContent`, { 'x-goog-api-key': key }, {
    contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
    generationConfig: { maxOutputTokens: 16 },
  })
}

main().then(() => process.exit(0))

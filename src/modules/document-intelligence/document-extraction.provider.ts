import { env } from '../../config/env'
import type { DocumentExtractionProvider } from './document-extraction.types'
import { GeminiDocumentExtractionProvider } from './gemini-extraction.provider'
import { MedicalDocumentAiProvider } from './medical-document-ai.provider'

export function createDocumentExtractionProvider(): DocumentExtractionProvider {
  if (env.DOCUMENT_AI_PROVIDER === 'gemini') {
    return new GeminiDocumentExtractionProvider()
  }
  return new MedicalDocumentAiProvider()
}

export const documentExtractionProvider = createDocumentExtractionProvider()

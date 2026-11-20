import type { ExtractedDocument } from './document-intelligence.schema'

export interface DocumentExtractionInput {
  buffer: Buffer
  mimeType: string
  fileName: string
}

export interface DocumentExtractionResult {
  data: ExtractedDocument
  rawText: string
  model: string
}

export interface DocumentExtractionProvider {
  isAvailable(): boolean
  extract(input: DocumentExtractionInput): Promise<DocumentExtractionResult>
}

export {
  documentIntelligenceRoutes,
  documentIntelligenceWorkspaceRoutes,
} from './document-intelligence.routes'
export { DocumentExtractionService } from './document-intelligence.service'
export { DocumentIntelligenceController } from './document-intelligence.controller'
export { startDocumentExtractionWorker } from './document-intelligence.worker'
export type { DocumentExtractionWorker } from './document-intelligence.worker'
export {
  ExtractedDocumentSchema,
  ExtractedTestSchema,
  LAB_CATEGORIES,
  normalizeExtractedDocument,
} from './document-intelligence.schema'
export type { ExtractedDocument, ExtractedTest, LabCategory } from './document-intelligence.schema'
export { documentExtractionProvider } from './document-extraction.provider'
export type {
  DocumentExtractionProvider,
  DocumentExtractionInput,
  DocumentExtractionResult,
} from './document-extraction.types'

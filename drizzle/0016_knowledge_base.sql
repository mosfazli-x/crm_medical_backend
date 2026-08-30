-- Knowledge base for AI support (RAG).
-- Stores chunked site knowledge with Gemini text embeddings.
-- pgvector is not available on the current PostgreSQL host, so embeddings
-- are stored as JSONB arrays and cosine similarity is computed in the
-- application layer. If the database is later moved to a pgvector-capable
-- host, this column can be migrated to vector(768) with an HNSW index.

CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" varchar(20) NOT NULL,
	"source_ref" varchar(200),
	"title" text NOT NULL,
	"content" text NOT NULL,
	"language" varchar(5) DEFAULT 'both' NOT NULL,
	"embedding" jsonb,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "idx_knowledge_chunks_source" ON "knowledge_chunks" ("source_type", "source_ref");--> statement-breakpoint
CREATE INDEX "idx_knowledge_chunks_active" ON "knowledge_chunks" ("is_active");--> statement-breakpoint
CREATE INDEX "idx_knowledge_chunks_trgm_content" ON "knowledge_chunks" USING gin ("content" gin_trgm_ops);--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "uq_knowledge_chunks_source_chunk" UNIQUE ("source_type", "source_ref", "chunk_index");--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "chk_knowledge_chunks_source_type" CHECK ("knowledge_chunks"."source_type" IN ('faq', 'system', 'site'));--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "chk_knowledge_chunks_language" CHECK ("knowledge_chunks"."language" IN ('fa', 'en', 'both'));

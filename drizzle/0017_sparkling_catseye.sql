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
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_knowledge_chunks_source_type" CHECK ("knowledge_chunks"."source_type" IN ('faq', 'system', 'site')),
	CONSTRAINT "chk_knowledge_chunks_language" CHECK ("knowledge_chunks"."language" IN ('fa', 'en', 'both'))
);
--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "national_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "is_foreign" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "nationality" varchar(100);--> statement-breakpoint
CREATE INDEX "idx_knowledge_chunks_source" ON "knowledge_chunks" USING btree ("source_type","source_ref");--> statement-breakpoint
CREATE INDEX "idx_knowledge_chunks_active" ON "knowledge_chunks" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_knowledge_chunks_source_chunk" ON "knowledge_chunks" USING btree ("source_type","source_ref","chunk_index");
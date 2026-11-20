CREATE TABLE "document_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attachment_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"document_type" varchar(50),
	"raw_text" text,
	"structured_data" jsonb,
	"confidence" numeric(4, 3),
	"model" varchar(100),
	"prompt_version" varchar(20),
	"page_count" integer,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"processed_at" timestamp,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_processing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attachment_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"locked_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lab_results" ADD COLUMN "source_attachment_id" uuid;--> statement-breakpoint
ALTER TABLE "lab_results" ADD COLUMN "extraction_id" uuid;--> statement-breakpoint
ALTER TABLE "lab_results" ADD COLUMN "review_status" varchar(20) DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_processing_jobs" ADD CONSTRAINT "document_processing_jobs_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_extractions_attachment" ON "document_extractions" USING btree ("attachment_id");--> statement-breakpoint
CREATE INDEX "idx_document_extractions_patient" ON "document_extractions" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_document_extractions_status" ON "document_extractions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_processing_jobs_attachment" ON "document_processing_jobs" USING btree ("attachment_id");--> statement-breakpoint
CREATE INDEX "idx_document_processing_jobs_status" ON "document_processing_jobs" USING btree ("status","next_attempt_at");--> statement-breakpoint
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_source_attachment_id_attachments_id_fk" FOREIGN KEY ("source_attachment_id") REFERENCES "public"."attachments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_extraction_id_document_extractions_id_fk" FOREIGN KEY ("extraction_id") REFERENCES "public"."document_extractions"("id") ON DELETE set null ON UPDATE no action;
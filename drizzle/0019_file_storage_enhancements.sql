ALTER TABLE "attachments" ADD COLUMN "file_hash" varchar(64) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "file_size" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "mime_type" varchar(100) DEFAULT 'application/octet-stream' NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "storage_path" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "deleted_at" timestamp;

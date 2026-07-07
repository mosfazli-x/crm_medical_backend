ALTER TABLE "messages" ADD COLUMN "deleted_by_sender" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "deleted_by_receiver" boolean DEFAULT false NOT NULL;
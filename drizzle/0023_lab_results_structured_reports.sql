ALTER TABLE "lab_results" ALTER COLUMN "value" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lab_results" ADD COLUMN "report_type" varchar(50);--> statement-breakpoint
ALTER TABLE "lab_results" ADD COLUMN "report_data" jsonb;
ALTER TABLE "doctor_visit_types" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "doctor_visit_types" ADD COLUMN "deleted_at" timestamp;

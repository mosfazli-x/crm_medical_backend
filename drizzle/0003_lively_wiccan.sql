CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pregnancies" ADD COLUMN "live_births" integer;--> statement-breakpoint
ALTER TABLE "pregnancies" ADD COLUMN "abortions" integer;--> statement-breakpoint
ALTER TABLE "pregnancies" ADD COLUMN "current_week" integer;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
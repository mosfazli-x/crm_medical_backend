ALTER TABLE "pregnancies" DROP CONSTRAINT "pregnancies_patient_id_patients_id_fk";
--> statement-breakpoint
ALTER TABLE "pregnancies" ALTER COLUMN "patient_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pregnancies" ALTER COLUMN "outcome" SET DATA TYPE varchar(30);--> statement-breakpoint
ALTER TABLE "pregnancies" ADD COLUMN "gravida_index" integer;--> statement-breakpoint
ALTER TABLE "pregnancies" ADD COLUMN "status" varchar(20) DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "pregnancies" ADD COLUMN "lmp" date;--> statement-breakpoint
ALTER TABLE "pregnancies" ADD COLUMN "edd" date;--> statement-breakpoint
ALTER TABLE "pregnancies" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "pregnancies" ADD COLUMN "gestational_age_weeks" integer;--> statement-breakpoint
ALTER TABLE "pregnancies" ADD COLUMN "gestational_age_days" integer;--> statement-breakpoint
ALTER TABLE "pregnancies" ADD COLUMN "delivery_method" varchar(40);--> statement-breakpoint
ALTER TABLE "pregnancies" ADD COLUMN "anesthesia_type" varchar(30);--> statement-breakpoint
ALTER TABLE "pregnancies" ADD COLUMN "maternal_complications" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "pregnancies" ADD COLUMN "prenatal_screenings" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "pregnancies" ADD COLUMN "newborns_details" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "pregnancies" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "pregnancies" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "pregnancies" ADD CONSTRAINT "pregnancies_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pregnancies" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "pregnancies" DROP COLUMN "live_births";--> statement-breakpoint
ALTER TABLE "pregnancies" DROP COLUMN "abortions";--> statement-breakpoint
ALTER TABLE "pregnancies" DROP COLUMN "current_week";--> statement-breakpoint
ALTER TABLE "pregnancies" DROP COLUMN "pregnancy_date";
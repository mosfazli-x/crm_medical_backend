CREATE TABLE "sms_broadcast_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broadcast_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'sent' NOT NULL,
	"error" text,
	"phone" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "sms_broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"message" text NOT NULL,
	"target_type" varchar(20) DEFAULT 'all' NOT NULL,
	"target_patient_ids" jsonb,
	"days_of_week" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hour" integer DEFAULT 9 NOT NULL,
	"minute" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"total_sent" integer DEFAULT 0 NOT NULL,
	"total_failed" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "chk_sms_broadcasts_target_type" CHECK ("sms_broadcasts"."target_type" IN ('all', 'specific')),
	CONSTRAINT "chk_sms_broadcasts_hour" CHECK ("sms_broadcasts"."hour" BETWEEN 0 AND 23),
	CONSTRAINT "chk_sms_broadcasts_minute" CHECK ("sms_broadcasts"."minute" BETWEEN 0 AND 59)
);
--> statement-breakpoint
ALTER TABLE "sms_broadcast_logs" ADD CONSTRAINT "sms_broadcast_logs_broadcast_id_sms_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."sms_broadcasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_broadcast_logs" ADD CONSTRAINT "sms_broadcast_logs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_broadcasts" ADD CONSTRAINT "sms_broadcasts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sms_broadcast_logs_broadcast" ON "sms_broadcast_logs" USING btree ("broadcast_id");--> statement-breakpoint
CREATE INDEX "idx_sms_broadcast_logs_patient" ON "sms_broadcast_logs" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_sms_broadcast_logs_sent_at" ON "sms_broadcast_logs" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_sms_broadcast_logs_status" ON "sms_broadcast_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sms_broadcasts_active" ON "sms_broadcasts" USING btree ("is_active");
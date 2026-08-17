CREATE TABLE "faq_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_fa" text NOT NULL,
	"answer_fa" text NOT NULL,
	"question_en" text,
	"answer_en" text,
	"category" varchar(50) DEFAULT 'general' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[],
	"source" varchar(30) DEFAULT 'manual' NOT NULL,
	"source_ai_model" varchar(100),
	"confidence" real DEFAULT 1,
	"usage_count" integer DEFAULT 0,
	"is_published" boolean DEFAULT true,
	"created_by" uuid,
	"approved_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_faq_source" CHECK ("faq_entries"."source" IN ('manual', 'gemini', 'groq', 'user_confirmed', 'approved')),
	CONSTRAINT "chk_faq_category" CHECK ("faq_entries"."category" IN ('general', 'billing', 'scheduling', 'clinical', 'patients', 'prescriptions', 'lab_results', 'inventory', 'accounting', 'staff', 'settings', 'other'))
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question" text NOT NULL,
	"question_language" varchar(5) DEFAULT 'fa' NOT NULL,
	"ai_provider" varchar(20),
	"ai_model" varchar(100),
	"ai_response" text,
	"ai_confidence" real,
	"ai_response_fa" text,
	"ai_response_en" text,
	"ai_attempts" integer DEFAULT 0,
	"escalated" boolean DEFAULT false,
	"escalated_to_telegram" boolean DEFAULT false,
	"escalated_to_crm" boolean DEFAULT false,
	"telegram_message_id" integer,
	"resolved" boolean DEFAULT false,
	"resolved_answer" text,
	"resolved_by" varchar(30),
	"resolved_at" timestamp,
	"needs_approval" boolean DEFAULT false,
	"published_faq_id" uuid,
	"response_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_support_tickets_ai_provider" CHECK ("support_tickets"."ai_provider" IS NULL OR "support_tickets"."ai_provider" IN ('gemini', 'groq')),
	CONSTRAINT "chk_support_tickets_resolved_by" CHECK ("support_tickets"."resolved_by" IS NULL OR "support_tickets"."resolved_by" IN ('user_confirmed', 'admin', 'ai'))
);
--> statement-breakpoint
ALTER TABLE "faq_entries" ADD CONSTRAINT "faq_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq_entries" ADD CONSTRAINT "faq_entries_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_published_faq_id_faq_entries_id_fk" FOREIGN KEY ("published_faq_id") REFERENCES "public"."faq_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_faq_category" ON "faq_entries" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_faq_published" ON "faq_entries" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "idx_faq_usage" ON "faq_entries" USING btree ("usage_count");--> statement-breakpoint
CREATE INDEX "idx_faq_tags" ON "faq_entries" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_user" ON "support_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_resolved" ON "support_tickets" USING btree ("resolved");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_approval" ON "support_tickets" USING btree ("needs_approval");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_created" ON "support_tickets" USING btree ("created_at");
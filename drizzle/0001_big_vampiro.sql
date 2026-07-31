CREATE TABLE "lead_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"type" varchar(30) NOT NULL,
	"note" text,
	"performed_by" uuid,
	"old_status" varchar(30),
	"new_status" varchar(30),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_lead_activity_type" CHECK ("lead_activities"."type" IN ('created', 'contacted', 'note_added', 'status_changed', 'assigned', 'qualified', 'appointment_booked', 'visit_completed', 'converted', 'lost'))
);
--> statement-breakpoint
CREATE TABLE "lead_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"body" text NOT NULL,
	"author_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(30) NOT NULL,
	"category" varchar(30) DEFAULT 'other' NOT NULL,
	"description" text,
	"color" varchar(7),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_lead_source_type" CHECK ("lead_sources"."type" IN ('instagram', 'google_ads', 'google_search', 'website', 'referral', 'walk_in', 'whatsapp', 'telegram', 'phone_call', 'other')),
	CONSTRAINT "chk_lead_source_category" CHECK ("lead_sources"."category" IN ('social', 'paid_ads', 'organic', 'referral', 'direct', 'messaging', 'other'))
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"phone" varchar(20),
	"national_id" varchar(10),
	"source_id" uuid,
	"campaign_name" varchar(150),
	"utm_source" varchar(100),
	"utm_medium" varchar(100),
	"utm_campaign" varchar(100),
	"referrer_url" text,
	"landing_url" text,
	"status" varchar(30) DEFAULT 'new' NOT NULL,
	"priority" varchar(10) DEFAULT 'medium' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected_service_id" uuid,
	"expected_visit_type_id" uuid,
	"expected_value" numeric(12, 2),
	"assigned_staff_id" uuid,
	"assigned_doctor_id" uuid,
	"first_contact_at" timestamp,
	"last_contact_at" timestamp,
	"next_follow_up_at" timestamp,
	"last_activity_at" timestamp,
	"converted_patient_id" uuid,
	"conversion_date" timestamp,
	"converted_by_id" uuid,
	"conversion_note" text,
	"lost_reason" varchar(30),
	"lost_at" timestamp,
	"note" text,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"marketing_consent_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_lead_status" CHECK ("leads"."status" IN ('new', 'contacted', 'qualified', 'appointment_booked', 'visited', 'converted', 'lost')),
	CONSTRAINT "chk_lead_priority" CHECK ("leads"."priority" IN ('low', 'medium', 'high')),
	CONSTRAINT "chk_lead_lost_reason" CHECK ("leads"."lost_reason" IS NULL OR "leads"."lost_reason" IN ('not_interested', 'budget', 'competitor', 'unreachable', 'wrong_number', 'duplicate', 'other'))
);
--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_source_id_lead_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."lead_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_expected_service_id_procedure_codes_id_fk" FOREIGN KEY ("expected_service_id") REFERENCES "public"."procedure_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_expected_visit_type_id_doctor_visit_types_id_fk" FOREIGN KEY ("expected_visit_type_id") REFERENCES "public"."doctor_visit_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_doctor_id_users_id_fk" FOREIGN KEY ("assigned_doctor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_patient_id_patients_id_fk" FOREIGN KEY ("converted_patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_by_id_users_id_fk" FOREIGN KEY ("converted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lead_activities_lead" ON "lead_activities" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_lead_activities_lead_created" ON "lead_activities" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_lead_activities_type" ON "lead_activities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_lead_activities_performed" ON "lead_activities" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "idx_lead_notes_lead" ON "lead_notes" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_lead_sources_active" ON "lead_sources" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_lead_sources_type" ON "lead_sources" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_leads_status" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_leads_priority" ON "leads" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_leads_source" ON "leads" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_leads_assigned_staff" ON "leads" USING btree ("assigned_staff_id");--> statement-breakpoint
CREATE INDEX "idx_leads_assigned_doctor" ON "leads" USING btree ("assigned_doctor_id");--> statement-breakpoint
CREATE INDEX "idx_leads_phone" ON "leads" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "idx_leads_next_follow_up" ON "leads" USING btree ("next_follow_up_at");--> statement-breakpoint
CREATE INDEX "idx_leads_created" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_leads_tags" ON "leads" USING gin ("tags");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_leads_converted_patient" ON "leads" USING btree ("converted_patient_id") WHERE "leads"."converted_patient_id" IS NOT NULL;
CREATE TABLE "clinical_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"assessment_type" varchar(50) NOT NULL,
	"result" jsonb NOT NULL,
	"provider_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"visit_id" uuid,
	"doctor_id" uuid,
	"order_date" timestamp DEFAULT now() NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vital_signs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"visit_id" uuid,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"blood_pressure_systolic" integer,
	"blood_pressure_diastolic" integer,
	"heart_rate" integer,
	"respiratory_rate" integer,
	"temperature_celsius" numeric(4, 1),
	"oxygen_saturation" integer,
	"weight_kg" numeric(5, 1),
	"height_cm" numeric(5, 1),
	"bmi" numeric(5, 2),
	"pain_score" integer,
	"notes" text,
	"recorded_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "patient_id" uuid;--> statement-breakpoint
ALTER TABLE "lab_results" ADD COLUMN "lab_order_id" uuid;--> statement-breakpoint
ALTER TABLE "lab_results" ADD COLUMN "validated_by_id" uuid;--> statement-breakpoint
ALTER TABLE "lab_results" ADD COLUMN "validated_at" timestamp;--> statement-breakpoint
ALTER TABLE "screening_results" ADD COLUMN "lab_result_id" uuid;--> statement-breakpoint
ALTER TABLE "clinical_assessments" ADD CONSTRAINT "clinical_assessments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_assessments" ADD CONSTRAINT "clinical_assessments_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_lab_order_id_lab_orders_id_fk" FOREIGN KEY ("lab_order_id") REFERENCES "public"."lab_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_validated_by_id_users_id_fk" FOREIGN KEY ("validated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_results" ADD CONSTRAINT "screening_results_lab_result_id_lab_results_id_fk" FOREIGN KEY ("lab_result_id") REFERENCES "public"."lab_results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
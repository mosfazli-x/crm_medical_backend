CREATE TABLE "allergies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid,
	"substance" varchar(255) NOT NULL,
	"severity" varchar(20),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "diseases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid,
	"name" varchar(255) NOT NULL,
	"diagnosed_at" date,
	"is_active" boolean DEFAULT true,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "medications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid,
	"name" varchar(255) NOT NULL,
	"dosage" varchar(100),
	"is_current" boolean DEFAULT true,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"national_id" char(10) NOT NULL,
	"insurance_code" varchar(50),
	"birth_date" date,
	"phone" varchar(20),
	"address" text,
	"marital_status" varchar(20),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"is_deleted" boolean DEFAULT false,
	"deleted_at" timestamp,
	CONSTRAINT "patients_national_id_unique" UNIQUE("national_id")
);
--> statement-breakpoint
CREATE TABLE "pregnancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid,
	"type" varchar(50),
	"outcome" varchar(50),
	"live_births" integer,
	"pregnancy_date" date,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(20) NOT NULL,
	"patient_id" uuid,
	"full_name" varchar(200),
	"organization_name" varchar(200),
	"phone_confirmed" boolean DEFAULT false,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"requires_password_change" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid,
	"visit_type" varchar(50),
	"visit_reason" varchar(255),
	"notes" text,
	"visit_date" timestamp NOT NULL,
	"duration_minutes" integer DEFAULT 30,
	"status" varchar(20) DEFAULT 'confirmed',
	"reminder_sent" boolean DEFAULT false,
	"next_visit_date" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diseases" ADD CONSTRAINT "diseases_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pregnancies" ADD CONSTRAINT "pregnancies_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
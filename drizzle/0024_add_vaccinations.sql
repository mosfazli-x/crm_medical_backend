CREATE TABLE "vaccinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"vaccine_name" varchar(200) NOT NULL,
	"dose_number" varchar(50),
	"date_administered" date,
	"lot_number" varchar(100),
	"manufacturer" varchar(200),
	"site" varchar(100),
	"administered_by" varchar(200),
	"next_dose_date" date,
	"status" varchar(30),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
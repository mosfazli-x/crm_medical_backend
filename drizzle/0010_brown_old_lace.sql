CREATE TABLE "doctor_visit_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"price" numeric(12, 2),
	"color" varchar(7),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "visit_type_id" uuid;--> statement-breakpoint
ALTER TABLE "doctor_visit_types" ADD CONSTRAINT "doctor_visit_types_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_visit_type_id_doctor_visit_types_id_fk" FOREIGN KEY ("visit_type_id") REFERENCES "public"."doctor_visit_types"("id") ON DELETE no action ON UPDATE no action;
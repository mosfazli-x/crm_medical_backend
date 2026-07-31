CREATE TABLE "doctor_profiles" (
	"doctor_id" uuid PRIMARY KEY NOT NULL,
	"specialty" varchar(255),
	"bio" text,
	"photo_url" text,
	"experience_years" integer,
	"patients_count" integer,
	"rating" numeric(3, 1),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
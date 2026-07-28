CREATE TABLE "staff_attendance_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attendance_id" uuid NOT NULL,
	"check_in_time" timestamp NOT NULL,
	"check_out_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_attendance" ALTER COLUMN "date" SET DATA TYPE varchar(10);--> statement-breakpoint
ALTER TABLE "staff_attendance_sessions" ADD CONSTRAINT "staff_attendance_sessions_attendance_id_staff_attendance_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."staff_attendance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_attendance" DROP COLUMN "check_in_time";--> statement-breakpoint
ALTER TABLE "staff_attendance" DROP COLUMN "check_out_time";
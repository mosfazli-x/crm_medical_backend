CREATE TABLE "clinic_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"assignee_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"priority" varchar(10) DEFAULT 'medium' NOT NULL,
	"due_date" varchar(10),
	"notes" text,
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_clinic_task_status" CHECK ("clinic_tasks"."status" IN ('pending', 'in_progress', 'done', 'cancelled')),
	CONSTRAINT "chk_clinic_task_priority" CHECK ("clinic_tasks"."priority" IN ('low', 'medium', 'high'))
);
--> statement-breakpoint
ALTER TABLE "clinic_tasks" ADD CONSTRAINT "clinic_tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_tasks" ADD CONSTRAINT "clinic_tasks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_clinic_tasks_assignee" ON "clinic_tasks" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "idx_clinic_tasks_status" ON "clinic_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_clinic_tasks_due_date" ON "clinic_tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_clinic_tasks_created" ON "clinic_tasks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_clinic_tasks_assignee_status" ON "clinic_tasks" USING btree ("assignee_id","status");
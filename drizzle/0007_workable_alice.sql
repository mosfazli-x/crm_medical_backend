CREATE TABLE "task_assignees" (
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_assignees_task_id_user_id_pk" PRIMARY KEY("task_id","user_id")
);
--> statement-breakpoint
DROP INDEX "idx_clinic_tasks_assignee";--> statement-breakpoint
DROP INDEX "idx_clinic_tasks_assignee_status";--> statement-breakpoint
ALTER TABLE "clinic_tasks" ADD COLUMN "estimated_minutes" integer;--> statement-breakpoint
ALTER TABLE "clinic_tasks" ADD COLUMN "spent_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_clinic_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."clinic_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_task_assignees_task" ON "task_assignees" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_assignees_user" ON "task_assignees" USING btree ("user_id");
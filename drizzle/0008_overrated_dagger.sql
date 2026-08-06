ALTER TABLE "clinic_tasks" DROP CONSTRAINT "clinic_tasks_assignee_id_users_id_fk";
--> statement-breakpoint
INSERT INTO "task_assignees" ("task_id", "user_id", "assigned_at")
SELECT "id", "assignee_id", now() FROM "clinic_tasks" WHERE "assignee_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "clinic_tasks" DROP COLUMN "assignee_id";
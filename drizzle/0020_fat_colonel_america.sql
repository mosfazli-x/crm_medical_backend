ALTER TABLE "visits" ADD COLUMN "reminder_days_before" integer;--> statement-breakpoint
ALTER TABLE "visits" ADD COLUMN "reminder_sent_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_visits_next_visit_date ON visits(next_visit_date) WHERE next_visit_date IS NOT NULL;

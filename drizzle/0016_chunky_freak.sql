ALTER TABLE "users" ADD COLUMN "sms_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telegram_enabled" boolean DEFAULT true NOT NULL;
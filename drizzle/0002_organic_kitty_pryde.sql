ALTER TABLE "users" ADD COLUMN "status" varchar(20) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "is_active";
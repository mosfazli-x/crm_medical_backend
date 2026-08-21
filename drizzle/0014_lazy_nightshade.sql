CREATE TABLE "login_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event" varchar(20) NOT NULL,
	"browser" varchar(100),
	"browser_version" varchar(50),
	"os" varchar(100),
	"os_version" varchar(50),
	"device" varchar(100),
	"device_type" varchar(20),
	"ip_address" varchar(45),
	"user_agent" text,
	"revoked" boolean DEFAULT false,
	"revoked_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_login_sessions_event" CHECK ("login_sessions"."event" IN ('login', 'logout')),
	CONSTRAINT "chk_login_sessions_device_type" CHECK ("login_sessions"."device_type" IS NULL OR "login_sessions"."device_type" IN ('desktop', 'mobile', 'tablet', 'unknown'))
);
--> statement-breakpoint
ALTER TABLE "login_sessions" ADD CONSTRAINT "login_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_login_sessions_user" ON "login_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_login_sessions_event" ON "login_sessions" USING btree ("event");--> statement-breakpoint
CREATE INDEX "idx_login_sessions_created" ON "login_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_login_sessions_revoked" ON "login_sessions" USING btree ("revoked");--> statement-breakpoint
CREATE INDEX "idx_login_sessions_user_event" ON "login_sessions" USING btree ("user_id","event");
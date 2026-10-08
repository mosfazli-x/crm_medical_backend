CREATE TABLE "cashbook_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"grantee_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_cashbook_access_not_self" CHECK ("cashbook_access_grants"."owner_id" <> "cashbook_access_grants"."grantee_id")
);
--> statement-breakpoint
ALTER TABLE "cashbook_access_grants" ADD CONSTRAINT "cashbook_access_grants_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashbook_access_grants" ADD CONSTRAINT "cashbook_access_grants_grantee_id_users_id_fk" FOREIGN KEY ("grantee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cashbook_access_owner" ON "cashbook_access_grants" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_cashbook_access_grantee" ON "cashbook_access_grants" USING btree ("grantee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cashbook_access_owner_grantee" ON "cashbook_access_grants" USING btree ("owner_id","grantee_id");
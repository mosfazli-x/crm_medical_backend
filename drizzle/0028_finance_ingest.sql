CREATE TABLE "finance_ingest_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" varchar(120) NOT NULL,
	"platform" varchar(20) DEFAULT 'unknown' NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"token_prefix" varchar(12) NOT NULL,
	"last_seen_at" timestamp,
	"message_count" integer DEFAULT 0 NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_finance_ingest_tokens_platform" CHECK ("finance_ingest_tokens"."platform" IN ('android', 'ios', 'web', 'unknown'))
);
--> statement-breakpoint
CREATE TABLE "finance_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ingest_token_id" uuid,
	"source_id" uuid,
	"cashbook_entry_id" uuid,
	"client_message_id" varchar(120),
	"dedupe_key" varchar(64) NOT NULL,
	"channel" varchar(20) DEFAULT 'sms' NOT NULL,
	"sender" varchar(120),
	"raw_text" text NOT NULL,
	"received_at" timestamp NOT NULL,
	"parsed" jsonb,
	"parser_id" varchar(60),
	"confidence" integer DEFAULT 0 NOT NULL,
	"direction" varchar(20),
	"amount_rial" bigint,
	"balance_rial" bigint,
	"card_last4" varchar(4),
	"external_ref" varchar(120),
	"status" varchar(20) DEFAULT 'review' NOT NULL,
	"rejection_reason" varchar(120),
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_finance_messages_status" CHECK ("finance_messages"."status" IN ('posted', 'review', 'duplicate', 'ignored', 'failed')),
	CONSTRAINT "chk_finance_messages_direction" CHECK ("finance_messages"."direction" IS NULL OR "finance_messages"."direction" IN ('income', 'expense'))
);
--> statement-breakpoint
CREATE TABLE "finance_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" varchar(120) NOT NULL,
	"channel" varchar(20) DEFAULT 'sms' NOT NULL,
	"bank_code" varchar(40) NOT NULL,
	"sender_patterns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"card_last4" varchar(4),
	"account_id" uuid NOT NULL,
	"income_category_id" uuid,
	"expense_category_id" uuid,
	"auto_post" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_finance_sources_channel" CHECK ("finance_sources"."channel" IN ('sms', 'android_app', 'ios_shortcut', 'manual', 'bank_api'))
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"billing_record_id" uuid NOT NULL,
	"amount_rial" bigint NOT NULL,
	"match_type" varchar(30) DEFAULT 'manual' NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_payment_allocations_match" CHECK ("payment_allocations"."match_type" IN ('manual', 'reference', 'card', 'name', 'amount')),
	CONSTRAINT "chk_payment_allocations_amount" CHECK ("payment_allocations"."amount_rial" > 0)
);
--> statement-breakpoint
ALTER TABLE "cashbook_accounts" ADD COLUMN "bank_code" varchar(40);--> statement-breakpoint
ALTER TABLE "cashbook_accounts" ADD COLUMN "card_last4" varchar(4);--> statement-breakpoint
ALTER TABLE "cashbook_accounts" ADD COLUMN "iban_last4" varchar(4);--> statement-breakpoint
ALTER TABLE "cashbook_entries" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "cashbook_entries" ADD COLUMN "external_ref" varchar(120);--> statement-breakpoint
ALTER TABLE "cashbook_entries" ADD COLUMN "transfer_group_id" uuid;--> statement-breakpoint
ALTER TABLE "finance_ingest_tokens" ADD CONSTRAINT "finance_ingest_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_messages" ADD CONSTRAINT "finance_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_messages" ADD CONSTRAINT "finance_messages_ingest_token_id_finance_ingest_tokens_id_fk" FOREIGN KEY ("ingest_token_id") REFERENCES "public"."finance_ingest_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_messages" ADD CONSTRAINT "finance_messages_source_id_finance_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."finance_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_messages" ADD CONSTRAINT "finance_messages_cashbook_entry_id_cashbook_entries_id_fk" FOREIGN KEY ("cashbook_entry_id") REFERENCES "public"."cashbook_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_messages" ADD CONSTRAINT "finance_messages_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_sources" ADD CONSTRAINT "finance_sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_sources" ADD CONSTRAINT "finance_sources_account_id_cashbook_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."cashbook_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_sources" ADD CONSTRAINT "finance_sources_income_category_id_cashbook_categories_id_fk" FOREIGN KEY ("income_category_id") REFERENCES "public"."cashbook_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_sources" ADD CONSTRAINT "finance_sources_expense_category_id_cashbook_categories_id_fk" FOREIGN KEY ("expense_category_id") REFERENCES "public"."cashbook_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_entry_id_cashbook_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."cashbook_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_billing_record_id_billing_records_id_fk" FOREIGN KEY ("billing_record_id") REFERENCES "public"."billing_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_finance_ingest_tokens_user" ON "finance_ingest_tokens" USING btree ("user_id","is_revoked");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_finance_ingest_tokens_hash" ON "finance_ingest_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_finance_messages_user_status" ON "finance_messages" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_finance_messages_user_received" ON "finance_messages" USING btree ("user_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_finance_messages_dedupe" ON "finance_messages" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_finance_messages_client" ON "finance_messages" USING btree ("user_id","client_message_id");--> statement-breakpoint
CREATE INDEX "idx_finance_messages_entry" ON "finance_messages" USING btree ("cashbook_entry_id");--> statement-breakpoint
CREATE INDEX "idx_finance_sources_user" ON "finance_sources" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_finance_sources_account" ON "finance_sources" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_finance_sources_bank" ON "finance_sources" USING btree ("bank_code");--> statement-breakpoint
CREATE INDEX "idx_payment_allocations_entry" ON "payment_allocations" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "idx_payment_allocations_billing" ON "payment_allocations" USING btree ("billing_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payment_allocations_entry_billing" ON "payment_allocations" USING btree ("entry_id","billing_record_id");--> statement-breakpoint
CREATE INDEX "idx_cashbook_accounts_bank_match" ON "cashbook_accounts" USING btree ("user_id","bank_code","card_last4");--> statement-breakpoint
CREATE INDEX "idx_cashbook_entries_source" ON "cashbook_entries" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_cashbook_entries_transfer" ON "cashbook_entries" USING btree ("transfer_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cashbook_entries_external_ref" ON "cashbook_entries" USING btree ("user_id","external_ref");
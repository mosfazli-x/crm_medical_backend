CREATE TABLE "cashbook_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"type" varchar(30) DEFAULT 'cash' NOT NULL,
	"opening_balance_rial" bigint DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_cashbook_accounts_type" CHECK ("cashbook_accounts"."type" IN ('cash', 'bank', 'card', 'other'))
);
--> statement-breakpoint
CREATE TABLE "cashbook_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"amount_rial" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_cashbook_budgets_month" CHECK ("cashbook_budgets"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "chk_cashbook_budgets_amount" CHECK ("cashbook_budgets"."amount_rial" > 0)
);
--> statement-breakpoint
CREATE TABLE "cashbook_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"kind" varchar(20) NOT NULL,
	"color" varchar(7),
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_cashbook_categories_kind" CHECK ("cashbook_categories"."kind" IN ('income', 'expense'))
);
--> statement-breakpoint
CREATE TABLE "cashbook_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"kind" varchar(20) NOT NULL,
	"amount_rial" bigint NOT NULL,
	"category_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"description" text NOT NULL,
	"notes" text,
	"reference" varchar(100),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"void_reason" text,
	"voided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_cashbook_entries_kind" CHECK ("cashbook_entries"."kind" IN ('income', 'expense')),
	CONSTRAINT "chk_cashbook_entries_status" CHECK ("cashbook_entries"."status" IN ('active', 'voided')),
	CONSTRAINT "chk_cashbook_entries_amount" CHECK ("cashbook_entries"."amount_rial" > 0)
);
--> statement-breakpoint
CREATE TABLE "cashbook_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" integer NOT NULL,
	"file_hash" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cashbook_receipts_entry_id_unique" UNIQUE("entry_id"),
	CONSTRAINT "chk_cashbook_receipts_size" CHECK ("cashbook_receipts"."file_size" > 0)
);
--> statement-breakpoint
ALTER TABLE "cashbook_accounts" ADD CONSTRAINT "cashbook_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashbook_budgets" ADD CONSTRAINT "cashbook_budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashbook_budgets" ADD CONSTRAINT "cashbook_budgets_category_id_cashbook_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."cashbook_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashbook_categories" ADD CONSTRAINT "cashbook_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashbook_entries" ADD CONSTRAINT "cashbook_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashbook_entries" ADD CONSTRAINT "cashbook_entries_category_id_cashbook_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."cashbook_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashbook_entries" ADD CONSTRAINT "cashbook_entries_account_id_cashbook_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."cashbook_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashbook_receipts" ADD CONSTRAINT "cashbook_receipts_entry_id_cashbook_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."cashbook_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashbook_receipts" ADD CONSTRAINT "cashbook_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cashbook_accounts_user" ON "cashbook_accounts" USING btree ("user_id","is_archived");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cashbook_accounts_user_name" ON "cashbook_accounts" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "idx_cashbook_budgets_user_month" ON "cashbook_budgets" USING btree ("user_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cashbook_budgets_user_category_month" ON "cashbook_budgets" USING btree ("user_id","category_id","month");--> statement-breakpoint
CREATE INDEX "idx_cashbook_categories_user_kind" ON "cashbook_categories" USING btree ("user_id","kind","is_archived");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cashbook_categories_user_kind_name" ON "cashbook_categories" USING btree ("user_id","kind","name");--> statement-breakpoint
CREATE INDEX "idx_cashbook_entries_user_date" ON "cashbook_entries" USING btree ("user_id","entry_date");--> statement-breakpoint
CREATE INDEX "idx_cashbook_entries_user_status" ON "cashbook_entries" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_cashbook_entries_category" ON "cashbook_entries" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_cashbook_entries_account" ON "cashbook_entries" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_cashbook_receipts_user" ON "cashbook_receipts" USING btree ("user_id");
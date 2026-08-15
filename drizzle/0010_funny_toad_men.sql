CREATE TABLE "consumable_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consumable_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consumable_expenses" ADD CONSTRAINT "consumable_expenses_item_id_consumable_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."consumable_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_consumable_expenses_item_month" ON "consumable_expenses" USING btree ("item_id","month");--> statement-breakpoint
CREATE INDEX "idx_consumable_expenses_month" ON "consumable_expenses" USING btree ("month");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_consumable_expenses_item_month" ON "consumable_expenses" USING btree ("item_id","month");--> statement-breakpoint
CREATE INDEX "idx_consumable_items_name" ON "consumable_items" USING btree ("name");
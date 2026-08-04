CREATE TABLE "patient_item_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"visit_id" uuid,
	"quantity" numeric(12, 3) NOT NULL,
	"unit_price" numeric(12, 2),
	"total_price" numeric(15, 2),
	"performed_by_id" uuid NOT NULL,
	"notes" text,
	"used_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patient_item_usages" ADD CONSTRAINT "patient_item_usages_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_item_usages" ADD CONSTRAINT "patient_item_usages_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_item_usages" ADD CONSTRAINT "patient_item_usages_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_item_usages" ADD CONSTRAINT "patient_item_usages_performed_by_id_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_patient_item_usages_patient" ON "patient_item_usages" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_patient_item_usages_product" ON "patient_item_usages" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_patient_item_usages_used_at" ON "patient_item_usages" USING btree ("used_at");

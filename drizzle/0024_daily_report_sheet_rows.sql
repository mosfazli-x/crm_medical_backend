CREATE TABLE "daily_report_sheet_rows" (
	"id" uuid PRIMARY KEY NOT NULL,
	"report_date" date NOT NULL,
	"patient_id" uuid NOT NULL,
	"visit_type" varchar(100) NOT NULL,
	"category" varchar(30) NOT NULL,
	"bank_amount" numeric(12, 2) NOT NULL,
	"pos_amount" numeric(12, 2) NOT NULL,
	"cash_amount" numeric(12, 2) NOT NULL,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_daily_report_sheet_rows_category" CHECK ("daily_report_sheet_rows"."category" IN ('visit', 'mixed_laser', 'single_laser', 'colposcopy', 'co_test', 'miscellaneous')),
	CONSTRAINT "chk_daily_report_sheet_rows_bank_amount" CHECK ("daily_report_sheet_rows"."bank_amount" >= 0),
	CONSTRAINT "chk_daily_report_sheet_rows_pos_amount" CHECK ("daily_report_sheet_rows"."pos_amount" >= 0),
	CONSTRAINT "chk_daily_report_sheet_rows_cash_amount" CHECK ("daily_report_sheet_rows"."cash_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "daily_report_sheet_rows" ADD CONSTRAINT "daily_report_sheet_rows_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_report_sheet_rows" ADD CONSTRAINT "daily_report_sheet_rows_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_daily_report_sheet_rows_date" ON "daily_report_sheet_rows" USING btree ("report_date");--> statement-breakpoint
CREATE INDEX "idx_daily_report_sheet_rows_patient" ON "daily_report_sheet_rows" USING btree ("patient_id");
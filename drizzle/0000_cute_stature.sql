CREATE TABLE "allergies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid,
	"substance" varchar(255) NOT NULL,
	"severity" varchar(20),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid,
	"doctor_id" uuid NOT NULL,
	"appointment_date" date NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"visit_type_id" uuid,
	"patient_first_name" varchar(100) NOT NULL,
	"patient_last_name" varchar(100) NOT NULL,
	"patient_national_id" varchar(10) NOT NULL,
	"patient_phone" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_hash" varchar(64) DEFAULT '' NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"mime_type" varchar(100) DEFAULT 'application/octet-stream' NOT NULL,
	"storage_path" text DEFAULT '' NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(50),
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"procedure_code_id" uuid,
	"visit_id" uuid,
	"description" varchar(500) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"insurance_claim_amount" numeric(12, 2),
	"patient_pay_amount" numeric(12, 2),
	"status" varchar(30) DEFAULT 'pending',
	"billed_date" date,
	"paid_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chart_of_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(30) NOT NULL,
	"parent_id" uuid,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chart_of_accounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "clinic_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"description" varchar(255),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clinic_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "clinical_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"assessment_type" varchar(50) NOT NULL,
	"result" jsonb NOT NULL,
	"provider_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"consent_type" varchar(50) NOT NULL,
	"is_granted" boolean DEFAULT true,
	"granted_at" timestamp DEFAULT now(),
	"revoked_at" timestamp,
	"expires_at" timestamp,
	"granted_by_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contraceptive_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"method" varchar(100) NOT NULL,
	"start_date" date,
	"end_date" date,
	"is_current" boolean DEFAULT true,
	"reason_for_discontinuation" varchar(255),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "diseases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid,
	"name" varchar(255) NOT NULL,
	"diagnosed_at" date,
	"is_active" boolean DEFAULT true,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "doctor_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "doctor_profiles" (
	"doctor_id" uuid PRIMARY KEY NOT NULL,
	"specialty" varchar(255),
	"bio" text,
	"photo_url" text,
	"experience_years" integer,
	"patients_count" integer,
	"rating" numeric(3, 1),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"show_on_landing" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctor_visit_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"price" numeric(12, 2),
	"color" varchar(7),
	"is_active" boolean DEFAULT true,
	"is_deleted" boolean DEFAULT false,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "family_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"relationship" varchar(50) NOT NULL,
	"condition" varchar(255) NOT NULL,
	"age_at_diagnosis" integer,
	"is_deceased" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fetal_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pregnancy_id" uuid NOT NULL,
	"prenatal_visit_id" uuid,
	"measurement_date" timestamp NOT NULL,
	"gestational_age_weeks" integer,
	"gestational_age_days" integer,
	"biparietal_diameter_mm" numeric(5, 1),
	"femur_length_mm" numeric(5, 1),
	"abdominal_circumference_mm" numeric(6, 1),
	"head_circumference_mm" numeric(6, 1),
	"estimated_fetal_weight_g" numeric(6, 1),
	"amniotic_fluid_index" numeric(4, 1),
	"placenta_position" varchar(50),
	"placenta_grade" varchar(10),
	"umbilical_artery_pi" numeric(4, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gynecological_surgeries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"surgery_type" varchar(100) NOT NULL,
	"surgery_date" date,
	"hospital" varchar(255),
	"surgeon_name" varchar(200),
	"indication" text,
	"findings" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_number" varchar(50) NOT NULL,
	"entry_date" date NOT NULL,
	"description" text NOT NULL,
	"reference" varchar(100),
	"reference_type" varchar(50),
	"created_by_id" uuid,
	"status" varchar(20) DEFAULT 'posted',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "journal_entries_entry_number_unique" UNIQUE("entry_number")
);
--> statement-breakpoint
CREATE TABLE "journal_entry_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"debit" numeric(15, 2) DEFAULT '0',
	"credit" numeric(15, 2) DEFAULT '0',
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lab_order_id" uuid NOT NULL,
	"test_name" varchar(200) NOT NULL,
	"test_code" varchar(50),
	"category" varchar(50),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"visit_id" uuid,
	"doctor_id" uuid,
	"order_date" timestamp DEFAULT now() NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"lab_order_id" uuid,
	"category" varchar(50) NOT NULL,
	"test_name" varchar(200) NOT NULL,
	"test_code" varchar(50),
	"value" varchar(100),
	"unit" varchar(50),
	"reference_range_low" varchar(50),
	"reference_range_high" varchar(50),
	"is_abnormal" boolean,
	"report_type" varchar(50),
	"report_data" jsonb,
	"performed_date" timestamp NOT NULL,
	"performed_by" varchar(200),
	"validated_by_id" uuid,
	"validated_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid,
	"name" varchar(255) NOT NULL,
	"dosage" varchar(100),
	"is_current" boolean DEFAULT true,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "menstrual_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"menarche_age" integer,
	"cycle_length" integer,
	"cycle_length_max" integer,
	"flow_duration" integer,
	"flow_severity" varchar(30),
	"lmp_date" date,
	"dysmenorrhea_severity" varchar(30),
	"dysmenorrhea_vas" integer,
	"pms_pmdd" varchar(30),
	"intermenstrual_bleeding" boolean DEFAULT false,
	"notes" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "menstrual_history_patient_id_unique" UNIQUE("patient_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"sender_role" varchar(20) NOT NULL,
	"receiver_id" uuid,
	"receiver_role" varchar(20),
	"patient_id" uuid,
	"subject" varchar(200),
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"is_confidential" boolean DEFAULT false,
	"deleted_by_sender" boolean DEFAULT false NOT NULL,
	"deleted_by_receiver" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20) NOT NULL,
	"code" varchar(64) NOT NULL,
	"type" varchar(50) DEFAULT 'password_reset' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"national_id" char(10) NOT NULL,
	"insurance_code" varchar(50),
	"insurance_type" varchar(50),
	"birth_date" date,
	"phone" varchar(20),
	"address" text,
	"marital_status" varchar(20),
	"smoking" varchar(20),
	"bmi" numeric(5, 2),
	"exercise" varchar(50),
	"alcohol" varchar(20),
	"confidential_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"is_deleted" boolean DEFAULT false,
	"deleted_at" timestamp,
	CONSTRAINT "patients_national_id_unique" UNIQUE("national_id")
);
--> statement-breakpoint
CREATE TABLE "postpartum_care_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pregnancy_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"ppd_screening_date" date,
	"epds_score" integer,
	"breastfeeding_status" varchar(50),
	"breastfeeding_challenges" text,
	"contraception_counseling" boolean DEFAULT false,
	"contraception_method" varchar(100),
	"perineal_wound_healing" varchar(30),
	"cs_wound_healing" varchar(30),
	"lochia_status" varchar(30),
	"mood_assessment" text,
	"follow_up_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pregnancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"gravida_index" integer,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"lmp" date,
	"edd" date,
	"end_date" date,
	"gestational_age_weeks" integer,
	"gestational_age_days" integer,
	"outcome" varchar(30),
	"delivery_method" varchar(40),
	"anesthesia_type" varchar(30),
	"maternal_complications" jsonb DEFAULT '[]'::jsonb,
	"prenatal_screenings" jsonb DEFAULT '{}'::jsonb,
	"newborns_details" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prenatal_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pregnancy_id" uuid NOT NULL,
	"gestational_age_weeks" integer NOT NULL,
	"gestational_age_days" integer DEFAULT 0,
	"visit_date" timestamp NOT NULL,
	"blood_pressure_systolic" integer,
	"blood_pressure_diastolic" integer,
	"weight_kg" numeric(5, 1),
	"fundal_height_cm" numeric(4, 1),
	"fetal_heart_rate" integer,
	"urine_protein" varchar(20),
	"urine_glucose" varchar(20),
	"presentation" varchar(30),
	"engaged" boolean,
	"cervical_dilation" numeric(3, 1),
	"cervical_effacement" integer,
	"contractions" varchar(100),
	"edema" varchar(20),
	"varicose_veins" boolean DEFAULT false,
	"fetal_movements" varchar(50),
	"lab_tests_ordered" jsonb DEFAULT '[]'::jsonb,
	"medications_prescribed" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"plan" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"visit_id" uuid,
	"medication_name" varchar(255) NOT NULL,
	"dosage" varchar(100) NOT NULL,
	"frequency" varchar(100),
	"route" varchar(50),
	"duration" varchar(100),
	"quantity" integer,
	"refills" integer DEFAULT 0,
	"instructions" text,
	"start_date" date,
	"end_date" date,
	"is_active" boolean DEFAULT true,
	"discontinued_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procedure_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(20) NOT NULL,
	"description" varchar(500) NOT NULL,
	"category" varchar(50),
	"default_price" numeric(12, 2),
	"insurance_coverage_rate" numeric(5, 2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "procedure_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"sku" varchar(50),
	"barcode" varchar(100),
	"category_id" uuid,
	"unit" varchar(50) DEFAULT 'عدد' NOT NULL,
	"purchase_price" numeric(12, 2),
	"selling_price" numeric(12, 2),
	"current_stock" numeric(12, 3) DEFAULT '0',
	"min_stock_level" numeric(12, 3) DEFAULT '0',
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "reproductive_summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"gravida" integer DEFAULT 0,
	"para" integer DEFAULT 0,
	"abortions" integer DEFAULT 0,
	"ectopics" integer DEFAULT 0,
	"live_births" integer DEFAULT 0,
	"preterm_births" integer DEFAULT 0,
	"stillbirths" integer DEFAULT 0,
	"cesarean_sections" integer DEFAULT 0,
	"vaginal_deliveries" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reproductive_summary_patient_id_unique" UNIQUE("patient_id")
);
--> statement-breakpoint
CREATE TABLE "screening_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"screening_type" varchar(50) NOT NULL,
	"performed_date" date NOT NULL,
	"result" varchar(100),
	"result_details" jsonb,
	"lab_result_id" uuid,
	"provider_id" uuid,
	"facility_name" varchar(200),
	"notes" text,
	"next_due_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screening_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"screening_type" varchar(50) NOT NULL,
	"due_date" date NOT NULL,
	"status" varchar(30) DEFAULT 'pending',
	"risk_level" varchar(20),
	"assigned_to_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sexual_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"is_active" boolean,
	"partners_count" integer,
	"dyspareunia" varchar(30),
	"dyspareunia_notes" text,
	"notes" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sexual_history_patient_id_unique" UNIQUE("patient_id")
);
--> statement-breakpoint
CREATE TABLE "staff_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"date" varchar(10) NOT NULL,
	"status" varchar(20) DEFAULT 'present' NOT NULL,
	"work_location" varchar(50),
	"notes" text,
	"admin_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_attendance_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attendance_id" uuid NOT NULL,
	"check_in_time" timestamp NOT NULL,
	"check_out_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"position" varchar(100),
	"employment_date" date,
	"weekly_schedule" jsonb,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "staff_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"movement_type" varchar(20) NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit_price" numeric(12, 2),
	"total_price" numeric(15, 2),
	"reference" varchar(100),
	"reference_type" varchar(50),
	"description" text,
	"performed_by_id" uuid,
	"performed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_link_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" varchar(6) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_link_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "telegram_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chat_id" varchar(50) NOT NULL,
	"username" varchar(255),
	"first_name" varchar(255),
	"last_name" varchar(255),
	"is_active" boolean DEFAULT true,
	"linked_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_links_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "telegram_links_chat_id_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(20) NOT NULL,
	"patient_id" uuid,
	"full_name" varchar(200),
	"organization_name" varchar(200),
	"phone_confirmed" boolean DEFAULT false,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"requires_password_change" boolean DEFAULT true,
	"sms_enabled" boolean DEFAULT true NOT NULL,
	"telegram_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "chk_status" CHECK ("users"."status" IN ('pending', 'approved', 'rejected')),
	CONSTRAINT "chk_role_values" CHECK ("users"."role" IN ('admin_doctor', 'doctor', 'lab', 'pharmacy', 'patient', 'clinic_staff')),
	CONSTRAINT "chk_patient_role" CHECK ((
        ("users"."role" = 'patient' AND ("users"."patient_id" IS NOT NULL OR "users"."full_name" IS NOT NULL)) OR
        ("users"."role" != 'patient' AND "users"."patient_id" IS NULL)
      )),
	CONSTRAINT "chk_organization" CHECK ((
        ("users"."role" IN ('lab', 'pharmacy') AND "users"."organization_name" IS NOT NULL) OR
        ("users"."role" NOT IN ('lab', 'pharmacy'))
      )),
	CONSTRAINT "chk_patient_name" CHECK ((
        ("users"."role" = 'patient' AND "users"."full_name" IS NOT NULL) OR
        ("users"."role" != 'patient')
      ))
);
--> statement-breakpoint
CREATE TABLE "vaccinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"vaccine_name" varchar(200) NOT NULL,
	"dose_number" varchar(50),
	"date_administered" date,
	"lot_number" varchar(100),
	"manufacturer" varchar(200),
	"site" varchar(100),
	"administered_by" varchar(200),
	"next_dose_date" date,
	"status" varchar(30),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid,
	"visit_type" varchar(50),
	"visit_reason" varchar(255),
	"notes" text,
	"visit_date" timestamp NOT NULL,
	"duration_minutes" integer DEFAULT 30,
	"status" varchar(20) DEFAULT 'confirmed',
	"reminder_sent" boolean DEFAULT false,
	"next_visit_date" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vital_signs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"visit_id" uuid,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"blood_pressure_systolic" integer,
	"blood_pressure_diastolic" integer,
	"heart_rate" integer,
	"respiratory_rate" integer,
	"temperature_celsius" numeric(4, 1),
	"oxygen_saturation" integer,
	"weight_kg" numeric(5, 1),
	"height_cm" numeric(5, 1),
	"bmi" numeric(5, 2),
	"pain_score" integer,
	"notes" text,
	"recorded_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_visit_type_id_doctor_visit_types_id_fk" FOREIGN KEY ("visit_type_id") REFERENCES "public"."doctor_visit_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_records" ADD CONSTRAINT "billing_records_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_records" ADD CONSTRAINT "billing_records_procedure_code_id_procedure_codes_id_fk" FOREIGN KEY ("procedure_code_id") REFERENCES "public"."procedure_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_records" ADD CONSTRAINT "billing_records_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_assessments" ADD CONSTRAINT "clinical_assessments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_assessments" ADD CONSTRAINT "clinical_assessments_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_granted_by_id_users_id_fk" FOREIGN KEY ("granted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contraceptive_history" ADD CONSTRAINT "contraceptive_history_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diseases" ADD CONSTRAINT "diseases_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_availability" ADD CONSTRAINT "doctor_availability_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_visit_types" ADD CONSTRAINT "doctor_visit_types_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_history" ADD CONSTRAINT "family_history_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fetal_measurements" ADD CONSTRAINT "fetal_measurements_pregnancy_id_pregnancies_id_fk" FOREIGN KEY ("pregnancy_id") REFERENCES "public"."pregnancies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fetal_measurements" ADD CONSTRAINT "fetal_measurements_prenatal_visit_id_prenatal_visits_id_fk" FOREIGN KEY ("prenatal_visit_id") REFERENCES "public"."prenatal_visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gynecological_surgeries" ADD CONSTRAINT "gynecological_surgeries_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_order_items" ADD CONSTRAINT "lab_order_items_lab_order_id_lab_orders_id_fk" FOREIGN KEY ("lab_order_id") REFERENCES "public"."lab_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_lab_order_id_lab_orders_id_fk" FOREIGN KEY ("lab_order_id") REFERENCES "public"."lab_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_validated_by_id_users_id_fk" FOREIGN KEY ("validated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menstrual_history" ADD CONSTRAINT "menstrual_history_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postpartum_care_plans" ADD CONSTRAINT "postpartum_care_plans_pregnancy_id_pregnancies_id_fk" FOREIGN KEY ("pregnancy_id") REFERENCES "public"."pregnancies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postpartum_care_plans" ADD CONSTRAINT "postpartum_care_plans_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pregnancies" ADD CONSTRAINT "pregnancies_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prenatal_visits" ADD CONSTRAINT "prenatal_visits_pregnancy_id_pregnancies_id_fk" FOREIGN KEY ("pregnancy_id") REFERENCES "public"."pregnancies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_inventory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reproductive_summary" ADD CONSTRAINT "reproductive_summary_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_results" ADD CONSTRAINT "screening_results_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_results" ADD CONSTRAINT "screening_results_lab_result_id_lab_results_id_fk" FOREIGN KEY ("lab_result_id") REFERENCES "public"."lab_results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_results" ADD CONSTRAINT "screening_results_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_schedules" ADD CONSTRAINT "screening_schedules_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_schedules" ADD CONSTRAINT "screening_schedules_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sexual_history" ADD CONSTRAINT "sexual_history_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_attendance_sessions" ADD CONSTRAINT "staff_attendance_sessions_attendance_id_staff_attendance_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."staff_attendance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_schedules" ADD CONSTRAINT "staff_schedules_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_performed_by_id_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_link_codes" ADD CONSTRAINT "telegram_link_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Phase A stabilization: 70 non-unique indexes are defined as raw extra SQL in schema.ts.
-- drizzle-kit generate does not emit raw extra.sql statements, so they are appended here manually
-- so a fresh 'drizzle-kit migrate' reproduces the full live schema.
CREATE INDEX IF NOT EXISTS idx_allergies_patient ON allergies(patient_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_billing_records_patient ON billing_records(patient_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_billing_records_status ON billing_records(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_billing_records_visit ON billing_records(visit_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_clinical_assessments_patient ON clinical_assessments(patient_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_clinical_assessments_type ON clinical_assessments(assessment_type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_coa_active ON chart_of_accounts(is_active);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_coa_parent ON chart_of_accounts(parent_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_coa_type ON chart_of_accounts(type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_diseases_patient ON diseases(patient_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_sort ON doctor_profiles(sort_order);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_inv_cat_active ON inventory_categories(is_active);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_je_created_by ON journal_entries(created_by_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_je_entry_date ON journal_entries(entry_date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_je_reference ON journal_entries(reference, reference_type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_je_status ON journal_entries(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jel_account ON journal_entry_lines(account_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jel_journal ON journal_entry_lines(journal_entry_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_lab_order_items_order ON lab_order_items(lab_order_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_lab_orders_doctor ON lab_orders(doctor_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON lab_orders(patient_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_lab_results_category ON lab_results(category);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_lab_results_lab_order ON lab_results(lab_order_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_lab_results_patient ON lab_results(patient_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_lab_results_performed_date ON lab_results(performed_date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_lab_results_report_type ON lab_results(report_type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_lab_results_test_name ON lab_results(test_name);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_medications_patient ON medications(patient_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_messages_patient ON messages(patient_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_patients_deleted ON patients(is_deleted);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(first_name, last_name);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_pregnancies_patient ON pregnancies(patient_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_pregnancies_status ON pregnancies(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_prescriptions_active ON prescriptions(is_active);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON prescriptions(doctor_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_prescriptions_visit ON prescriptions(visit_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_products_low_stock ON products(current_stock, min_stock_level);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_scr_results_date ON screening_results(performed_date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_scr_results_patient ON screening_results(patient_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_scr_results_type ON screening_results(screening_type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_scr_sched_due_date ON screening_schedules(due_date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_scr_sched_patient ON screening_schedules(patient_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_scr_sched_status ON screening_schedules(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sessions_attendance ON staff_attendance_sessions(attendance_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff ON staff_attendance(staff_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_stock_movements_performed ON stock_movements(performed_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_visits_doctor ON visits(doctor_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_vital_signs_patient ON vital_signs(patient_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_vital_signs_recorded_at ON vital_signs(recorded_at);

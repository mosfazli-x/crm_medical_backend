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
CREATE TABLE "lab_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"category" varchar(50) NOT NULL,
	"test_name" varchar(200) NOT NULL,
	"test_code" varchar(50),
	"value" varchar(100) NOT NULL,
	"unit" varchar(50),
	"reference_range_low" varchar(50),
	"reference_range_high" varchar(50),
	"is_abnormal" boolean,
	"performed_date" timestamp NOT NULL,
	"performed_by" varchar(200),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
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
	"created_at" timestamp DEFAULT now() NOT NULL
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
ALTER TABLE "patients" ADD COLUMN "smoking" varchar(20);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "bmi" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "exercise" varchar(50);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "alcohol" varchar(20);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "confidential_notes" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_records" ADD CONSTRAINT "billing_records_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_records" ADD CONSTRAINT "billing_records_procedure_code_id_procedure_codes_id_fk" FOREIGN KEY ("procedure_code_id") REFERENCES "public"."procedure_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_records" ADD CONSTRAINT "billing_records_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_granted_by_id_users_id_fk" FOREIGN KEY ("granted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contraceptive_history" ADD CONSTRAINT "contraceptive_history_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_history" ADD CONSTRAINT "family_history_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fetal_measurements" ADD CONSTRAINT "fetal_measurements_pregnancy_id_pregnancies_id_fk" FOREIGN KEY ("pregnancy_id") REFERENCES "public"."pregnancies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fetal_measurements" ADD CONSTRAINT "fetal_measurements_prenatal_visit_id_prenatal_visits_id_fk" FOREIGN KEY ("prenatal_visit_id") REFERENCES "public"."prenatal_visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gynecological_surgeries" ADD CONSTRAINT "gynecological_surgeries_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menstrual_history" ADD CONSTRAINT "menstrual_history_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postpartum_care_plans" ADD CONSTRAINT "postpartum_care_plans_pregnancy_id_pregnancies_id_fk" FOREIGN KEY ("pregnancy_id") REFERENCES "public"."pregnancies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postpartum_care_plans" ADD CONSTRAINT "postpartum_care_plans_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prenatal_visits" ADD CONSTRAINT "prenatal_visits_pregnancy_id_pregnancies_id_fk" FOREIGN KEY ("pregnancy_id") REFERENCES "public"."pregnancies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reproductive_summary" ADD CONSTRAINT "reproductive_summary_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_results" ADD CONSTRAINT "screening_results_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_results" ADD CONSTRAINT "screening_results_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_schedules" ADD CONSTRAINT "screening_schedules_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_schedules" ADD CONSTRAINT "screening_schedules_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sexual_history" ADD CONSTRAINT "sexual_history_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
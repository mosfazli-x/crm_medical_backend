-- Add lifestyle columns to patients table
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "smoking" varchar(20);
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "bmi" decimal(5,2);
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "exercise" varchar(50);
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "alcohol" varchar(20);
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "confidential_notes" text;

-- Create gynecological_surgeries table
CREATE TABLE IF NOT EXISTS "gynecological_surgeries" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "patient_id" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
    "surgery_type" varchar(100) NOT NULL,
    "surgery_date" date,
    "hospital" varchar(255),
    "surgeon_name" varchar(200),
    "indication" text,
    "findings" text,
    "notes" text,
    "created_at" timestamp DEFAULT now()
);

-- Create contraceptive_history table
CREATE TABLE IF NOT EXISTS "contraceptive_history" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "patient_id" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
    "method" varchar(100) NOT NULL,
    "start_date" date,
    "end_date" date,
    "is_current" boolean DEFAULT true,
    "reason_for_discontinuation" varchar(255),
    "notes" text,
    "created_at" timestamp DEFAULT now()
);

-- Create menstrual_history table
CREATE TABLE IF NOT EXISTS "menstrual_history" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "patient_id" uuid NOT NULL UNIQUE REFERENCES "patients"("id") ON DELETE CASCADE,
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
    "updated_at" timestamp DEFAULT now()
);

-- Create sexual_history table
CREATE TABLE IF NOT EXISTS "sexual_history" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "patient_id" uuid NOT NULL UNIQUE REFERENCES "patients"("id") ON DELETE CASCADE,
    "is_active" boolean,
    "partners_count" integer,
    "dyspareunia" varchar(30),
    "dyspareunia_notes" text,
    "notes" text,
    "updated_at" timestamp DEFAULT now()
);

-- Create family_history table
CREATE TABLE IF NOT EXISTS "family_history" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "patient_id" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
    "relationship" varchar(50) NOT NULL,
    "condition" varchar(255) NOT NULL,
    "age_at_diagnosis" integer,
    "is_deceased" boolean DEFAULT false,
    "notes" text,
    "created_at" timestamp DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" uuid REFERENCES "users"("id"),
    "action" varchar(50) NOT NULL,
    "entity_type" varchar(50) NOT NULL,
    "entity_id" varchar(50),
    "old_values" jsonb,
    "new_values" jsonb,
    "ip_address" varchar(45),
    "user_agent" text,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create consent_records table
CREATE TABLE IF NOT EXISTS "consent_records" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "patient_id" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
    "consent_type" varchar(50) NOT NULL,
    "is_granted" boolean DEFAULT true,
    "granted_at" timestamp DEFAULT now(),
    "revoked_at" timestamp,
    "expires_at" timestamp,
    "granted_by_id" uuid REFERENCES "users"("id"),
    "notes" text,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create screening_schedules table
CREATE TABLE IF NOT EXISTS "screening_schedules" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "patient_id" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
    "screening_type" varchar(50) NOT NULL,
    "due_date" date NOT NULL,
    "status" varchar(30) DEFAULT 'pending',
    "risk_level" varchar(20),
    "assigned_to_id" uuid REFERENCES "users"("id"),
    "notes" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create screening_results table
CREATE TABLE IF NOT EXISTS "screening_results" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "patient_id" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
    "screening_type" varchar(50) NOT NULL,
    "performed_date" date NOT NULL,
    "result" varchar(100),
    "result_details" jsonb,
    "provider_id" uuid REFERENCES "users"("id"),
    "facility_name" varchar(200),
    "notes" text,
    "next_due_date" date,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create lab_results table
CREATE TABLE IF NOT EXISTS "lab_results" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "patient_id" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
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

-- Create procedure_codes table
CREATE TABLE IF NOT EXISTS "procedure_codes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "code" varchar(20) NOT NULL UNIQUE,
    "description" varchar(500) NOT NULL,
    "category" varchar(50),
    "default_price" decimal(12,2),
    "insurance_coverage_rate" decimal(5,2),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create billing_records table
CREATE TABLE IF NOT EXISTS "billing_records" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "patient_id" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
    "procedure_code_id" uuid REFERENCES "procedure_codes"("id"),
    "visit_id" uuid REFERENCES "visits"("id"),
    "description" varchar(500) NOT NULL,
    "amount" decimal(12,2) NOT NULL,
    "insurance_claim_amount" decimal(12,2),
    "patient_pay_amount" decimal(12,2),
    "status" varchar(30) DEFAULT 'pending',
    "billed_date" date,
    "paid_date" date,
    "notes" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create prenatal_visits table
CREATE TABLE IF NOT EXISTS "prenatal_visits" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "pregnancy_id" uuid NOT NULL REFERENCES "pregnancies"("id") ON DELETE CASCADE,
    "gestational_age_weeks" integer NOT NULL,
    "gestational_age_days" integer DEFAULT 0,
    "visit_date" timestamp NOT NULL,
    "blood_pressure_systolic" integer,
    "blood_pressure_diastolic" integer,
    "weight_kg" decimal(5,1),
    "fundal_height_cm" decimal(4,1),
    "fetal_heart_rate" integer,
    "urine_protein" varchar(20),
    "urine_glucose" varchar(20),
    "presentation" varchar(30),
    "engaged" boolean,
    "cervical_dilation" decimal(3,1),
    "cervical_effacement" integer,
    "contractions" varchar(100),
    "edema" varchar(20),
    "varicose_veins" boolean DEFAULT false,
    "fetal_movements" varchar(50),
    "lab_tests_ordered" jsonb DEFAULT '[]',
    "medications_prescribed" jsonb DEFAULT '[]',
    "notes" text,
    "plan" text,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create fetal_measurements table
CREATE TABLE IF NOT EXISTS "fetal_measurements" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "pregnancy_id" uuid NOT NULL REFERENCES "pregnancies"("id") ON DELETE CASCADE,
    "prenatal_visit_id" uuid REFERENCES "prenatal_visits"("id"),
    "measurement_date" timestamp NOT NULL,
    "gestational_age_weeks" integer,
    "gestational_age_days" integer,
    "biparietal_diameter_mm" decimal(5,1),
    "femur_length_mm" decimal(5,1),
    "abdominal_circumference_mm" decimal(6,1),
    "head_circumference_mm" decimal(6,1),
    "estimated_fetal_weight_g" decimal(6,1),
    "amniotic_fluid_index" decimal(4,1),
    "placenta_position" varchar(50),
    "placenta_grade" varchar(10),
    "umbilical_artery_pi" decimal(4,2),
    "notes" text,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create postpartum_care_plans table
CREATE TABLE IF NOT EXISTS "postpartum_care_plans" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "pregnancy_id" uuid NOT NULL REFERENCES "pregnancies"("id") ON DELETE CASCADE,
    "patient_id" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
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

-- Create messages table
CREATE TABLE IF NOT EXISTS "messages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "sender_id" uuid NOT NULL REFERENCES "users"("id"),
    "sender_role" varchar(20) NOT NULL,
    "receiver_id" uuid REFERENCES "users"("id"),
    "receiver_role" varchar(20),
    "patient_id" uuid REFERENCES "patients"("id"),
    "subject" varchar(200),
    "body" text NOT NULL,
    "is_read" boolean DEFAULT false,
    "read_at" timestamp,
    "is_confidential" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create reproductive_summary table
CREATE TABLE IF NOT EXISTS "reproductive_summary" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "patient_id" uuid NOT NULL UNIQUE REFERENCES "patients"("id") ON DELETE CASCADE,
    "gravida" integer DEFAULT 0,
    "para" integer DEFAULT 0,
    "abortions" integer DEFAULT 0,
    "ectopics" integer DEFAULT 0,
    "live_births" integer DEFAULT 0,
    "preterm_births" integer DEFAULT 0,
    "stillbirths" integer DEFAULT 0,
    "cesarean_sections" integer DEFAULT 0,
    "vaginal_deliveries" integer DEFAULT 0,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

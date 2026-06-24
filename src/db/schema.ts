import { pgTable, uuid, serial, varchar, char, date, text, timestamp, boolean, integer, jsonb, decimal, primaryKey } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm'

export const patients = pgTable('patients', {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    nationalId: char('national_id', { length: 10 }).unique().notNull(),
    insuranceCode: varchar('insurance_code', { length: 50 }),
    insuranceType: varchar('insurance_type', { length: 50 }),
    birthDate: date('birth_date'),
    phone: varchar('phone', { length: 20 }),
    address: text('address'),
    maritalStatus: varchar('marital_status', { length: 20 }),
    smoking: varchar('smoking', { length: 20 }),
    bmi: decimal('bmi', { precision: 5, scale: 2 }),
    exercise: varchar('exercise', { length: 50 }),
    alcohol: varchar('alcohol', { length: 20 }),
    confidentialNotes: text('confidential_notes'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    isDeleted: boolean('is_deleted').default(false),
    deletedAt: timestamp('deleted_at'),
});

export const diseases = pgTable('diseases', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    diagnosedAt: date('diagnosed_at'),
    isActive: boolean('is_active').default(true),
    notes: text('notes'),
});

export const medications = pgTable('medications', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    dosage: varchar('dosage', { length: 100 }),
    isCurrent: boolean('is_current').default(true),
    notes: text('notes'),
});

export const allergies = pgTable('allergies', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }),
    substance: varchar('substance', { length: 255 }).notNull(),
    severity: varchar('severity', { length: 20 }),
    createdAt: timestamp('created_at').defaultNow(),
});

export const visits = pgTable('visits', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    doctorId: uuid('doctor_id'),

    visitType: varchar('visit_type', { length: 50 }),
    visitReason: varchar('visit_reason', { length: 255 }),
    notes: text('notes'),

    visitDate: timestamp('visit_date').notNull(),
    durationMinutes: integer('duration_minutes').default(30),
    status: varchar('status', { length: 20 }).default('confirmed'),
    reminderSent: boolean('reminder_sent').default(false),

    nextVisitDate: timestamp('next_visit_date'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const pregnancies = pgTable('pregnancies', {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id').references(() => patients.id).notNull(),
    gravidaIndex: integer('gravida_index'),
    status: varchar('status', { length: 20 }).notNull().default('completed'),
    lmp: date('lmp'),
    edd: date('edd'),
    endDate: date('end_date'),
    gestationalAgeWeeks: integer('gestational_age_weeks'),
    gestationalAgeDays: integer('gestational_age_days'),
    outcome: varchar('outcome', { length: 30 }),
    deliveryMethod: varchar('delivery_method', { length: 40 }),
    anesthesiaType: varchar('anesthesia_type', { length: 30 }),
    maternalComplications: jsonb('maternal_complications').default([]),
    prenatalScreenings: jsonb('prenatal_screenings').default({}),
    newbornsDetails: jsonb('newborns_details').default([]),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const gynecologicalSurgeries = pgTable('gynecological_surgeries', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    surgeryType: varchar('surgery_type', { length: 100 }).notNull(),
    surgeryDate: date('surgery_date'),
    hospital: varchar('hospital', { length: 255 }),
    surgeonName: varchar('surgeon_name', { length: 200 }),
    indication: text('indication'),
    findings: text('findings'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const contraceptiveHistory = pgTable('contraceptive_history', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    method: varchar('method', { length: 100 }).notNull(),
    startDate: date('start_date'),
    endDate: date('end_date'),
    isCurrent: boolean('is_current').default(true),
    reasonForDiscontinuation: varchar('reason_for_discontinuation', { length: 255 }),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const menstrualHistory = pgTable('menstrual_history', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').notNull().unique().references(() => patients.id, { onDelete: 'cascade' }),
    menarcheAge: integer('menarche_age'),
    cycleLength: integer('cycle_length'),
    cycleLengthMax: integer('cycle_length_max'),
    flowDuration: integer('flow_duration'),
    flowSeverity: varchar('flow_severity', { length: 30 }),
    lmpDate: date('lmp_date'),
    dysmenorrheaSeverity: varchar('dysmenorrhea_severity', { length: 30 }),
    dysmenorrheaVAS: integer('dysmenorrhea_vas'),
    pmsPmdd: varchar('pms_pmdd', { length: 30 }),
    intermenstrualBleeding: boolean('intermenstrual_bleeding').default(false),
    notes: text('notes'),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const sexualHistory = pgTable('sexual_history', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').notNull().unique().references(() => patients.id, { onDelete: 'cascade' }),
    isActive: boolean('is_active'),
    partnersCount: integer('partners_count'),
    dyspareunia: varchar('dyspareunia', { length: 30 }),
    dyspareuniaNotes: text('dyspareunia_notes'),
    notes: text('notes'),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const familyHistory = pgTable('family_history', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    relationship: varchar('relationship', { length: 50 }).notNull(),
    condition: varchar('condition', { length: 255 }).notNull(),
    ageAtDiagnosis: integer('age_at_diagnosis'),
    isDeceased: boolean('is_deceased').default(false),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const users = pgTable('users', {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    phone: varchar('phone', { length: 20 }).unique().notNull(),
    passwordHash: text('password_hash').notNull(),
    role: varchar('role', { length: 20 }).notNull(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }),
    fullName: varchar('full_name', { length: 200 }),
    organizationName: varchar('organization_name', { length: 200 }),
    phoneConfirmed: boolean('phone_confirmed').default(false),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    requiresPasswordChange: boolean('requires_password_change').default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
    return {
        chkStatus: sql`CHECK (status IN ('pending', 'approved', 'rejected'))`,
        chkRoleValues: sql`CHECK (role IN ('admin_doctor', 'doctor', 'lab', 'pharmacy', 'patient'))`,
        chkPatientRole: sql`CHECK (
      (role = 'patient' AND (${table.patientId} IS NOT NULL OR ${table.fullName} IS NOT NULL)) OR
      (role != 'patient' AND ${table.patientId} IS NULL)
    )`,
        chkOrganization: sql`CHECK (
      (role IN ('lab', 'pharmacy') AND ${table.organizationName} IS NOT NULL) OR
      (role NOT IN ('lab', 'pharmacy'))
    )`,
        chkPatientName: sql`CHECK (
      (role = 'patient' AND ${table.fullName} IS NOT NULL) OR
      (role != 'patient')
    )`,
    };
});

export const otpCodes = pgTable('otp_codes', {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: varchar('phone', { length: 20 }).notNull(),
    code: varchar('code', { length: 5 }).notNull(),
    type: varchar('type', { length: 50 }).default('password_reset').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    attempts: integer('attempts').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const attachments = pgTable('attachments', {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id')
        .notNull()
        .references(() => patients.id, { onDelete: 'cascade' }),
    fileType: varchar('file_type', { length: 50 }).notNull(),
    fileName: text('file_name').notNull(),
    filePath: text('file_path').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const doctorAvailability = pgTable('doctor_availability', {
    id: uuid('id').primaryKey().defaultRandom(),
    doctorId: uuid('doctor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(),
    startTime: varchar('start_time', { length: 5 }).notNull(),
    endTime: varchar('end_time', { length: 5 }).notNull(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const doctorVisitTypes = pgTable('doctor_visit_types', {
    id: uuid('id').primaryKey().defaultRandom(),
    doctorId: uuid('doctor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    durationMinutes: integer('duration_minutes').default(30).notNull(),
    price: decimal('price', { precision: 12, scale: 2 }),
    color: varchar('color', { length: 7 }),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const appointments = pgTable('appointments', {
    id: uuid('id').primaryKey().defaultRandom(),
    doctorId: uuid('doctor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    appointmentDate: date('appointment_date').notNull(),
    startTime: varchar('start_time', { length: 5 }).notNull(),
    endTime: varchar('end_time', { length: 5 }).notNull(),
    status: varchar('status', { length: 20 }).default('pending'),
    visitTypeId: uuid('visit_type_id').references(() => doctorVisitTypes.id),
    patientFirstName: varchar('patient_first_name', { length: 100 }).notNull(),
    patientLastName: varchar('patient_last_name', { length: 100 }).notNull(),
    patientNationalId: varchar('patient_national_id', { length: 10 }).notNull(),
    patientPhone: varchar('patient_phone', { length: 20 }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id),
    action: varchar('action', { length: 50 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: varchar('entity_id', { length: 50 }),
    oldValues: jsonb('old_values'),
    newValues: jsonb('new_values'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const consentRecords = pgTable('consent_records', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    consentType: varchar('consent_type', { length: 50 }).notNull(),
    isGranted: boolean('is_granted').default(true),
    grantedAt: timestamp('granted_at').defaultNow(),
    revokedAt: timestamp('revoked_at'),
    expiresAt: timestamp('expires_at'),
    grantedById: uuid('granted_by_id').references(() => users.id),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const screeningSchedules = pgTable('screening_schedules', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    screeningType: varchar('screening_type', { length: 50 }).notNull(),
    dueDate: date('due_date').notNull(),
    status: varchar('status', { length: 30 }).default('pending'),
    riskLevel: varchar('risk_level', { length: 20 }),
    assignedToId: uuid('assigned_to_id').references(() => users.id),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const screeningResults = pgTable('screening_results', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    screeningType: varchar('screening_type', { length: 50 }).notNull(),
    performedDate: date('performed_date').notNull(),
    result: varchar('result', { length: 100 }),
    resultDetails: jsonb('result_details'),
    providerId: uuid('provider_id').references(() => users.id),
    facilityName: varchar('facility_name', { length: 200 }),
    notes: text('notes'),
    nextDueDate: date('next_due_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const labResults = pgTable('lab_results', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    category: varchar('category', { length: 50 }).notNull(),
    testName: varchar('test_name', { length: 200 }).notNull(),
    testCode: varchar('test_code', { length: 50 }),
    value: varchar('value', { length: 100 }).notNull(),
    unit: varchar('unit', { length: 50 }),
    referenceRangeLow: varchar('reference_range_low', { length: 50 }),
    referenceRangeHigh: varchar('reference_range_high', { length: 50 }),
    isAbnormal: boolean('is_abnormal'),
    performedDate: timestamp('performed_date').notNull(),
    performedBy: varchar('performed_by', { length: 200 }),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const procedureCodes = pgTable('procedure_codes', {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 20 }).notNull().unique(),
    description: varchar('description', { length: 500 }).notNull(),
    category: varchar('category', { length: 50 }),
    defaultPrice: decimal('default_price', { precision: 12, scale: 2 }),
    insuranceCoverageRate: decimal('insurance_coverage_rate', { precision: 5, scale: 2 }),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const billingRecords = pgTable('billing_records', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    procedureCodeId: uuid('procedure_code_id').references(() => procedureCodes.id),
    visitId: uuid('visit_id').references(() => visits.id),
    description: varchar('description', { length: 500 }).notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    insuranceClaimAmount: decimal('insurance_claim_amount', { precision: 12, scale: 2 }),
    patientPayAmount: decimal('patient_pay_amount', { precision: 12, scale: 2 }),
    status: varchar('status', { length: 30 }).default('pending'),
    billedDate: date('billed_date'),
    paidDate: date('paid_date'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const prenatalVisits = pgTable('prenatal_visits', {
    id: uuid('id').primaryKey().defaultRandom(),
    pregnancyId: uuid('pregnancy_id').notNull().references(() => pregnancies.id, { onDelete: 'cascade' }),
    gestationalAgeWeeks: integer('gestational_age_weeks').notNull(),
    gestationalAgeDays: integer('gestational_age_days').default(0),
    visitDate: timestamp('visit_date').notNull(),
    bloodPressureSystolic: integer('blood_pressure_systolic'),
    bloodPressureDiastolic: integer('blood_pressure_diastolic'),
    weightKg: decimal('weight_kg', { precision: 5, scale: 1 }),
    fundalHeightCm: decimal('fundal_height_cm', { precision: 4, scale: 1 }),
    fetalHeartRate: integer('fetal_heart_rate'),
    urineProtein: varchar('urine_protein', { length: 20 }),
    urineGlucose: varchar('urine_glucose', { length: 20 }),
    presentation: varchar('presentation', { length: 30 }),
    engaged: boolean('engaged'),
    cervicalDilation: decimal('cervical_dilation', { precision: 3, scale: 1 }),
    cervicalEffacement: integer('cervical_effacement'),
    contractions: varchar('contractions', { length: 100 }),
    edema: varchar('edema', { length: 20 }),
    varicoseVeins: boolean('varicose_veins').default(false),
    fetalMovements: varchar('fetal_movements', { length: 50 }),
    labTestsOrdered: jsonb('lab_tests_ordered').default([]),
    medicationsPrescribed: jsonb('medications_prescribed').default([]),
    notes: text('notes'),
    plan: text('plan'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const fetalMeasurements = pgTable('fetal_measurements', {
    id: uuid('id').primaryKey().defaultRandom(),
    pregnancyId: uuid('pregnancy_id').notNull().references(() => pregnancies.id, { onDelete: 'cascade' }),
    prenatalVisitId: uuid('prenatal_visit_id').references(() => prenatalVisits.id),
    measurementDate: timestamp('measurement_date').notNull(),
    gestationalAgeWeeks: integer('gestational_age_weeks'),
    gestationalAgeDays: integer('gestational_age_days'),
    biparietalDiameterMm: decimal('biparietal_diameter_mm', { precision: 5, scale: 1 }),
    femurLengthMm: decimal('femur_length_mm', { precision: 5, scale: 1 }),
    abdominalCircumferenceMm: decimal('abdominal_circumference_mm', { precision: 6, scale: 1 }),
    headCircumferenceMm: decimal('head_circumference_mm', { precision: 6, scale: 1 }),
    estimatedFetalWeightG: decimal('estimated_fetal_weight_g', { precision: 6, scale: 1 }),
    amnioticFluidIndex: decimal('amniotic_fluid_index', { precision: 4, scale: 1 }),
    placentaPosition: varchar('placenta_position', { length: 50 }),
    placentaGrade: varchar('placenta_grade', { length: 10 }),
    umbilicalArteryPI: decimal('umbilical_artery_pi', { precision: 4, scale: 2 }),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const postpartumCarePlans = pgTable('postpartum_care_plans', {
    id: uuid('id').primaryKey().defaultRandom(),
    pregnancyId: uuid('pregnancy_id').notNull().references(() => pregnancies.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    ppdScreeningDate: date('ppd_screening_date'),
    epdsScore: integer('epds_score'),
    breastfeedingStatus: varchar('breastfeeding_status', { length: 50 }),
    breastfeedingChallenges: text('breastfeeding_challenges'),
    contraceptionCounseling: boolean('contraception_counseling').default(false),
    contraceptionMethod: varchar('contraception_method', { length: 100 }),
    perinealWoundHealing: varchar('perineal_wound_healing', { length: 30 }),
    csWoundHealing: varchar('cs_wound_healing', { length: 30 }),
    lochiaStatus: varchar('lochia_status', { length: 30 }),
    moodAssessment: text('mood_assessment'),
    followUpDate: date('follow_up_date'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const messages = pgTable('messages', {
    id: uuid('id').primaryKey().defaultRandom(),
    senderId: uuid('sender_id').notNull().references(() => users.id),
    senderRole: varchar('sender_role', { length: 20 }).notNull(),
    receiverId: uuid('receiver_id').references(() => users.id),
    receiverRole: varchar('receiver_role', { length: 20 }),
    patientId: uuid('patient_id').references(() => patients.id),
    subject: varchar('subject', { length: 200 }),
    body: text('body').notNull(),
    isRead: boolean('is_read').default(false),
    readAt: timestamp('read_at'),
    isConfidential: boolean('is_confidential').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const reproductiveSummary = pgTable('reproductive_summary', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').notNull().unique().references(() => patients.id, { onDelete: 'cascade' }),
    gravida: integer('gravida').default(0),
    para: integer('para').default(0),
    abortions: integer('abortions').default(0),
    ectopics: integer('ectopics').default(0),
    liveBirths: integer('live_births').default(0),
    pretermBirths: integer('preterm_births').default(0),
    stillbirths: integer('stillbirths').default(0),
    cesareanSections: integer('cesarean_sections').default(0),
    vaginalDeliveries: integer('vaginal_deliveries').default(0),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

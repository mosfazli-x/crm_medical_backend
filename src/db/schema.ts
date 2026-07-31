import { pgTable, uuid, serial, varchar, char, date, text, timestamp, boolean, integer, jsonb, decimal, primaryKey, check, index, uniqueIndex } from 'drizzle-orm/pg-core';
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
}, (table) => ({
    phoneIdx: sql`CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone)`,
    deletedIdx: sql`CREATE INDEX IF NOT EXISTS idx_patients_deleted ON patients(is_deleted)`,
    nameIdx: sql`CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(first_name, last_name)`,
}));

export const diseases = pgTable('diseases', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    diagnosedAt: date('diagnosed_at'),
    isActive: boolean('is_active').default(true),
    notes: text('notes'),
}, (table) => ({
    patientIdx: sql`CREATE INDEX IF NOT EXISTS idx_diseases_patient ON diseases(patient_id)`,
}));

export const medications = pgTable('medications', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    dosage: varchar('dosage', { length: 100 }),
    isCurrent: boolean('is_current').default(true),
    notes: text('notes'),
}, (table) => ({
    patientIdx: sql`CREATE INDEX IF NOT EXISTS idx_medications_patient ON medications(patient_id)`,
}));

export const prescriptions = pgTable('prescriptions', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    doctorId: uuid('doctor_id').notNull().references(() => users.id),
    visitId: uuid('visit_id').references(() => visits.id),
    medicationName: varchar('medication_name', { length: 255 }).notNull(),
    dosage: varchar('dosage', { length: 100 }).notNull(),
    frequency: varchar('frequency', { length: 100 }),
    route: varchar('route', { length: 50 }),
    duration: varchar('duration', { length: 100 }),
    quantity: integer('quantity'),
    refills: integer('refills').default(0),
    instructions: text('instructions'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    isActive: boolean('is_active').default(true),
    discontinuedReason: text('discontinued_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    patientIdx: sql`CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id)`,
    doctorIdx: sql`CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON prescriptions(doctor_id)`,
    visitIdx: sql`CREATE INDEX IF NOT EXISTS idx_prescriptions_visit ON prescriptions(visit_id)`,
    activeIdx: sql`CREATE INDEX IF NOT EXISTS idx_prescriptions_active ON prescriptions(is_active)`,
}));

export const allergies = pgTable('allergies', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }),
    substance: varchar('substance', { length: 255 }).notNull(),
    severity: varchar('severity', { length: 20 }),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    patientIdx: sql`CREATE INDEX IF NOT EXISTS idx_allergies_patient ON allergies(patient_id)`,
}));

export const vaccinations = pgTable('vaccinations', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    vaccineName: varchar('vaccine_name', { length: 200 }).notNull(),
    doseNumber: varchar('dose_number', { length: 50 }),
    dateAdministered: date('date_administered'),
    lotNumber: varchar('lot_number', { length: 100 }),
    manufacturer: varchar('manufacturer', { length: 200 }),
    site: varchar('site', { length: 100 }),
    administeredBy: varchar('administered_by', { length: 200 }),
    nextDoseDate: date('next_dose_date'),
    status: varchar('status', { length: 30 }),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const visits = pgTable('visits', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    doctorId: uuid('doctor_id').references(() => users.id),

    visitType: varchar('visit_type', { length: 50 }),
    visitReason: varchar('visit_reason', { length: 255 }),
    notes: text('notes'),

    visitDate: timestamp('visit_date').notNull(),
    durationMinutes: integer('duration_minutes').default(30),
    status: varchar('status', { length: 20 }).default('confirmed'),
    reminderSent: boolean('reminder_sent').default(false),

    nextVisitDate: timestamp('next_visit_date'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    patientIdx: sql`CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id)`,
    doctorIdx: sql`CREATE INDEX IF NOT EXISTS idx_visits_doctor ON visits(doctor_id)`,
    visitDateIdx: sql`CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date)`,
}));

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
}, (table) => ({
    patientIdx: sql`CREATE INDEX IF NOT EXISTS idx_pregnancies_patient ON pregnancies(patient_id)`,
    statusIdx: sql`CREATE INDEX IF NOT EXISTS idx_pregnancies_status ON pregnancies(status)`,
}));

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
    smsEnabled: boolean('sms_enabled').default(true).notNull(),
    telegramEnabled: boolean('telegram_enabled').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
    return {
        chkStatus: check('chk_status', sql`${table.status} IN ('pending', 'approved', 'rejected')`),
        chkRoleValues: check('chk_role_values', sql`${table.role} IN ('admin_doctor', 'doctor', 'lab', 'pharmacy', 'patient', 'clinic_staff')`),
        chkPatientRole: check('chk_patient_role', sql`(
        (${table.role} = 'patient' AND (${table.patientId} IS NOT NULL OR ${table.fullName} IS NOT NULL)) OR
        (${table.role} != 'patient' AND ${table.patientId} IS NULL)
      )`),
        chkOrganization: check('chk_organization', sql`(
        (${table.role} IN ('lab', 'pharmacy') AND ${table.organizationName} IS NOT NULL) OR
        (${table.role} NOT IN ('lab', 'pharmacy'))
      )`),
        chkPatientName: check('chk_patient_name', sql`(
        (${table.role} = 'patient' AND ${table.fullName} IS NOT NULL) OR
        (${table.role} != 'patient')
      )`),
    };
});

export const otpCodes = pgTable('otp_codes', {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: varchar('phone', { length: 20 }).notNull(),
    code: varchar('code', { length: 64 }).notNull(),
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
    fileHash: varchar('file_hash', { length: 64 }).notNull().default(''),
    fileSize: integer('file_size').notNull().default(0),
    mimeType: varchar('mime_type', { length: 100 }).notNull().default('application/octet-stream'),
    storagePath: text('storage_path').notNull().default(''),
    isDeleted: boolean('is_deleted').default(false),
    deletedAt: timestamp('deleted_at'),
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
    isDeleted: boolean('is_deleted').default(false),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const appointments = pgTable('appointments', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
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
}, (table) => ({
    doctorIdx: sql`CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id)`,
    dateIdx: sql`CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date)`,
    statusIdx: sql`CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status)`,
    patientIdx: sql`CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id)`,
}));

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
}, (table) => ({
    entityIdx: sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)`,
    userIdx: sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)`,
    createdIdx: sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)`,
}));

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
}, (table) => ({
    patientIdx: sql`CREATE INDEX IF NOT EXISTS idx_scr_sched_patient ON screening_schedules(patient_id)`,
    dueDateIdx: sql`CREATE INDEX IF NOT EXISTS idx_scr_sched_due_date ON screening_schedules(due_date)`,
    statusIdx: sql`CREATE INDEX IF NOT EXISTS idx_scr_sched_status ON screening_schedules(status)`,
}))

export const screeningResults = pgTable('screening_results', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    screeningType: varchar('screening_type', { length: 50 }).notNull(),
    performedDate: date('performed_date').notNull(),
    result: varchar('result', { length: 100 }),
    resultDetails: jsonb('result_details'),
    labResultId: uuid('lab_result_id').references(() => labResults.id, { onDelete: 'set null' }),
    providerId: uuid('provider_id').references(() => users.id),
    facilityName: varchar('facility_name', { length: 200 }),
    notes: text('notes'),
    nextDueDate: date('next_due_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    patientIdx: sql`CREATE INDEX IF NOT EXISTS idx_scr_results_patient ON screening_results(patient_id)`,
    screeningTypeIdx: sql`CREATE INDEX IF NOT EXISTS idx_scr_results_type ON screening_results(screening_type)`,
    performedDateIdx: sql`CREATE INDEX IF NOT EXISTS idx_scr_results_date ON screening_results(performed_date)`,
}))

export const labOrders = pgTable('lab_orders', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    visitId: uuid('visit_id').references(() => visits.id, { onDelete: 'set null' }),
    doctorId: uuid('doctor_id').references(() => users.id),
    orderDate: timestamp('order_date').defaultNow().notNull(),
    status: varchar('status', { length: 30 }).default('pending').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    patientIdx: sql`CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON lab_orders(patient_id)`,
    doctorIdx: sql`CREATE INDEX IF NOT EXISTS idx_lab_orders_doctor ON lab_orders(doctor_id)`,
    statusIdx: sql`CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders(status)`,
}))

export const labOrderItems = pgTable('lab_order_items', {
    id: uuid('id').primaryKey().defaultRandom(),
    labOrderId: uuid('lab_order_id').notNull().references(() => labOrders.id, { onDelete: 'cascade' }),
    testName: varchar('test_name', { length: 200 }).notNull(),
    testCode: varchar('test_code', { length: 50 }),
    category: varchar('category', { length: 50 }),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    orderIdx: sql`CREATE INDEX IF NOT EXISTS idx_lab_order_items_order ON lab_order_items(lab_order_id)`,
}))

export const labResults = pgTable('lab_results', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    labOrderId: uuid('lab_order_id').references(() => labOrders.id, { onDelete: 'set null' }),
    category: varchar('category', { length: 50 }).notNull(),
    testName: varchar('test_name', { length: 200 }).notNull(),
    testCode: varchar('test_code', { length: 50 }),
    value: varchar('value', { length: 100 }),
    unit: varchar('unit', { length: 50 }),
    referenceRangeLow: varchar('reference_range_low', { length: 50 }),
    referenceRangeHigh: varchar('reference_range_high', { length: 50 }),
    isAbnormal: boolean('is_abnormal'),
    reportType: varchar('report_type', { length: 50 }),
    reportData: jsonb('report_data'),
    performedDate: timestamp('performed_date').notNull(),
    performedBy: varchar('performed_by', { length: 200 }),
    validatedById: uuid('validated_by_id').references(() => users.id),
    validatedAt: timestamp('validated_at'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    patientIdx: sql`CREATE INDEX IF NOT EXISTS idx_lab_results_patient ON lab_results(patient_id)`,
    categoryIdx: sql`CREATE INDEX IF NOT EXISTS idx_lab_results_category ON lab_results(category)`,
    testNameIdx: sql`CREATE INDEX IF NOT EXISTS idx_lab_results_test_name ON lab_results(test_name)`,
    performedDateIdx: sql`CREATE INDEX IF NOT EXISTS idx_lab_results_performed_date ON lab_results(performed_date)`,
    labOrderIdx: sql`CREATE INDEX IF NOT EXISTS idx_lab_results_lab_order ON lab_results(lab_order_id)`,
    reportTypeIdx: sql`CREATE INDEX IF NOT EXISTS idx_lab_results_report_type ON lab_results(report_type)`,
}))

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
}, (table) => ({
    patientIdx: sql`CREATE INDEX IF NOT EXISTS idx_billing_records_patient ON billing_records(patient_id)`,
    visitIdx: sql`CREATE INDEX IF NOT EXISTS idx_billing_records_visit ON billing_records(visit_id)`,
    statusIdx: sql`CREATE INDEX IF NOT EXISTS idx_billing_records_status ON billing_records(status)`,
}));

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

export const vitalSigns = pgTable('vital_signs', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  visitId: uuid('visit_id').references(() => visits.id, { onDelete: 'set null' }),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
  bloodPressureSystolic: integer('blood_pressure_systolic'),
  bloodPressureDiastolic: integer('blood_pressure_diastolic'),
  heartRate: integer('heart_rate'),
  respiratoryRate: integer('respiratory_rate'),
  temperatureCelsius: decimal('temperature_celsius', { precision: 4, scale: 1 }),
  oxygenSaturation: integer('oxygen_saturation'),
  weightKg: decimal('weight_kg', { precision: 5, scale: 1 }),
  heightCm: decimal('height_cm', { precision: 5, scale: 1 }),
  bmi: decimal('bmi', { precision: 5, scale: 2 }),
  painScore: integer('pain_score'),
  notes: text('notes'),
  recordedById: uuid('recorded_by_id').references(() => users.id),
}, (table) => ({
  patientIdx: sql`CREATE INDEX IF NOT EXISTS idx_vital_signs_patient ON vital_signs(patient_id)`,
  recordedAtIdx: sql`CREATE INDEX IF NOT EXISTS idx_vital_signs_recorded_at ON vital_signs(recorded_at)`,
}))

export const clinicalAssessments = pgTable('clinical_assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  assessmentType: varchar('assessment_type', { length: 50 }).notNull(),
  result: jsonb('result').notNull(),
  providerId: uuid('provider_id').references(() => users.id),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  patientIdx: sql`CREATE INDEX IF NOT EXISTS idx_clinical_assessments_patient ON clinical_assessments(patient_id)`,
  typeIdx: sql`CREATE INDEX IF NOT EXISTS idx_clinical_assessments_type ON clinical_assessments(assessment_type)`,
}))

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
    deletedBySender: boolean('deleted_by_sender').default(false).notNull(),
    deletedByReceiver: boolean('deleted_by_receiver').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    senderIdx: sql`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`,
    receiverIdx: sql`CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id)`,
    patientIdx: sql`CREATE INDEX IF NOT EXISTS idx_messages_patient ON messages(patient_id)`,
    createdIdx: sql`CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)`,
}));

export const telegramLinks = pgTable('telegram_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  chatId: varchar('chat_id', { length: 50 }).notNull().unique(),
  username: varchar('username', { length: 255 }),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  isActive: boolean('is_active').default(true),
  linkedAt: timestamp('linked_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const telegramLinkCodes = pgTable('telegram_link_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 6 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

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

export const staffProfiles = pgTable('staff_profiles', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
    position: varchar('position', { length: 100 }),
    employmentDate: date('employment_date'),
    weeklySchedule: jsonb('weekly_schedule'),
    notes: text('notes'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const staffAttendance = pgTable('staff_attendance', {
    id: uuid('id').primaryKey().defaultRandom(),
    staffId: uuid('staff_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    date: varchar('date', { length: 10 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('present'),
    workLocation: varchar('work_location', { length: 50 }),
    notes: text('notes'),
    adminNotes: text('admin_notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    staffDateIdx: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_attendance_staff_date ON staff_attendance(staff_id, date)`,
    dateIdx: sql`CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(date)`,
    staffIdx: sql`CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff ON staff_attendance(staff_id)`,
}));

export const staffAttendanceSessions = pgTable('staff_attendance_sessions', {
    id: uuid('id').primaryKey().defaultRandom(),
    attendanceId: uuid('attendance_id').notNull().references(() => staffAttendance.id, { onDelete: 'cascade' }),
    checkInTime: timestamp('check_in_time').notNull(),
    checkOutTime: timestamp('check_out_time'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    attendanceIdx: sql`CREATE INDEX IF NOT EXISTS idx_sessions_attendance ON staff_attendance_sessions(attendance_id)`,
}));

export const staffSchedules = pgTable('staff_schedules', {
    id: uuid('id').primaryKey().defaultRandom(),
    staffId: uuid('staff_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(),
    startTime: varchar('start_time', { length: 5 }).notNull(),
    endTime: varchar('end_time', { length: 5 }).notNull(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    staffDayIdx: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_schedules_staff_day ON staff_schedules(staff_id, day_of_week)`,
}));

export const clinicSettings = pgTable('clinic_settings', {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 100 }).unique().notNull(),
    value: text('value').notNull(),
    description: varchar('description', { length: 255 }),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    keyIdx: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_settings_key ON clinic_settings(key)`,
}));

// ─── Doctor Profiles (public landing-page profiles) ───

export const doctorProfiles = pgTable('doctor_profiles', {
    doctorId: uuid('doctor_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    specialty: varchar('specialty', { length: 255 }),
    bio: text('bio'),
    photoUrl: text('photo_url'),
    experienceYears: integer('experience_years'),
    patientsCount: integer('patients_count'),
    rating: decimal('rating', { precision: 3, scale: 1 }),
    sortOrder: integer('sort_order').default(0).notNull(),
    showOnLanding: boolean('show_on_landing').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    sortIdx: sql`CREATE INDEX IF NOT EXISTS idx_doctor_profiles_sort ON doctor_profiles(sort_order)`,
}));

// ─── Accounting Module ───

export const chartOfAccounts = pgTable('chart_of_accounts', {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 20 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 30 }).notNull(),
    parentId: uuid('parent_id'),
    description: text('description'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    typeIdx: sql`CREATE INDEX IF NOT EXISTS idx_coa_type ON chart_of_accounts(type)`,
    parentIdx: sql`CREATE INDEX IF NOT EXISTS idx_coa_parent ON chart_of_accounts(parent_id)`,
    activeIdx: sql`CREATE INDEX IF NOT EXISTS idx_coa_active ON chart_of_accounts(is_active)`,
}));

export const journalEntries = pgTable('journal_entries', {
    id: uuid('id').primaryKey().defaultRandom(),
    entryNumber: varchar('entry_number', { length: 50 }).notNull().unique(),
    entryDate: date('entry_date').notNull(),
    description: text('description').notNull(),
    reference: varchar('reference', { length: 100 }),
    referenceType: varchar('reference_type', { length: 50 }),
    createdById: uuid('created_by_id').references(() => users.id),
    status: varchar('status', { length: 20 }).default('posted'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    entryDateIdx: sql`CREATE INDEX IF NOT EXISTS idx_je_entry_date ON journal_entries(entry_date)`,
    statusIdx: sql`CREATE INDEX IF NOT EXISTS idx_je_status ON journal_entries(status)`,
    referenceIdx: sql`CREATE INDEX IF NOT EXISTS idx_je_reference ON journal_entries(reference, reference_type)`,
    createdByIdx: sql`CREATE INDEX IF NOT EXISTS idx_je_created_by ON journal_entries(created_by_id)`,
}));

export const journalEntryLines = pgTable('journal_entry_lines', {
    id: uuid('id').primaryKey().defaultRandom(),
    journalEntryId: uuid('journal_entry_id').notNull().references(() => journalEntries.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id').notNull().references(() => chartOfAccounts.id),
    debit: decimal('debit', { precision: 15, scale: 2 }).default('0'),
    credit: decimal('credit', { precision: 15, scale: 2 }).default('0'),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    journalIdx: sql`CREATE INDEX IF NOT EXISTS idx_jel_journal ON journal_entry_lines(journal_entry_id)`,
    accountIdx: sql`CREATE INDEX IF NOT EXISTS idx_jel_account ON journal_entry_lines(account_id)`,
}));

// ─── Inventory Module ───

export const inventoryCategories = pgTable('inventory_categories', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    activeIdx: sql`CREATE INDEX IF NOT EXISTS idx_inv_cat_active ON inventory_categories(is_active)`,
}));

export const products = pgTable('products', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    sku: varchar('sku', { length: 50 }).unique(),
    barcode: varchar('barcode', { length: 100 }),
    categoryId: uuid('category_id').references(() => inventoryCategories.id),
    unit: varchar('unit', { length: 50 }).notNull().default('عدد'),
    purchasePrice: decimal('purchase_price', { precision: 12, scale: 2 }),
    sellingPrice: decimal('selling_price', { precision: 12, scale: 2 }),
    currentStock: decimal('current_stock', { precision: 12, scale: 3 }).default('0'),
    minStockLevel: decimal('min_stock_level', { precision: 12, scale: 3 }).default('0'),
    description: text('description'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    categoryIdx: sql`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)`,
    skuIdx: sql`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)`,
    activeIdx: sql`CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active)`,
    lowStockIdx: sql`CREATE INDEX IF NOT EXISTS idx_products_low_stock ON products(current_stock, min_stock_level)`,
}));

export const stockMovements = pgTable('stock_movements', {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    movementType: varchar('movement_type', { length: 20 }).notNull(),
    quantity: decimal('quantity', { precision: 12, scale: 3 }).notNull(),
    unitPrice: decimal('unit_price', { precision: 12, scale: 2 }),
    totalPrice: decimal('total_price', { precision: 15, scale: 2 }),
    reference: varchar('reference', { length: 100 }),
    referenceType: varchar('reference_type', { length: 50 }),
    description: text('description'),
    performedById: uuid('performed_by_id').references(() => users.id),
    performedAt: timestamp('performed_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    productIdx: sql`CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id)`,
    typeIdx: sql`CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type)`,
    performedIdx: sql`CREATE INDEX IF NOT EXISTS idx_stock_movements_performed ON stock_movements(performed_at)`,
}));

export const leadSources = pgTable('lead_sources', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    type: varchar('type', { length: 30 }).notNull(),
    category: varchar('category', { length: 30 }).notNull().default('other'),
    description: text('description'),
    color: varchar('color', { length: 7 }),
    isActive: boolean('is_active').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    activeIdx: index('idx_lead_sources_active').on(table.isActive),
    typeIdx: index('idx_lead_sources_type').on(table.type),
    chkType: check('chk_lead_source_type', sql`${table.type} IN ('instagram', 'google_ads', 'google_search', 'website', 'referral', 'walk_in', 'whatsapp', 'telegram', 'phone_call', 'other')`),
    chkCategory: check('chk_lead_source_category', sql`${table.category} IN ('social', 'paid_ads', 'organic', 'referral', 'direct', 'messaging', 'other')`),
}));

export const leads = pgTable('leads', {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    phone: varchar('phone', { length: 20 }),
    nationalId: varchar('national_id', { length: 10 }),

    sourceId: uuid('source_id').references(() => leadSources.id),
    campaignName: varchar('campaign_name', { length: 150 }),
    utmSource: varchar('utm_source', { length: 100 }),
    utmMedium: varchar('utm_medium', { length: 100 }),
    utmCampaign: varchar('utm_campaign', { length: 100 }),
    referrerUrl: text('referrer_url'),
    landingUrl: text('landing_url'),

    status: varchar('status', { length: 30 }).notNull().default('new'),
    priority: varchar('priority', { length: 10 }).notNull().default('medium'),
    tags: jsonb('tags').default([]).notNull(),

    expectedServiceId: uuid('expected_service_id').references(() => procedureCodes.id),
    expectedVisitTypeId: uuid('expected_visit_type_id').references(() => doctorVisitTypes.id),
    expectedValue: decimal('expected_value', { precision: 12, scale: 2 }),

    assignedStaffId: uuid('assigned_staff_id').references(() => users.id),
    assignedDoctorId: uuid('assigned_doctor_id').references(() => users.id),

    firstContactAt: timestamp('first_contact_at'),
    lastContactAt: timestamp('last_contact_at'),
    nextFollowUpAt: timestamp('next_follow_up_at'),
    lastActivityAt: timestamp('last_activity_at'),

    convertedPatientId: uuid('converted_patient_id').references(() => patients.id),
    conversionDate: timestamp('conversion_date'),
    convertedById: uuid('converted_by_id').references(() => users.id),
    conversionNote: text('conversion_note'),

    lostReason: varchar('lost_reason', { length: 30 }),
    lostAt: timestamp('lost_at'),

    note: text('note'),
    marketingConsent: boolean('marketing_consent').default(false).notNull(),
    marketingConsentAt: timestamp('marketing_consent_at'),

    isDeleted: boolean('is_deleted').default(false).notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    statusIdx: index('idx_leads_status').on(table.status),
    priorityIdx: index('idx_leads_priority').on(table.priority),
    sourceIdx: index('idx_leads_source').on(table.sourceId),
    staffIdx: index('idx_leads_assigned_staff').on(table.assignedStaffId),
    doctorIdx: index('idx_leads_assigned_doctor').on(table.assignedDoctorId),
    phoneIdx: index('idx_leads_phone').on(table.phone),
    followUpIdx: index('idx_leads_next_follow_up').on(table.nextFollowUpAt),
    createdIdx: index('idx_leads_created').on(table.createdAt),
    tagsIdx: index('idx_leads_tags').using('gin', table.tags),
    convertedPatientUq: uniqueIndex('uq_leads_converted_patient').on(table.convertedPatientId).where(sql`${table.convertedPatientId} IS NOT NULL`),
    chkStatus: check('chk_lead_status', sql`${table.status} IN ('new', 'contacted', 'qualified', 'appointment_booked', 'visited', 'converted', 'lost')`),
    chkPriority: check('chk_lead_priority', sql`${table.priority} IN ('low', 'medium', 'high')`),
    chkLostReason: check('chk_lead_lost_reason', sql`${table.lostReason} IS NULL OR ${table.lostReason} IN ('not_interested', 'budget', 'competitor', 'unreachable', 'wrong_number', 'duplicate', 'other')`),
}));

export const leadActivities = pgTable('lead_activities', {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 30 }).notNull(),
    note: text('note'),
    performedBy: uuid('performed_by').references(() => users.id),
    oldStatus: varchar('old_status', { length: 30 }),
    newStatus: varchar('new_status', { length: 30 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    leadIdx: index('idx_lead_activities_lead').on(table.leadId),
    leadCreatedIdx: index('idx_lead_activities_lead_created').on(table.leadId, table.createdAt),
    typeIdx: index('idx_lead_activities_type').on(table.type),
    performedIdx: index('idx_lead_activities_performed').on(table.performedBy),
    chkType: check('chk_lead_activity_type', sql`${table.type} IN ('created', 'contacted', 'note_added', 'status_changed', 'assigned', 'qualified', 'appointment_booked', 'visit_completed', 'converted', 'lost')`),
}));

export const leadNotes = pgTable('lead_notes', {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    authorId: uuid('author_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    leadIdx: index('idx_lead_notes_lead').on(table.leadId),
}));


import { pgTable, uuid, serial, varchar, char, date, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm'


export const patients = pgTable('patients', {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    nationalId: char('national_id', { length: 10 }).unique().notNull(),
    insuranceCode: varchar('insurance_code', { length: 50 }),
    birthDate: date('birth_date'),
    phone: varchar('phone', { length: 20 }),
    address: text('address'),
    maritalStatus: varchar('marital_status', { length: 20 }),
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
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }),
    outcome: varchar('outcome', { length: 50 }),
    liveBirths: integer('live_births'),
    pregnancyDate: date('pregnancy_date'),
    notes: text('notes'),
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
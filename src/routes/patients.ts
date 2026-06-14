// src/routes/patients.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
// use fastify.db (decorated by plugins/db) for better DI/testability
import { patients, diseases, medications, allergies, visits, pregnancies, attachments } from '../db/schema'
import { desc, eq, and, notInArray } from 'drizzle-orm'
import { z } from 'zod'
import { requireRole } from '../middleware/roleAuth';
import path from 'path'
import fs from 'fs/promises'
import { saveMultipartParts, cleanupSavedFiles, SavedFile } from '../utils/uploads'
import { smsService } from '../services/sms.service';


const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

const PatientPayloadSchema = z.object({
    patient: z.object({
        first_name: z.string().min(2, 'نام باید حداقل ۲ کاراکتر باشد'),
        last_name: z.string().min(2, 'نام خانوادگی باید حداقل ۲ کاراکتر باشد'),
        national_id: z.string().length(10, 'شماره ملی باید دقیقاً ۱۰ رقم باشد'),
        insurance_code: z.string().optional().nullable(),
        birth_date: z.string().nullable().optional(),
        phone: z
            .string()
            .regex(
                /^09\d{9}$/,
                'شماره موبایل معتبر نیست'
            )
            .optional()
            .or(z.literal('')),
        address: z.string().optional().nullable(),
        marital_status: z.string().optional().nullable(),
        diseases: z.array(
            z.object({
                name: z.string().min(1, 'نام بیماری نمی‌تواند خالی باشد'),
                diagnosed_at: z.string().nullable().optional(),
            })
        ).optional().default([]),
        medications: z.array(
            z.object({
                name: z.string().min(1, 'نام دارو نمی‌تواند خالی باشد'),
                dosage: z.string().optional().nullable(),
            })
        ).optional().default([]),
        allergies: z.array(
            z.object({
                substance: z.string().min(1, 'ماده حساسیت‌زا نمی‌تواند خالی باشد'),
                severity: z.enum(['خفیف', 'متوسط', 'شدید']).optional().default('متوسط'),
            })
        ).optional().default([]),
        pregnancy_notes: z.string().optional().nullable(),
    }),
    pregnancy: z.object({
        live: z.number().int().min(0).default(0),
        abortion: z.number().int().min(0).default(0),
        current: z.number().int().min(0).optional().nullable(),
        note: z.string().optional().nullable()
    }).optional(),
    visit: z.object({
        visit_date: z.string().min(1, 'تاریخ ویزیت الزامی است'),
        visit_type: z.string().optional(),
        reason: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        pregnancy_records: z.array(z.object({
            gravida_index: z.union([z.number(), z.string()]).optional().nullable(),
            status: z.string().optional().nullable(),
            lmp: z.string().optional().nullable(),
            edd: z.string().optional().nullable(),
            end_date: z.string().optional().nullable(),
            gestational_age_weeks: z.union([z.number(), z.string()]).optional().nullable(),
            gestational_age_days: z.union([z.number(), z.string()]).optional().nullable(),
            outcome: z.string().optional().nullable(),
            delivery_method: z.string().optional().nullable(),
            anesthesia_type: z.string().optional().nullable(),
            maternal_complications: z.array(z.string()).optional().nullable(),
            prenatal_screenings: z.record(z.string(), z.any()).optional().nullable(),
            newborns_details: z.array(z.any()).optional().nullable(),
            notes: z.string().optional().nullable(),
        })).optional(),
        pregnancy_notes: z.string().optional().nullable(),
    }),
})

export async function patientRoutes(fastify: FastifyInstance) {

    fastify.post('/register', { preHandler: requireRole(['admin_doctor', 'doctor']) }, async (request, reply) => {
        if (!request.isMultipart()) {
            return reply.status(400).send({ error: 'درخواست باید از نوع FormData باشد' })
        }

        const { files: uploadedFiles, fields } = await saveMultipartParts(request.parts(), UPLOAD_DIR)

        const rawPatient = fields.patient ? JSON.parse(fields.patient as string) : null
        const rawVisit = fields.visit ? JSON.parse(fields.visit as string) : null

        const result = PatientPayloadSchema.safeParse({
            patient: rawPatient,
            visit: rawVisit,
        })

        if (!result.success) {
            await cleanupSavedFiles(UPLOAD_DIR, uploadedFiles as SavedFile[]).catch(() => { })
            return reply.status(400).send({ error: 'داده‌های ورودی نامعتبر', details: result.error })
        }

        const { patient, visit } = result.data

        try {
            const newPatient = await fastify.db.transaction(async (tx) => {
                // الف) ثبت اطلاعات بیمار
                const [insertedPatient] = await tx.insert(patients).values({
                    firstName: patient.first_name,
                    lastName: patient.last_name,
                    nationalId: patient.national_id,
                    insuranceCode: patient.insurance_code || null,
                    birthDate: patient.birth_date || null,
                    phone: patient.phone || null,
                    address: patient.address || null,
                    maritalStatus: patient.marital_status || null,
                }).returning()

                // ب) ثبت بیماری‌ها
                if (patient.diseases && patient.diseases.length > 0) {
                    await tx.insert(diseases).values(
                        patient.diseases.map((d: any) => ({
                            patientId: insertedPatient.id,
                            name: d.name,
                            diagnosedAt: d.diagnosed_at || null,
                        }))
                    )
                }

                // ج) ثبت داروها
                if (patient.medications && patient.medications.length > 0) {
                    await tx.insert(medications).values(
                        patient.medications.map((m: any) => ({
                            patientId: insertedPatient.id,
                            name: m.name,
                            dosage: m.dosage || null,
                        }))
                    )
                }

                // د) ثبت آلرژی‌ها
                if (patient.allergies && patient.allergies.length > 0) {
                    await tx.insert(allergies).values(
                        patient.allergies.map((a: any) => ({
                            patientId: insertedPatient.id,
                            substance: a.substance,
                            severity: a.severity || 'متوسط',
                        }))
                    )
                }

                // هـ) ثبت اطلاعات بارداری همگام با اسکیمای اصلی دیتابیس
                if (visit) {
                    if (visit.pregnancy_records && visit.pregnancy_records.length > 0) {
                        await tx.insert(pregnancies).values(
                            visit.pregnancy_records.map((p: any) => ({
                                patientId: insertedPatient.id,
                                gravidaIndex: (p.gravida_index != null && p.gravida_index !== '') ? Number(p.gravida_index) : null,
                                status: p.status ?? 'completed',
                                lmp: p.lmp ?? null,
                                edd: p.edd ?? null,
                                endDate: p.end_date ?? null,
                                gestationalAgeWeeks: (p.gestational_age_weeks != null && p.gestational_age_weeks !== '') ? Number(p.gestational_age_weeks) : null,
                                gestationalAgeDays: (p.gestational_age_days != null && p.gestational_age_days !== '') ? Number(p.gestational_age_days) : null,
                                outcome: p.outcome ?? null,
                                deliveryMethod: p.delivery_method ?? null,
                                anesthesiaType: p.anesthesia_type ?? null,
                                maternalComplications: p.maternal_complications ?? [],
                                prenatalScreenings: p.prenatal_screenings ?? {},
                                newbornsDetails: p.newborns_details ?? [],
                                notes: p.notes ?? (visit.pregnancy_notes || null),
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }))
                        )
                    } else if (visit.pregnancy_notes) {
                        await tx.insert(pregnancies).values({
                            patientId: insertedPatient.id,
                            notes: visit.pregnancy_notes,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        })
                    }
                }

                // و) ثبت فایلهای آپلود شده
                if (uploadedFiles.length > 0) {
                    await tx.insert(attachments).values(
                        uploadedFiles.map((file: any) => ({
                            patientId: insertedPatient.id,
                            fileType: file.type || (file.fieldname ? file.fieldname.replace(/\[\]$/, '') : 'unknown'),
                            fileName: file.originalName,
                            filePath: file.publicPath,
                            createdAt: new Date()
                        }))
                    )
                }

                return insertedPatient
            })


            if (newPatient.phone) {
                await smsService.send(
                    newPatient.phone.toString(),
                    `خوش آمدید به کلینیک تخصصی دکتر حسینی 👋\n${newPatient.firstName} عزیز، ثبت‌نام شما با موفقیت انجام شد.`
                )
            }

            return reply.status(201).send({
                success: true,
                message: 'بیمار، ویزیت اولیه و فایل‌ها با موفقیت ثبت شدند',
                patientId: newPatient.id,
            })

        } catch (error: any) {
            await cleanupSavedFiles(UPLOAD_DIR, uploadedFiles as SavedFile[]).catch(() => { })

            if (error.constraint === 'patients_national_id_key') {
                return reply.status(409).send({ error: 'شماره ملی قبلاً ثبت شده است' })
            }

            console.error('خطا در ثبت بیمار و فایل‌ها:', error)
            return reply.status(500).send({ error: 'خطای داخلی سرور هنگام ثبت اطلاعات' })
        }
    })

    fastify.get('/', { preHandler: requireRole(['admin_doctor', 'doctor']) }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const allPatients = await fastify.db.select({
                id: patients.id,
                firstName: patients.firstName,
                lastName: patients.lastName,
                nationalId: patients.nationalId,
                phone: patients.phone,
                birthDate: patients.birthDate,
                maritalStatus: patients.maritalStatus,
                createdAt: patients.createdAt,
            })
                .from(patients)
                .where(eq(patients.isDeleted, false))
                .orderBy(desc(patients.createdAt))

            return reply.status(200).send({
                success: true,
                data: allPatients,
            })
        } catch (error) {
            console.error('خطا در دریافت لیست بیماران:', error)
            return reply.status(500).send({ error: 'خطای سرور' })
        }
    })

    fastify.get<{ Params: { id: string } }>('/:id', { preHandler: requireRole(['admin_doctor', 'doctor']) }, async (request, reply) => {
        const { id } = request.params
        try {
            const patientData = await fastify.db.transaction(async (tx) => {
                const [patient] = await tx
                    .select({
                        id: patients.id,
                        firstName: patients.firstName,
                        lastName: patients.lastName,
                        nationalId: patients.nationalId,
                        insuranceCode: patients.insuranceCode,
                        birth_date: patients.birthDate,
                        phone: patients.phone,
                        address: patients.address,
                        maritalStatus: patients.maritalStatus,
                    })
                    .from(patients)
                    .where(eq(patients.id, id))

                if (!patient) throw { status: 404, message: 'بیمار یافت نشد' }

                const diseasesList = await tx
                    .select({ name: diseases.name, diagnosed_at: diseases.diagnosedAt })
                    .from(diseases)
                    .where(eq(diseases.patientId, id))

                const medicationsList = await tx
                    .select({ name: medications.name, dosage: medications.dosage })
                    .from(medications)
                    .where(eq(medications.patientId, id))

                const allergiesList = await tx
                    .select({ substance: allergies.substance, severity: allergies.severity })
                    .from(allergies)
                    .where(eq(allergies.patientId, id))

                const obstetricHistory = await tx
                    .select()
                    .from(pregnancies)
                    .where(eq(pregnancies.patientId, id))
                    .orderBy(pregnancies.gravidaIndex);

                const attachmentsList = await tx
                    .select({
                        fileType: attachments.fileType,
                        fileName: attachments.fileName,
                        filePath: attachments.filePath,
                    })
                    .from(attachments)
                    .where(eq(attachments.patientId, id))

                const attachmentsData = {
                    ultrasound: attachmentsList.filter(f => f.fileType === 'ultrasound'),
                    lab: attachmentsList.filter(f => f.fileType === 'lab'),
                    prescription: attachmentsList.filter(f => f.fileType === 'prescription')
                }

                return {
                    ...patient,
                    diseases: diseasesList.map(d => ({
                        name: d.name,
                        diagnosed_at: d.diagnosed_at ? new Date(d.diagnosed_at).toISOString().slice(0, 10) : null,
                    })),
                    medications: medicationsList,
                    allergies: allergiesList,
                    obstetricHistory,
                    attachments: attachmentsData
                }
            })

            return reply.status(200).send({ success: true, data: patientData })
        } catch (error: any) {
            if (error.status === 404) return reply.status(404).send({ error: 'بیمار یافت نشد' })
            console.error('خطا در دریافت جزئیات بیمار:', error)
            return reply.status(500).send({ error: 'خطای سرور در بازیابی اطلاعات' })
        }
    })

    fastify.post<{ Params: { id: string } }>('/:id', { preHandler: requireRole(['admin_doctor', 'doctor']) }, async (request, reply) => {
        const { id: patientId } = request.params
        // در بک‌اند (Controller)
        if (!request.isMultipart()) {
            return reply.status(400).send({ error: 'درخواست باید از نوع FormData باشد' })
        }

        const { files: uploadedFiles, fields } = await saveMultipartParts(request.parts(), UPLOAD_DIR)

        const rawPatient = fields.patient ? JSON.parse(fields.patient as string) : null
        const rawPregnancy = fields.pregnancy ? JSON.parse(fields.pregnancy as string) : null


        if (!rawPatient) {
            await cleanupSavedFiles(UPLOAD_DIR, uploadedFiles as SavedFile[]).catch(() => { })
            return reply.status(400).send({ error: 'داده‌های مربوط به بیمار یافت نشد' })
        }

        const pregnanciesList = Array.isArray(rawPregnancy) ? rawPregnancy : (rawPregnancy ? [rawPregnancy] : [])

        try {
            const result = await fastify.db.transaction(async (tx) => {
                // ۱. آپدیت اطلاعات پایه بیمار
                const updatedPatientList = await tx
                    .update(patients)
                    .set({
                        firstName: rawPatient.first_name,
                        lastName: rawPatient.last_name,
                        insuranceCode: rawPatient.insurance_code ?? null,
                        birthDate: rawPatient.birth_date ?? null,
                        phone: rawPatient.phone ?? null,
                        address: rawPatient.address ?? null,
                        maritalStatus: rawPatient.marital_status ?? null,
                        updatedAt: new Date(),
                    })
                    .where(eq(patients.id, patientId))
                    .returning()

                if (updatedPatientList.length === 0) throw { status: 404, message: 'بیمار یافت نشد' }

                // ۲. همگام‌سازی بیماری‌ها (تنها در صورتی که فیلد diseases ارسال شده باشد)
                if (rawPatient.diseases !== undefined) {
                    const diseasesList = Array.isArray(rawPatient.diseases) ? rawPatient.diseases : []
                    const diseaseIds = diseasesList.filter((d: any) => d.id).map((d: any) => d.id)

                    if (diseaseIds.length > 0) {
                        await tx.delete(diseases).where(and(eq(diseases.patientId, patientId), notInArray(diseases.id, diseaseIds)))
                    } else {
                        await tx.delete(diseases).where(eq(diseases.patientId, patientId))
                    }

                    for (const disease of diseasesList) {
                        const diseasePayload = {
                            patientId,
                            name: disease.name,
                            diagnosedAt: disease.diagnosed_at ?? null,
                        }
                        if (disease.id) {
                            await tx.update(diseases).set(diseasePayload).where(eq(diseases.id, disease.id))
                        } else {
                            await tx.insert(diseases).values(diseasePayload)
                        }
                    }
                }

                // ۳. همگام‌سازی داروها
                if (rawPatient.medications !== undefined) {
                    const medicationsList = Array.isArray(rawPatient.medications) ? rawPatient.medications : []
                    const medicationIds = medicationsList.filter((m: any) => m.id).map((m: any) => m.id)

                    if (medicationIds.length > 0) {
                        await tx.delete(medications).where(and(eq(medications.patientId, patientId), notInArray(medications.id, medicationIds)))
                    } else {
                        await tx.delete(medications).where(eq(medications.patientId, patientId))
                    }

                    for (const medication of medicationsList) {
                        const medicationPayload = {
                            patientId,
                            name: medication.name,
                            dosage: medication.dosage ?? null,
                        }
                        if (medication.id) {
                            await tx.update(medications).set(medicationPayload).where(eq(medications.id, medication.id))
                        } else {
                            await tx.insert(medications).values(medicationPayload)
                        }
                    }
                }

                // ۴. همگام‌سازی آلرژی‌ها
                if (rawPatient.allergies !== undefined) {
                    const allergiesList = Array.isArray(rawPatient.allergies) ? rawPatient.allergies : []
                    const allergyIds = allergiesList.filter((a: any) => a.id).map((a: any) => a.id)

                    if (allergyIds.length > 0) {
                        await tx.delete(allergies).where(and(eq(allergies.patientId, patientId), notInArray(allergies.id, allergyIds)))
                    } else {
                        await tx.delete(allergies).where(eq(allergies.patientId, patientId))
                    }

                    for (const allergy of allergiesList) {
                        const allergyPayload = {
                            patientId,
                            substance: allergy.substance,
                            severity: allergy.severity ?? 'متوسط',
                        }
                        if (allergy.id) {
                            await tx.update(allergies).set(allergyPayload).where(eq(allergies.id, allergy.id))
                        } else {
                            await tx.insert(allergies).values(allergyPayload)
                        }
                    }
                }

                // ۵. همگام‌سازی بارداری‌ها
                if (fields.pregnancy !== undefined) {
                    const incomingIds = pregnanciesList.filter((p: any) => p.id).map((p: any) => p.id)

                    if (incomingIds.length > 0) {
                        await tx.delete(pregnancies).where(and(eq(pregnancies.patientId, patientId), notInArray(pregnancies.id, incomingIds)))
                    } else {
                        await tx.delete(pregnancies).where(eq(pregnancies.patientId, patientId))
                    }

                    for (const p of pregnanciesList) {
                        const pregnancyPayload = {
                            patientId: patientId,
                            gravidaIndex: (p.gravida_index != null && p.gravida_index !== '') ? Number(p.gravida_index) : null,
                            status: p.status ?? 'completed',
                            lmp: p.lmp ?? null,
                            edd: p.edd ?? null,
                            endDate: p.end_date ?? null,
                            gestationalAgeWeeks: (p.gestational_age_weeks != null && p.gestational_age_weeks !== '') ? Number(p.gestational_age_weeks) : null,
                            gestationalAgeDays: (p.gestational_age_days != null && p.gestational_age_days !== '') ? Number(p.gestational_age_days) : null,
                            outcome: p.outcome ?? null,
                            deliveryMethod: p.delivery_method ?? null,
                            anesthesiaType: p.anesthesia_type ?? null,
                            maternalComplications: p.maternal_complications ?? [],
                            prenatalScreenings: p.prenatal_screenings ?? {},
                            newbornsDetails: p.newborns_details ?? [],
                            notes: p.notes ?? null,
                            updatedAt: new Date()
                        }

                        if (p.id) {
                            await tx.update(pregnancies).set(pregnancyPayload).where(eq(pregnancies.id, p.id))
                        } else {
                            await tx.insert(pregnancies).values({ ...pregnancyPayload, createdAt: new Date() })
                        }
                    }
                }

                // ۶. مدیریت فایل‌های آپلود شده جدید
                if (uploadedFiles.length > 0) {
                    await tx.insert(attachments).values(
                        uploadedFiles.map(file => ({
                            patientId: patientId,
                            fileType: file.type || (file.fieldname ? file.fieldname.replace(/\[\]$/, '') : 'unknown'),
                            fileName: file.originalName,
                            filePath: file.publicPath,
                            createdAt: new Date()
                        }))
                    )
                }

                return updatedPatientList[0]
            })

            return reply.status(200).send({
                success: true,
                message: 'پرونده بیمار با موفقیت به‌روزرسانی شد.',
                patient: result
            })

        } catch (error: any) {
            for (const file of uploadedFiles) {
                if ((file as any).savedName) {
                    await fs.unlink(path.join(UPLOAD_DIR, (file as any).savedName)).catch(() => { })
                }
            }
            console.error('خطا در به‌روزرسانی بیمار:', error)
            return reply.status(error.status || 500).send({ error: error.message || 'خطای داخلی سرور' })
        }
    })

    fastify.delete<{
        Params: { id: string }
    }>(
        '/:id',
        { preHandler: requireRole(['admin_doctor', 'doctor']) },
        async (request, reply) => {
            const { id } = request.params

            try {
                const result = await fastify.db.transaction(async (tx: any) => {
                    // چک کن بیمار وجود داره و قبلاً حذف نشده
                    const [existing] = await tx
                        .select({ id: patients.id, isDeleted: patients.isDeleted })
                        .from(patients)
                        .where(eq(patients.id, id))

                    if (!existing) {
                        throw { status: 404, message: 'بیمار یافت نشد' }
                    }

                    if (existing.isDeleted) {
                        throw { status: 410, message: 'بیمار قبلاً حذف شده است' }
                    }

                    // حذف نرم: فقط علامت‌گذاری
                    const [deletedPatient] = await tx
                        .update(patients)
                        .set({
                            isDeleted: true,
                            deletedAt: new Date(),
                        })
                        .where(eq(patients.id, id))
                        .returning({
                            id: patients.id,
                            firstName: patients.firstName,
                            lastName: patients.lastName,
                        })

                    return deletedPatient
                })

                return reply.status(200).send({
                    success: true,
                    message: 'بیمار با موفقیت حذف شد (قابل بازیابی)',
                    patient: {
                        id: result.id,
                        firstName: result.firstName,
                        lastName: result.lastName,
                    },
                })

            } catch (error: any) {
                if (error.status === 404) {
                    return reply.status(404).send({ error: 'بیمار یافت نشد' })
                }
                if (error.status === 410) {
                    return reply.status(410).send({ error: 'بیمار قبلاً حذف شده است' })
                }

                console.error('خطا در حذف بیمار:', error)
                return reply.status(500).send({ error: 'خطای سرور' })
            }
        })
}
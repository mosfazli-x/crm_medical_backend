// src/routes/patients.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { db } from '../db'
import { patients, diseases, medications, allergies, visits, pregnancies } from '../db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireRole } from '../middleware/roleAuth';

const PatientPayloadSchema = z.object({
    patient: z.object({
        first_name: z.string().min(2, 'نام باید حداقل ۲ کاراکتر باشد'),
        last_name: z.string().min(2, 'نام خانوادگی باید حداقل ۲ کاراکتر باشد'),
        national_id: z.string().length(10, 'شماره ملی باید دقیقاً ۱۰ رقم باشد'),
        insurance_code: z.string().optional().nullable(),
        birth_date: z.string().nullable().optional(),
        phone: z.string().optional().nullable(),
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
    }).optional(),
    visit: z.object({
        visit_date: z.string().min(1, 'تاریخ ویزیت الزامی است'),
        visit_type: z.string().optional(),
        reason: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
    }),
})

type RegisterPatientBody = z.infer<typeof PatientPayloadSchema>

export async function patientRoutes(fastify: FastifyInstance) {

    fastify.post('/register', { preHandler: requireRole(['admin_doctor', 'doctor']) }, async (request: FastifyRequest<{ Body: RegisterPatientBody }>, reply: FastifyReply) => {
        const result = PatientPayloadSchema.safeParse(request.body)
        console.log(result)
        if (!result.success) {
            return reply.status(400).send({ error: 'داده‌های ورودی نامعتبر', details: result.error.errors })
        }

        const { patient, visit, pregnancy } = result.data

        try {
            const newPatient = await db.transaction(async (tx) => {
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

                if (patient.diseases.length > 0) {
                    await tx.insert(diseases).values(
                        patient.diseases.map(d => ({
                            patientId: insertedPatient.id,
                            name: d.name,
                            diagnosedAt: d.diagnosed_at || null,
                        }))
                    )
                }

                if (patient.medications.length > 0) {
                    await tx.insert(medications).values(
                        patient.medications.map(m => ({
                            patientId: insertedPatient.id,
                            name: m.name,
                            dosage: m.dosage || null,
                        }))
                    )
                }

                if (patient.allergies.length > 0) {
                    await tx.insert(allergies).values(
                        patient.allergies.map(a => ({
                            patientId: insertedPatient.id,
                            substance: a.substance,
                            severity: a.severity || 'متوسط',
                        }))
                    )
                }

                if (pregnancy) {
                    await tx.insert(pregnancies).values({
                        patientId: insertedPatient.id,
                        notes: patient.pregnancy_notes || null,
                    })
                }

                return insertedPatient
            })

            return reply.status(201).send({
                success: true,
                message: 'بیمار و ویزیت اولیه با موفقیت ثبت شد',
                patientId: newPatient.id,
            })

        } catch (error: any) {
            if (error.constraint === 'patients_national_id_key') {
                return reply.status(409).send({ error: 'شماره ملی قبلاً ثبت شده است' })
            }

            console.error('خطا در ثبت بیمار:', error)
            return reply.status(500).send({ error: 'خطای سرور' })
        }
    })

    fastify.get('/', { preHandler: requireRole(['admin_doctor', 'doctor']) }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const allPatients = await db
                .select({
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
                .orderBy(patients.createdAt, 'desc') // جدیدترین‌ها اول

            return reply.status(200).send({
                success: true,
                data: allPatients,
            })
        } catch (error) {
            console.error('خطا در دریافت لیست بیماران:', error)
            return reply.status(500).send({ error: 'خطای سرور' })
        }
    })

    // GET /api/patients/:id - جزئیات کامل بیمار
    fastify.get('/:id', { preHandler: requireRole(['admin_doctor', 'doctor']) }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params

        try {
            const patientData = await db.transaction(async (tx) => {
                // 1. اطلاعات پایه بیمار
                const [patient] = await tx
                    .select({
                        id: patients.id,
                        firstName: patients.firstName,
                        lastName: patients.lastName,
                        nationalId: patients.nationalId,
                        insuranceCode: patients.insuranceCode,
                        birthDate: patients.birthDate,
                        phone: patients.phone,
                        address: patients.address,
                        maritalStatus: patients.maritalStatus,
                    })
                    .from(patients)
                    .where(eq(patients.id, id))

                if (!patient) {
                    throw { status: 404, message: 'بیمار یافت نشد' }
                }

                const diseasesList = await tx
                    .select({
                        name: diseases.name,
                        diagnosed_at: diseases.diagnosedAt,
                    })
                    .from(diseases)
                    .where(eq(diseases.patientId, id))

                // 3. داروها
                const medicationsList = await tx
                    .select({
                        name: medications.name,
                        dosage: medications.dosage,
                    })
                    .from(medications)
                    .where(eq(medications.patientId, id))

                // 4. آلرژی‌ها
                const allergiesList = await tx
                    .select({
                        substance: allergies.substance,
                        severity: allergies.severity,
                    })
                    .from(allergies)
                    .where(eq(allergies.patientId, id))

                // 5. خلاصه بارداری (ممکنه وجود نداشته باشه)
                const pregnancyData = await tx
                    .select({
                        notes: pregnancies.notes,
                    })
                    .from(pregnancies)
                    .where(eq(pregnancies.patientId, id))
                    .limit(1)

                const pregnancyNotes = pregnancyData.length > 0 ? pregnancyData[0].notes : null

                const pregnancy = null
                // 6. ویزیت اولیه

                return {
                    ...patient,
                    diseases: diseasesList.map(d => ({
                        name: d.name,
                        diagnosed_at: d.diagnosed_at ? d.diagnosed_at.toISOString().slice(0, 10) : null,
                    })),
                    medications: medicationsList,
                    allergies: allergiesList,
                    pregnancy,
                    pregnancyNotes,
                }
            })

            return reply.status(200).send({
                success: true,
                data: patientData,
            })

        } catch (error: any) {
            if (error.status === 404) {
                return reply.status(404).send({ error: 'بیمار یافت نشد' })
            }

            console.error('خطا در دریافت جزئیات بیمار:', error)
            return reply.status(500).send({ error: 'خطای سرور' })
        }
    })

    // PUT /api/patients/:id - ویرایش کامل اطلاعات بیمار
    fastify.put('/:id', { preHandler: requireRole(['admin_doctor', 'doctor']) }, async (request: FastifyRequest<{
        Params: { id: string };
        Body: RegisterPatientBody
    }>, reply: FastifyReply) => {
        const { id } = request.params
        const { patient, visit, pregnancy } = request.body

        try {
            const result = await db.transaction(async (tx) => {
                // 1. به‌روزرسانی اطلاعات پایه بیمار
                const updatedPatientList = await tx
                    .update(patients)
                    .set({
                        firstName: patient.first_name,
                        lastName: patient.last_name,
                        // national_id رو تغییر نمی‌دیم چون unique هست و ممکنه conflict بده
                        // اگر واقعاً لازم بود، باید جداگانه مدیریت بشه
                        insuranceCode: patient.insurance_code ?? null,
                        birthDate: patient.birth_date ?? null,
                        phone: patient.phone ?? null,
                        address: patient.address ?? null,
                        maritalStatus: patient.marital_status ?? null,
                        updatedAt: new Date(),
                    })
                    .where(eq(patients.id, id))
                    .returning({
                        id: patients.id,
                        firstName: patients.firstName,
                        lastName: patients.lastName,
                        nationalId: patients.nationalId,
                    })

                if (updatedPatientList.length === 0) {
                    throw { status: 404, message: 'بیمار یافت نشد' }
                }

                const updatedPatient = updatedPatientList[0]

                // 2. مدیریت بیماری‌ها - حذف همه و اضافه مجدد
                await tx.delete(diseases).where(eq(diseases.patientId, id))
                if (patient.diseases && patient.diseases.length > 0) {
                    await tx.insert(diseases).values(
                        patient.diseases.map(d => ({
                            patientId: id,
                            name: d.name,
                            diagnosedAt: d.diagnosed_at ?? null,
                        }))
                    )
                }

                // 3. مدیریت داروها
                await tx.delete(medications).where(eq(medications.patientId, id))
                if (patient.medications && patient.medications.length > 0) {
                    await tx.insert(medications).values(
                        patient.medications.map(m => ({
                            patientId: id,
                            name: m.name,
                            dosage: m.dosage ?? null,
                        }))
                    )
                }

                // 4. مدیریت آلرژی‌ها
                await tx.delete(allergies).where(eq(allergies.patientId, id))
                if (patient.allergies && patient.allergies.length > 0) {
                    await tx.insert(allergies).values(
                        patient.allergies.map(a => ({
                            patientId: id,
                            substance: a.substance,
                            severity: a.severity ?? 'متوسط',
                        }))
                    )
                }

                // 5. مدیریت خلاصه بارداری
                await tx.delete(pregnancies).where(eq(pregnancies.patientId, id))

                if (pregnancy && (pregnancy.live > 0 || pregnancy.abortion > 0 || pregnancy.current !== null || patient.pregnancy_notes)) {
                    await tx.insert(pregnancies).values({
                        patientId: id,
                        liveBirths: pregnancy.live,
                        abortions: pregnancy.abortion,
                        currentWeek: pregnancy.current ?? null,
                        notes: patient.pregnancy_notes ?? null,
                    })
                }

                // 6. مدیریت ویزیت اولیه
                const existingVisits = await tx
                    .select({ id: visits.id })
                    .from(visits)
                    .where(eq(visits.patientId, id))
                    .orderBy(visits.visitDate)
                    .limit(1)

                if (existingVisits.length > 0) {
                    const visitId = existingVisits[0].id

                    // به‌روزرسانی ویزیت
                    await tx
                        .update(visits)
                        .set({
                            visitType: visit.visit_type ?? 'ویزیت اولیه',
                            visitReason: visit.reason ?? null,
                            visitDate: new Date(visit.visit_date),
                        })
                        .where(eq(visits.id, visitId))

                    // به‌روزرسانی یا ایجاد یادداشت
                    const existingNote = await tx
                        .select({ id: visitNotes.id })
                        .from(visitNotes)
                        .where(eq(visitNotes.visitId, visitId))
                        .limit(1)

                    if (visit.notes) {
                        if (existingNote.length > 0) {
                            await tx
                                .update(visitNotes)
                                .set({ content: visit.notes })
                                .where(eq(visitNotes.id, existingNote[0].id))
                        } else {
                            await tx.insert(visitNotes).values({
                                visitId,
                                content: visit.notes,
                            })
                        }
                    } else if (existingNote.length > 0) {
                        // اگر یادداشت خالی بود، حذفش کن
                        await tx.delete(visitNotes).where(eq(visitNotes.id, existingNote[0].id))
                    }
                }

                return updatedPatient
            })

            return reply.status(200).send({
                success: true,
                message: 'اطلاعات بیمار با موفقیت به‌روزرسانی شد',
                patient: {
                    id: result.id,
                    firstName: result.firstName,
                    lastName: result.lastName,
                    nationalId: result.nationalId,
                },
            })

        } catch (error: any) {
            if (error.status === 404) {
                return reply.status(404).send({ error: 'بیمار یافت نشد' })
            }

            // خطای تکراری شماره ملی (اگر بعداً اجازه تغییر دادی)
            if (error.constraint === 'patients_national_id_key') {
                return reply.status(409).send({ error: 'شماره ملی قبلاً استفاده شده است' })
            }

            console.error('خطا در ویرایش بیمار:', error)
            return reply.status(500).send({ error: 'خطای داخلی سرور' })
        }
    })

    // DELETE /api/patients/:id - حذف نرم بیمار
    fastify.delete('/:id', { preHandler: requireRole(['admin_doctor', 'doctor']) }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params

        try {
            const result = await db.transaction(async (tx) => {
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
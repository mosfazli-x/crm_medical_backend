// src/routes/users.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { db } from '../db'
import { users, patients } from '../db/schema'
import { eq, and, not, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { requireRole } from '../middleware/roleAuth'

// ولیدیشن برای تأیید ساده کاربر (غیربیمار)
const ApproveUserSchema = z.object({})

// ولیدیشن برای تأیید بیمار + ایجاد پرونده
const ApprovePatientSchema = z.object({
    firstName: z.string().min(2, 'نام باید حداقل ۲ کاراکتر باشد'),
    lastName: z.string().min(2, 'نام خانوادگی باید حداقل ۲ کاراکتر باشد'),
    nationalId: z.string().length(10, 'شماره ملی باید دقیقاً ۱۰ رقم باشد'),
    insuranceCode: z.string().optional().nullable(),
    birthDate: z.string().nullable().optional(),
    address: z.string().optional().nullable(),
    maritalStatus: z.string().optional().nullable(),
})

type ApprovePatientBody = z.infer<typeof ApprovePatientSchema>

export async function userRoutes(fastify: FastifyInstance) {
    // GET /api/users - لیست همه کاربران
    fastify.get('/', { preHandler: requireRole(['admin_doctor']) }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const allUsers = await db
                .select({
                    id: users.id,
                    phone: users.phone,
                    fullName: users.fullName,
                    role: users.role,
                    status: users.status,
                    organizationName: users.organizationName,
                    patientId: users.patientId,
                    createdAt: users.createdAt,
                })
                .from(users)
                .orderBy(users.createdAt, 'desc')

            return reply.status(200).send({
                success: true,
                data: allUsers,
            })
        } catch (error) {
            console.error('خطا در دریافت لیست کاربران:', error)
            return reply.status(500).send({ error: 'خطای سرور' })
        }
    })

    // GET /api/users/:id - جزئیات کاربر
    fastify.get('/:id', { preHandler: requireRole(['admin_doctor']) }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params
        try {
            const [user] = await db
                .select({
                    id: users.id,
                    phone: users.phone,
                    fullName: users.fullName,
                    role: users.role,
                    status: users.status,
                    organizationName: users.organizationName,
                    patientId: users.patientId,
                    createdAt: users.createdAt,
                })
                .from(users)
                .where(eq(users.id, id))

            if (!user) {
                return reply.status(404).send({ error: 'کاربر یافت نشد' })
            }

            return reply.status(200).send({
                success: true,
                data: user,
            })
        } catch (error) {
            console.error('خطا در دریافت جزئیات کاربر:', error)
            return reply.status(500).send({ error: 'خطای سرور' })
        }
    })

    // POST /api/users/approve/:id - تأیید ساده کاربر (doctor, lab, pharmacy)
    fastify.post('/approve/:id', { preHandler: requireRole(['admin_doctor']) }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params

        try {
            const result = await db.transaction(async (tx) => {
                const [updatedUser] = await tx
                    .update(users)
                    .set({
                        status: 'approved',
                        requiresPasswordChange: false,
                        updatedAt: new Date(),
                    })
                    .where(and(
                        eq(users.id, id),
                        eq(users.status, 'pending'),
                        not(inArray(users.role, ['patient']))
                    ))
                    .returning({
                        id: users.id,
                        fullName: users.fullName,
                        role: users.role,
                        status: users.status,
                    })

                if (updatedUser.length === 0) {
                    throw { status: 404, message: 'کاربر یافت نشد یا قبلاً تأیید/رد شده است' }
                }

                return updatedUser[0]
            })

            return reply.status(200).send({
                success: true,
                message: 'کاربر با موفقیت تأیید شد',
                user: result,
            })
        } catch (error: any) {
            if (error.status === 404) {
                return reply.status(404).send({ error: error.message })
            }
            console.error('خطا در تأیید کاربر:', error)
            return reply.status(500).send({ error: 'خطای سرور' })
        }
    })

    // POST /api/users/reject/:id - رد کاربر (برای pending) → status = 'rejected'
    fastify.post('/reject/:id', { preHandler: requireRole(['admin_doctor']) }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params

        try {
            const result = await db.transaction(async (tx) => {
                const [updatedUser] = await tx
                    .update(users)
                    .set({
                        status: 'rejected',
                        updatedAt: new Date(),
                    })
                    .where(and(eq(users.id, id), eq(users.status, 'pending')))
                    .returning({
                        id: users.id,
                        fullName: users.fullName,
                        role: users.role,
                        status: users.status,
                    })

                if (updatedUser.length === 0) {
                    throw { status: 404, message: 'کاربر یافت نشد یا قبلاً پردازش شده است' }
                }

                return updatedUser[0]
            })

            return reply.status(200).send({
                success: true,
                message: 'کاربر با موفقیت رد شد (غیرفعال)',
                user: result,
            })
        } catch (error: any) {
            if (error.status === 404) {
                return reply.status(404).send({ error: error.message })
            }
            console.error('خطا در رد کاربر:', error)
            return reply.status(500).send({ error: 'خطای سرور' })
        }
    })

    // POST /api/users/deactivate/:id - غیرفعال کردن کاربر approved → status = 'rejected'
    fastify.post('/deactivate/:id', { preHandler: requireRole(['admin_doctor']) }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params

        try {
            const result = await db.transaction(async (tx) => {
                const [updatedUser] = await tx
                    .update(users)
                    .set({
                        status: 'rejected',
                        updatedAt: new Date(),
                    })
                    .where(and(eq(users.id, id), eq(users.status, 'approved')))
                    .returning({
                        id: users.id,
                        fullName: users.fullName,
                        role: users.role,
                        status: users.status,
                    })

                if (updatedUser.length === 0) {
                    throw { status: 404, message: 'کاربر یافت نشد یا قبلاً غیرفعال شده است' }
                }

                return updatedUser[0]
            })

            return reply.status(200).send({
                success: true,
                message: 'کاربر با موفقیت غیرفعال شد',
                user: result,
            })
        } catch (error: any) {
            if (error.status === 404) {
                return reply.status(404).send({ error: error.message })
            }
            console.error('خطا در غیرفعال کردن کاربر:', error)
            return reply.status(500).send({ error: 'خطای سرور' })
        }
    })

    // POST /api/users/activate/:id - فعال کردن مجدد کاربر rejected → status = 'approved'
    fastify.post('/activate/:id', { preHandler: requireRole(['admin_doctor']) }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params

        try {
            const result = await db.transaction(async (tx) => {
                const [updatedUser] = await tx
                    .update(users)
                    .set({
                        status: 'approved',
                        updatedAt: new Date(),
                    })
                    .where(and(eq(users.id, id), eq(users.status, 'rejected')))
                    .returning({
                        id: users.id,
                        fullName: users.fullName,
                        role: users.role,
                        status: users.status,
                    })

                if (updatedUser.length === 0) {
                    throw { status: 404, message: 'کاربر یافت نشد یا وضعیت مناسب برای فعال کردن ندارد' }
                }

                return updatedUser[0]
            })

            return reply.status(200).send({
                success: true,
                message: 'کاربر با موفقیت فعال شد',
                user: result,
            })
        } catch (error: any) {
            if (error.status === 404) {
                return reply.status(404).send({ error: error.message })
            }
            console.error('خطا در فعال کردن کاربر:', error)
            return reply.status(500).send({ error: 'خطای سرور' })
        }
    })

    fastify.post('/approve-patient/:id', { preHandler: requireRole(['admin_doctor']) }, async (request: FastifyRequest<{
        Params: { id: string }
        Body: ApprovePatientBody
    }>, reply: FastifyReply) => {
        const { id } = request.params
        const result = ApprovePatientSchema.safeParse(request.body)

        if (!result.success) {
            return reply.status(400).send({ error: 'داده‌های ورودی نامعتبر', details: result.error.errors })
        }

        const patientData = result.data

        try {
            const data = await db.transaction(async (tx) => {
                // 1. ایجاد پرونده patient جدید
                const [newPatient] = await tx
                    .insert(patients)
                    .values({
                        firstName: patientData.firstName,
                        lastName: patientData.lastName,
                        nationalId: patientData.nationalId,
                        insuranceCode: patientData.insuranceCode ?? null,
                        birthDate: patientData.birthDate ?? null,
                        address: patientData.address ?? null,
                        maritalStatus: patientData.maritalStatus ?? null,
                    })
                    .returning({
                        id: patients.id,
                        firstName: patients.firstName,
                        lastName: patients.lastName,
                        nationalId: patients.nationalId,
                    })

                // 2. sync phone از user
                const [userPhone] = await tx.select({ phone: users.phone }).from(users).where(eq(users.id, id))

                if (userPhone?.phone) {
                    await tx.update(patients).set({ phone: userPhone.phone }).where(eq(patients.id, newPatient.id))
                }

                // 3. لینک و تأیید user
                const [updatedUser] = await tx
                    .update(users)
                    .set({
                        patientId: newPatient.id,
                        status: 'approved',
                        requiresPasswordChange: false,
                        updatedAt: new Date(),
                    })
                    .where(and(eq(users.id, id), eq(users.role, 'patient'), eq(users.status, 'pending')))
                    .returning({
                        id: users.id,
                        fullName: users.fullName,
                        status: users.status,
                        patientId: users.patientId,
                    })

                if (updatedUser.length === 0) {
                    throw { status: 400, message: 'کاربر بیمار نیست یا قبلاً تأیید شده' }
                }

                return { patient: newPatient, user: updatedUser[0] }
            })

            return reply.status(200).send({
                success: true,
                message: 'بیمار با موفقیت تأیید و پرونده ایجاد شد',
                data,
            })
        } catch (error: any) {
            if (error.constraint === 'patients_national_id_key') {
                return reply.status(409).send({ error: 'شماره ملی قبلاً ثبت شده است' })
            }
            if (error.status === 400 || error.status === 404) {
                return reply.status(error.status).send({ error: error.message })
            }
            console.error('خطا در تأیید بیمار:', error)
            return reply.status(500).send({ error: 'خطای سرور' })
        }
    })
}
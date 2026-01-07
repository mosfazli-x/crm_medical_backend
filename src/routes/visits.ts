// src/routes/visits.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { db } from '../db'
import { patients, visits } from '../db/schema'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { requireRole } from '../middleware/roleAuth';

export async function visitRoutes(fastify: FastifyInstance) {
    fastify.get('/patients',{ preHandler: requireRole(['admin_doctor', 'doctor']) }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const patientList = await db
                .select({
                    id: patients.id,
                    fullName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`.as('full_name'),
                    nationalId: patients.nationalId,
                })
                .from(patients)
                .where(eq(patients.isDeleted, false))  // اگر soft delete داری
                .orderBy(patients.lastName)

            return reply.status(200).send({
                success: true,
                data: patientList,
            })
        } catch (error) {
            console.error('خطا در دریافت لیست بیماران:', error)
            return reply.status(500).send({ error: 'خطای سرور' })
        }
    })

    // ۲. GET /api/visits - ویزیت‌ها برای تقویم (events)
    fastify.get('/',{ preHandler: requireRole(['admin_doctor', 'doctor']) }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const appointments = await db
                .select({
                    id: visits.id,
                    title: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`.as('full_name'),
                    start: visits.visitDate,
                    visitType: visits.visitType,
                    notes: visits.notes,
                    patientId: visits.patientId,
                    durationMinutes: visits.durationMinutes,
                })
                .from(visits)
                .innerJoin(patients, eq(visits.patientId, patients.id))
                .where(eq(patients.isDeleted, false))

            // تبدیل به فرمت FullCalendar
            const events = appointments.map(apt => {
                const start = apt.start
                const end = new Date(start.getTime() + (apt.durationMinutes || 30) * 60000)

                return {
                    id: apt.id,
                    title: `${apt.visitType || 'ویزیت'} - ${apt.title}`,
                    start: start.toISOString(),
                    end: end.toISOString(),
                    backgroundColor: getVisitColor(apt.visitType),
                    borderColor: getVisitBorderColor(apt.visitType),
                    textColor: '#ffffff',
                    extendedProps: {
                        patientId: apt.patientId,
                        notes: apt.notes || '',
                        type: apt.visitType || 'ویزیت',
                    },
                }
            })

            return reply.status(200).send(events)
        } catch (error) {
            console.error('خطا در دریافت ویزیت‌ها:', error)
            return reply.status(500).send({ error: 'خطای سرور' })
        }
    })

    // تابع کمکی برای رنگ‌بندی ویزیت‌ها
    const getVisitColor = (type: string | null) => {
        switch (type) {
            case 'ویزیت اولیه': return '#3b82f6'
            case 'چکاپ بارداری': return '#10b981'
            case 'پیگیری': return '#f59e0b'
            case 'اورژانسی': return '#ef4444'
            default: return '#6366f1'
        }
    }

    const getVisitBorderColor = (type: string | null) => {
        switch (type) {
            case 'ویزیت اولیه': return '#2563eb'
            case 'چکاپ بارداری': return '#059669'
            case 'پیگیری': return '#d97706'
            case 'اورژانسی': return '#dc2626'
            default: return '#4f46e5'
        }
    }

    const CreateVisitSchema = z.object({
        patientId: z.string().uuid('شناسه بیمار نامعتبر است'),
        visitDate: z.string().datetime('فرمت تاریخ نامعتبر است'),
        visitType: z.string().optional().nullable(),
        visitReason: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        durationMinutes: z.number().int().min(15).optional().default(30),
    })

    fastify.post('/',{ preHandler: requireRole(['admin_doctor', 'doctor']) }, async (request: FastifyRequest<{ Body: z.infer<typeof CreateVisitSchema> }>, reply: FastifyReply) => {
        const result = CreateVisitSchema.safeParse(request.body)
        console.log(result)
        if (!result.success) {
            return reply.status(400).send({ error: 'داده‌های ورودی نامعتبر', details: result.error })
        }

        const { patientId, visitDate, visitType, visitReason, notes, durationMinutes } = result.data

        try {
            const [newVisit] = await db.insert(visits).values({
                patientId,
                visitType: visitType || 'ویزیت اولیه',
                visitReason: visitReason || null,
                notes: notes || null,
                visitDate: new Date(visitDate),
                durationMinutes,
            }).returning()

            return reply.status(201).send({
                success: true,
                message: 'نوبت ویزیت با موفقیت ثبت شد',
                visit: newVisit,
            })
        } catch (error: any) {
            console.error('خطا در ثبت نوبت:', error)
            if (error.code === '23503') {
                return reply.status(400).send({ error: 'بیمار یافت نشد' })
            }
            return reply.status(500).send({ error: 'خطای سرور' })
        }
    })

    fastify.put('/:id',{ preHandler: requireRole(['admin_doctor', 'doctor']) }, async (request: FastifyRequest<{
        Params: { id: string }
        Body: z.infer<typeof CreateVisitSchema>  // همون schema ثبت رو استفاده می‌کنیم
    }>, reply: FastifyReply) => {
        const { id } = request.params
        const result = CreateVisitSchema.safeParse(request.body)
        if (!result.success) {
            return reply.status(400).send({ error: 'داده‌های ورودی نامعتبر', details: result.error.errors })
        }

        const { patientId, visitDate, visitType, reason, notes, durationMinutes } = result.data

        try {
            const [updatedVisit] = await db
                .update(visits)
                .set({
                    patientId,
                    visitType: visitType || 'ویزیت اولیه',
                    visitReason: reason || null,
                    notes: notes || null,
                    visitDate: new Date(visitDate),
                    durationMinutes,
                })
                .where(eq(visits.id, id))
                .returning()

            if (!updatedVisit) {
                return reply.status(404).send({ error: 'نوبت ویزیت یافت نشد' })
            }

            return reply.status(200).send({
                success: true,
                message: 'نوبت ویزیت با موفقیت به‌روزرسانی شد',
                visit: updatedVisit,
            })
        } catch (error: any) {
            console.error('خطا در ویرایش نوبت:', error)
            if (error.code === '23503') {
                return reply.status(400).send({ error: 'بیمار یافت نشد' })
            }
            return reply.status(500).send({ error: 'خطای سرور' })
        }
    })

    fastify.delete('/:id',{ preHandler: requireRole(['admin_doctor', 'doctor']) }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params

        try {
            const [deletedVisit] = await db
                .delete(visits)
                .where(eq(visits.id, id))
                .returning()

            if (!deletedVisit) {
                return reply.status(404).send({ error: 'نوبت ویزیت یافت نشد' })
            }

            return reply.status(200).send({
                success: true,
                message: 'نوبت ویزیت با موفقیت حذف شد',
            })
        } catch (error) {
            console.error('خطا در حذف نوبت:', error)
            return reply.status(500).send({ error: 'خطای سرور' })
        }
    })
}
import { FastifyInstance } from 'fastify';
// use fastify.db (decorated by plugins/db) for better DI/testability
import { users } from '../db/schema';
import { eq, count } from 'drizzle-orm';
import { z } from 'zod';
import { smsService } from '../services/sms.service';


const LoginSchema = z.object({
    phone: z.string().regex(/^09\d{9}$/, 'شماره تلفن معتبر نیست (باید با 09 شروع شود و ۱۱ رقم باشد)'),
    password: z.string().min(6, 'رمز عبور حداقل ۶ کاراکتر باشد'),
});

const RegisterSchema = z.object({
    phone: z.string().regex(/^09\d{9}$/, 'شماره تلفن معتبر نیست'),
    fullName: z.string().min(2, 'نام کامل حداقل ۲ کاراکتر باشد'),
    role: z.string().min(2, 'نقش کاربر باید مشخص شده باشد'),
    password: z.string().min(8, 'رمز عبور حداقل ۸ کاراکتر باشد'),
});

type LoginBody = z.infer<typeof LoginSchema>;
type RegisterBody = z.infer<typeof RegisterSchema>;

export async function authRoutes(fastify: FastifyInstance) {
    fastify.post('/login', async (request, reply) => {
        const result = LoginSchema.safeParse(request.body);
        if (!result.success) {
            return reply.status(400).send({ error: 'داده‌های ورودی نامعتبر', details: result.error });
        }

        const { phone, password } = result.data;

        try {
            const [user] = await fastify.db
                .select({
                    id: users.id,
                    fullName: users.fullName,
                    role: users.role,
                    passwordHash: users.passwordHash,
                    patientId: users.patientId,
                    requiresPasswordChange: users.requiresPasswordChange,
                    status: users.status,
                    phoneConfirmed: users.phoneConfirmed,
                })
                .from(users)
                .where(eq(users.phone, phone))
                .limit(1);

            if (!user) {
                return reply.status(401).send({ error: 'شماره تلفن یا رمز عبور اشتباه است' });
            }
            if (user.status !== 'approved') {
                return reply.status(403).send({ error: 'حساب شما غیرفعال است' });
            }

            if (!user.phoneConfirmed) {
                return reply.status(403).send({ error: 'شماره تلفن تأیید نشده است' });
            }

            const match = await fastify.bcrypt.compare(password, user.passwordHash);
            if (!match) {
                return reply.status(401).send({ error: 'شماره تلفن یا رمز عبور اشتباه است' });
            }

            const token = fastify.jwt.sign(
                {
                    id: user.id,
                    fullName: user.fullName,
                    role: user.role,
                    patientId: user.patientId,
                },
                { expiresIn: '7d' }
            );

            return reply.status(200).send({
                success: true,
                token,
                user: {
                    id: user.id,
                    fullName: user.fullName,
                    role: user.role,
                    patientId: user.patientId,
                    requiresPasswordChange: user.requiresPasswordChange,
                },
            });
        } catch (err) {
            console.error('Error in /auth/login:', err);
            return reply.status(500).send({ error: 'خطای سرور' });
        }
    });

    fastify.post('/register', async (request, reply) => {
        const result = RegisterSchema.safeParse(request.body);
        if (!result.success) {
            return reply.status(400).send({ error: 'داده‌های ورودی نامعتبر', details: result.error });
        }

        const { phone, fullName, password, role } = result.data;

        try {
            const passwordHash = await fastify.bcrypt.hash(password);

            const [newUser] = await fastify.db
                .insert(users)
                .values({
                    phone,
                    fullName,
                    passwordHash,
                    role,
                    phoneConfirmed: false,
                    status: 'pending',
                    requiresPasswordChange: false,
                })
                .returning({
                    id: users.id,
                    fullName: users.fullName,
                    role: users.role,
                    phone: users.phone,
                });

            const token = fastify.jwt.sign(
                {
                    id: newUser.id,
                    fullName: newUser.fullName,
                    role: newUser.role,
                    patientId: null,
                },
                { expiresIn: '7d' }
            );

            await smsService.send(
                '09307551594',
                `ثبت‌نام کاربر جدید
                نام: ${newUser.fullName}
                موبایل: ${phone}
                شناسه: ${newUser.id}
                نقش: ${newUser.role}`
            );

            await smsService.send(
                phone,
                `👋 خوش آمدید به کلینیک تخصصی دکتر حسینی
                ${newUser.fullName} عزیز،
                ثبت‌نام شما با موفقیت انجام شد.
                در صورت نیاز به راهنمایی، از پشتیبانی کلینیک استفاده کنید.`
            );

            return reply.status(201).send({
                success: true,
                message: 'کاربر با موفقیت ساخته شد',
                token,
                user: newUser,
            });


        } catch (err: any) {
            // Postgres unique violation code is 23505
            if (err?.code === '23505' || err?.constraint === 'users_phone_key') {
                return reply.status(409).send({ error: 'شماره تلفن قبلاً ثبت شده است' });
            }
            console.error('Error in /auth/register:', err);
            return reply.status(500).send({ error: 'خطای سرور' });
        }
    });
}
import Fastify from 'fastify'
import jwt from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import path from 'path'
export const buildApp = () => {
  const app = Fastify({ logger: true })
  app.register(require('@fastify/cors'), {
    origin: true, // یا آدرس فرانت
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true
  });
  app.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
  });

  app.register(require('fastify-bcrypt'), {
    saltWorkFactor: 12
  })
  app.register(fastifyMultipart, {
    limits: {
      fieldNameSize: 100, // حداکثر اندازه نام فیلدها (به بایت)
      fieldSize: 1000000, // حداکثر اندازه فیلدهای متنی (۱ مگابایت)
      fileSize: 10 * 1024 * 1024, // حداکثر حجم هر فایل (۱۰ مگابایت)
      files: 10           // حداکثر تعداد فایل در هر درخواست
    },
    attachFieldsToBody: false // این را false بگذار چون بالا از request.parts() استفاده کردیم
  })
  app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/', // آدرس دسترسی: http://localhost:3000/uploads/filename.jpg
  })

  return app
}

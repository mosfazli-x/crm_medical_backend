import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import { env } from './config/env'
import { errorHandler } from './shared/middleware'
import dbPlugin from './shared/plugins/db.plugin'
import { INSURANCE_TYPE_VALUES } from './shared/constants/insurance'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  })

  app.setErrorHandler(errorHandler)

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })

  await app.register(jwt, {
    secret: env.JWT_SECRET,
  })

  await app.register(fastifyMultipart, {
    limits: {
      fieldNameSize: 100,
      fieldSize: 1_000_000,
      fileSize: 10 * 1024 * 1024,
      files: 10,
    },
    attachFieldsToBody: false,
  })

  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  })

  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'uploads', 'insurance-logos'),
    prefix: '/insurance-logos/',
    decorateReply: false,
  })

  await app.register(dbPlugin)

  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(patientRoutes, { prefix: '/api/patients' })
  await app.register(visitRoutes, { prefix: '/api/visits' })
  await app.register(userRoutes, { prefix: '/api/users' })
  await app.register(schedulingRoutes, { prefix: '/api/scheduling' })

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  app.get('/api/insurance-types', async () => {
    return { success: true, data: INSURANCE_TYPE_VALUES }
  })

  return app
}

import { authRoutes } from './modules/auth'
import { patientRoutes } from './modules/patients'
import { visitRoutes } from './modules/visits'
import { userRoutes } from './modules/users'
import { schedulingRoutes } from './modules/scheduling'

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
      files: 50,
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
  await app.register(visitTypesRoutes, { prefix: '/api/visit-types' })

  await app.register(reproductiveRoutes, { prefix: '/api/reproductive' })
  await app.register(screeningRoutes, { prefix: '/api/screening' })
  await app.register(labResultsRoutes, { prefix: '/api/lab-results' })
  await app.register(clinicalRoutes, { prefix: '/api/clinical' })
  await app.register(billingRoutes, { prefix: '/api/billing' })
  await app.register(pregnancyRoutes, { prefix: '/api/pregnancy' })
  await app.register(messagingRoutes, { prefix: '/api/messaging' })
  await app.register(consentRoutes, { prefix: '/api/consent' })

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
import { reproductiveRoutes } from './modules/reproductive'
import { screeningRoutes } from './modules/screening'
import { labResultsRoutes } from './modules/lab-results'
import { clinicalRoutes } from './modules/clinical'
import { billingRoutes } from './modules/billing'
import { pregnancyRoutes } from './modules/pregnancy'
import { messagingRoutes } from './modules/messaging'
import { consentRoutes } from './modules/consent'
import { visitTypesRoutes } from './modules/visit-types'
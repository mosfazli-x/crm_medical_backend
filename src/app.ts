import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import { env } from './config/env'
import { errorHandler, globalRateLimit, initRevocationCache } from './shared/middleware'
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

  // Global request limiter: basic defense against request floods / DDoS
  app.addHook('onRequest', globalRateLimit)

  // Basic security response headers
  app.addHook('onSend', (_request, reply, _payload, done) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('X-Frame-Options', 'SAMEORIGIN')
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    done()
  })

  const corsOrigins = env.NODE_ENV === 'production'
    ? [env.CORS_ORIGIN || 'https://yourdomain.com']
    : true

  await app.register(cors, {
    origin: corsOrigins,
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

  // Initialize default clinic settings
  const settingsSvc = new SettingsService((app as any).db)
  await settingsSvc.initDefaults()

  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(patientRoutes, { prefix: '/api/patients' })
  await app.register(patientRoutes, { prefix: '/api/patient' })
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
  await app.register(telegramRoutes, { prefix: '/api/telegram' })
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' })
  await app.register(staffRoutes, { prefix: '/api/staff' })
  await app.register(settingsRoutes, { prefix: '/api/settings' })
  await app.register(auditRoutes, { prefix: '/api/audit' })
  await app.register(prescriptionRoutes, { prefix: '/api/prescriptions' })
  await app.register(labOrderItemsRoutes, { prefix: '/api/lab-order-items' })
  await app.register(bookingRoutes, { prefix: '/api/booking' })
  await app.register(doctorProfileRoutes, { prefix: '/api/doctor-profiles' })
  await app.register(accountingRoutes, { prefix: '/api/accounting' })
  await app.register(inventoryRoutes, { prefix: '/api/inventory' })
  await app.register(consumablesRoutes, { prefix: '/api/consumables' })
  await app.register(patientUsageRoutes, { prefix: '/api/patient-usage' })
  await app.register(leadSourcesRoutes, { prefix: '/api/lead-sources' })
  await app.register(leadsRoutes, { prefix: '/api/leads' })
  await app.register(dailyReportsRoutes, { prefix: '/api/daily-reports' })
  await app.register(scheduleRoutes, { prefix: '/api/schedule' })
  await app.register(miniAppRoutes, { prefix: '/api/miniapp' })
  await app.register(ocrRoutes, { prefix: '/api/ocr' })
  await app.register(faqRoutes, { prefix: '/api/faq' })
  await app.register(aiSupportRoutes, { prefix: '/api/support' })
  await app.register(patientNotesRoutes, { prefix: '/api/patient-notes' })
  await app.register(loginHistoryRoutes, { prefix: '/api/login-history' })
  await app.register(blogRoutes, { prefix: '/api/blog' })

  // Initialize token revocation cache
  initRevocationCache((app as any).db)

  // Seed default lead sources
  const leadSourcesSvc = new LeadSourcesService((app as any).db)
  await leadSourcesSvc.ensureDefaults()

  // Seed default daily-report visit types
  const dailyReportsSvc = new DailyReportsService((app as any).db)
  await dailyReportsSvc.ensureDefaults()

  // Seed default consumable items
  const consumablesSvc = new ConsumablesService((app as any).db)
  await consumablesSvc.ensureDefaults()

  app.get('/health', async (_, reply) => {
    try {
      await (app as any).db.execute(sql`SELECT 1 as ok`)
      return { status: 'ok', db: 'connected', timestamp: new Date().toISOString() }
    } catch (err) {
      reply.status(503)
      return { status: 'error', db: 'disconnected', timestamp: new Date().toISOString() }
    }
  })

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
import { telegramRoutes } from './modules/telegram'
import { dashboardRoutes } from './modules/dashboard'
import { staffRoutes } from './modules/staff'
import { settingsRoutes } from './modules/settings'
import { auditRoutes } from './modules/audit'
import { prescriptionRoutes } from './modules/prescriptions'
import { labOrderItemsRoutes } from './modules/lab-order-items'
import { bookingRoutes } from './modules/booking'
import { doctorProfileRoutes } from './modules/doctor-profiles'
import { accountingRoutes } from './modules/accounting'
import { inventoryRoutes } from './modules/inventory'
import { patientUsageRoutes } from './modules/patient-usage'
import { leadSourcesRoutes, LeadSourcesService } from './modules/lead-sources'
import { leadsRoutes } from './modules/leads'
import { dailyReportsRoutes, DailyReportsService } from './modules/daily-reports'
import { consumablesRoutes, ConsumablesService } from './modules/consumables'
import { scheduleRoutes } from './modules/schedule'
import { miniAppRoutes } from './modules/miniapp'
import { ocrRoutes } from './modules/ocr'
import { faqRoutes, aiSupportRoutes } from './modules/support'
import { patientNotesRoutes } from './modules/patient-notes'
import { loginHistoryRoutes } from './modules/login-history'
import { blogRoutes } from './modules/blog'
import { SettingsService } from './modules/settings'
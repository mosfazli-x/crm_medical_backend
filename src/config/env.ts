import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3101),
  BACKEND_PORT: z.coerce.number().int().positive().default(3101),

  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),

  SMS_ENABLED: z.preprocess(
    (val) => val === 'true' || val === '1' || val === true || val === 1,
    z.boolean()
  ).default(true),
  SMS_USERNAME: z.string().optional(),
  SMS_PASSWORD: z.string().optional(),
  SMS_LINE: z.string().optional(),
  SMS_API_BASE_URL: z.string().url().default('https://api.sms.ir/v1/send'),

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_WEBHOOK_URL: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  TELEGRAM_MINIAPP_URL: z.string().url().optional(),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default('uploads'),
  BACKUP_DIR: z.string().optional(),
  BACKUP_ENABLED: z.preprocess(
    (val) => val === 'true' || val === '1' || val === true || val === 1,
    z.boolean()
  ).default(false),
  MAX_FILE_SIZE: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  ALLOWED_MIME_TYPES: z.string().default('image/jpeg,image/png,image/webp,application/pdf,image/svg+xml'),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('ir-thr-at1'),
  S3_BUCKET: z.string().default('crm-uploads'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),

  PRESIGNED_URL_EXPIRY: z.coerce.number().int().positive().default(3600),

  CORS_ORIGIN: z.string().optional(),

  OCR_SPACE_API_KEY: z.string().optional(),
  OCR_SPACE_PROXY: z.string().url().optional(),

  // AI Support
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  TELEGRAM_SUPPORT_CHAT_ID: z.string().optional(),
  SUPPORT_AI_ENABLED: z.preprocess(
    (val) => val === 'true' || val === '1' || val === true || val === 1,
    z.boolean()
  ).default(false),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data

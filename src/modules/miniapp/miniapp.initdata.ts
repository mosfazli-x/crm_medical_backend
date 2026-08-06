import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../../config/env'

export interface TelegramUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

export interface ParsedInitData {
  user: TelegramUser | null
  authDate: number | null
  startParam: string | null
  queryId: string | null
}

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60

export function parseInitData(initData: string): ParsedInitData {
  const params = new URLSearchParams(initData)
  let user: TelegramUser | null = null
  const rawUser = params.get('user')
  if (rawUser) {
    try {
      user = JSON.parse(rawUser) as TelegramUser
    } catch {
      user = null
    }
  }

  const authDate = Number(params.get('auth_date')) || null

  return {
    user,
    authDate,
    startParam: params.get('start_param'),
    queryId: params.get('query_id'),
  }
}

export function validateInitData(initData: string): boolean {
  if (!env.TELEGRAM_BOT_TOKEN) return false

  const params = new URLSearchParams(initData)
  const receivedHash = params.get('hash')
  if (!receivedHash) return false

  const authDate = Number(params.get('auth_date'))
  if (!authDate || Number.isNaN(authDate)) return false
  if (Math.abs(Date.now() / 1000 - authDate) > MAX_AUTH_AGE_SECONDS) return false

  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(env.TELEGRAM_BOT_TOKEN).digest()
  const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  const receivedBuffer = Buffer.from(receivedHash, 'hex')
  const calculatedBuffer = Buffer.from(calculatedHash, 'hex')

  if (receivedBuffer.length !== calculatedBuffer.length) return false
  return timingSafeEqual(receivedBuffer, calculatedBuffer)
}

export function isValidInitData(initData: string): boolean {
  return validateInitData(initData)
}

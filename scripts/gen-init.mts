import { createHmac } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envText = readFileSync(resolve(root, '.env'), 'utf8')
const token = envText.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m)?.[1]?.trim()
if (!token) throw new Error('TELEGRAM_BOT_TOKEN not found in .env')

const user = {
  id: 123456789,
  first_name: 'بیمار',
  last_name: 'تستی',
  username: 'tg_patient_test',
  language_code: 'fa',
}

const authDate = Math.floor(Date.now() / 1000)
const params = new URLSearchParams()
params.set('auth_date', String(authDate))
params.set('user', JSON.stringify(user))

const dataCheckString = [...params.entries()]
  .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  .map(([key, value]) => `${key}=${value}`)
  .join('\n')

const secretKey = createHmac('sha256', 'WebAppData').update(token).digest()
const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

const initData = `auth_date=${authDate}&user=${encodeURIComponent(JSON.stringify(user))}&hash=${hash}`
writeFileSync(resolve(root, '.initdata.txt'), initData, 'utf8')
console.log('auth_date=' + authDate)
console.log(initData)

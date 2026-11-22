import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { api, registerTestUser } from './helpers'

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001'

type IngestResult = {
  messageId: string | null
  status: 'posted' | 'review' | 'duplicate' | 'ignored' | 'failed'
  entryId: string | null
  reason: string | null
  parserId: string
  bankCode: string | null
  direction: 'income' | 'expense' | null
  amountRial: string | null
  confidence: number
}

async function ingestWithToken(token: string, messages: Array<{ text: string; sender?: string; clientId?: string; receivedAt?: string }>) {
  const response = await fetch(`${API_BASE}/api/finance/sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ingest-token': token },
    body: JSON.stringify({ messages }),
  })
  return { status: response.status, body: await response.json() as { success: boolean; data?: IngestResult[]; error?: string } }
}

describe('Finance SMS ingestion API', () => {
  const suffix = randomUUID().slice(0, 8)
  const ref = `${Date.now()}`.slice(-7)
  let doctorToken = ''
  let patientToken = ''
  let accountId = ''
  let sourceId = ''
  let deviceToken = ''
  let depositMessageId = ''
  let reviewMessageId = ''
  let ignoredMessageId = ''

  const depositText = [
    'بانک ملی ایران',
    'واریز به حساب شما',
    'مبلغ: 5,000,000 ریال',
    'موجودی: 12,450,000 ریال',
    'تاریخ: ۱۴۰۵/۰۹/۱۴ ۱۲:۳۰',
    `شماره پیگیری: ${ref}`,
  ].join('\n')

  beforeAll(async () => {
    const doctor = await registerTestUser('doctor')
    const patient = await registerTestUser('patient')
    doctorToken = doctor.token
    patientToken = patient.token

    const account = await api.post('/api/cashbook/accounts', {
      name: `Ingest account ${suffix}`,
      type: 'bank',
      openingBalanceRial: '0',
    }, doctorToken)
    expect(account.status).toBe(201)
    accountId = account.body.data.id

    // No categories supplied: the service must provision fallback ones.
    const source = await api.post('/api/finance/sources', {
      label: `Melli ${suffix}`,
      bankCode: 'melli',
      channel: 'android_app',
      senderPatterns: ['bankmelli', 'melli'],
      cardLast4: '1234',
      accountId,
    }, doctorToken)
    expect(source.status).toBe(201)
    sourceId = source.body.data.id
    expect(source.body.data.incomeCategoryId).toBeTruthy()
    expect(source.body.data.expenseCategoryId).toBeTruthy()

    const token = await api.post('/api/finance/tokens', { label: `Phone ${suffix}`, platform: 'android' }, doctorToken)
    expect(token.status).toBe(201)
    deviceToken = token.body.data.token
    expect(deviceToken.startsWith('bsi_')).toBe(true)
  }, 60000)

  it('guards management routes with authentication and role', async () => {
    expect((await api.get('/api/finance/sources')).status).toBe(401)
    expect((await api.get('/api/finance/sources', patientToken)).status).toBe(403)
    expect((await api.get('/api/finance/messages', patientToken)).status).toBe(403)
    expect((await ingestWithToken('bsi_not_a_real_token', [{ text: 'test' }])).status).toBe(401)
  })

  it('auto-posts a high-confidence bank message to the cashbook', async () => {
    const res = await ingestWithToken(deviceToken, [{ text: depositText, sender: 'BankMelli', clientId: `c-${suffix}-1` }])
    expect(res.status).toBe(200)
    const [result] = res.body.data!
    expect(result.status).toBe('posted')
    expect(result.entryId).toBeTruthy()
    expect(result.direction).toBe('income')
    expect(result.amountRial).toBe('5000000')
    expect(result.confidence).toBeGreaterThanOrEqual(70)
    depositMessageId = result.messageId!

    const entry = await api.get(`/api/cashbook/entries/${result.entryId}`, doctorToken)
    expect(entry.status).toBe(200)
    expect(entry.body.data.kind).toBe('income')
    expect(entry.body.data.amountRial).toBe('5000000')
    expect(entry.body.data.accountId).toBe(accountId)
  })

  it('collapses a re-delivered message instead of double posting', async () => {
    const res = await ingestWithToken(deviceToken, [{ text: depositText, sender: 'BankMelli' }])
    const [result] = res.body.data!
    expect(result.status).toBe('duplicate')
    expect(result.messageId).toBe(depositMessageId)
    expect(result.entryId).toBeNull()
  })

  it('ignores security codes and queues unknown senders for review', async () => {
    const otp = await ingestWithToken(deviceToken, [{
      text: 'رمز پویا: ۴۸۲۱\nمبلغ 1,000,000 ریال',
      sender: 'BankMelli',
      clientId: `c-${suffix}-otp`,
    }])
    expect(otp.body.data![0]!.status).toBe('ignored')
    ignoredMessageId = otp.body.data![0]!.messageId!

    // Unknown bank and no matching source → review, never a guessed entry.
    const unknown = await ingestWithToken(deviceToken, [{
      text: 'مبلغ 480,000 ریال از حساب شما برداشت شد. موجودی: 1,520,000 ریال',
      sender: '9821',
      clientId: `c-${suffix}-unknown`,
    }])
    const [result] = unknown.body.data!
    expect(result.status).toBe('review')
    expect(result.entryId).toBeNull()
    reviewMessageId = result.messageId!
  })

  it('lists the inbox with filters and stats', async () => {
    const review = await api.get('/api/finance/messages?status=review', doctorToken)
    expect(review.status).toBe(200)
    expect(review.body.pagination?.total).toBeGreaterThanOrEqual(1)
    expect((review.body.data as Array<{ id: string }>).some((row) => row.id === reviewMessageId)).toBe(true)

    const stats = await api.get('/api/finance/stats', doctorToken)
    expect(stats.status).toBe(200)
    expect(stats.body.data.posted).toBeGreaterThanOrEqual(1)
    expect(stats.body.data.ignored).toBeGreaterThanOrEqual(1)
  })

  it('approves a queued message into the cashbook exactly once', async () => {
    const categories = await api.get('/api/cashbook/categories', doctorToken)
    const expenseCategory = (categories.body.data as Array<{ id: string; kind: string }>)
      .find((category) => category.kind === 'expense')!
    expect(expenseCategory).toBeTruthy()

    const approve = await api.post(`/api/finance/messages/${reviewMessageId}/approve`, {
      kind: 'expense',
      categoryId: expenseCategory.id,
      accountId,
    }, doctorToken)
    expect(approve.status).toBe(200)
    expect(approve.body.data.entryId).toBeTruthy()

    const entry = await api.get(`/api/cashbook/entries/${approve.body.data.entryId}`, doctorToken)
    expect(entry.body.data.kind).toBe('expense')
    expect(entry.body.data.amountRial).toBe('480000')

    const again = await api.post(`/api/finance/messages/${reviewMessageId}/approve`, {}, doctorToken)
    expect(again.status).toBe(409)
  })

  it('ignores a message on request and refuses to post it afterwards', async () => {
    const ignore = await api.post(`/api/finance/messages/${ignoredMessageId}/ignore`, {}, doctorToken)
    expect(ignore.status).toBe(200)
    expect(ignore.body.data.status).toBe('ignored')

    const approve = await api.post(`/api/finance/messages/${ignoredMessageId}/approve`, {}, doctorToken)
    expect(approve.status).toBe(400)
  })

  it('does not auto-post when a source disables auto posting', async () => {
    await api.patch(`/api/finance/sources/${sourceId}`, { autoPost: false }, doctorToken)
    const res = await ingestWithToken(deviceToken, [{
      text: 'خرید از کارت شما\nمبلغ 1,250,000 ریال\nموجودی 8,750,000 ریال\nبانک ملی',
      sender: 'BankMelli',
      clientId: `c-${suffix}-manual`,
    }])
    const [result] = res.body.data!
    expect(result.status).toBe('review')
    expect(result.reason).toBe('auto_post_disabled')
    await api.patch(`/api/finance/sources/${sourceId}`, { autoPost: true }, doctorToken)
  })

  it('accepts pasted text from the authenticated UI', async () => {
    const res = await api.post('/api/finance/paste', {
      text: `واریز 3,000,000 ریال به حساب شما\nشماره پیگیری: ${ref}9\nبانک ملی`,
      sender: 'BankMelli',
    }, doctorToken)
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('posted')
  })

  it('rejects a device token once revoked', async () => {
    const tokens = await api.get('/api/finance/tokens', doctorToken)
    const tokenId = (tokens.body.data as Array<{ id: string; tokenPrefix: string }>)
      .find((row) => row.tokenPrefix === deviceToken.slice(0, 12))!.id

    const revoke = await api.delete(`/api/finance/tokens/${tokenId}`, doctorToken)
    expect(revoke.status).toBe(200)

    const res = await ingestWithToken(deviceToken, [{ text: 'واریز 1000 ریال' }])
    expect(res.status).toBe(401)
  })
})

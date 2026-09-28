import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { api, registerTestUser } from './helpers'

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001'
const pngHeader = Buffer.from('89504e470d0a1a0a', 'hex')

type CashbookData = {
  id: string
  name?: string
  kind?: string
  amountRial?: string
  openingBalanceRial?: string
  status?: string
  receipt?: { id: string; mimeType: string; fileSize: number } | null
}

type CashbookEntryData = CashbookData & {
  userId: string
  description: string
  voidReason?: string | null
}

async function uploadReceipt(entryId: string, token: string, content: Buffer, filename: string) {
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(content)], { type: 'image/png' }), filename)
  const response = await fetch(`${API_BASE}/api/cashbook/entries/${entryId}/receipt`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  return { status: response.status, body: await response.json() }
}

async function getBinary(path: string, token?: string) {
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined
  return fetch(`${API_BASE}${path}`, { headers })
}

describe('Cashbook API', () => {
  const suffix = randomUUID()
  let doctorToken = ''
  let otherDoctorToken = ''
  let adminToken = ''
  let patientToken = ''
  let doctorId = ''
  let otherDoctorId = ''
  let expenseCategoryId = ''
  let incomeCategoryId = ''
  let accountId = ''
  let incomeEntryId = ''
  let expenseEntryId = ''
  let voidEntryId = ''
  let receiptEntryId = ''
  let invalidReceiptEntryId = ''

  const createEntry = async (kind: 'income' | 'expense', description: string, amountRial: string) => {
    const response = await api.post('/api/cashbook/entries', {
      entryDate: '2026-09-15',
      kind,
      amountRial,
      categoryId: kind === 'income' ? incomeCategoryId : expenseCategoryId,
      accountId,
      description,
      reference: `REF-${suffix}`,
    }, doctorToken)
    expect(response.status).toBe(201)
    return (response.body.data as CashbookEntryData).id
  }

  beforeAll(async () => {
    const doctor = await registerTestUser('doctor')
    const otherDoctor = await registerTestUser('doctor')
    const admin = await registerTestUser('admin_doctor')
    const patient = await registerTestUser('patient')
    doctorToken = doctor.token
    otherDoctorToken = otherDoctor.token
    adminToken = admin.token
    patientToken = patient.token
    doctorId = doctor.user.id
    otherDoctorId = otherDoctor.user.id

    const account = await api.post('/api/cashbook/accounts', {
      name: `Cashbook account ${suffix}`,
      type: 'cash',
      openingBalanceRial: '500',
    }, doctorToken)
    expect(account.status).toBe(201)
    accountId = (account.body.data as CashbookData).id

    const expenseCategory = await api.post('/api/cashbook/categories', {
      name: `Cashbook expenses ${suffix}`,
      kind: 'expense',
      color: '#ef4444',
    }, doctorToken)
    expect(expenseCategory.status).toBe(201)
    expenseCategoryId = (expenseCategory.body.data as CashbookData).id

    const incomeCategory = await api.post('/api/cashbook/categories', {
      name: `Cashbook income ${suffix}`,
      kind: 'income',
      color: '#22c55e',
    }, doctorToken)
    expect(incomeCategory.status).toBe(201)
    incomeCategoryId = (incomeCategory.body.data as CashbookData).id

    incomeEntryId = await createEntry('income', `Income ${suffix}`, '2000')
    expenseEntryId = await createEntry('expense', `Expense ${suffix}`, '1000')
    voidEntryId = await createEntry('expense', `Voided expense ${suffix}`, '250')
    receiptEntryId = await createEntry('expense', `Receipt expense ${suffix}`, '300')
  })

  it('requires authentication and the doctor or admin role', async () => {
    expect((await api.get('/api/cashbook/summary')).status).toBe(401)
    expect((await api.get('/api/cashbook/summary', patientToken)).status).toBe(403)
  })

  it('validates dates, ranges, and positive Rial amounts', async () => {
    const invalidDate = await api.post('/api/cashbook/entries', {
      entryDate: '2026-02-30',
      kind: 'expense',
      amountRial: '1',
      categoryId: expenseCategoryId,
      accountId,
      description: 'Invalid date',
    }, doctorToken)
    expect(invalidDate.status).toBe(400)

    const invalidAmount = await api.post('/api/cashbook/entries', {
      entryDate: '2026-09-15',
      kind: 'expense',
      amountRial: '-1',
      categoryId: expenseCategoryId,
      accountId,
      description: 'Invalid amount',
    }, doctorToken)
    expect(invalidAmount.status).toBe(400)

    const invalidRange = await api.get('/api/cashbook/summary?from=2026-09-30&to=2026-09-01', doctorToken)
    expect(invalidRange.status).toBe(400)
  })

  it('supports owner-scoped CRUD, search, and string money serialization', async () => {
    const update = await api.patch(`/api/cashbook/entries/${incomeEntryId}`, {
      description: `Updated income ${suffix}`,
    }, doctorToken)
    expect(update.status).toBe(200)
    expect((update.body.data as CashbookEntryData).description).toBe(`Updated income ${suffix}`)
    expect((update.body.data as CashbookEntryData).amountRial).toBe('2000')

    const list = await api.get('/api/cashbook/entries?from=2026-09-01&to=2026-09-30&search=Updated%20income', doctorToken)
    expect(list.status).toBe(200)
    expect(list.body.pagination).toBeDefined()
    expect(list.body.pagination?.total).toBe(1)
    expect((list.body.data[0] as CashbookEntryData).id).toBe(incomeEntryId)

    const voided = await api.post(`/api/cashbook/entries/${voidEntryId}/void`, { reason: 'Duplicate entry' }, doctorToken)
    expect(voided.status).toBe(200)
    expect((voided.body.data as CashbookEntryData).status).toBe('voided')
    expect((voided.body.data as CashbookEntryData).voidReason).toBe('Duplicate entry')

    const editVoided = await api.patch(`/api/cashbook/entries/${voidEntryId}`, { description: 'Not editable' }, doctorToken)
    expect(editVoided.status).toBe(400)
  })

  it('enforces owner isolation while allowing admin oversight', async () => {
    const doctorRead = await api.get(`/api/cashbook/entries?userId=${otherDoctorId}`, doctorToken)
    expect(doctorRead.status).toBe(403)

    const adminRead = await api.get(`/api/cashbook/entries?userId=${doctorId}`, adminToken)
    expect(adminRead.status).toBe(200)

    const otherDoctorEdit = await api.patch(`/api/cashbook/entries/${expenseEntryId}`, { description: 'Blocked' }, otherDoctorToken)
    expect(otherDoctorEdit.status).toBe(404)

    const adminEdit = await api.patch(`/api/cashbook/entries/${expenseEntryId}`, { description: 'Admin mutation' }, adminToken)
    expect(adminEdit.status).toBe(404)
  })

  it('manages archived resources and rejects empty updates and mismatched categories', async () => {
    const emptyCategoryUpdate = await api.patch(`/api/cashbook/categories/${expenseCategoryId}`, {}, doctorToken)
    expect(emptyCategoryUpdate.status).toBe(400)

    const emptyAccountUpdate = await api.patch(`/api/cashbook/accounts/${accountId}`, {}, doctorToken)
    expect(emptyAccountUpdate.status).toBe(400)

    const archiveCategory = await api.patch(`/api/cashbook/categories/${expenseCategoryId}`, { isArchived: true }, doctorToken)
    expect(archiveCategory.status).toBe(200)
    const activeCategories = await api.get('/api/cashbook/categories', doctorToken)
    expect((activeCategories.body.data as CashbookData[]).some((item) => item.id === expenseCategoryId)).toBe(false)
    const allCategories = await api.get('/api/cashbook/categories?includeArchived=true', doctorToken)
    expect((allCategories.body.data as CashbookData[]).some((item) => item.id === expenseCategoryId)).toBe(true)
    const restoreCategory = await api.patch(`/api/cashbook/categories/${expenseCategoryId}`, { isArchived: false }, doctorToken)
    expect(restoreCategory.status).toBe(200)

    const archiveAccount = await api.patch(`/api/cashbook/accounts/${accountId}`, { isArchived: true }, doctorToken)
    expect(archiveAccount.status).toBe(200)
    const restoreAccount = await api.patch(`/api/cashbook/accounts/${accountId}`, { isArchived: false }, doctorToken)
    expect(restoreAccount.status).toBe(200)

    const mismatched = await api.post('/api/cashbook/entries', {
      entryDate: '2026-09-15',
      kind: 'income',
      amountRial: '10',
      categoryId: expenseCategoryId,
      accountId,
      description: 'Mismatched category',
    }, doctorToken)
    expect(mismatched.status).toBe(400)
  })

  it('calculates budgets and summaries over the requested range', async () => {
    const budget = await api.post('/api/cashbook/budgets', {
      categoryId: expenseCategoryId,
      month: '2026-09',
      amountRial: '5000',
    }, doctorToken)
    expect(budget.status).toBe(201)
    expect((budget.body.data as CashbookData).amountRial).toBe('5000')

    const budgets = await api.get('/api/cashbook/budgets/2026-09', doctorToken)
    expect(budgets.status).toBe(200)
    const savedBudget = (budgets.body.data as Array<CashbookData & { spentRial: string; remainingRial: string }>)
      .find((item) => item.id === (budget.body.data as CashbookData).id)
    expect(savedBudget?.spentRial).toBe('1300')
    expect(savedBudget?.remainingRial).toBe('3700')

    const summary = await api.get('/api/cashbook/summary?from=2026-09-10&to=2026-09-20&month=2026-09', doctorToken)
    expect(summary.status).toBe(200)
    const summaryData = summary.body.data as {
      totals: { incomeRial: string; expenseRial: string; netRial: string; entryCount: number }
      budgets: Array<{ categoryId: string; spentRial: string; remainingRial: string }>
    }
    expect(summaryData.totals.incomeRial).toBe('2000')
    expect(summaryData.totals.expenseRial).toBe('1300')
    expect(summaryData.totals.netRial).toBe('700')
    expect(summaryData.totals.entryCount).toBe(3)
    expect(summaryData.budgets.find((item) => item.categoryId === expenseCategoryId)?.spentRial).toBe('1300')
  })

  it('exports authenticated CSV data', async () => {
    const response = await getBinary('/api/cashbook/export?from=2026-09-01&to=2026-09-30&search=Updated%20income&format=csv', doctorToken)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/csv')
    const body = await response.text()
    expect(body).toContain('Updated income')
    expect(body).not.toContain('Voided expense')
    expect(body).toContain('2000')
  })

  it('stores and serves private receipts with owner authorization', async () => {
    const uploaded = await uploadReceipt(receiptEntryId, doctorToken, pngHeader, `receipt-${suffix}.png`)
    expect(uploaded.status).toBe(201)
    const receiptId = (uploaded.body.data as CashbookData['receipt'])?.id
    expect(receiptId).toBeDefined()

    const entry = await api.get(`/api/cashbook/entries/${receiptEntryId}`, doctorToken)
    expect(entry.status).toBe(200)
    expect((entry.body.data as CashbookEntryData).receipt?.mimeType).toBe('image/png')

    const served = await getBinary(`/api/cashbook/receipts/${receiptId}`, doctorToken)
    expect(served.status).toBe(200)
    expect(served.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await served.arrayBuffer())).toEqual(pngHeader)

    const otherDoctorResponse = await getBinary(`/api/cashbook/receipts/${receiptId}`, otherDoctorToken)
    expect(otherDoctorResponse.status).toBe(403)
    const adminResponse = await getBinary(`/api/cashbook/receipts/${receiptId}`, adminToken)
    expect(adminResponse.status).toBe(200)

    invalidReceiptEntryId = await createEntry('expense', `Invalid receipt expense ${suffix}`, '50')
    const invalidUpload = await uploadReceipt(invalidReceiptEntryId, doctorToken, Buffer.from('not an image'), `invalid-${suffix}.png`)
    expect(invalidUpload.status).toBe(400)
  })
})

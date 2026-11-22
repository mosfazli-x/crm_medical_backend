import { describe, it, expect } from 'vitest'
import { parseBankSms, buildDedupeInput, isSecurityMessage, toAsciiDigits } from '../modules/finance-ingest/sms-parser'

/**
 * Fixtures are realistic phrasings for the banks the clinic uses. They are
 * intentionally varied (Persian/Arabic digits, separators, line breaks,
 * credit/debit wording) because that variation is what breaks naive parsers.
 * When a real message fails, add it here first, then fix the parser.
 */
describe('SMS parser — normalization', () => {
  it('converts Persian and Arabic digits to ASCII', () => {
    expect(toAsciiDigits('۱۲۳۴۵۶۷۸۹۰')).toBe('1234567890')
    expect(toAsciiDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789')
  })
})

describe('SMS parser — Bank Melli', () => {
  it('parses an incoming deposit with balance, date and reference', () => {
    const result = parseBankSms({
      sender: 'BankMelli',
      text: [
        'بانک ملی ایران',
        'واریز به حساب شما',
        'مبلغ: ۵,۰۰۰,۰۰۰ ریال',
        'موجودی: ۱۲,۴۵۰,۰۰۰ ریال',
        'تاریخ: ۱۴۰۵/۰۹/۱۴ ۱۲:۳۰',
        'شماره پیگیری: ۱۲۳۴۵۶',
      ].join('\n'),
    })

    expect(result.outcome).toBe('parsed')
    expect(result.bankCode).toBe('melli')
    expect(result.direction).toBe('income')
    expect(result.amountRial).toBe('5000000')
    expect(result.balanceRial).toBe('12450000')
    expect(result.externalRef).toBe('123456')
    expect(result.confidence).toBeGreaterThanOrEqual(70)
    expect(result.occurredAt).toBeInstanceOf(Date)
  })

  it('parses an outgoing card purchase', () => {
    const result = parseBankSms({
      sender: 'BankMelli',
      text: 'خرید از کارت شما\nمبلغ 1,250,000 ریال\nموجودی 8,750,000 ریال',
    })

    expect(result.outcome).toBe('parsed')
    expect(result.direction).toBe('expense')
    expect(result.amountRial).toBe('1250000')
    expect(result.balanceRial).toBe('8750000')
  })
})

describe('SMS parser — Bank Saderat', () => {
  it('parses a withdrawal written with Arabic digits and dotted date', () => {
    const result = parseBankSms({
      sender: 'SADERAT',
      text: 'بانک صادرات ایران\nبرداشت از حساب ۰۱۰۱۲۳۴۵۶۷۸۰۱\nمبلغ ۱٬۲۵۰٬۰۰۰ ریال\nموجودی ۸٬۷۵۰٬۰۰۰ ریال\n۱۴۰۵/۰۹/۱۴ - ۰۹:۱۵',
    })

    expect(result.outcome).toBe('parsed')
    expect(result.bankCode).toBe('saderat')
    expect(result.direction).toBe('expense')
    expect(result.amountRial).toBe('1250000')
    expect(result.balanceRial).toBe('8750000')
    expect(result.cardLast4).toBe('7801')
  })

  it('treats thouland-separated amounts in toman correctly when the unit says toman', () => {
    const result = parseBankSms({
      sender: 'SADERAT',
      text: 'برداشت از حساب شما\nمبلغ: 250,000 تومان',
    })

    expect(result.outcome).toBe('parsed')
    expect(result.direction).toBe('expense')
    expect(result.amountRial).toBe('2500000')
  })
})

describe('SMS parser — Bank Mellat', () => {
  it('parses an internet gateway purchase with masked card', () => {
    const result = parseBankSms({
      sender: 'BankMellat',
      text: [
        'خرید از درگاه اینترنتی',
        'مبلغ: 2,300,000 ریال',
        'کارت: 6104-****-5678',
        'موجودی: 9,100,000 ریال',
        'بانک ملت',
      ].join('\n'),
      receivedAt: new Date('2026-01-10T10:00:00.000Z'),
    })

    expect(result.outcome).toBe('parsed')
    expect(result.bankCode).toBe('mellat')
    expect(result.direction).toBe('expense')
    expect(result.amountRial).toBe('2300000')
    expect(result.cardLast4).toBe('5678')
    expect(result.confidence).toBeGreaterThanOrEqual(75)
  })
})

describe('SMS parser — Resalat Bank', () => {
  it('parses an incoming card-to-card transfer', () => {
    const result = parseBankSms({
      sender: 'Resalat',
      text: 'بانک رسالت\nانتقال کارت به کارت\nواریز 3,000,000 ریال به حساب شما\nموجودی: 3,000,000 ریال\n1405/09/15',
    })

    expect(result.outcome).toBe('parsed')
    expect(result.bankCode).toBe('resalat')
    expect(result.direction).toBe('income')
    expect(result.amountRial).toBe('3000000')
  })

  it('parses an outgoing transfer where only the from-account is mentioned', () => {
    const result = parseBankSms({
      sender: 'Resalat',
      text: 'انتقال از حساب شما به حساب دیگری\nمبلغ 750,000 ریال\nموجودی 2,250,000 ریال',
    })

    expect(result.outcome).toBe('parsed')
    expect(result.direction).toBe('expense')
    expect(result.amountRial).toBe('750000')
  })
})

describe('SMS parser — unknown banks still parse', () => {
  it('uses the generic template when the bank is not recognised', () => {
    const result = parseBankSms({
      sender: '9821',
      text: 'مبلغ 480,000 ریال از حساب شما برداشت شد. موجودی: 1,520,000 ریال',
    })

    expect(result.outcome).toBe('parsed')
    expect(result.bankCode).toBeNull()
    expect(result.parserId).toBe('generic.v1')
    expect(result.direction).toBe('expense')
    expect(result.amountRial).toBe('480000')
    // No bank identity, so it must not reach the auto-post threshold.
    expect(result.confidence).toBeLessThan(85)
  })
})

describe('SMS parser — rejections', () => {
  it('ignores one-time passwords', () => {
    const result = parseBankSms({
      sender: 'BankMelli',
      text: 'رمز پویا: ۴۸۲۱\nمبلغ 1,000,000 ریال',
    })

    expect(result.outcome).toBe('ignored')
    expect(result.reason).toBe('security_message')
    expect(isSecurityMessage('رمز یکبار مصرف شما')).toBe(true)
  })

  it('ignores promotional messages without a transaction verb', () => {
    const result = parseBankSms({
      sender: 'BankMellat',
      text: 'وام فوری تا 500 میلیون تومان بدون ضامن',
    })

    expect(result.outcome).toBe('ignored')
    expect(result.amountRial).toBeNull()
  })

  it('fails closed on an unrecognised bank message body', () => {
    const result = parseBankSms({ sender: 'unknown', text: 'سلام، وقت بخیر' })
    expect(result.outcome).toBe('ignored')
    expect(result.reason).toBe('not_transactional')
  })

  it('rejects empty input', () => {
    expect(parseBankSms({ text: '   ' }).outcome).toBe('failed')
  })
})

describe('SMS parser — dedupe keys', () => {
  it('prefers the bank reference', () => {
    const parsed = parseBankSms({
      sender: 'BankMelli',
      text: 'واریز 1,000,000 ریال به حساب شما\nشماره پیگیری: 987654',
    })
    expect(buildDedupeInput(parsed, '')).toBe('ref:987654')
  })

  it('falls back to a content fingerprint', () => {
    const text = 'خرید 200,000 ریال از کارت شما'
    const a = parseBankSms({ sender: 'x', text })
    const b = parseBankSms({ sender: 'x', text })
    expect(buildDedupeInput(a, text)).toBe(buildDedupeInput(b, text))
    expect(buildDedupeInput(a, text)).toContain('hash:')
  })
})

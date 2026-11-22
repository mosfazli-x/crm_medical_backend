/**
 * Bank SMS parser.
 *
 * Pure functions only — no database, no network — so it can be unit-tested
 * against real message fixtures and reused by any ingestion connector
 * (Android app, iOS Shortcut, pasted text, future statement import).
 *
 * Design notes:
 *  - Persian/Arabic digits, Arabic Yeh/Kaf, ZWNJ and the various thousand
 *    separators (`,` `،` `٬` `'` space) are normalized first.
 *  - Banks phrase messages differently, so extraction is driven by a keyword
 *    model (direction verbs, amount/balance/reference keywords) rather than
 *    one rigid regex per bank. Bank-specific quirks are expressed as small
 *    template tweaks; an unknown bank still parses via the generic path.
 *  - The parser never guesses silently: every field carries a confidence
 *    contribution, and callers decide whether to post or queue for review.
 */
import { toGregorian } from 'jalaali-js'

export type SmsDirection = 'income' | 'expense'
export type SmsOutcome = 'parsed' | 'ignored' | 'failed'

export interface ParsedSmsSignals {
  bankDetected: boolean
  explicitCurrency: boolean
  hasBalance: boolean
  hasReference: boolean
  hasDateTime: boolean
  hasCard: boolean
}

export interface ParsedSms {
  outcome: SmsOutcome
  /** Identifier of the template that produced this result, for diagnostics. */
  parserId: string
  bankCode: string | null
  direction: SmsDirection | null
  /** Integer rial amount as a decimal string (kept as string to avoid overflow). */
  amountRial: string | null
  balanceRial: string | null
  cardLast4: string | null
  externalRef: string | null
  /** When the transaction happened, if the message carries a timestamp. */
  occurredAt: Date | null
  /** Merchant / payer / payee text, when recognisable. */
  dealer: string | null
  description: string
  /** 0–100. Callers should auto-post only above their configured threshold. */
  confidence: number
  /** Machine-readable rejection/ignore reason, when outcome is not `parsed`. */
  reason: string | null
  signals: ParsedSmsSignals
}

export interface ParseInput {
  text: string
  sender?: string | null
  receivedAt?: Date | null
}

interface BankProfile {
  code: string
  parserId: string
  /** Words that identify the bank in the sender id or the message body. */
  markers: string[]
}

/* ────────────────────────────────────────────────────────────────
   Bank registry
   ──────────────────────────────────────────────────────────────── */

const BANKS: BankProfile[] = [
  { code: 'saderat', parserId: 'saderat.v1', markers: ['صادرات', 'saderat', 'sad'] },
  { code: 'melli', parserId: 'melli.v1', markers: ['ملی', 'melli', 'bankmelli', 'bmi'] },
  { code: 'mellat', parserId: 'mellat.v1', markers: ['ملت', 'mellat', 'behpardakht'] },
  { code: 'resalat', parserId: 'resalat.v1', markers: ['رسالت', 'resalat'] },
  { code: 'tejarat', parserId: 'tejarat.v1', markers: ['تجارت', 'tejarat'] },
  { code: 'parsian', parserId: 'parsian.v1', markers: ['پارسیان', 'parsian'] },
  { code: 'pasargad', parserId: 'pasargad.v1', markers: ['پاسارگاد', 'pasargad'] },
  { code: 'saman', parserId: 'saman.v1', markers: ['سامان', 'saman'] },
  { code: 'sepah', parserId: 'sepah.v1', markers: ['سپه', 'sepah'] },
  { code: 'refah', parserId: 'refah.v1', markers: ['رفاه', 'refah'] },
  { code: 'shahr', parserId: 'shahr.v1', markers: ['شهر', 'shahr'] },
  { code: 'keshavarzi', parserId: 'keshavarzi.v1', markers: ['کشاورزی', 'keshavarzi'] },
  { code: 'maskan', parserId: 'maskan.v1', markers: ['مسکن', 'maskan'] },
  { code: 'ayandeh', parserId: 'ayandeh.v1', markers: ['آینده', 'ayandeh'] },
  { code: 'blubank', parserId: 'blubank.v1', markers: ['بلوبانک', 'بلو', 'blubank'] },
  { code: 'ansar', parserId: 'ansar.v1', markers: ['انصار', 'ansar'] },
  { code: 'sarmayeh', parserId: 'sarmayeh.v1', markers: ['سرمایه', 'sarmayeh'] },
]

const GENERIC_PARSER_ID = 'generic.v1'

/* ────────────────────────────────────────────────────────────────
   Normalization
   ──────────────────────────────────────────────────────────────── */

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

export function toAsciiDigits(input: string): string {
  let out = ''
  for (const ch of input) {
    const pi = PERSIAN_DIGITS.indexOf(ch)
    if (pi >= 0) {
      out += String(pi)
      continue
    }
    const ai = ARABIC_DIGITS.indexOf(ch)
    out += ai >= 0 ? String(ai) : ch
  }
  return out
}

function normalize(input: string): string {
  return toAsciiDigits(String(input ?? ''))
    .replace(/[\u064A\u0649]/g, 'ی') // Arabic yeh / alef maksura → Persian yeh
    .replace(/\u0643/g, 'ک') // Arabic kaf → Persian kaf
    .replace(/\u200c/g, ' ') // ZWNJ → space (keyword matching only)
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '') // bidi controls
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/** Text with dates, times and card masks removed, so amount detection is safe. */
interface StrippedText {
  text: string
  dates: string[]
  times: string[]
  cardMasks: string[]
}

function stripStructuredTokens(normalized: string): StrippedText {
  const dates: string[] = []
  const times: string[] = []
  const cardMasks: string[] = []

  let text = normalized

  // Card masks first: 6037-****-1234 / **** 1234 / 6104XXXXXXXX1234
  text = text.replace(/\b(\d{4})[\s\-*xX]{4,}[\s\-*xX]*(\d{4})\b/g, (match, first, last) => {
    cardMasks.push(`${first}${last}`)
    return ' <CARD> '
  })
  text = text.replace(/\*{2,}\s*(\d{4})/g, (match, last) => {
    cardMasks.push(last)
    return ' <CARD> '
  })
  text = text.replace(/\b(\d{16})\b/g, (match) => {
    cardMasks.push(match)
    return ' <CARD> '
  })

  // Jalali dates (14xx/aa/bb), Gregorian ISO and dotted variants.
  text = text.replace(/\b(1[34]\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/g, (match) => {
    dates.push(match)
    return ' <DATE> '
  })
  text = text.replace(/\b(20\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/g, (match) => {
    dates.push(match)
    return ' <DATE> '
  })

  // Clock times.
  text = text.replace(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/g, (match) => {
    times.push(match)
    return ' <TIME> '
  })

  return { text: text.replace(/[ \t]+/g, ' ').trim(), dates, times, cardMasks }
}

/* ────────────────────────────────────────────────────────────────
   Number / currency helpers
   ──────────────────────────────────────────────────────────────── */

const SEPARATORS = /[,،٬'\s_]/g

function digitsToBigInt(raw: string): bigint | null {
  const digits = raw.replace(SEPARATORS, '').replace(/\D/g, '')
  if (!digits) return null
  try {
    return BigInt(digits)
  } catch {
    return null
  }
}

interface NumberCandidate {
  value: bigint
  raw: string
  index: number
  end: number
  /** Weight from the keyword immediately before it. */
  score: number
  hasUnit: boolean
}

const AMOUNT_KEYWORDS = [
  { word: 'مبلغ تراکنش', weight: 6 },
  { word: 'مبلغ', weight: 5 },
  { word: 'برداشت', weight: 4 },
  { word: 'واریز', weight: 4 },
  { word: 'خرید', weight: 4 },
  { word: 'پرداخت', weight: 4 },
  { word: 'انتقال', weight: 3 },
  { word: 'بدهکار', weight: 3 },
  { word: 'بستانکار', weight: 3 },
  { word: 'مانده', weight: 1 },
  { word: 'موجودی', weight: 1 },
]

const RIAL_RE = /(ریال|ريال|\bIRR\b)/i
const TOMAN_RE = /(تومان|تومن|ت مان|\bIRT\b)/i
const THOUSAND_RE = /هزار/
const MILLION_RE = /میلیون/
const BILLION_RE = /میلیارد/

/** Magnitude word attached to a number ("۵ میلیون تومان"). */
function magnitudeMultiplier(window: string): bigint {
  if (BILLION_RE.test(window)) return 1_000_000_000n
  if (MILLION_RE.test(window)) return 1_000_000n
  if (THOUSAND_RE.test(window)) return 1_000n
  return 1n
}

function hasMagnitudeOrUnit(window: string): boolean {
  return THOUSAND_RE.test(window) || MILLION_RE.test(window) || BILLION_RE.test(window)
}

function collectNumbers(text: string): NumberCandidate[] {
  const candidates: NumberCandidate[] = []
  const re = /\d[\d,،٬' \u00a0_]*\d|\d/g
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    const raw = match[0]
    const value = digitsToBigInt(raw)
    if (value === null) continue

    const before = text.slice(Math.max(0, match.index - 26), match.index)
    const after = text.slice(match.index + raw.length, match.index + raw.length + 16)

    let score = 0
    for (const kw of AMOUNT_KEYWORDS) {
      if (before.includes(kw.word)) score = Math.max(score, kw.weight)
    }

    const hasUnit = RIAL_RE.test(after) || TOMAN_RE.test(after) || hasMagnitudeOrUnit(after)
    if (hasUnit) score += 2

    candidates.push({ value, raw, index: match.index, end: match.index + raw.length, score, hasUnit })
  }

  return candidates
}

interface CurrencyResult {
  rial: bigint
  explicit: boolean
}

/**
 * Resolves a printed number into rials.
 *
 * `before`/`after` are the text immediately around the number. Magnitude
 * words (هزار/میلیون/میلیارد) multiply the face value; the currency word
 * (ریال/تومان) then converts to rials. "۵۰۰ میلیون تومان" therefore becomes
 * 5,000,000,000 rials, not 5,000.
 */
function applyCurrencyMultiplier(value: bigint, before: string, after: string, wholeText: string): CurrencyResult {
  const local = `${before} ${after}`
  const magnitude = magnitudeMultiplier(local)

  if (TOMAN_RE.test(after) || TOMAN_RE.test(before)) {
    return { rial: value * magnitude * 10n, explicit: true }
  }
  if (RIAL_RE.test(after) || RIAL_RE.test(before)) {
    return { rial: value * magnitude, explicit: true }
  }
  if (hasMagnitudeOrUnit(after) || hasMagnitudeOrUnit(before)) {
    // Magnitude without currency is almost always toman in Persian copy.
    return { rial: value * magnitude * 10n, explicit: true }
  }

  // No unit next to the number: fall back to the message-level currency.
  const tomanAnywhere = TOMAN_RE.test(wholeText)
  const rialAnywhere = RIAL_RE.test(wholeText)
  if (tomanAnywhere && !rialAnywhere) {
    return { rial: value * 10n, explicit: true }
  }
  if (rialAnywhere) {
    return { rial: value, explicit: true }
  }

  // Iranian bank alerts default to rial when no unit is printed.
  return { rial: value, explicit: false }
}

/* ────────────────────────────────────────────────────────────────
   Direction detection
   ──────────────────────────────────────────────────────────────── */

const INCOME_KEYWORDS: { re: RegExp; weight: number }[] = [
  { re: /به حساب شما/g, weight: 6 },
  { re: /به کارت شما/g, weight: 6 },
  { re: /واریز/g, weight: 6 },
  { re: /افزایش موجودی/g, weight: 5 },
  { re: /دریافت وجه/g, weight: 5 },
  { re: /واریزی/g, weight: 5 },
  { re: /بستانکار/g, weight: 4 },
]

const EXPENSE_KEYWORDS: { re: RegExp; weight: number }[] = [
  { re: /از حساب شما/g, weight: 6 },
  { re: /از کارت شما/g, weight: 6 },
  { re: /برداشت/g, weight: 6 },
  { re: /خرید/g, weight: 6 },
  { re: /کاهش موجودی/g, weight: 5 },
  { re: /پرداخت/g, weight: 4 },
  { re: /بدهکار/g, weight: 4 },
  { re: /قبض/g, weight: 2 },
  { re: /شارژ/g, weight: 2 },
]

function scoreKeywords(text: string, keywords: { re: RegExp; weight: number }[]): number {
  let score = 0
  for (const { re, weight } of keywords) {
    re.lastIndex = 0
    if (re.test(text)) score = Math.max(score, weight)
  }
  return score
}

function detectDirection(text: string): { direction: SmsDirection | null; income: number; expense: number } {
  const income = scoreKeywords(text, INCOME_KEYWORDS)
  const expense = scoreKeywords(text, EXPENSE_KEYWORDS)

  if (income > 0 && expense > 0) {
    // Contradictory verbs: trust the stronger one, but only if clearly stronger.
    if (income >= expense + 2) return { direction: 'income', income, expense }
    if (expense >= income + 2) return { direction: 'expense', income, expense }
    return { direction: null, income, expense }
  }
  if (income > 0) return { direction: 'income', income, expense }
  if (expense > 0) return { direction: 'expense', income, expense }
  return { direction: null, income, expense }
}

/* ────────────────────────────────────────────────────────────────
   Field extraction
   ──────────────────────────────────────────────────────────────── */

function extractCardLast4(stripped: StrippedText, normalized: string): string | null {
  for (const mask of stripped.cardMasks) {
    const digits = mask.replace(/\D/g, '')
    if (digits.length >= 4) return digits.slice(-4)
  }
  // "کارت 1234" / "حساب 1234" style suffixes.
  const labeled = normalized.match(/(?:کارت|حساب|شماره کارت|شماره حساب)[^\d]{0,12}(\d{4,})/)
  if (labeled?.[1]) return labeled[1].slice(-4)
  // Standalone masked tail, e.g. "1234*".
  const tail = normalized.match(/(\d{4})\s*\*/)
  if (tail?.[1]) return tail[1]
  return null
}

function extractReference(normalized: string): string | null {
  const patterns = [
    /(?:شماره\s*پیگیری|کد\s*پیگیری|پیگیری)[^\d]{0,8}(\d{4,})/,
    /(?:شماره\s*مرجع|مرجع|کد\s*رهگیری|رهگیری)[^\d]{0,8}(\d{4,})/,
    /(?:شماره\s*سند|سند)[^\d]{0,8}(\d{4,})/,
    /(?:رسید|کد\s*تراکنش)[^\d]{0,8}(\d{4,})/,
    /\bREF[^\d]{0,6}(\d{4,})/i,
  ]
  for (const re of patterns) {
    const m = normalized.match(re)
    if (m?.[1]) return m[1]
  }
  return null
}

function extractDealer(normalized: string): string | null {
  const patterns = [
    /(?:بابت|جهت|در قبال)\s*([^.,،؛\n]{2,40})/,
    /(?:فروشگاه|درگاه|پذیرنده)\s*[:\-]?\s*([^.,،؛\n]{2,40})/,
    /(?:از|به)\s+(?:حساب|کارت)\s+([^\d\n]{2,30})/,
  ]
  for (const re of patterns) {
    const m = normalized.match(re)
    if (m?.[1]) {
      const cleaned = m[1]
        .replace(/^(حساب|کارت)\s*/, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
      if (cleaned.length >= 2) return cleaned
    }
  }
  return null
}

const TEHRAN_OFFSET_MINUTES = 3 * 60 + 30

function extractOccurredAt(stripped: StrippedText, receivedAt?: Date | null): Date | null {
  const dateText = stripped.dates[0]
  if (!dateText) return receivedAt ?? null

  const parts = dateText.split(/[\/\-.]/).map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return receivedAt ?? null

  let [year, month, day] = parts
  const timeText = stripped.times[0]
  let hour = 0
  let minute = 0
  if (timeText) {
    const [h, m] = timeText.split(':').map(Number)
    hour = h ?? 0
    minute = m ?? 0
  }

  // Jalali years are ~13xx/14xx; Gregorian are ~20xx.
  if (year < 1700) {
    try {
      const g = toGregorian(year, month, day)
      year = g.gy
      month = g.gm
      day = g.gd
    } catch {
      return receivedAt ?? null
    }
  }

  const utc = Date.UTC(year, month - 1, day, hour, minute)
  return new Date(utc - TEHRAN_OFFSET_MINUTES * 60 * 1000)
}

/* ────────────────────────────────────────────────────────────────
   Ignore rules — never post security codes or marketing names
   ──────────────────────────────────────────────────────────────── */

const OTP_PATTERNS: RegExp[] = [
  /رمز\s*(پویا|یکبار\s*مصرف|یکبارمصرف|اینترنتی|دوم|اول|ثابت|موقت|تایید|تأیید|فعالسازی|فعال\s*سازی)/,
  /(کد|رمز)\s*(تایید|تأیید|فعالسازی|فعال\s*سازی)\b/,
  /CVV2?/i,
  /رمز\s*حساب/,
  /پین\s*کد/,
  /کد\s*یکبار\s*مصرف/,
]

export function isSecurityMessage(normalized: string): boolean {
  return OTP_PATTERNS.some((re) => re.test(normalized))
}

/* ────────────────────────────────────────────────────────────────
   Main entry point
   ──────────────────────────────────────────────────────────────── */

export function parseBankSms(input: ParseInput): ParsedSms {
  const normalized = normalize(input.text)
  const sender = normalize(String(input.sender ?? '')).toLowerCase()

  const bank = detectBank(normalized, sender)
  const parserId = bank?.parserId ?? GENERIC_PARSER_ID

  const signals: ParsedSmsSignals = {
    bankDetected: Boolean(bank),
    explicitCurrency: false,
    hasBalance: false,
    hasReference: false,
    hasDateTime: false,
    hasCard: false,
  }

  const emptyResult = (outcome: SmsOutcome, reason: string | null, confidence = 0): ParsedSms => ({
    outcome,
    parserId,
    bankCode: bank?.code ?? null,
    direction: null,
    amountRial: null,
    balanceRial: null,
    cardLast4: null,
    externalRef: null,
    occurredAt: null,
    dealer: null,
    description: '',
    confidence,
    reason,
    signals,
  })

  if (!normalized) {
    return emptyResult('failed', 'empty_message')
  }

  if (isSecurityMessage(normalized)) {
    return emptyResult('ignored', 'security_message')
  }

  const stripped = stripStructuredTokens(normalized)
  const candidates = collectNumbers(stripped.text)

  const cardLast4 = extractCardLast4(stripped, normalized)
  signals.hasCard = Boolean(cardLast4)

  const externalRef = extractReference(normalized)
  signals.hasReference = Boolean(externalRef)

  const occurredAt = extractOccurredAt(stripped, input.receivedAt ?? null)
  signals.hasDateTime = stripped.dates.length > 0

  const dealer = extractDealer(normalized)

  const { direction, income, expense } = detectDirection(normalized)

  // Balance: the number right after موجودی/مانده. Remember its position so the
  // same figure is never mistaken for the transaction amount (card-to-card
  // transfers often leave amount === balance).
  let balanceValue: bigint | null = null
  let balanceIndex = -1
  const balanceMatch = stripped.text.match(/(?:موجودی|مانده)(?:\s*(?:حساب|کارت|قابل\s*برداشت))?[^\d]{0,12}(\d[\d,،٬'\s_]*\d|\d)/)
  if (balanceMatch?.[1]) {
    const parsed = digitsToBigInt(balanceMatch[1])
    if (parsed !== null) {
      const numberIndex = (balanceMatch.index ?? 0) + balanceMatch[0].lastIndexOf(balanceMatch[1])
      const before = stripped.text.slice(Math.max(0, numberIndex - 12), numberIndex)
      const after = stripped.text.slice(numberIndex + balanceMatch[1].length, numberIndex + balanceMatch[1].length + 20)
      balanceValue = applyCurrencyMultiplier(parsed, before, after, stripped.text).rial
      balanceIndex = numberIndex
      signals.hasBalance = true
    }
  }

  // Amount: highest-scoring number that is not the balance figure.
  const amountCandidates = candidates.filter((candidate) => {
    if (balanceIndex >= 0 && candidate.index === balanceIndex) return false
    // Ignore tiny numbers (step counters, reference fragments, etc.).
    if (candidate.value < 100n && !candidate.hasUnit) return false
    return true
  })

  const best = amountCandidates
    .slice()
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]

  let amountRial: bigint | null = null
  if (best) {
    const before = stripped.text.slice(Math.max(0, best.index - 12), best.index)
    const after = stripped.text.slice(best.end, best.end + 20)
    const applied = applyCurrencyMultiplier(best.value, before, after, stripped.text)
    amountRial = applied.rial
    signals.explicitCurrency = applied.explicit
  }

  // No transaction verb at all: a notice, promo or balance-only message. It is
  // not a failure — there is simply nothing to post — but it must never carry
  // a guessed amount into the review queue.
  if (!direction) {
    if (income === 0 && expense === 0) {
      return {
        ...emptyResult('ignored', 'not_transactional', bank ? 15 : 0),
        balanceRial: balanceValue?.toString() ?? null,
        externalRef,
        occurredAt,
        dealer,
        cardLast4,
        description: buildDescription(null, null, dealer, externalRef),
      }
    }
    return {
      ...emptyResult('failed', 'direction_unknown', 0),
      amountRial: amountRial?.toString() ?? null,
      balanceRial: balanceValue?.toString() ?? null,
      externalRef,
      occurredAt,
      dealer,
      cardLast4,
      description: buildDescription(amountRial, null, dealer, externalRef),
    }
  }

  // Direction known but no amount: fail rather than post a zero-value entry.
  if (amountRial === null || amountRial <= 0n) {
    const hasNumbers = amountCandidates.length > 0
    return {
      ...emptyResult(hasNumbers ? 'failed' : 'ignored', hasNumbers ? 'amount_not_found' : 'no_amount', bank ? 15 : 0),
      direction,
      balanceRial: balanceValue?.toString() ?? null,
      externalRef,
      occurredAt,
      dealer,
      cardLast4,
      description: buildDescription(null, direction, dealer, externalRef),
    }
  }

  // ── Confidence ──
  let confidence = 0
  if (bank) confidence += 15
  confidence += 30 // amount present
  confidence += 25 // direction present
  if (signals.explicitCurrency) confidence += 5
  if (signals.hasBalance) confidence += 5
  if (signals.hasReference) confidence += 5
  if (signals.hasDateTime) confidence += 5
  if (signals.hasCard) confidence += 5
  if (income > 0 && expense > 0) confidence -= 15
  confidence = Math.max(0, Math.min(100, confidence))

  return {
    outcome: 'parsed',
    parserId,
    bankCode: bank?.code ?? null,
    direction,
    amountRial: amountRial.toString(),
    balanceRial: balanceValue?.toString() ?? null,
    cardLast4,
    externalRef,
    occurredAt,
    dealer,
    description: buildDescription(amountRial, direction, dealer, externalRef),
    confidence,
    reason: null,
    signals,
  }
}

function detectBank(normalized: string, sender: string): BankProfile | null {
  const haystack = `${sender} ${normalized}`.toLowerCase()
  // Sender matches are strong: bank sender ids usually contain the bank name.
  for (const bank of BANKS) {
    if (bank.markers.some((marker) => sender.includes(marker.toLowerCase()))) return bank
  }
  for (const bank of BANKS) {
    if (bank.markers.some((marker) => haystack.includes(marker.toLowerCase()))) return bank
  }
  return null
}

function buildDescription(
  amountRial: bigint | null,
  direction: SmsDirection | null,
  dealer: string | null,
  reference: string | null,
): string {
  const parts: string[] = []
  if (direction === 'income') parts.push('واریز')
  else if (direction === 'expense') parts.push('برداشت')
  if (dealer) parts.push(dealer)
  if (reference) parts.push(`پیگیری ${reference}`)
  if (amountRial !== null) parts.push(`${amountRial.toString()} ریال`)
  return parts.join(' · ').slice(0, 500) || 'تراکنش بانکی'
}

/**
 * Stable dedupe key. Prefers the bank reference, then a fingerprint of the
 * meaningful message fields so re-sent/duplicated delivery collapses.
 */
export function buildDedupeInput(parsed: ParsedSms, rawText: string): string {
  if (parsed.externalRef) return `ref:${parsed.externalRef}`
  const fingerprint = [
    normalize(rawText).replace(/\s+/g, ' '),
    parsed.amountRial ?? '',
    parsed.balanceRial ?? '',
    parsed.occurredAt ? parsed.occurredAt.toISOString().slice(0, 16) : '',
  ].join('|')
  return `hash:${fingerprint}`
}

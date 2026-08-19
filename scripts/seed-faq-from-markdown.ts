/**
 * Parses FAQ.md and seeds the faq_entries table via direct SQL inserts.
 *
 * Usage:
 *   npx tsx scripts/seed-faq-from-markdown.ts
 *
 * Requires DATABASE_URL in environment or .env file.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { Pool } from 'pg'
import { config } from 'dotenv'

config({ path: resolve(__dirname, '../.env') })

interface FaqEntry {
  question_fa: string
  answer_fa: string
  question_en: string | null
  answer_en: string | null
  category: string
  tags: string[]
  source: string
  is_published: boolean
}

interface RawEntry {
  id: string
  question: string
  answer: string
  section: string
  part: 'A' | 'B' | 'C' | 'D'
}

const SECTION_TO_CATEGORY: Record<string, string> = {
  // English Part A sections
  'general & authentication': 'general',
  'dashboard': 'general',
  'patient management': 'patients',
  'clinical operations': 'clinical',
  'appointments & scheduling': 'scheduling',
  'clinical tools & screening': 'clinical',
  'lab results & prescriptions': 'lab_results',
  'billing & accounting': 'billing',
  'inventory & consumables': 'inventory',
  'crm — leads & lead sources': 'other',
  'crm': 'other',
  'messaging & communication': 'other',
  'staff management & attendance': 'staff',
  'administration & settings': 'settings',
  'daily reports': 'accounting',
  'profile & preferences': 'settings',
  'support & faq system': 'general',
  'telegram mini app (staff view)': 'general',
  // English Part B sections
  'account & login': 'general',
  'booking appointments': 'scheduling',
  'viewing records': 'patients',
  'messaging': 'other',
  'telegram mini app (patient view)': 'general',
  'profile & personal info': 'settings',
  // Farsi Part C sections (mapped to same categories)
  'احراز هویت و ورود': 'general',
  'داشبورد': 'general',
  'مدیریت بیماران': 'patients',
  'عملیات بالینی': 'clinical',
  'نوبت\u200cدهی و برنامه\u200cریزی': 'scheduling',
  'ابزارهای بالینی و غربالگری': 'clinical',
  'نتایج آزمایش و نسخه\u200cها': 'lab_results',
  'صورتحساب و حسابداری': 'billing',
  'انبار و ملزومات': 'inventory',
  'مدیریت ارتباط با مشتری (crm) — لیدها': 'other',
  'مدیریت ارتباط با مشتری': 'other',
  'پیام\u200cرسانی و ارتباطات': 'other',
  'پیام\u200cرسانی': 'other',
  'مدیریت کارکنان و حضور و غیاب': 'staff',
  'مدیریت کارکنان': 'staff',
  'مدیریت و تنظیمات': 'settings',
  'گزارش\u200cهای روزانه': 'accounting',
  'پروفایل و اطلاعات شخصی': 'settings',
  'پشتیبانی و سیستم faq': 'general',
  // Farsi Part D sections
  'حساب کاربری و ورود': 'general',
  'رزرو نوبت': 'scheduling',
  'مشاهده پرونده': 'patients',
  'اپلیکیشن تلگرام': 'general',
  'پروفایل': 'settings',
}

// Maps English section names to Farsi equivalents (by category order)
const EN_TO_FA_SECTION: Record<string, string> = {
  'general & authentication': 'احراز هویت و ورود',
  'dashboard': 'داشبورد',
  'patient management': 'مدیریت بیماران',
  'clinical operations': 'عملیات بالینی',
  'appointments & scheduling': 'نوبت\u200cدهی و برنامه\u200cریزی',
  'clinical tools & screening': 'ابزارهای بالینی و غربالگری',
  'lab results & prescriptions': 'نتایج آزمایش و نسخه\u200cها',
  'billing & accounting': 'صورتحساب و حسابداری',
  'inventory & consumables': 'انبار و ملزومات',
  'crm — leads & lead sources': 'مدیریت ارتباط با مشتری (CRM) — لیدها',
  'messaging & communication': 'پیام\u200cرسانی و ارتباطات',
  'staff management & attendance': 'مدیریت کارکنان و حضور و غیاب',
  'administration & settings': 'مدیریت و تنظیمات',
  'daily reports': 'گزارش\u200cهای روزانه',
  'profile & preferences': 'پروفایل و اطلاعات شخصی',
  'support & faq system': 'پشتیبانی و سیستم FAQ',
  'telegram mini app': 'اپلیکیشن تلگرام',
  'telegram mini app (staff view)': 'اپلیکیشن تلگرام',
  'account & login': 'حساب کاربری و ورود',
  'booking appointments': 'رزرو نوبت',
  'viewing records': 'مشاهده پرونده',
  'messaging': 'پیام\u200cرسانی',
  'telegram mini app (patient view)': 'اپلیکیشن تلگرام',
  'profile & personal info': 'پروفایل و اطلاعات شخصی',
}

const FA_TO_EN_SECTION: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_FA_SECTION).map(([en, fa]) => [fa, en])
)

function getCategory(section: string): string {
  const normalized = section.toLowerCase().trim()
  if (SECTION_TO_CATEGORY[normalized]) return SECTION_TO_CATEGORY[normalized]
  for (const [key, val] of Object.entries(SECTION_TO_CATEGORY)) {
    if (normalized.includes(key) || key.includes(normalized)) return val
  }
  return 'general'
}

function normalizeSection(section: string, part: string): string {
  // Always normalize to lowercase English section name so pairing works
  if (part === 'C' || part === 'D') {
    return FA_TO_EN_SECTION[section] || section.toLowerCase()
  }
  // For Part A/B, find the lowercase key that matches
  const lower = section.toLowerCase()
  return lower
}

function parseFaqMarkdown(content: string): RawEntry[] {
  const entries: RawEntry[] = []
  const lines = content.split('\n')

  let currentPart: 'A' | 'B' | 'C' | 'D' | null = null
  let currentSection = 'general'

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Detect Part headers
    if (line.startsWith('# Part A') || line.startsWith('# Part A')) {
      currentPart = 'A'
      continue
    }
    if (line.startsWith('# Part B')) {
      currentPart = 'B'
      continue
    }
    if (line.startsWith('# Part C')) {
      currentPart = 'C'
      continue
    }
    if (line.startsWith('# Part D')) {
      currentPart = 'D'
      continue
    }

    if (!currentPart) continue

    // Detect section headers (## heading)
    if (line.startsWith('## ') && !line.startsWith('### ')) {
      const sectionName = line.replace(/^##\s+/, '').replace(/\s*\(.*\)\s*$/, '').trim()
      if (sectionName && !sectionName.startsWith('#')) {
        currentSection = sectionName
      }
      continue
    }

    // Detect FAQ entries (### X-NN: question)
    const entryMatch = line.match(/^###\s+([A-D])-(\d+):\s*(.+)/)
    if (entryMatch) {
      const [, partLetter, numStr, question] = entryMatch
      if (partLetter !== currentPart) continue

      const id = `${partLetter}-${numStr}`

      // Collect answer lines until next ### or ## or --- or end of part
      const answerLines: string[] = []
      let j = i + 1
      while (j < lines.length) {
        const nextLine = lines[j].trim()
        if (nextLine.startsWith('### ') || nextLine.startsWith('## ') || nextLine.startsWith('# Part')) break
        if (nextLine === '---') {
          // Check if the line after --- is a section/part header
          if (j + 1 < lines.length) {
            const peek = lines[j + 1].trim()
            if (peek.startsWith('## ') || peek.startsWith('# Part')) break
          }
        }
        // Skip the "**Answer:**" or "**پاسخ:**" prefix
        let answerText = nextLine
        if (answerText.startsWith('**Answer:**')) {
          answerText = answerText.replace(/^\*\*Answer:\*\*\s*/, '')
        } else if (answerText.startsWith('**پاسخ:**')) {
          answerText = answerText.replace(/^\*\*پاسخ:\*\*\s*/, '')
        }
        if (answerText || nextLine === '') {
          answerLines.push(answerText)
        }
        j++
      }

      const answer = answerLines.join('\n').trim()
      if (question && answer) {
        const normalizedSection = normalizeSection(currentSection, currentPart)
        entries.push({
          id,
          question: question.trim(),
          answer,
          section: normalizedSection,
          part: currentPart,
        })
      }
    }
  }

  return entries
}

function extractTags(question: string, answer: string, category: string): string[] {
  const text = `${question} ${answer}`.toLowerCase()
  const tags: string[] = []

  // Extract meaningful keywords
  const keywords: Record<string, string[]> = {
    login: ['login', 'ورود', 'password', 'رمز'],
    patients: ['patient', 'بیمار', 'create', 'ثبت', 'search', 'جستجو'],
    scheduling: ['appointment', 'نوبت', 'book', 'رزرو', 'schedule', 'برنامه'],
    prescriptions: ['prescription', 'نسخه', 'medication', 'دارو'],
    lab: ['lab', 'آزمایش', 'result', 'نتیجه'],
    billing: ['billing', 'صورتحساب', 'payment', 'پرداخت'],
    inventory: ['inventory', 'انبار', 'stock', 'موجودی'],
    messaging: ['message', 'پیام', 'send', 'ارسال'],
    attendance: ['attendance', 'حضور', 'check-in', 'ورود'],
    settings: ['settings', 'تنظیمات', 'config', 'پیکربندی'],
    clinical: ['clinical', 'بالینی', 'vital', 'علائم حیاتی', 'pcos', 'screening'],
    telegram: ['telegram', 'تلگرام'],
    profile: ['profile', 'پروفایل'],
  }

  const categoryKeywords: Record<string, string[]> = {
    general: ['general', 'عمومی'],
    patients: ['patient', 'بیمار'],
    scheduling: ['appointment', 'نوبت'],
    prescriptions: ['prescription', 'نسخه'],
    lab_results: ['lab', 'آزمایش'],
    billing: ['billing', 'صورتحساب'],
    accounting: ['accounting', 'حسابداری'],
    inventory: ['inventory', 'انبار'],
    clinical: ['clinical', 'بالینی'],
    staff: ['staff', 'کارمند', 'attendance', 'حضور'],
    settings: ['settings', 'تنظیمات'],
    other: [],
  }

  // Add category tag
  tags.push(category)

  // Add keyword tags
  for (const [tag, words] of Object.entries(keywords)) {
    if (words.some(w => text.includes(w))) {
      tags.push(tag)
    }
  }

  return [...new Set(tags)].slice(0, 8)
}

function escapeSqlString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
}

function formatArrayLiteral(arr: string[]): string {
  if (arr.length === 0) return "'{}'::text[]"
  const escaped = arr.map(s => `'${escapeSqlString(s)}'`)
  return `ARRAY[${escaped.join(', ')}]::text[]`
}

function generateSql(entries: FaqEntry[]): string {
  const header = `-- Comprehensive FAQ seed from FAQ.md
-- Generated by scripts/seed-faq-from-markdown.ts
-- Run: psql $DATABASE_URL -f backend/drizzle/seed-faq-full.sql

-- First, clear existing manual/approved entries (keep user_confirmed and gemini/groq entries)
DELETE FROM faq_entries WHERE source IN ('manual', 'approved');

INSERT INTO faq_entries (question_fa, answer_fa, question_en, answer_en, category, tags, source, is_published, confidence)
VALUES
`

  const values = entries.map((entry, idx) => {
    const qFa = escapeSqlString(entry.question_fa)
    const aFa = escapeSqlString(entry.answer_fa)
    const qEn = entry.question_en ? `'${escapeSqlString(entry.question_en)}'` : 'NULL'
    const aEn = entry.answer_en ? `'${escapeSqlString(entry.answer_en)}'` : 'NULL'
    const tags = formatArrayLiteral(entry.tags)
    const comma = idx < entries.length - 1 ? ',' : ';'

    return `  (
    '${qFa}',
    '${escapeSqlString(entry.answer_fa)}',
    ${qEn},
    ${aEn},
    '${entry.category}',
    ${tags},
    '${entry.source}',
    ${entry.is_published},
    1.0
  )${comma}`
  })

  return header + values.join('\n') + '\n'
}

async function main() {
  const faqPath = resolve(__dirname, '../../FAQ.md')
  console.log(`Reading FAQ.md from: ${faqPath}`)
  const content = readFileSync(faqPath, 'utf-8')

  console.log('Parsing FAQ entries...')
  const rawEntries = parseFaqMarkdown(content)
  console.log(`Found ${rawEntries.length} raw entries`)

  // Group by part
  const partA = rawEntries.filter(e => e.part === 'A')
  const partB = rawEntries.filter(e => e.part === 'B')
  const partC = rawEntries.filter(e => e.part === 'C')
  const partD = rawEntries.filter(e => e.part === 'D')

  console.log(`Part A (English staff): ${partA.length} entries`)
  console.log(`Part B (English patient): ${partB.length} entries`)
  console.log(`Part C (Farsi staff): ${partC.length} entries`)
  console.log(`Part D (Farsi patient): ${partD.length} entries`)

  // Build paired entries
  const pairedEntries: FaqEntry[] = []

  // Helper: pair entries from two parts by section + position
  function pairEntries(
    primary: RawEntry[],
    secondary: RawEntry[],
    primaryLang: 'en' | 'fa',
  ): FaqEntry[] {
    const result: FaqEntry[] = []

    // Group by section
    const primaryBySection = new Map<string, RawEntry[]>()
    const secondaryBySection = new Map<string, RawEntry[]>()

    for (const entry of primary) {
      const section = entry.section
      if (!primaryBySection.has(section)) primaryBySection.set(section, [])
      primaryBySection.get(section)!.push(entry)
    }
    for (const entry of secondary) {
      const section = entry.section
      if (!secondaryBySection.has(section)) secondaryBySection.set(section, [])
      secondaryBySection.get(section)!.push(entry)
    }

    // For each section in primary, pair with secondary
    for (const [section, primaryEntries] of primaryBySection) {
      const secondaryEntries = secondaryBySection.get(section) || []
      const category = getCategory(section)

      for (let i = 0; i < primaryEntries.length; i++) {
        const primaryEntry = primaryEntries[i]
        const secondaryEntry = secondaryEntries[i] || null

        const question_fa = primaryLang === 'fa'
          ? primaryEntry.question
          : (secondaryEntry?.question || primaryEntry.question)
        const answer_fa = primaryLang === 'fa'
          ? primaryEntry.answer
          : (secondaryEntry?.answer || primaryEntry.answer)
        const question_en = primaryLang === 'en'
          ? primaryEntry.question
          : (secondaryEntry?.question || primaryEntry.question)
        const answer_en = primaryLang === 'en'
          ? primaryEntry.answer
          : (secondaryEntry?.answer || primaryEntry.answer)

        const tags = extractTags(
          `${question_fa} ${question_en}`,
          `${answer_fa} ${answer_en}`,
          category,
        )

        result.push({
          question_fa,
          answer_fa,
          question_en,
          answer_en,
          category,
          tags,
          source: 'manual',
          is_published: true,
        })
      }
    }

    // Add remaining secondary entries that weren't paired
    const pairedSecondaryIds = new Set<string>()
    for (const [section, primaryEntries] of primaryBySection) {
      const secondaryEntries = secondaryBySection.get(section) || []
      for (let i = 0; i < Math.min(primaryEntries.length, secondaryEntries.length); i++) {
        pairedSecondaryIds.add(secondaryEntries[i].id)
      }
    }

    for (const [section, secondaryEntries] of secondaryBySection) {
      const category = getCategory(section)
      for (const entry of secondaryEntries) {
        if (pairedSecondaryIds.has(entry.id)) continue

        const question_fa = primaryLang === 'fa' ? entry.question : entry.question
        const answer_fa = primaryLang === 'fa' ? entry.answer : entry.answer
        const question_en = primaryLang === 'en' ? null : null
        const answer_en = primaryLang === 'en' ? null : null

        // These are extra Farsi-only entries
        result.push({
          question_fa: entry.question,
          answer_fa: entry.answer,
          question_en: null,
          answer_en: null,
          category,
          tags: extractTags(entry.question, entry.answer, category),
          source: 'manual',
          is_published: true,
        })
      }
    }

    return result
  }

  // Pair Part A (English) + Part C (Farsi)
  const staffEntries = pairEntries(partA, partC, 'en')
  console.log(`Paired staff entries: ${staffEntries.length}`)

  // Pair Part B (English) + Part D (Farsi)
  const patientEntries = pairEntries(partB, partD, 'en')
  console.log(`Paired patient entries: ${patientEntries.length}`)

  const allEntries = [...staffEntries, ...patientEntries]
  console.log(`Total FAQ entries to seed: ${allEntries.length}`)

  // Generate SQL
  const sql = generateSql(allEntries)

  const outputPath = resolve(__dirname, '../drizzle/seed-faq-full.sql')
  const { writeFileSync } = await import('fs')
  writeFileSync(outputPath, sql, 'utf-8')
  console.log(`SQL written to: ${outputPath}`)

  // Optionally run against database
  const shouldSeed = process.argv.includes('--seed')
  if (shouldSeed) {
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      console.error('DATABASE_URL not set. Cannot seed database.')
      process.exit(1)
    }

    console.log('Seeding database...')
    const pool = new Pool({ connectionString: dbUrl })
    try {
      await pool.query(sql)
      console.log(`Successfully seeded ${allEntries.length} FAQ entries!`)
    } catch (err: any) {
      console.error('Database seeding failed:', err.message)
      console.error('You can manually run the SQL file:')
      console.error(`  psql $DATABASE_URL -f ${outputPath}`)
    } finally {
      await pool.end()
    }
  } else {
    console.log('\nTo seed the database, run:')
    console.log(`  npx tsx scripts/seed-faq-from-markdown.ts --seed`)
    console.log(`  psql $DATABASE_URL -f ${outputPath}`)
  }
}

main().catch(console.error)

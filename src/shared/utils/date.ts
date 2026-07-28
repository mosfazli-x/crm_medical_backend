import { toJalaali, toGregorian, jalaaliMonthLength } from 'jalaali-js'

export function gregorianToJalaliStr(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const j = toJalaali(year, month, day)
  const monthNames = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
  ]
  return `${j.jd} ${monthNames[j.jm - 1]} ${j.jy}`
}

export function getTodayJalali(): string {
  const now = new Date()
  const j = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate())
  return `${j.jy}-${String(j.jm).padStart(2, '0')}-${String(j.jd).padStart(2, '0')}`
}

export function jalaliToGregorianDate(jalaliStr: string): Date {
  const [jy, jm, jd] = jalaliStr.split('-').map(Number)
  const g = toGregorian(jy, jm, jd)
  return new Date(g.gy, g.gm - 1, g.gd)
}

export function jalaliToGregorianStr(jalaliStr: string): string {
  const [jy, jm, jd] = jalaliStr.split('-').map(Number)
  const g = toGregorian(jy, jm, jd)
  return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`
}

export function getJalaliMonthRange(jalaliYear: number, jalaliMonth: number): { start: string; end: string } {
  const daysInMonth = jalaaliMonthLength(jalaliYear, jalaliMonth)
  return {
    start: `${jalaliYear}-${String(jalaliMonth).padStart(2, '0')}-01`,
    end: `${jalaliYear}-${String(jalaliMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`,
  }
}

import type { ISODate, Month } from './types'

const MONTHS_SHORT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.']
const MONTHS_LONG = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function today(): ISODate {
  return toISODate(new Date())
}

export function monthOf(date: ISODate): Month {
  return date.slice(0, 7)
}

export function isMonth(s: unknown): s is Month {
  return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s)
}

export function addMonths(m: Month, n: number): Month {
  const [y, mo] = m.split('-').map(Number)
  const idx = y * 12 + (mo - 1) + n
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`
}

/** Anzahl Monate von a bis b (b - a). */
export function diffMonths(a: Month, b: Month): number {
  const [ya, ma] = a.split('-').map(Number)
  const [yb, mb] = b.split('-').map(Number)
  return (yb - ya) * 12 + (mb - ma)
}

export function addDays(date: ISODate, n: number): ISODate {
  const d = parseISODate(date)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000)
}

export function daysInMonth(m: Month): number {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo, 0).getDate()
}

export function monthLabel(m: Month, long = false): string {
  const [y, mo] = m.split('-').map(Number)
  return `${(long ? MONTHS_LONG : MONTHS_SHORT)[mo - 1]} ${y}`
}

export function dateLabel(d: ISODate): string {
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

export function shortDateLabel(d: ISODate): string {
  const [, m, day] = d.split('-')
  return `${day}.${m}.`
}

/**
 * Budgetmonat mit frei wählbarem Monatsbeginn.
 * Beispiel Monatsbeginn 27: "2026-10" läuft vom 27.10. bis 26.11.
 */
export function periodRange(m: Month, startDay: number): { start: ISODate; end: ISODate } {
  const day = Math.min(Math.max(1, Math.round(startDay)), 28)
  const start = `${m}-${pad(day)}`
  const end = addDays(`${addMonths(m, 1)}-${pad(day)}`, -1)
  return { start, end }
}

export function periodOf(date: ISODate, startDay: number): Month {
  const day = Math.min(Math.max(1, Math.round(startDay)), 28)
  const m = monthOf(date)
  return Number(date.slice(8, 10)) >= day ? m : addMonths(m, -1)
}

/** Teilt einen Budgetzeitraum in Wochen (Mo–So, angeschnittene Wochen am Rand). */
export function weeksOfPeriod(m: Month, startDay: number): { start: ISODate; end: ISODate; days: number }[] {
  const { start, end } = periodRange(m, startDay)
  const weeks: { start: ISODate; end: ISODate; days: number }[] = []
  let cur = start
  while (cur <= end) {
    const dow = (parseISODate(cur).getDay() + 6) % 7 // 0 = Montag
    let wEnd = addDays(cur, 6 - dow)
    if (wEnd > end) wEnd = end
    weeks.push({ start: cur, end: wEnd, days: diffDays(cur, wEnd) + 1 })
    cur = addDays(wEnd, 1)
  }
  return weeks
}

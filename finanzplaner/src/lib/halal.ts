import { addDays, diffDays } from './dates'
import { round2 } from './money'
import type { ISODate, PurificationEntry } from './types'

export const ZAKAT_RATE = 0.025
/** Ein Mondjahr (Haul) hat rund 354 Tage. */
export const HAUL_DAYS = 354

export interface ZakatInput {
  nisab: number
  haulStart: ISODate | ''
  cash: number
  gold: number
  investments: number
  receivables: number
  debts: number
  today: ISODate
}

export interface ZakatResult {
  /** Zakat-pflichtiges Vermögen (Vermögen − fällige Schulden, nie negativ) */
  wealth: number
  aboveNisab: boolean
  haulEnd: ISODate | null
  haulComplete: boolean
  daysLeft: number | null
  /** 2,5 % des Vermögens, wenn über Nisab – sonst 0 */
  zakat: number
  /** Zakat ist jetzt fällig (über Nisab und Haul vollendet) */
  due: boolean
}

export function calculateZakat(i: ZakatInput): ZakatResult {
  const gross = i.cash + i.gold + i.investments + i.receivables
  const wealth = round2(Math.max(0, gross - i.debts))
  const aboveNisab = i.nisab > 0 && wealth >= i.nisab
  const haulEnd = i.haulStart ? addDays(i.haulStart, HAUL_DAYS) : null
  const daysLeft = haulEnd ? Math.max(0, diffDays(i.today, haulEnd)) : null
  const haulComplete = haulEnd !== null && i.today >= haulEnd
  const zakat = aboveNisab ? round2(wealth * ZAKAT_RATE) : 0
  return { wealth, aboveNisab, haulEnd, haulComplete, daysLeft, zakat, due: aboveNisab && haulComplete }
}

export function purificationSummary(entries: PurificationEntry[]) {
  const impure = round2(entries.filter((e) => e.type === 'unrein').reduce((s, e) => s + e.amount, 0))
  const donated = round2(entries.filter((e) => e.type === 'gespendet').reduce((s, e) => s + e.amount, 0))
  return { impure, donated, open: round2(Math.max(0, impure - donated)) }
}

export interface EtfPoint {
  year: number
  invested: number
  pessimistic: number
  normal: number
  optimistic: number
}

/** Endwert eines Sparplans mit monatlicher Einzahlung (am Monatsende) und jährlicher Rendite in Prozent. */
export function etfFutureValue(monthly: number, years: number, annualPercent: number): number {
  const months = Math.round(years * 12)
  const r = Math.pow(1 + annualPercent / 100, 1 / 12) - 1
  if (Math.abs(r) < 1e-12) return round2(monthly * months)
  return round2(monthly * ((Math.pow(1 + r, months) - 1) / r))
}

export function etfSeries(
  monthly: number,
  years: number,
  rates: { pessimistic: number; normal: number; optimistic: number },
): EtfPoint[] {
  const out: EtfPoint[] = []
  for (let y = 0; y <= Math.max(0, Math.round(years)); y++) {
    out.push({
      year: y,
      invested: round2(monthly * 12 * y),
      pessimistic: etfFutureValue(monthly, y, rates.pessimistic),
      normal: etfFutureValue(monthly, y, rates.normal),
      optimistic: etfFutureValue(monthly, y, rates.optimistic),
    })
  }
  return out
}

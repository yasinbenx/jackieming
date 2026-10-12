import { addDays, addMonths, daysInMonth, diffDays, monthOf } from './dates'
import { round2 } from './money'
import { isContractActive, monthlyAmount } from './plan'
import type { Contract, ISODate, Month, NoticeUnit } from './types'

export const NOTICE_LABEL: Record<NoticeUnit, [string, string]> = {
  tage: ['Tag', 'Tage'],
  wochen: ['Woche', 'Wochen'],
  monate: ['Monat', 'Monate'],
}

export function noticeText(c: Pick<Contract, 'noticeValue' | 'noticeUnit'>): string {
  if (!c.noticeValue) return 'jederzeit'
  const [one, many] = NOTICE_LABEL[c.noticeUnit]
  return `${c.noticeValue} ${c.noticeValue === 1 ? one : many}`
}

/** Letzter Tag, an dem gekündigt werden muss, damit der Vertrag zum Enddatum endet. */
export function cancelDeadline(c: Contract): ISODate | null {
  if (!c.endDate) return null
  const n = c.noticeValue || 0
  if (c.noticeUnit === 'tage') return addDays(c.endDate, -n)
  if (c.noticeUnit === 'wochen') return addDays(c.endDate, -7 * n)
  const m: Month = addMonths(monthOf(c.endDate), -n)
  const day = Math.min(Number(c.endDate.slice(8, 10)), daysInMonth(m))
  return `${m}-${String(day).padStart(2, '0')}`
}

export type ContractStatus = 'aktiv' | 'laeuft-bald-aus' | 'frist-bald' | 'ausgelaufen' | 'gekuendigt'

export const SOON_DAYS = 60

export function contractStatus(c: Contract, today: ISODate): ContractStatus {
  if (c.endDate && c.endDate < today) return 'ausgelaufen'
  if (c.cancelled) return 'gekuendigt'
  const deadline = cancelDeadline(c)
  if (deadline && deadline >= today && diffDays(today, deadline) <= 30) return 'frist-bald'
  if (c.endDate && diffDays(today, c.endDate) <= SOON_DAYS) return 'laeuft-bald-aus'
  return 'aktiv'
}

export function contractTotals(contracts: Contract[], m: Month) {
  const active = contracts.filter((c) => isContractActive(c, m))
  const monthly = round2(active.reduce((s, c) => s + monthlyAmount(c), 0))
  return { monthly, yearly: round2(monthly * 12), count: active.length }
}

export interface Reminder {
  contract: Contract
  deadline: ISODate
  daysLeft: number
}

/**
 * Kündigungs-Erinnerungen: alle laufenden Verträge mit Enddatum, sortiert nach Frist.
 * Fixkosten ohne Kündigungsfrist (z. B. Ratenzahlungen) enden von selbst und brauchen keine Erinnerung.
 */
export function cancelReminders(contracts: Contract[], today: ISODate): Reminder[] {
  return contracts
    .filter((c) => !c.cancelled && c.endDate && c.endDate >= today && !(c.kind === 'fix' && !c.noticeValue))
    .map((c) => {
      const deadline = cancelDeadline(c)!
      return { contract: c, deadline, daysLeft: diffDays(today, deadline) }
    })
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
}

/** Kalender-Datei (.ics) für eine Kündigungs-Erinnerung */
export function reminderIcs(r: Reminder): string {
  const d = r.deadline.replace(/-/g, '')
  const remindDay = addDays(r.deadline, -7).replace(/-/g, '')
  const uid = `${r.contract.id}-${d}@finanzplaner`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Finanzplaner//DE',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${remindDay}`,
    `SUMMARY:${r.contract.name} kündigen (Frist ${r.deadline.split('-').reverse().join('.')})`,
    'DESCRIPTION:Erinnerung aus deinem Finanzplaner.',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

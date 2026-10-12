import { describe, expect, it } from 'vitest'
import { addMonths, diffMonths, periodOf, periodRange, weeksOfPeriod } from './dates'

describe('Monatsrechnung', () => {
  it('addMonths über Jahresgrenzen', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02')
    expect(addMonths('2027-01', -1)).toBe('2026-12')
  })
  it('diffMonths', () => {
    expect(diffMonths('2026-10', '2029-12')).toBe(38)
  })
})

describe('Monatsbeginn', () => {
  it('Kalendermonat bei Tag 1', () => {
    expect(periodRange('2026-02', 1)).toEqual({ start: '2026-02-01', end: '2026-02-28' })
    expect(periodOf('2026-10-12', 1)).toBe('2026-10')
  })
  it('Gehaltsmonat ab dem 27.', () => {
    expect(periodRange('2026-10', 27)).toEqual({ start: '2026-10-27', end: '2026-11-26' })
    expect(periodOf('2026-11-05', 27)).toBe('2026-10')
    expect(periodOf('2026-11-27', 27)).toBe('2026-11')
  })
  it('Wochen decken den ganzen Zeitraum ab', () => {
    const weeks = weeksOfPeriod('2026-10', 1)
    expect(weeks[0].start).toBe('2026-10-01')
    expect(weeks.at(-1)!.end).toBe('2026-10-31')
    expect(weeks.reduce((s, w) => s + w.days, 0)).toBe(31)
  })
})

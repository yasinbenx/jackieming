import { describe, expect, it } from 'vitest'
import { calculateZakat, etfFutureValue, etfSeries, purificationSummary } from './halal'

const base = { nisab: 6000, haulStart: '2025-10-01', cash: 5000, gold: 2000, investments: 1000, receivables: 0, debts: 0, today: '2026-10-12' }

describe('Zakat', () => {
  it('2,5 % auf das Vermögen über dem Nisab nach vollendetem Haul', () => {
    const r = calculateZakat(base)
    expect(r.wealth).toBe(8000)
    expect(r.aboveNisab).toBe(true)
    expect(r.haulEnd).toBe('2026-09-20')
    expect(r.haulComplete).toBe(true)
    expect(r.zakat).toBe(200)
    expect(r.due).toBe(true)
  })
  it('unter dem Nisab keine Zakat', () => {
    const r = calculateZakat({ ...base, cash: 1000 })
    expect(r.aboveNisab).toBe(false)
    expect(r.zakat).toBe(0)
  })
  it('Schulden werden abgezogen, nie negativ', () => {
    expect(calculateZakat({ ...base, debts: 3000 }).wealth).toBe(5000)
    expect(calculateZakat({ ...base, debts: 99999 }).wealth).toBe(0)
  })
  it('Haul noch nicht vollendet', () => {
    const r = calculateZakat({ ...base, haulStart: '2026-10-01' })
    expect(r.haulComplete).toBe(false)
    expect(r.daysLeft).toBe(343)
    expect(r.due).toBe(false)
  })
  it('Nisab 0 gilt als nicht eingetragen', () => {
    expect(calculateZakat({ ...base, nisab: 0 }).aboveNisab).toBe(false)
  })
})

describe('Purification', () => {
  it('offener Betrag = unrein − gespendet', () => {
    const s = purificationSummary([
      { id: '1', date: '2026-01-01', source: 'Zinsen Tagesgeld', amount: 12.4, type: 'unrein' },
      { id: '2', date: '2026-02-01', source: 'Dividende Anteil', amount: 3.1, type: 'unrein' },
      { id: '3', date: '2026-03-01', source: 'Spende', amount: 10, type: 'gespendet' },
    ])
    expect(s).toEqual({ impure: 15.5, donated: 10, open: 5.5 })
  })
})

describe('ETF-Sparplan', () => {
  it('0 % Rendite = Summe der Einzahlungen', () => {
    expect(etfFutureValue(100, 10, 0)).toBe(12000)
  })
  it('Rendite erhöht den Endwert, Reihenfolge der Szenarien stimmt', () => {
    const s = etfSeries(100, 20, { pessimistic: 2, normal: 5, optimistic: 7 })
    const last = s.at(-1)!
    expect(last.invested).toBe(24000)
    expect(last.pessimistic).toBeGreaterThan(24000)
    expect(last.normal).toBeGreaterThan(last.pessimistic)
    expect(last.optimistic).toBeGreaterThan(last.normal)
    // 100 €/Monat, 5 % p. a., 20 Jahre ≈ 40.600 €
    expect(last.normal).toBeGreaterThan(40000)
    expect(last.normal).toBeLessThan(41500)
  })
  it('negative Rendite ist möglich', () => {
    expect(etfFutureValue(100, 5, -10)).toBeLessThan(6000)
  })
})

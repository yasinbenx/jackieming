import { describe, expect, it } from 'vitest'
import { sampleData } from './defaults'
import {
  balanceAt, fixedCostsFor, incomeFor, monthlyAmount, monthsToGoal, nextGoalReached, requiredMonthly, simulatePlan,
} from './plan'
import { basePlanInput, scenarioPlanInput } from './selectors'
import type { Goal } from './types'

const data = sampleData()
const byName = (name: string) => data.goals.find((g) => g.name === name)!

describe('Einnahmen und Fixkosten aus den Startdaten', () => {
  it('Azubi-Netto bis Januar 2027, danach 2.650 €', () => {
    expect(incomeFor(data.incomes, '2027-01')).toBe(1200)
    expect(incomeFor(data.incomes, '2027-02')).toBe(2650)
  })
  it('Handy endet im Dezember, Kronenrechnung im Januar', () => {
    expect(fixedCostsFor(data.contracts, '2026-10')).toBe(436.97)
    expect(fixedCostsFor(data.contracts, '2026-12')).toBe(436.97)
    expect(fixedCostsFor(data.contracts, '2027-01')).toBe(371.97)
    expect(fixedCostsFor(data.contracts, '2027-02')).toBe(311.97)
  })
  it('Rhythmus wird auf den Monat umgerechnet', () => {
    expect(monthlyAmount({ amount: 120, rhythm: 'jaehrlich' })).toBe(10)
    expect(monthlyAmount({ amount: 30, rhythm: 'vierteljaehrlich' })).toBe(10)
  })
})

describe('Simulation mit Prioritäten', () => {
  const res = simulatePlan(basePlanInput(data), '2026-10', 120)
  const not = byName('Notgroschen')

  it('vor Februar fließt der ganze Überschuss in den Notgroschen', () => {
    expect(res.months[0].free).toBe(263.03)
    expect(res.months[0].allocations[not.id]).toBe(263.03)
    expect(balanceAt(res, not.id, '2027-01')).toBe(1117.12)
  })
  it('ab Februar gelten die Raten, Überschuss zuerst in den Notgroschen', () => {
    const feb = res.months[4]
    expect(feb.month).toBe('2027-02')
    expect(feb.free).toBe(1838.03)
    expect(feb.allocations[not.id]).toBe(638.03)
    expect(feb.allocations[byName('Auto').id]).toBe(700)
    expect(feb.saved).toBe(1838.03)
  })
  it('Notgroschen ist im April 2027 voll und wird nie überfüllt', () => {
    expect(res.reached[not.id]).toBe('2027-04')
    expect(Math.max(...res.balances[not.id])).toBe(3000)
  })
  it('nach dem Notgroschen fließt der Rest ins nächste Ziel', () => {
    const apr = res.months[6]
    expect(apr.allocations[byName('Auto').id]).toBe(731.21)
    const mai = res.months[7]
    expect(mai.allocations[not.id]).toBeUndefined()
    expect(mai.allocations[byName('Auto').id]).toBe(700 + 500 + 138.03)
  })
  it('es wird nie mehr verteilt als frei ist', () => {
    for (const m of res.months) expect(m.saved + m.unallocated).toBeCloseTo(Math.max(0, m.free), 2)
  })
  it('Auto-Minimum wird vor dem Zielbetrag erreicht', () => {
    const auto = byName('Auto')
    expect(res.minReached[auto.id]! < res.reached[auto.id]!).toBe(true)
  })
  it('nächstes Ziel ist der Notgroschen', () => {
    const next = nextGoalReached(data.goals, res, '2026-10')!
    expect(next.goal.name).toBe('Notgroschen')
    expect(next.inMonths).toBe(6)
  })
  it('ohne Überschuss-Verteilung bleibt Geld übrig', () => {
    const r = simulatePlan({ ...basePlanInput(data), overflow: false }, '2026-10', 12)
    expect(r.months[0].saved).toBe(0)
    expect(r.months[0].unallocated).toBe(263.03)
  })
  it('bei zu wenig Geld bekommt die höchste Priorität zuerst', () => {
    const r = simulatePlan({ ...basePlanInput(data), lifeBudget: 2000 }, '2027-02', 1)
    // frei: 2650 - 311,97 - 2000 = 338,03 → alles in den Notgroschen (Rate 500)
    expect(r.months[0].allocations[not.id]).toBe(338.03)
    expect(r.months[0].saved).toBe(338.03)
  })
  it('negative Monate verteilen nichts', () => {
    const r = simulatePlan({ ...basePlanInput(data), lifeBudget: 5000 }, '2027-02', 1)
    expect(r.months[0].free).toBeLessThan(0)
    expect(r.months[0].saved).toBe(0)
  })
})

describe('Szenario', () => {
  it('Miete verzögert die Hochzeit', () => {
    const base = simulatePlan(basePlanInput(data), '2026-10', 120)
    const s = { ...data, scenario: { ...data.scenario, rent: 700, rentFrom: '2027-06' } }
    const sc = simulatePlan(scenarioPlanInput(s), '2026-10', 120)
    const h = byName('Hochzeit').id
    expect(sc.reached[h]! > base.reached[h]!).toBe(true)
    expect(balanceAt(sc, h, '2028-12')!).toBeLessThan(balanceAt(base, h, '2028-12')!)
  })
  it('Gehalts-Override ersetzt das Einkommen ab dem Monat', () => {
    const s = { ...data, scenario: { ...data.scenario, salary: 3000, salaryFrom: '2027-03' } }
    const r = simulatePlan(scenarioPlanInput(s), '2027-02', 2)
    expect(r.months[0].income).toBe(2650)
    expect(r.months[1].income).toBe(3000)
  })
})

describe('Zielrechnungen', () => {
  const goal: Goal = { ...byName('Hochzeit'), current: 1000 }
  it('nötige Monatsrate bis zum Zieldatum', () => {
    // 24.000 € in 39 Monaten (Okt. 2026 bis einschl. Dez. 2029)
    expect(requiredMonthly(goal, '2026-10')).toBe(615.39)
    expect(requiredMonthly({ ...goal, current: 30000 }, '2026-10')).toBe(0)
    expect(requiredMonthly({ ...goal, targetDate: undefined }, '2026-10')).toBeNull()
  })
  it('Monate bis zum Ziel bei fester Rate', () => {
    expect(monthsToGoal({ target: 3000, current: 0, monthlyRate: 500 })).toBe(6)
    expect(monthsToGoal({ target: 1000, current: 0, monthlyRate: 150 })).toBe(7)
    expect(monthsToGoal({ target: 1000, current: 0, monthlyRate: 0 })).toBeNull()
    expect(monthsToGoal({ target: null, current: 0, monthlyRate: 100 })).toBeNull()
  })
})

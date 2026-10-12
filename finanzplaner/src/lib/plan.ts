import { addMonths, diffMonths, monthOf } from './dates'
import { round2 } from './money'
import type { Contract, Goal, IncomePeriod, Month, Rhythm } from './types'

export const RHYTHM_FACTOR: Record<Rhythm, number> = {
  woechentlich: 52 / 12,
  monatlich: 1,
  vierteljaehrlich: 1 / 3,
  halbjaehrlich: 1 / 6,
  jaehrlich: 1 / 12,
}

export const RHYTHM_LABEL: Record<Rhythm, string> = {
  woechentlich: 'wöchentlich',
  monatlich: 'monatlich',
  vierteljaehrlich: 'vierteljährlich',
  halbjaehrlich: 'halbjährlich',
  jaehrlich: 'jährlich',
}

/** Monatlicher Gegenwert eines Vertrags (z. B. 120 € jährlich → 10 €). */
export function monthlyAmount(c: Pick<Contract, 'amount' | 'rhythm'>): number {
  return round2(c.amount * RHYTHM_FACTOR[c.rhythm])
}

export function isContractActive(c: Contract, m: Month): boolean {
  if (c.startDate && monthOf(c.startDate) > m) return false
  if (c.endDate) return monthOf(c.endDate) >= m
  // gekündigt ohne Enddatum → zählt nicht mehr
  return !c.cancelled
}

export function incomeFor(incomes: IncomePeriod[], m: Month): number {
  return round2(
    incomes.filter((i) => i.from <= m && (!i.to || i.to >= m)).reduce((s, i) => s + i.amount, 0),
  )
}

export function fixedCostsFor(contracts: Contract[], m: Month): number {
  return round2(contracts.filter((c) => isContractActive(c, m)).reduce((s, c) => s + monthlyAmount(c), 0))
}

export function isGoalDone(target: number | null, balance: number): boolean {
  return target !== null && balance >= target - 0.005
}

export function sortByPriority<T extends { priority: number }>(goals: T[]): T[] {
  return [...goals].sort((a, b) => a.priority - b.priority)
}

/** Zusätzliche Kosten in Szenarien (Miete, Studiengebühren, Auto …) */
export interface ExtraCost {
  label: string
  amount: number
  from: Month
}

export interface PlanInput {
  incomes: IncomePeriod[]
  contracts: Contract[]
  lifeBudget: number
  goals: Goal[]
  /** Überschuss automatisch ins nächste Ziel (Priorität) */
  overflow: boolean
  salaryOverride?: { amount: number; from: Month } | null
  extraCosts?: ExtraCost[]
}

export interface MonthPlan {
  month: Month
  income: number
  fixed: number
  life: number
  extra: number
  /** Einnahmen − Fixkosten − Leben − Extra */
  free: number
  /** Betrag pro Ziel-ID in diesem Monat */
  allocations: Record<string, number>
  saved: number
  /** Geld, das keinem Ziel zugeordnet wurde */
  unallocated: number
}

export interface PlanResult {
  months: MonthPlan[]
  /** Stand pro Ziel am Ende jedes Monats */
  balances: Record<string, number[]>
  /** Monat, in dem das Ziel voraussichtlich erreicht wird (null = nicht im Zeitraum) */
  reached: Record<string, Month | null>
  minReached: Record<string, Month | null>
}

export function incomeWithOverride(input: PlanInput, m: Month): number {
  const o = input.salaryOverride
  if (o && m >= o.from) return round2(o.amount)
  return incomeFor(input.incomes, m)
}

/**
 * Simuliert die Monate ab `start`.
 * Ablauf pro Monat:
 *  1. Freies Geld = Einnahmen − Fixkosten − Leben − Zusatzkosten
 *  2. Ziele bekommen ihre geplante Rate in Reihenfolge der Priorität (Notgroschen zuerst),
 *     aber nie mehr als bis zum Zielbetrag.
 *  3. Was übrig bleibt (auch die Rate fertiger Ziele), fließt ins erste noch offene Ziel
 *     nach Priorität, danach ins nächste – sofern Überschuss-Verteilung aktiv ist.
 */
export function simulatePlan(input: PlanInput, start: Month, count: number): PlanResult {
  const goals = sortByPriority(input.goals)
  const bal: Record<string, number> = {}
  const balances: Record<string, number[]> = {}
  const reached: Record<string, Month | null> = {}
  const minReached: Record<string, Month | null> = {}
  for (const g of goals) {
    bal[g.id] = g.current
    balances[g.id] = []
    reached[g.id] = isGoalDone(g.target, g.current) ? addMonths(start, -1) : null
    minReached[g.id] = g.minTarget !== undefined && g.current >= g.minTarget ? addMonths(start, -1) : null
  }
  const months: MonthPlan[] = []

  for (let i = 0; i < count; i++) {
    const m = addMonths(start, i)
    const income = incomeWithOverride(input, m)
    const fixed = fixedCostsFor(input.contracts, m)
    const life = input.lifeBudget
    const extra = round2((input.extraCosts ?? []).filter((e) => m >= e.from).reduce((s, e) => s + e.amount, 0))
    const free = round2(income - fixed - life - extra)
    let pool = Math.max(0, free)
    const allocations: Record<string, number> = {}

    const give = (g: Goal, wanted: number) => {
      const room = g.target === null ? Infinity : Math.max(0, g.target - bal[g.id])
      const amount = round2(Math.min(wanted, room, pool))
      if (amount <= 0) return
      bal[g.id] = round2(bal[g.id] + amount)
      allocations[g.id] = round2((allocations[g.id] ?? 0) + amount)
      pool = round2(pool - amount)
    }

    for (const g of goals) {
      if (g.rateFrom && m < g.rateFrom) continue
      give(g, g.monthlyRate)
    }
    if (input.overflow) {
      for (const g of goals) {
        if (pool <= 0) break
        give(g, pool)
      }
    }

    for (const g of goals) {
      balances[g.id].push(bal[g.id])
      if (reached[g.id] === null && isGoalDone(g.target, bal[g.id])) reached[g.id] = m
      if (minReached[g.id] === null && g.minTarget !== undefined && bal[g.id] >= g.minTarget - 0.005)
        minReached[g.id] = m
    }
    const saved = round2(Object.values(allocations).reduce((s, v) => s + v, 0))
    months.push({ month: m, income, fixed, life, extra, free, allocations, saved, unallocated: round2(pool) })
  }
  return { months, balances, reached, minReached }
}

/** Stand eines Ziels am Ende des Monats m laut Simulation (oder null, wenn außerhalb). */
export function balanceAt(result: PlanResult, goalId: string, m: Month): number | null {
  if (!result.months.length) return null
  const idx = diffMonths(result.months[0].month, m)
  const arr = result.balances[goalId]
  if (!arr || idx < 0) return null
  if (idx >= arr.length) return null
  return arr[idx]
}

/**
 * Wie viel muss ich pro Monat sparen, um bis zum Zielmonat (einschließlich) fertig zu sein?
 * Gibt null zurück, wenn kein Zielbetrag/Zieldatum gesetzt ist.
 */
export function requiredMonthly(goal: Pick<Goal, 'target' | 'targetDate' | 'current'>, from: Month): number | null {
  if (goal.target === null || !goal.targetDate) return null
  const remaining = goal.target - goal.current
  if (remaining <= 0) return 0
  const months = diffMonths(from, goal.targetDate) + 1
  if (months <= 0) return round2(remaining)
  return round2(Math.ceil((remaining / months) * 100) / 100)
}

/** Monate bis zum Ziel bei fester Rate, ohne Prioritäten. null = nie (Rate 0 oder offenes Ziel). */
export function monthsToGoal(goal: Pick<Goal, 'target' | 'current' | 'monthlyRate'>): number | null {
  if (goal.target === null) return null
  const remaining = goal.target - goal.current
  if (remaining <= 0) return 0
  if (goal.monthlyRate <= 0) return null
  return Math.ceil(round2(remaining / goal.monthlyRate - 1e-9))
}

/** Nächstes Ziel, das (laut Simulation) erreicht wird. */
export function nextGoalReached(
  goals: Goal[],
  result: PlanResult,
  start: Month,
): { goal: Goal; month: Month; inMonths: number } | null {
  let best: { goal: Goal; month: Month; inMonths: number } | null = null
  for (const g of goals) {
    if (isGoalDone(g.target, g.current)) continue
    const m = result.reached[g.id]
    if (!m) continue
    const inMonths = diffMonths(start, m)
    if (!best || inMonths < best.inMonths || (inMonths === best.inMonths && g.priority < best.goal.priority))
      best = { goal: g, month: m, inMonths }
  }
  return best
}

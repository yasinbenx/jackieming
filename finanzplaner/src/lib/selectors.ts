import { periodOf, periodRange } from './dates'
import { round2 } from './money'
import type { PlanInput } from './plan'
import type { AppData, Expense, Month } from './types'

export const PROJECTION_MONTHS = 120

export function currentPeriod(data: AppData, date: string): Month {
  return periodOf(date, data.settings.monthStartDay)
}

export function basePlanInput(data: AppData): PlanInput {
  return {
    incomes: data.incomes,
    contracts: data.contracts,
    lifeBudget: data.lifeBudget,
    goals: data.goals,
    overflow: data.settings.overflow,
    extraCosts: data.study.fee > 0 ? [{ label: 'Studiengebühren', amount: data.study.fee, from: data.study.from }] : [],
  }
}

export function scenarioPlanInput(data: AppData): PlanInput {
  const s = data.scenario
  const studyFee = s.studyFee ?? data.study.fee
  const extraCosts = [
    { label: 'Studiengebühren', amount: studyFee, from: data.study.from },
    { label: 'Miete', amount: s.rent, from: s.rentFrom },
    { label: 'Autokosten', amount: s.carCosts, from: s.carFrom },
  ].filter((e) => e.amount > 0)
  return {
    ...basePlanInput(data),
    lifeBudget: s.lifeBudget ?? data.lifeBudget,
    salaryOverride: s.salary !== null ? { amount: s.salary, from: s.salaryFrom } : null,
    extraCosts,
  }
}

export function expensesInPeriod(expenses: Expense[], m: Month, startDay: number): Expense[] {
  const { start, end } = periodRange(m, startDay)
  return expenses.filter((e) => e.date >= start && e.date <= end)
}

export function sumExpenses(expenses: Expense[]): number {
  return round2(expenses.reduce((s, e) => s + e.amount, 0))
}

export function accountsTotal(data: AppData): number {
  return round2(data.accounts.reduce((s, a) => s + a.balance, 0))
}

export function potsTotal(data: AppData): number {
  return round2(data.goals.reduce((s, g) => s + g.current, 0))
}

/** Ampel: Anteil des verbrauchten Budgets → grün / gelb / rot */
export type Traffic = 'green' | 'yellow' | 'red'
export function trafficLight(spent: number, budget: number): Traffic {
  if (budget <= 0) return spent > 0 ? 'red' : 'green'
  const ratio = spent / budget
  if (ratio > 1) return 'red'
  if (ratio >= 0.8) return 'yellow'
  return 'green'
}

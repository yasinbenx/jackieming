import { today } from './dates'
import type { AppData, Contract, Goal, Settings } from './types'

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export const ACCOUNT_COLORS = ['#0ea5e9', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#22c55e', '#ec4899', '#64748b']
export const GOAL_COLORS = ['#14b8a6', '#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6', '#22c55e', '#ef4444', '#64748b']

export const DEFAULT_CATEGORIES = [
  'Essen & Trinken',
  'Lebensmittel',
  'Freizeit',
  'Kleidung',
  'Unterwegs',
  'Geschenke',
  'Gesundheit',
  'Sonstiges',
]

export const DEFAULT_SETTINGS: Settings = {
  currency: 'EUR',
  monthStartDay: 1,
  theme: 'system',
  overflow: true,
  categories: DEFAULT_CATEGORIES,
}

export const DEFAULT_TODOS = [
  'Handytarif vergleichen und wechseln',
  'Daueraufträge für die Töpfe einrichten',
  'Freistellungsauftrag prüfen',
  'Notgroschen auf eigenes Unterkonto legen',
  'Steuer-ID und Unterlagen für die Steuererklärung sammeln',
]

/** Leerer Zustand – für "Alles zurücksetzen" ohne Beispieldaten. */
export function emptyData(): AppData {
  return {
    version: 1,
    accounts: [],
    incomes: [],
    contracts: [],
    lifeBudget: 0,
    study: { fee: 0, from: '2027-10' },
    expenses: [],
    goals: [],
    wishes: [],
    todos: [],
    checkIns: [],
    halal: {
      nisab: 0,
      haulStart: '',
      zakatAssets: { cash: 0, gold: 0, investments: 0, receivables: 0, debts: 0 },
      useAccountBalances: true,
      purification: [],
      etf: { monthly: 100, years: 20, pessimistic: 2, normal: 5, optimistic: 7 },
    },
    scenario: {
      salary: null,
      salaryFrom: '2027-02',
      studyFee: null,
      rent: 0,
      rentFrom: '2028-01',
      carCosts: 0,
      carFrom: '2028-01',
      lifeBudget: null,
    },
    settings: { ...DEFAULT_SETTINGS, categories: [...DEFAULT_CATEGORIES] },
  }
}

/** Beispieldaten laut Startplan – alles im Interface änderbar. */
export function sampleData(): AppData {
  const d = emptyData()
  const now = today()
  d.accounts = [
    { id: 'db', name: 'Deutsche Bank', purpose: 'Gehalt und Fixkosten', balance: 0, color: '#0ea5e9', updatedAt: now },
    { id: 'c24', name: 'C24', purpose: 'Alltag und Spaß', balance: 0, color: '#14b8a6', updatedAt: now },
    { id: 'tr', name: 'Trade Republic', purpose: 'Nur langfristiges Investieren', balance: 0, color: '#8b5cf6', updatedAt: now },
  ]
  d.incomes = [
    { id: uid(), label: 'Azubi-Netto', amount: 1200, from: '2026-01', to: '2027-01' },
    { id: uid(), label: 'Netto-Gehalt', amount: 2650, from: '2027-02' },
  ]
  const c = (
    name: string,
    amount: number,
    kind: Contract['kind'],
    extra: Partial<Contract> = {},
  ): Contract => ({
    id: uid(),
    name,
    amount,
    rhythm: 'monatlich',
    accountId: 'db',
    kind,
    noticeValue: kind === 'abo' ? 1 : 0,
    noticeUnit: 'monate',
    cancelled: false,
    ...extra,
  })
  d.contracts = [
    c('Vater', 200, 'fix'),
    c('Handy', 65, 'fix', { endDate: '2026-12-31', noticeValue: 3 }),
    c('Handy Bruder', 10, 'fix'),
    c('DB-Ticket', 60, 'abo', { noticeValue: 1 }),
    c('Kronenrechnung', 60, 'fix', { endDate: '2027-01-31' }),
    c('Disney+', 8.99, 'abo'),
    c('iCloud', 9.99, 'abo', { noticeValue: 0 }),
    c('Claude', 20, 'abo', { noticeValue: 0 }),
    c('Snapchat+', 2.99, 'abo', { noticeValue: 0 }),
  ]
  d.lifeBudget = 500
  const g = (
    name: string,
    emoji: string,
    priority: number,
    extra: Partial<Goal>,
  ): Goal => ({
    id: uid(),
    name,
    emoji,
    target: null,
    current: 0,
    monthlyRate: 0,
    priority,
    color: GOAL_COLORS[(priority - 1) % GOAL_COLORS.length],
    accountId: 'c24',
    ...extra,
  })
  d.goals = [
    g('Notgroschen', '🛟', 1, { target: 3000, monthlyRate: 500, rateFrom: '2027-02' }),
    g('Auto', '🚗', 2, {
      target: 10000,
      minTarget: 5000,
      targetDate: '2027-12',
      monthlyRate: 700,
      rateFrom: '2027-02',
      note: 'Bar angespart, 5.000 bis 10.000 €',
    }),
    g('Urlaub', '🏖️', 3, { target: 1000, monthlyRate: 150, rateFrom: '2027-02' }),
    g('Hochzeit', '💍', 4, { target: 25000, targetDate: '2029-12', monthlyRate: 250, rateFrom: '2027-02' }),
    g('Studium', '🎓', 5, {
      target: 1000,
      targetDate: '2027-10',
      monthlyRate: 0,
      note: 'Rücklage zum Studienstart. Gebühren pro Monat unter Monatsbudget.',
    }),
    g('Langfristig investieren', '📈', 6, { monthlyRate: 100, rateFrom: '2027-02', accountId: 'tr' }),
  ]
  d.todos = DEFAULT_TODOS.map((text) => ({ id: uid(), text, done: false }))
  return d
}

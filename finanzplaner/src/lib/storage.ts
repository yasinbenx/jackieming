import { emptyData } from './defaults'
import type { AppData } from './types'

export const STORAGE_KEY = 'finanzplaner:v1'

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Prüft importierte oder gespeicherte Daten und füllt fehlende Felder mit Standardwerten.
 * Wirft einen Fehler mit verständlicher Meldung, wenn die Datei nicht passt.
 */
export function normalizeData(raw: unknown): AppData {
  if (!isObj(raw)) throw new Error('Die Datei enthält keine gültigen Finanzplaner-Daten.')
  if (raw.version !== undefined && raw.version !== 1)
    throw new Error('Diese Datei stammt aus einer unbekannten Version des Finanzplaners.')
  const base = emptyData()
  const arrays = ['accounts', 'incomes', 'contracts', 'expenses', 'goals', 'wishes', 'todos', 'checkIns'] as const
  const known = [...arrays, 'halal', 'scenario', 'settings', 'lifeBudget', 'study']
  if (!known.some((k) => k in raw)) throw new Error('Die Datei enthält keine gültigen Finanzplaner-Daten.')
  for (const k of arrays) {
    if (raw[k] !== undefined && !Array.isArray(raw[k])) throw new Error(`Feld "${k}" ist beschädigt.`)
  }
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
  const halal = isObj(raw.halal) ? raw.halal : {}
  return {
    version: 1,
    accounts: (raw.accounts as AppData['accounts']) ?? base.accounts,
    incomes: (raw.incomes as AppData['incomes']) ?? base.incomes,
    contracts: (raw.contracts as AppData['contracts']) ?? base.contracts,
    lifeBudget: Math.max(0, num(raw.lifeBudget, base.lifeBudget)),
    study: { ...base.study, ...(isObj(raw.study) ? (raw.study as Partial<AppData['study']>) : {}) },
    expenses: (raw.expenses as AppData['expenses']) ?? base.expenses,
    goals: (raw.goals as AppData['goals']) ?? base.goals,
    wishes: (raw.wishes as AppData['wishes']) ?? base.wishes,
    todos: (raw.todos as AppData['todos']) ?? base.todos,
    checkIns: (raw.checkIns as AppData['checkIns']) ?? base.checkIns,
    halal: {
      ...base.halal,
      ...(halal as Partial<AppData['halal']>),
      zakatAssets: { ...base.halal.zakatAssets, ...(isObj(halal.zakatAssets) ? halal.zakatAssets : {}) },
      etf: { ...base.halal.etf, ...(isObj(halal.etf) ? halal.etf : {}) },
      purification: Array.isArray(halal.purification) ? (halal.purification as AppData['halal']['purification']) : [],
    },
    scenario: { ...base.scenario, ...(isObj(raw.scenario) ? (raw.scenario as Partial<AppData['scenario']>) : {}) },
    settings: {
      ...base.settings,
      ...(isObj(raw.settings) ? (raw.settings as Partial<AppData['settings']>) : {}),
    },
  }
}

export function loadData(): AppData | null {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (!s) return null
    return normalizeData(JSON.parse(s))
  } catch {
    return null
  }
}

export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function parseImport(text: string): AppData {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.')
  }
  return normalizeData(raw)
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV mit Semikolon und Dezimalkomma – öffnet sich in deutschem Excel/Numbers direkt richtig. */
export function toCSV(headers: string[], rows: unknown[][]): string {
  return '﻿' + [headers, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n')
}

export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

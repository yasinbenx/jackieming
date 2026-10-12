let currentCurrency = 'EUR'

export function setCurrency(c: string) {
  currentCurrency = c
}

export function formatMoney(value: number, opts: { decimals?: boolean; currency?: string } = {}): string {
  const decimals = opts.decimals ?? !Number.isInteger(round2(value))
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: opts.currency ?? currentCurrency,
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(value)
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(value)
}

export function formatPercent(value: number, decimals = 0): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Liest Beträge so, wie man sie in Deutschland tippt:
 * "8,99" · "1.234,56" · "1234.5" · "1 200" · "-5" → Zahl, sonst null.
 */
export function parseAmount(input: string): number | null {
  let s = input.trim().replace(/\s|€/g, '')
  if (!s) return null
  if (!/^-?[\d.,]+$/.test(s)) return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    // das letzte Trennzeichen ist das Dezimaltrennzeichen
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (lastComma >= 0) {
    if ((s.match(/,/g) ?? []).length > 1) return null
    s = s.replace(',', '.')
  } else if (lastDot >= 0) {
    const parts = s.split('.')
    // "1.200" oder "1.200.000" → Tausenderpunkte
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].replace('-', '').length > 0)) {
      if (parts.slice(1).every((p) => p.length === 3)) s = parts.join('')
      else if (parts.length > 2) return null
    }
  }
  const n = Number(s)
  return Number.isFinite(n) ? round2(n) : null
}

export type AmountCheck = { ok: true; value: number } | { ok: false; error: string }

/** Prüft Pflicht-Beträge: nicht leer, gültige Zahl, nicht negativ. */
export function validateAmount(input: string, opts: { allowZero?: boolean; max?: number } = {}): AmountCheck {
  if (!input.trim()) return { ok: false, error: 'Bitte einen Betrag eingeben.' }
  const v = parseAmount(input)
  if (v === null) return { ok: false, error: 'Bitte eine gültige Zahl eingeben, z. B. 12,50.' }
  if (v < 0) return { ok: false, error: 'Der Betrag darf nicht negativ sein.' }
  if (v === 0 && !opts.allowZero) return { ok: false, error: 'Der Betrag muss größer als 0 sein.' }
  if (opts.max !== undefined && v > opts.max) return { ok: false, error: `Höchstens ${formatNumber(opts.max)}.` }
  return { ok: true, value: v }
}

/** Zahl für Eingabefelder: 8.99 → "8,99" */
export function toInputString(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return ''
  return String(round2(n)).replace('.', ',')
}

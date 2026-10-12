import type { CSSProperties } from 'react'
import { formatMoney } from '../lib/money'

export const tooltipStyle: CSSProperties = {
  background: 'var(--chart-tooltip-bg)',
  border: '1px solid var(--chart-tooltip-border)',
  borderRadius: 12,
  fontSize: 13,
  boxShadow: '0 4px 16px rgb(0 0 0 / 0.08)',
}

export const axisProps = {
  stroke: 'var(--chart-text)',
  tick: { fill: 'var(--chart-text)', fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const

export const moneyTooltip = (v: unknown) => formatMoney(Number(v))

/** Kurze Achsen-Beschriftung: 12500 → "12,5 Tsd." */
export function compactMoney(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Tsd.`
  return `${Math.round(v)}`
}

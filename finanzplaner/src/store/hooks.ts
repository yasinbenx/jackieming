import { useMemo } from 'react'
import { today } from '../lib/dates'
import { simulatePlan, type PlanResult } from '../lib/plan'
import { basePlanInput, currentPeriod, PROJECTION_MONTHS } from '../lib/selectors'
import type { Month } from '../lib/types'
import { useStore } from './store'

/** Aktueller Budgetmonat und die Hochrechnung aller Ziele ab diesem Monat. */
export function usePlan(): { now: string; period: Month; result: PlanResult } {
  const { data } = useStore()
  const now = today()
  const period = currentPeriod(data, now)
  const result = useMemo(() => simulatePlan(basePlanInput(data), period, PROJECTION_MONTHS), [data, period])
  return { now, period, result }
}

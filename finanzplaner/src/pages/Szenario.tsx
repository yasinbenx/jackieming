import { AlertTriangle, RotateCcw } from 'lucide-react'
import { useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisProps, compactMoney, moneyTooltip, tooltipStyle } from '../components/charts'
import LiveAmount from '../components/LiveAmount'
import { Badge, Button, Callout, Card, Money, PageHeader, TextInput } from '../components/ui'
import { addMonths, diffMonths, isMonth, monthLabel } from '../lib/dates'
import { emptyData } from '../lib/defaults'
import { formatMoney, round2 } from '../lib/money'
import { balanceAt, incomeFor, isGoalDone, simulatePlan, sortByPriority } from '../lib/plan'
import { scenarioPlanInput, PROJECTION_MONTHS } from '../lib/selectors'
import type { Month, Scenario } from '../lib/types'
import { usePlan } from '../store/hooks'
import { useStore } from '../store/store'

function MonthField({ label, value, onChange }: { label: string; value: Month; onChange: (m: Month) => void }) {
  return <TextInput label={label} type="month" value={value} onChange={(e) => isMonth(e.target.value) && onChange(e.target.value)} />
}

export default function Szenario() {
  const { data, update } = useStore()
  const { period, result: base } = usePlan()
  const s = data.scenario
  const set = (patch: Partial<Scenario>) => update((d) => { d.scenario = { ...d.scenario, ...patch } })

  const sc = useMemo(() => simulatePlan(scenarioPlanInput(data), period, PROJECTION_MONTHS), [data, period])
  const goals = sortByPriority(data.goals)
  const firstDeficit = sc.months.find((m) => m.free < 0)
  const deficitCount = sc.months.filter((m) => m.free < 0).length
  const changed =
    s.salary !== null || s.studyFee !== null || s.rent > 0 || s.carCosts > 0 || s.lifeBudget !== null

  // Vergleichsmonat für "freies Geld": der späteste Startmonat aller Änderungen
  const refMonth = [period, s.salary !== null ? s.salaryFrom : period, s.rent > 0 ? s.rentFrom : period, s.carCosts > 0 ? s.carFrom : period, (s.studyFee ?? data.study.fee) > 0 ? data.study.from : period]
    .filter((m) => m >= period)
    .sort()
    .at(-1)!
  const ri = Math.min(diffMonths(period, refMonth), PROJECTION_MONTHS - 1)

  const chartData = useMemo(() => {
    let a = 0
    let b = 0
    return Array.from({ length: 60 }, (_, i) => {
      a += base.months[i]?.saved ?? 0
      b += sc.months[i]?.saved ?? 0
      return { label: monthLabel(addMonths(period, i)), plan: round2(a), szenario: round2(b) }
    })
  }, [base, sc, period])

  const reachedText = (m: Month | null, done: boolean) => (done ? 'erreicht' : m ? monthLabel(m) : 'nicht in 10 J.')

  return (
    <div className="space-y-4">
      <PageHeader
        title="Was wäre wenn?"
        subtitle="Spiel Veränderungen durch – dein echter Plan bleibt unverändert."
        action={
          changed && (
            <Button variant="secondary" onClick={() => set({ ...emptyData().scenario })}>
              <RotateCcw size={16} /> <span className="hidden sm:inline">Zurücksetzen</span>
            </Button>
          )
        }
      />

      <Card title="Annahmen">
        <div className="grid gap-4 sm:grid-cols-2">
          <LiveAmount
            label="Netto-Gehalt pro Monat"
            value={s.salary}
            nullable
            placeholder={`wie geplant (${formatMoney(incomeFor(data.incomes, s.salaryFrom))})`}
            onChange={(v) => set({ salary: v })}
          />
          <MonthField label="Gehalt ab" value={s.salaryFrom} onChange={(m) => set({ salaryFrom: m })} />
          <LiveAmount
            label="Studiengebühren pro Monat"
            value={s.studyFee}
            nullable
            placeholder={`wie geplant (${formatMoney(data.study.fee)})`}
            hint={`ab ${monthLabel(data.study.from)} (Start änderst du im Budget)`}
            onChange={(v) => set({ studyFee: v })}
          />
          <LiveAmount
            label="Alltag & Spaß pro Monat"
            value={s.lifeBudget}
            nullable
            placeholder={`wie geplant (${formatMoney(data.lifeBudget)})`}
            onChange={(v) => set({ lifeBudget: v })}
          />
          <LiveAmount label="Auszug: Warmmiete pro Monat" value={s.rent} onChange={(v) => set({ rent: v ?? 0 })} placeholder="0" />
          <MonthField label="Auszug ab" value={s.rentFrom} onChange={(m) => set({ rentFrom: m })} />
          <LiveAmount label="Autokosten pro Monat" value={s.carCosts} onChange={(v) => set({ carCosts: v ?? 0 })} placeholder="0" hint="Versicherung, Steuer, Sprit, Rücklage Reparaturen" />
          <MonthField label="Auto ab" value={s.carFrom} onChange={(m) => set({ carFrom: m })} />
        </div>
      </Card>

      {firstDeficit && (
        <Callout tone="danger" icon={<AlertTriangle size={18} />}>
          Ab {monthLabel(firstDeficit.month, true)} reicht das Geld nicht mehr: Es fehlen {formatMoney(-firstDeficit.free)} pro Monat
          {deficitCount > 1 && ` (in ${deficitCount} Monaten)`}. In diesen Monaten wird nichts gespart.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Frei zum Sparen · {monthLabel(refMonth)}</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <Money value={Math.max(0, sc.months[ri].free)} className="text-2xl font-bold" />
            <span className="text-sm text-slate-500">statt <Money value={Math.max(0, base.months[ri].free)} /></span>
          </div>
        </Card>
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Gespart in 5 Jahren</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <Money value={chartData.at(-1)!.szenario} className="text-2xl font-bold" />
            <span className="text-sm text-slate-500">statt <Money value={chartData.at(-1)!.plan} /></span>
          </div>
        </Card>
      </div>

      <Card title="Auswirkung auf deine Ziele">
        {goals.length === 0 ? (
          <p className="text-sm text-slate-500">Lege zuerst Sparziele an.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {goals.map((g) => {
              const done = isGoalDone(g.target, g.current)
              const a = base.reached[g.id]
              const b = sc.reached[g.id]
              const delay = a && b ? diffMonths(a, b) : null
              const atDate = g.targetDate
              const baseAt = atDate ? balanceAt(base, g.id, atDate) : null
              const scAt = atDate ? balanceAt(sc, g.id, atDate) : null
              return (
                <li key={g.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{g.emoji} {g.name}</span>
                    {g.target !== null && !done && (
                      delay === null ? (b ? <Badge tone="green">früher</Badge> : a ? <Badge tone="red">nicht mehr erreichbar</Badge> : null)
                      : delay > 0 ? <Badge tone="red">{delay} Mon. später</Badge>
                      : delay < 0 ? <Badge tone="green">{-delay} Mon. früher</Badge>
                      : <Badge>unverändert</Badge>
                    )}
                  </div>
                  {g.target !== null && (
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Erreicht: {reachedText(a, done)} → <b className="text-slate-900 dark:text-slate-100">{reachedText(b, done)}</b>
                    </div>
                  )}
                  {atDate && baseAt !== null && scAt !== null && (
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Stand bis {monthLabel(atDate, true)}: <Money value={baseAt} /> → <b className="text-slate-900 dark:text-slate-100"><Money value={scAt} /></b>
                      {g.target !== null && <> von <Money value={g.target} /></>}
                    </div>
                  )}
                  {g.target === null && (
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Stand in 5 Jahren: <Money value={base.balances[g.id][59]} /> → <b className="text-slate-900 dark:text-slate-100"><Money value={sc.balances[g.id][59]} /></b>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card title="Gespartes Geld insgesamt">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={28} />
              <YAxis {...axisProps} tickFormatter={compactMoney} width={72} />
              <Tooltip contentStyle={tooltipStyle} formatter={moneyTooltip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="plan" name="Aktueller Plan" stroke="var(--chart-text)" strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="szenario" name="Szenario" stroke="var(--chart-save)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}

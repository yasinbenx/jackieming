import { AlertTriangle, ArrowRight, CalendarCheck, PartyPopper, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisProps, compactMoney, moneyTooltip, tooltipStyle } from '../components/charts'
import { Badge, Callout, Card, EmptyState, Money, PageHeader, Progress, Stat } from '../components/ui'
import { addMonths, diffDays, monthLabel, periodRange, shortDateLabel } from '../lib/dates'
import { formatMoney, round2 } from '../lib/money'
import { isGoalDone, nextGoalReached, sortByPriority } from '../lib/plan'
import { accountsTotal, expensesInPeriod, potsTotal, sumExpenses, trafficLight } from '../lib/selectors'
import { usePlan } from '../store/hooks'
import { useStore } from '../store/store'

const CHART_MONTHS = 24

export default function Dashboard() {
  const { data } = useStore()
  const { now, period, result } = usePlan()
  const startDay = data.settings.monthStartDay
  const spent = sumExpenses(expensesInPeriod(data.expenses, period, startDay))
  const left = round2(data.lifeBudget - spent)
  const tone = trafficLight(spent, data.lifeBudget)
  const { end } = periodRange(period, startDay)
  const daysLeft = Math.max(1, diffDays(now, end) + 1)
  const thisMonth = result.months[0]
  const total = accountsTotal(data)
  const pots = potsTotal(data)
  const next = nextGoalReached(data.goals, result, period)
  const lastCheckIn = data.checkIns.at(-1)
  const daysSinceCheckIn = lastCheckIn ? diffDays(lastCheckIn.date, now) : null

  const chartData = useMemo(() => {
    const rows: { label: string; ist?: number; plan?: number }[] = []
    for (const c of data.checkIns.slice(-12)) rows.push({ label: shortDateLabel(c.date), ist: c.accountsTotal })
    rows.push({ label: 'Heute', ist: total, plan: total })
    let acc = total
    for (let i = 0; i < CHART_MONTHS; i++) {
      acc = round2(acc + (result.months[i]?.saved ?? 0))
      rows.push({ label: monthLabel(addMonths(period, i)), plan: acc })
    }
    return rows
  }, [data.checkIns, total, result, period])

  const goals = sortByPriority(data.goals)

  return (
    <div className="space-y-4">
      <PageHeader title="Übersicht" subtitle={`${monthLabel(period, true)} · alles auf einen Blick`} />

      {data.incomes.length === 0 && (
        <Card title="Willkommen! So startest du in 3 Schritten">
          <ol className="space-y-2">
            {[
              { href: '#/konten', text: 'Konten anlegen und Kontostände eintragen', done: data.accounts.length > 0 },
              { href: '#/budget', text: 'Netto-Gehalt und Alltagsbudget eintragen (Budget → Planung)', done: data.incomes.length > 0 },
              { href: '#/ziele', text: 'Sparziele anlegen – Notgroschen zuerst', done: data.goals.length > 0 },
            ].map((s, i) => (
              <li key={s.href}>
                <a href={s.href} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${s.done ? 'bg-emerald-500 text-white' : 'bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-300'}`}>
                    {s.done ? '✓' : i + 1}
                  </span>
                  <span className="flex-1">{s.text}</span>
                  <ArrowRight size={16} className="text-slate-400" />
                </a>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-slate-500">Oder lade unter Einstellungen die Beispieldaten.</p>
        </Card>
      )}

      {thisMonth && thisMonth.free < 0 && (
        <Callout tone="danger" icon={<AlertTriangle size={18} />}>
          Dein Plan geht diesen Monat nicht auf: Es fehlen <b>{formatMoney(-thisMonth.free)}</b>. Prüfe Fixkosten oder das Alltagsbudget.
        </Callout>
      )}

      {/* Verfügbares Geld */}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Stat
            label={`Noch verfügbar im ${monthLabel(period, true).split(' ')[0]}`}
            value={<Money value={left} />}
            tone={tone}
            hint={
              left > 0
                ? `≈ ${formatMoney(round2(left / daysLeft))} pro Tag für die restlichen ${daysLeft} Tage`
                : left === 0
                  ? 'Alltagsbudget genau aufgebraucht'
                  : 'Alltagsbudget überzogen'
            }
          />
          <div className="text-sm text-slate-500 sm:text-right dark:text-slate-400">
            <div>
              ausgegeben <Money value={spent} className="font-semibold text-slate-900 dark:text-slate-100" />
            </div>
            <div>von <Money value={data.lifeBudget} /> für Alltag & Spaß</div>
          </div>
        </div>
        <Progress className="mt-4 h-3" value={spent} max={data.lifeBudget} tone={tone} />
        <div className="mt-3 flex justify-end">
          <a href="#/budget" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 dark:text-brand-300">
            Zum Budget <ArrowRight size={16} />
          </a>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><Stat label="Konten gesamt" value={<Money value={total} />} /></Card>
        <Card><Stat label="In Töpfen" value={<Money value={pots} />} /></Card>
        <Card><Stat label="Sparen diesen Monat" value={<Money value={thisMonth?.saved ?? 0} />} tone="brand" /></Card>
        <Card>
          <Stat
            label="Einnahmen"
            value={<Money value={thisMonth?.income ?? 0} />}
            hint={thisMonth ? `Fixkosten ${formatMoney(thisMonth.fixed)}` : undefined}
          />
        </Card>
      </div>

      {/* Nächstes Ziel */}
      {next ? (
        <Card className="bg-gradient-to-br from-brand-600 to-brand-800 text-white dark:from-brand-700 dark:to-brand-900 dark:border-brand-800">
          <div className="flex items-center gap-4">
            <div className="text-4xl" aria-hidden>{next.goal.emoji}</div>
            <div>
              <div className="text-sm text-brand-100">Nächstes Ziel</div>
              <div className="text-xl font-bold">
                {next.goal.name}{' '}
                {next.inMonths <= 0 ? 'noch diesen Monat erreicht' : `erreicht in ${next.inMonths} ${next.inMonths === 1 ? 'Monat' : 'Monaten'}`}
              </div>
              <div className="text-sm text-brand-100">voraussichtlich {monthLabel(next.month, true)}</div>
            </div>
          </div>
        </Card>
      ) : data.goals.length > 0 && data.goals.every((g) => isGoalDone(g.target, g.current) || g.target === null) ? (
        <Callout tone="success" icon={<PartyPopper size={18} />}>Alle Ziele mit Zielbetrag sind erreicht. Stark!</Callout>
      ) : null}

      {daysSinceCheckIn === null || daysSinceCheckIn >= 7 ? (
        <a href="#/checkin" className="block">
          <Callout tone="info" icon={<CalendarCheck size={18} />}>
            {daysSinceCheckIn === null
              ? 'Mach deinen ersten Wochen-Check-in – 10 Minuten, danach hast du wieder den Überblick.'
              : `Dein letzter Check-in ist ${daysSinceCheckIn} Tage her. Zeit für ein kurzes Update!`}
          </Callout>
        </a>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Sparziele */}
        <Card title="Sparziele" action={<a href="#/ziele" className="text-sm font-medium text-brand-700 dark:text-brand-300">Alle</a>}>
          {goals.length === 0 ? (
            <EmptyState title="Noch keine Sparziele" text="Lege einen Topf an, z. B. Notgroschen oder Urlaub." action={<a href="#/ziele" className="text-brand-700 dark:text-brand-300">Ziel anlegen</a>} />
          ) : (
            <ul className="space-y-4">
              {goals.map((g) => {
                const reached = result.reached[g.id]
                return (
                  <li key={g.id}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">
                        <span aria-hidden>{g.emoji}</span> {g.name}
                      </span>
                      <span className="tabular text-slate-500 dark:text-slate-400">
                        <Money value={g.current} className="font-semibold text-slate-900 dark:text-slate-100" />
                        {g.target !== null && <> / <Money value={g.target} /></>}
                      </span>
                    </div>
                    <Progress value={g.current} max={g.target ?? Math.max(g.current, 1)} color={g.color} />
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {g.target === null
                        ? 'offenes Ziel'
                        : isGoalDone(g.target, g.current)
                          ? 'erreicht ✓'
                          : reached
                            ? `voraussichtlich ${monthLabel(reached)}`
                            : 'mit aktuellem Plan nicht in Sicht'}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* Konten */}
        <Card title="Konten" action={<a href="#/konten" className="text-sm font-medium text-brand-700 dark:text-brand-300">Bearbeiten</a>}>
          {data.accounts.length === 0 ? (
            <EmptyState title="Noch keine Konten" text="Füge deine Konten hinzu, um den Gesamtstand zu sehen." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.accounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: a.color }} />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{a.name}</div>
                      <div className="truncate text-xs text-slate-500 dark:text-slate-400">{a.purpose}</div>
                    </div>
                  </div>
                  <Money value={a.balance} className="font-semibold" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Vermögensentwicklung */}
      <Card
        title="Vermögensentwicklung"
        action={<Badge tone="brand"><Sparkles size={12} /> Plan {CHART_MONTHS} Monate</Badge>}
      >
        {chartData.every((r) => !r.plan && !r.ist) ? (
          <EmptyState title="Noch keine Entwicklung" text="Sobald du Kontostände, Einnahmen und Sparziele eingetragen hast, siehst du hier, wie dein Vermögen wächst." />
        ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="planFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-save)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-save)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
              <YAxis {...axisProps} tickFormatter={compactMoney} width={72} />
              <Tooltip contentStyle={tooltipStyle} formatter={moneyTooltip} />
              <Area type="monotone" dataKey="plan" name="Plan" stroke="var(--chart-save)" strokeWidth={2} strokeDasharray="5 4" fill="url(#planFill)" isAnimationActive={false} />
              <Area type="monotone" dataKey="ist" name="Ist (Check-ins)" stroke="var(--chart-fix)" strokeWidth={2.5} fill="transparent" dot={{ r: 3 }} isAnimationActive={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        )}
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Blau: deine Kontostände aus den Check-ins. Grün gestrichelt: so wächst dein Vermögen, wenn du den Plan einhältst
          ({formatMoney(chartData.at(-1)?.plan ?? 0)} bis {monthLabel(addMonths(period, CHART_MONTHS - 1))}).
        </p>
      </Card>
    </div>
  )
}

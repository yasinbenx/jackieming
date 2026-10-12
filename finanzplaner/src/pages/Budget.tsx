import { AlertTriangle, Pencil, Plus, Receipt, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import ExpenseForm from '../components/ExpenseForm'
import { moneyTooltip, tooltipStyle } from '../components/charts'
import {
  AmountInput, Badge, Button, Callout, Card, ConfirmDialog, EmptyState, IconButton, InlineAmount, Modal, Money, MonthSwitcher,
  PageHeader, Progress, Segmented, TextInput, cx,
} from '../components/ui'
import { dateLabel, diffMonths, isMonth, monthLabel, periodRange, shortDateLabel, weeksOfPeriod } from '../lib/dates'
import { uid } from '../lib/defaults'
import { formatMoney, formatPercent, round2, toInputString, validateAmount } from '../lib/money'
import { isContractActive, monthlyAmount, simulatePlan, sortByPriority } from '../lib/plan'
import { basePlanInput, expensesInPeriod, sumExpenses, trafficLight } from '../lib/selectors'
import type { Expense, IncomePeriod, Month } from '../lib/types'
import { usePlan } from '../store/hooks'
import { useStore } from '../store/store'

type Tab = 'ueberblick' | 'ausgaben' | 'planung'

function IncomeForm({ income, onClose }: { income?: IncomePeriod; onClose: () => void }) {
  const { update } = useStore()
  const [label, setLabel] = useState(income?.label ?? 'Netto-Gehalt')
  const [amount, setAmount] = useState(income ? toInputString(income.amount) : '')
  const [from, setFrom] = useState(income?.from ?? '')
  const [to, setTo] = useState(income?.to ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = () => {
    const e: Record<string, string> = {}
    const a = validateAmount(amount)
    if (!a.ok) e.amount = a.error
    if (!label.trim()) e.label = 'Bitte eine Bezeichnung eingeben.'
    if (!isMonth(from)) e.from = 'Bitte einen Startmonat wählen.'
    if (to && isMonth(from) && to < from) e.to = 'Das Ende liegt vor dem Start.'
    setErrors(e)
    if (Object.keys(e).length || !a.ok) return
    const item: IncomePeriod = { id: income?.id ?? uid(), label: label.trim(), amount: a.value, from, to: to || undefined }
    update((d) => {
      const i = d.incomes.findIndex((x) => x.id === item.id)
      if (i >= 0) d.incomes[i] = item
      else d.incomes.push(item)
      d.incomes.sort((x, y) => x.from.localeCompare(y.from))
    })
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={income ? 'Einnahme bearbeiten' : 'Einnahme hinzufügen'}
      footer={<><Button variant="secondary" onClick={onClose}>Abbrechen</Button><Button onClick={save}>Speichern</Button></>}
    >
      <div className="space-y-4">
        <TextInput label="Bezeichnung" value={label} onChange={(e) => setLabel(e.target.value)} error={errors.label} maxLength={40} />
        <AmountInput label="Netto pro Monat" value={amount} onChange={setAmount} error={errors.amount} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Ab Monat" type="month" value={from} onChange={(e) => setFrom(e.target.value)} error={errors.from} />
          <TextInput label="Bis Monat (optional)" type="month" value={to} onChange={(e) => setTo(e.target.value)} error={errors.to} hint="Leer = unbegrenzt" />
        </div>
      </div>
    </Modal>
  )
}

export default function Budget() {
  const { data, update } = useStore()
  const { period, result, now } = usePlan()
  const [month, setMonth] = useState<Month>(period)
  const [tab, setTab] = useState<Tab>('ueberblick')
  const [expenseEdit, setExpenseEdit] = useState<Expense | 'new' | null>(null)
  const [incomeEdit, setIncomeEdit] = useState<IncomePeriod | 'new' | null>(null)
  const [deleteIncome, setDeleteIncome] = useState<IncomePeriod | null>(null)
  const startDay = data.settings.monthStartDay

  const idx = diffMonths(period, month)
  const isPlanMonth = idx >= 0 && idx < result.months.length
  const mp = useMemo(
    () => (isPlanMonth ? result.months[idx] : simulatePlan(basePlanInput(data), month, 1).months[0]),
    [isPlanMonth, result, idx, data, month],
  )
  const range = periodRange(month, startDay)
  const monthExpenses = useMemo(
    () => expensesInPeriod(data.expenses, month, startDay).sort((a, b) => b.date.localeCompare(a.date)),
    [data.expenses, month, startDay],
  )
  const spent = sumExpenses(monthExpenses)
  const tone = trafficLight(spent, mp.life)

  const pie = [
    { name: 'Fixkosten', value: round2(mp.fixed + mp.extra), color: 'var(--chart-fix)' },
    { name: 'Sparen', value: mp.saved, color: 'var(--chart-save)' },
    { name: 'Leben', value: mp.life, color: 'var(--chart-life)' },
    { name: 'Nicht verteilt', value: mp.unallocated, color: '#94a3b8' },
  ].filter((p) => p.value > 0)
  const pieTotal = pie.reduce((s, p) => s + p.value, 0)

  const weeks = weeksOfPeriod(month, startDay)
  const totalDays = weeks.reduce((s, w) => s + w.days, 0)

  const byCategory = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of monthExpenses) m.set(e.category, round2((m.get(e.category) ?? 0) + e.amount))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [monthExpenses])

  const accountName = (id: string) => data.accounts.find((a) => a.id === id)?.name ?? 'Ohne Konto'
  const activeContracts = data.contracts.filter((c) => isContractActive(c, month))

  return (
    <div className="space-y-4">
      <PageHeader
        title="Monatsbudget"
        subtitle="Einnahmen, Fixkosten, Sparen und Leben – Monat für Monat."
        action={<Button onClick={() => setExpenseEdit('new')}><Plus size={18} /> <span className="hidden sm:inline">Ausgabe</span></Button>}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthSwitcher
          value={month}
          onChange={setMonth}
          sub={startDay !== 1 ? `${shortDateLabel(range.start)} – ${shortDateLabel(range.end)}` : month === period ? 'aktueller Monat' : undefined}
        />
        <Segmented
          label="Ansicht"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'ueberblick', label: 'Überblick' },
            { value: 'ausgaben', label: 'Ausgaben' },
            { value: 'planung', label: 'Planung' },
          ]}
        />
      </div>

      {mp.free < 0 && (
        <Callout tone="danger" icon={<AlertTriangle size={18} />}>
          In {monthLabel(month, true)} reicht das Geld nicht: Es fehlen <b>{formatMoney(-mp.free)}</b>. Gespart wird in diesem Monat nichts.
        </Callout>
      )}

      {tab === 'ueberblick' && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Einnahmen</div><Money value={mp.income} className="mt-1 block text-xl font-bold" /></Card>
            <Card><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Fixkosten</div><Money value={round2(mp.fixed + mp.extra)} className="mt-1 block text-xl font-bold text-sky-600 dark:text-sky-400" /></Card>
            <Card><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Sparen</div><Money value={mp.saved} className="mt-1 block text-xl font-bold text-brand-600 dark:text-brand-400" /></Card>
            <Card><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Leben & Spaß</div><Money value={mp.life} className="mt-1 block text-xl font-bold text-amber-600 dark:text-amber-400" /></Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Aufteilung deines Geldes">
              {pieTotal === 0 ? (
                <EmptyState title="Noch keine Einnahmen" text="Trag unter „Planung“ dein Netto-Gehalt ein, dann siehst du hier die Aufteilung." />
              ) : (
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="h-48 w-48 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pie} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none" isAnimationActive={false}>
                          {pie.map((p) => <Cell key={p.name} fill={p.color} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} formatter={moneyTooltip} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="w-full space-y-2">
                    {pie.map((p) => (
                      <li key={p.name} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                          {p.name}
                        </span>
                        <span className="tabular text-right">
                          <span className="font-semibold">{formatPercent(p.value / pieTotal)}</span>{' '}
                          <span className="text-sm text-slate-500"><Money value={p.value} /></span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>

            <Card title="Alltagsgeld pro Woche">
              <div className="mb-3 flex items-baseline justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Monat gesamt</span>
                <span>
                  <Money value={round2(mp.life - spent)} className={cx('text-lg font-bold', tone === 'red' ? 'text-rose-600' : tone === 'yellow' ? 'text-amber-600' : 'text-emerald-600 dark:text-emerald-400')} />
                  <span className="text-slate-500"> übrig</span>
                </span>
              </div>
              <Progress value={spent} max={mp.life} tone={tone} className="mb-4" />
              <ul className="space-y-3">
                {weeks.map((w, i) => {
                  const budget = totalDays ? round2((mp.life * w.days) / totalDays) : 0
                  const wSpent = sumExpenses(monthExpenses.filter((e) => e.date >= w.start && e.date <= w.end))
                  const wTone = trafficLight(wSpent, budget)
                  const current = now >= w.start && now <= w.end
                  return (
                    <li key={w.start} className={cx('rounded-xl p-2', current && 'bg-slate-100 dark:bg-slate-800')}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium">
                          Woche {i + 1}{' '}
                          <span className="font-normal text-slate-500">{shortDateLabel(w.start)}–{shortDateLabel(w.end)}</span>{' '}
                          {current && <Badge tone="brand">jetzt</Badge>}
                        </span>
                        <span className="tabular">
                          <Money value={round2(budget - wSpent)} className="font-semibold" />
                          <span className="text-slate-500"> / <Money value={budget} /></span>
                        </span>
                      </div>
                      <Progress value={wSpent} max={budget} tone={wTone} className="h-1.5" />
                    </li>
                  )
                })}
              </ul>
            </Card>
          </div>
        </>
      )}

      {tab === 'ausgaben' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
          <Card
            title={<>Ausgaben <span className="font-normal text-slate-500">· <Money value={spent} /></span></>}
            action={<Button size="sm" onClick={() => setExpenseEdit('new')}><Plus size={16} /> Neu</Button>}
          >
            {monthExpenses.length === 0 ? (
              <EmptyState
                icon={<Receipt size={32} />}
                title="Keine Ausgaben in diesem Monat"
                text="Tippe auf „Neu“ oder den runden Plus-Knopf und erfasse Betrag und Kategorie – dauert 5 Sekunden."
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {monthExpenses.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2.5">
                    <button type="button" onClick={() => setExpenseEdit(e)} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{e.note || e.category}</div>
                        <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {dateLabel(e.date)} · {e.category} · {accountName(e.accountId)}
                        </div>
                      </div>
                      <Money value={-e.amount} className="font-semibold" />
                    </button>
                    <IconButton
                      label="Ausgabe löschen"
                      onClick={() => update((d) => { d.expenses = d.expenses.filter((x) => x.id !== e.id) })}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {byCategory.length > 0 && (
            <Card title="Nach Kategorie">
              <ul className="space-y-3">
                {byCategory.map(([cat, sum]) => (
                  <li key={cat}>
                    <div className="mb-1 flex justify-between text-sm"><span>{cat}</span><Money value={sum} className="font-semibold" /></div>
                    <Progress value={sum} max={byCategory[0][1]} className="h-1.5" />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {tab === 'planung' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Einnahmen" action={<Button size="sm" variant="secondary" onClick={() => setIncomeEdit('new')}><Plus size={16} /> Neu</Button>}>
            {data.incomes.length === 0 ? (
              <EmptyState title="Noch keine Einnahmen" text="Trag dein Netto-Gehalt ein. Für Gehaltssprünge (z. B. nach der Ausbildung) legst du einfach einen zweiten Zeitraum an." />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.incomes.map((i) => {
                  const active = i.from <= month && (!i.to || i.to >= month)
                  return (
                    <li key={i.id} className="flex items-center gap-2 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 font-medium">{i.label} {active && <Badge tone="green">aktiv</Badge>}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          ab {monthLabel(i.from)}{i.to ? ` bis ${monthLabel(i.to)}` : ''}
                        </div>
                      </div>
                      <Money value={i.amount} className="font-semibold" />
                      <IconButton label="Einnahme bearbeiten" onClick={() => setIncomeEdit(i)}><Pencil size={16} /></IconButton>
                      <IconButton label="Einnahme löschen" onClick={() => setDeleteIncome(i)}><Trash2 size={16} /></IconButton>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card title="Leben, Spaß & Studium">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Alltag & Spaß pro Monat</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Essen, Freizeit, Kleidung …</div>
                </div>
                <InlineAmount className="w-36" label="Alltagsbudget" value={data.lifeBudget} onCommit={(v) => update((d) => { d.lifeBudget = v })} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Studiengebühren pro Monat</div>
                  <label className="text-xs text-slate-500 dark:text-slate-400">
                    ab{' '}
                    <input
                      type="month"
                      aria-label="Studienstart"
                      value={data.study.from}
                      onChange={(e) => isMonth(e.target.value) && update((d) => { d.study.from = e.target.value })}
                      className="rounded-md border border-slate-300 bg-transparent px-1 dark:border-slate-700"
                    />
                  </label>
                </div>
                <InlineAmount className="w-36" label="Studiengebühren" value={data.study.fee} onCommit={(v) => update((d) => { d.study.fee = v })} />
              </div>
            </div>
          </Card>

          <Card
            title={<>Fixkosten in {monthLabel(month)} <span className="font-normal text-slate-500">· <Money value={mp.fixed} /></span></>}
            action={<a href="#/abos" className="text-sm font-medium text-brand-700 dark:text-brand-300">Bearbeiten</a>}
          >
            {activeContracts.length === 0 ? (
              <EmptyState title="Keine Fixkosten" text="Fixkosten und Abos pflegst du unter „Abos & Verträge“." />
            ) : (
              <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {activeContracts.map((c) => (
                  <li key={c.id} className="flex justify-between gap-3 py-2">
                    <span>
                      {c.name}
                      {c.endDate && <span className="text-xs text-slate-500"> · bis {dateLabel(c.endDate)}</span>}
                    </span>
                    <Money value={monthlyAmount(c)} />
                  </li>
                ))}
                {mp.extra > 0 && (
                  <li className="flex justify-between gap-3 py-2">
                    <span>Studiengebühren</span>
                    <Money value={mp.extra} />
                  </li>
                )}
              </ul>
            )}
          </Card>

          <Card
            title={<>Sparraten in {monthLabel(month)} <span className="font-normal text-slate-500">· <Money value={mp.saved} /></span></>}
            action={<a href="#/ziele" className="text-sm font-medium text-brand-700 dark:text-brand-300">Ziele</a>}
          >
            {data.goals.length === 0 ? (
              <EmptyState title="Keine Sparziele" text="Lege unter „Ziele“ Töpfe an – das übrige Geld wird dann automatisch verteilt." />
            ) : (
              <>
                <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {sortByPriority(data.goals).map((g) => {
                    const got = mp.allocations[g.id] ?? 0
                    const planned = g.rateFrom && month < g.rateFrom ? 0 : g.monthlyRate
                    return (
                      <li key={g.id} className="flex justify-between gap-3 py-2">
                        <span>{g.emoji} {g.name}</span>
                        <span className="tabular">
                          <Money value={got} className="font-semibold" />
                          {round2(got - planned) > 0 && <span className="text-xs text-brand-600 dark:text-brand-400"> (+<Money value={round2(got - planned)} /> Überschuss)</span>}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                {mp.unallocated > 0 && (
                  <p className="mt-2 text-sm text-slate-500">Nicht verteilt: <Money value={mp.unallocated} /></p>
                )}
                {!isPlanMonth && <p className="mt-2 text-xs text-slate-500">Vergangener Monat: berechnet mit den heutigen Ständen.</p>}
              </>
            )}
          </Card>
        </div>
      )}

      {expenseEdit && (
        <ExpenseForm open onClose={() => setExpenseEdit(null)} expense={expenseEdit === 'new' ? undefined : expenseEdit} />
      )}
      {incomeEdit && <IncomeForm income={incomeEdit === 'new' ? undefined : incomeEdit} onClose={() => setIncomeEdit(null)} />}
      <ConfirmDialog
        open={!!deleteIncome}
        onClose={() => setDeleteIncome(null)}
        title="Einnahme löschen?"
        text={deleteIncome && <>„{deleteIncome.label}“ ({formatMoney(deleteIncome.amount)}) wird gelöscht.</>}
        onConfirm={() => deleteIncome && update((d) => { d.incomes = d.incomes.filter((i) => i.id !== deleteIncome.id) })}
      />
    </div>
  )
}

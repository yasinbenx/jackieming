import { CalendarCheck, Check, ChevronLeft, ChevronRight, Landmark, PiggyBank, Plus, Receipt, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ExpenseForm from '../components/ExpenseForm'
import { axisProps, compactMoney, moneyTooltip, tooltipStyle } from '../components/charts'
import {
  AmountInput, Badge, Button, Callout, Card, ConfirmDialog, EmptyState, IconButton, Money, PageHeader, Progress, TextInput, cx,
} from '../components/ui'
import { addDays, dateLabel, diffDays, shortDateLabel, today, weeksOfPeriod } from '../lib/dates'
import { uid } from '../lib/defaults'
import { formatMoney, round2, toInputString, validateAmount } from '../lib/money'
import { sortByPriority } from '../lib/plan'
import { accountsTotal, currentPeriod, potsTotal, sumExpenses, trafficLight } from '../lib/selectors'
import type { CheckIn } from '../lib/types'
import { useStore } from '../store/store'

const STEPS = [
  { title: 'Kontostände', icon: Landmark },
  { title: 'Ausgaben', icon: Receipt },
  { title: 'Töpfe', icon: PiggyBank },
  { title: 'Fertig', icon: Check },
]

function Wizard({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { data, update } = useStore()
  const now = today()
  const [step, setStep] = useState(0)
  const [balances, setBalances] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.accounts.map((a) => [a.id, toInputString(a.balance)])),
  )
  const [pots, setPots] = useState<Record<string, string>>(() => Object.fromEntries(data.goals.map((g) => [g.id, toInputString(g.current)])))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [expenseOpen, setExpenseOpen] = useState(false)

  const weekStart = addDays(now, -6)
  const weekExpenses = data.expenses.filter((e) => e.date >= weekStart && e.date <= now).sort((a, b) => b.date.localeCompare(a.date))
  const weekSpent = sumExpenses(weekExpenses)
  const period = currentPeriod(data, now)
  const totalDays = weeksOfPeriod(period, data.settings.monthStartDay).reduce((s, w) => s + w.days, 0)
  const weekBudget = round2((data.lifeBudget * 7) / totalDays)

  const parsed = (map: Record<string, string>) => {
    const out: Record<string, number> = {}
    const errs: Record<string, string> = {}
    for (const [id, v] of Object.entries(map)) {
      const r = validateAmount(v, { allowZero: true })
      if (r.ok) out[id] = r.value
      else errs[id] = r.error
    }
    return { out, errs }
  }

  const next = () => {
    if (step === 0) {
      const { errs } = parsed(balances)
      setErrors(errs)
      if (Object.keys(errs).length) return
    }
    if (step === 2) {
      const { errs } = parsed(pots)
      setErrors(errs)
      if (Object.keys(errs).length) return
    }
    setStep((s) => s + 1)
  }

  const finish = () => {
    const b = parsed(balances).out
    const p = parsed(pots).out
    update((d) => {
      for (const a of d.accounts) {
        if (b[a.id] !== undefined && b[a.id] !== a.balance) {
          a.balance = b[a.id]
          a.updatedAt = now
        } else if (b[a.id] !== undefined) a.updatedAt = now
      }
      for (const g of d.goals) if (p[g.id] !== undefined) g.current = p[g.id]
      const entry: CheckIn = {
        id: uid(),
        date: now,
        balances: b,
        accountsTotal: accountsTotal(d),
        potsTotal: potsTotal(d),
        weekSpent,
        note: note.trim() || undefined,
      }
      d.checkIns.push(entry)
      d.checkIns.sort((x, y) => x.date.localeCompare(y.date))
    })
    onDone()
  }

  const newTotal = round2(Object.values(parsed(balances).out).reduce((s, v) => s + v, 0))
  const wTone = trafficLight(weekSpent, weekBudget)

  return (
    <div className="space-y-4">
      <PageHeader title="Wochen-Check-in" subtitle={`Schritt ${step + 1} von ${STEPS.length} · ca. 10 Minuten`} />

      <ol className="grid grid-cols-4 gap-2" aria-label="Fortschritt">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex flex-col items-center gap-1 text-center text-xs" aria-current={i === step ? 'step' : undefined}>
            <span
              className={cx(
                'flex h-10 w-10 items-center justify-center rounded-full border-2 transition',
                i < step && 'border-brand-600 bg-brand-600 text-white dark:border-brand-500 dark:bg-brand-500 dark:text-slate-950',
                i === step && 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300',
                i > step && 'border-slate-300 text-slate-400 dark:border-slate-700',
              )}
            >
              {i < step ? <Check size={18} /> : <s.icon size={18} />}
            </span>
            <span className={cx(i === step ? 'font-semibold' : 'text-slate-500')}>{s.title}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card title="1. Kontostände aktualisieren">
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Öffne deine Banking-Apps und trag die aktuellen Stände ein.</p>
          {data.accounts.length === 0 ? (
            <EmptyState title="Keine Konten" text="Du hast noch keine Konten angelegt. Du kannst diesen Schritt überspringen." action={<a className="text-brand-700 dark:text-brand-300" href="#/konten">Konten anlegen</a>} />
          ) : (
            <div className="space-y-3">
              {data.accounts.map((a) => (
                <div key={a.id} className="grid grid-cols-[1fr_10rem] items-start gap-3">
                  <div className="pt-2">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-slate-500">zuletzt <Money value={a.balance} /> am {dateLabel(a.updatedAt)}</div>
                  </div>
                  <AmountInput label="Stand" value={balances[a.id] ?? ''} onChange={(v) => setBalances({ ...balances, [a.id]: v })} error={errors[a.id]} />
                </div>
              ))}
              <div className="flex justify-between border-t border-slate-100 pt-3 font-semibold dark:border-slate-800">
                <span>Gesamt</span>
                <span>
                  <Money value={newTotal} />{' '}
                  <span className={cx('text-sm', newTotal - accountsTotal(data) >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                    (<Money value={round2(newTotal - accountsTotal(data))} signed />)
                  </span>
                </span>
              </div>
            </div>
          )}
        </Card>
      )}

      {step === 1 && (
        <Card title="2. Ausgaben der letzten 7 Tage prüfen" action={<Button size="sm" variant="secondary" onClick={() => setExpenseOpen(true)}><Plus size={16} /> Nachtragen</Button>}>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm text-slate-500">{shortDateLabel(weekStart)} – {shortDateLabel(now)}</span>
            <span><Money value={weekSpent} className="text-xl font-bold" /> <span className="text-sm text-slate-500">von ≈ <Money value={weekBudget} /></span></span>
          </div>
          <Progress value={weekSpent} max={weekBudget} tone={wTone} className="mb-4" />
          {weekExpenses.length === 0 ? (
            <p className="text-sm text-slate-500">Keine Ausgaben erfasst. Schau kurz in deine Banking-App: Fehlt etwas? Dann trag es nach.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {weekExpenses.map((e) => (
                <li key={e.id} className="flex justify-between gap-2 py-2">
                  <span>{dateLabel(e.date)} · {e.note || e.category}</span>
                  <Money value={e.amount} className="font-medium" />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">Fehlt etwas? Alles, was du in der Banking-App siehst, aber hier nicht, bitte nachtragen.</p>
        </Card>
      )}

      {step === 2 && (
        <Card title="3. Töpfe prüfen">
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Stimmen die Stände mit deinen Unterkonten überein? Hast du die Sparraten überwiesen? Mit „+ Rate“ addierst du die Monatsrate.
          </p>
          {data.goals.length === 0 ? (
            <p className="text-sm text-slate-500">Keine Töpfe angelegt.</p>
          ) : (
            <div className="space-y-3">
              {sortByPriority(data.goals).map((g) => (
                <div key={g.id} className="grid grid-cols-[1fr_10rem] items-start gap-3">
                  <div className="pt-2">
                    <div className="font-medium">{g.emoji} {g.name}</div>
                    <div className="text-xs text-slate-500">
                      {g.target !== null ? <>Ziel <Money value={g.target} /></> : 'offenes Ziel'}
                      {g.monthlyRate > 0 && (
                        <button
                          type="button"
                          className="ml-2 rounded-md bg-brand-50 px-1.5 py-0.5 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                          onClick={() => {
                            const r = validateAmount(pots[g.id] ?? '0', { allowZero: true })
                            const base = r.ok ? r.value : g.current
                            setPots({ ...pots, [g.id]: toInputString(round2(base + g.monthlyRate)) })
                          }}
                        >
                          + Rate {formatMoney(g.monthlyRate)}
                        </button>
                      )}
                    </div>
                  </div>
                  <AmountInput label="Stand" value={pots[g.id] ?? ''} onChange={(v) => setPots({ ...pots, [g.id]: v })} error={errors[g.id]} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {step === 3 && (
        <Card title="4. Geschafft!">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Konten</div>
              <Money value={newTotal} className="text-2xl font-bold" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Ausgaben 7 Tage</div>
              <Money value={weekSpent} className="text-2xl font-bold" />
            </div>
          </div>
          <div className="mt-4">
            <TextInput label="Notiz für dich (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. viel auswärts gegessen, nächste Woche kochen" maxLength={200} />
          </div>
        </Card>
      )}

      <div className="flex justify-between gap-2">
        <Button variant="ghost" onClick={step === 0 ? onCancel : () => setStep(step - 1)}>
          <ChevronLeft size={18} /> {step === 0 ? 'Abbrechen' : 'Zurück'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next}>Weiter <ChevronRight size={18} /></Button>
        ) : (
          <Button onClick={finish}><Check size={18} /> Check-in speichern</Button>
        )}
      </div>

      <ExpenseForm open={expenseOpen} onClose={() => setExpenseOpen(false)} />
    </div>
  )
}

export default function CheckInPage() {
  const { data, update } = useStore()
  const [running, setRunning] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState<CheckIn | null>(null)
  const now = today()
  const last = data.checkIns.at(-1)
  const since = last ? diffDays(last.date, now) : null

  const chartData = useMemo(
    () => data.checkIns.slice(-16).map((c) => ({ label: shortDateLabel(c.date), konten: c.accountsTotal, toepfe: c.potsTotal, ausgaben: c.weekSpent })),
    [data.checkIns],
  )
  const history = [...data.checkIns].reverse()

  if (running)
    return (
      <Wizard
        onCancel={() => setRunning(false)}
        onDone={() => {
          setRunning(false)
          setSaved(true)
          window.scrollTo({ top: 0 })
        }}
      />
    )

  return (
    <div className="space-y-4">
      <PageHeader title="Wochen-Check-in" subtitle="Einmal pro Woche, 10 Minuten – und du weißt wieder, wo du stehst." />

      {saved && <Callout tone="success" icon={<Check size={18} />}>Check-in gespeichert. Gut gemacht!</Callout>}

      <Card className="text-center">
        <CalendarCheck className="mx-auto mb-3 text-brand-600 dark:text-brand-400" size={40} />
        <div className="text-lg font-semibold">
          {since === null ? 'Noch kein Check-in' : since === 0 ? 'Heute schon erledigt ✓' : `Letzter Check-in vor ${since} ${since === 1 ? 'Tag' : 'Tagen'}`}
        </div>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          1. Kontostände eintragen · 2. Ausgaben prüfen · 3. Töpfe prüfen
        </p>
        <Button className="mt-4" onClick={() => { setSaved(false); setRunning(true) }}>
          Check-in starten <ChevronRight size={18} />
        </Button>
        {since !== null && since >= 7 && <div className="mt-3"><Badge tone="yellow">wieder fällig</Badge></div>}
      </Card>

      {data.checkIns.length === 0 ? (
        <EmptyState title="Noch kein Verlauf" text="Nach deinem ersten Check-in siehst du hier, wie sich Konten, Töpfe und Ausgaben Woche für Woche entwickeln." />
      ) : (
        <>
          {chartData.length >= 2 && (
            <Card title="Verlauf der letzten Wochen">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={compactMoney} width={72} />
                    <Tooltip contentStyle={tooltipStyle} formatter={moneyTooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line dataKey="konten" name="Konten" stroke="var(--chart-fix)" strokeWidth={2.5} isAnimationActive={false} />
                    <Line dataKey="toepfe" name="Töpfe" stroke="var(--chart-save)" strokeWidth={2.5} isAnimationActive={false} />
                    <Line dataKey="ausgaben" name="Ausgaben/Woche" stroke="var(--chart-life)" strokeWidth={2} strokeDasharray="4 3" isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
          <Card title="Alle Check-ins">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.map((c, i) => {
                const prev = history[i + 1]
                const delta = prev ? round2(c.accountsTotal - prev.accountsTotal) : null
                return (
                  <li key={c.id} className="flex items-start gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{dateLabel(c.date)}</span>
                        {delta !== null && (
                          <Badge tone={delta >= 0 ? 'green' : 'red'}><Money value={delta} signed /></Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Konten <Money value={c.accountsTotal} /> · Töpfe <Money value={c.potsTotal} /> · Ausgaben <Money value={c.weekSpent} />
                      </div>
                      {c.note && <p className="mt-1 text-sm italic text-slate-600 dark:text-slate-300">„{c.note}“</p>}
                    </div>
                    <IconButton label="Check-in löschen" onClick={() => setDeleting(c)}><Trash2 size={16} /></IconButton>
                  </li>
                )
              })}
            </ul>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Check-in löschen?"
        text={deleting && <>Der Eintrag vom {dateLabel(deleting.date)} wird aus dem Verlauf entfernt. Deine Kontostände bleiben unverändert.</>}
        onConfirm={() => deleting && update((d) => { d.checkIns = d.checkIns.filter((c) => c.id !== deleting.id) })}
      />
    </div>
  )
}

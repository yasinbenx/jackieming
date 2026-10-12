import { ArrowDown, ArrowUp, Pencil, PiggyBank, Plus, Target, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisProps, compactMoney, moneyTooltip, tooltipStyle } from '../components/charts'
import {
  AmountInput, Badge, Button, Card, ConfirmDialog, EmptyState, Field, IconButton, Modal, Money, PageHeader, Progress, SelectInput,
  Segmented, TextInput, Toggle, cx,
} from '../components/ui'
import { addMonths, diffMonths, isMonth, monthLabel } from '../lib/dates'
import { GOAL_COLORS, uid } from '../lib/defaults'
import { formatMoney, round2, toInputString, validateAmount } from '../lib/money'
import { isGoalDone, monthsToGoal, requiredMonthly, sortByPriority } from '../lib/plan'
import type { Goal } from '../lib/types'
import { usePlan } from '../store/hooks'
import { useStore } from '../store/store'

const CHART_MONTHS = 48

function GoalForm({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const { data, update } = useStore()
  const [name, setName] = useState(goal?.name ?? '')
  const [emoji, setEmoji] = useState(goal?.emoji ?? '🎯')
  const [open, setOpen] = useState(goal ? goal.target === null : false)
  const [target, setTarget] = useState(toInputString(goal?.target))
  const [minTarget, setMinTarget] = useState(toInputString(goal?.minTarget))
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '')
  const [current, setCurrent] = useState(goal ? toInputString(goal.current) : '0')
  const [rate, setRate] = useState(goal ? toInputString(goal.monthlyRate) : '0')
  const [rateFrom, setRateFrom] = useState(goal?.rateFrom ?? '')
  const [accountId, setAccountId] = useState(goal?.accountId ?? '')
  const [color, setColor] = useState(goal?.color ?? GOAL_COLORS[data.goals.length % GOAL_COLORS.length])
  const [note, setNote] = useState(goal?.note ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const save = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Bitte einen Namen eingeben.'
    const t = open ? null : validateAmount(target)
    if (t && !t.ok) e.target = t.error
    const mt = minTarget.trim() && !open ? validateAmount(minTarget) : null
    if (mt && !mt.ok) e.minTarget = mt.error
    if (mt?.ok && t?.ok && mt.value > t.value) e.minTarget = 'Der Mindestbetrag ist größer als das Ziel.'
    const c = validateAmount(current, { allowZero: true })
    if (!c.ok) e.current = c.error
    const r = validateAmount(rate, { allowZero: true })
    if (!r.ok) e.rate = r.error
    if (targetDate && !isMonth(targetDate)) e.targetDate = 'Ungültiger Monat.'
    setErrors(e)
    if (Object.keys(e).length || !c.ok || !r.ok) return
    update((d) => {
      const existing = d.goals.find((g) => g.id === goal?.id)
      const item: Goal = {
        id: goal?.id ?? uid(),
        name: name.trim(),
        emoji: emoji.trim() || '🎯',
        target: t && t.ok ? t.value : null,
        minTarget: mt && mt.ok ? mt.value : undefined,
        targetDate: targetDate || undefined,
        current: c.value,
        monthlyRate: r.value,
        rateFrom: rateFrom || undefined,
        priority: existing?.priority ?? Math.max(0, ...d.goals.map((g) => g.priority)) + 1,
        accountId: accountId || undefined,
        color,
        note: note.trim() || undefined,
      }
      if (existing) Object.assign(existing, item)
      else d.goals.push(item)
    })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={goal ? 'Ziel bearbeiten' : 'Neues Sparziel'}
      footer={<><Button variant="secondary" onClick={onClose}>Abbrechen</Button><Button onClick={save}>Speichern</Button></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[5rem_1fr] gap-3">
          <TextInput label="Symbol" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} className="text-center text-xl" />
          <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="z. B. Laptop" autoFocus={!goal} maxLength={40} />
        </div>
        <Toggle checked={open} onChange={setOpen} label="Offenes Ziel" description="Ohne Endbetrag, z. B. langfristig investieren" />
        {!open && (
          <div className="grid grid-cols-2 gap-3">
            <AmountInput label="Zielbetrag" value={target} onChange={setTarget} error={errors.target} />
            <AmountInput label="Mindestens (optional)" value={minTarget} onChange={setMinTarget} error={errors.minTarget} placeholder="—" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <AmountInput label="Aktueller Stand" value={current} onChange={setCurrent} error={errors.current} />
          <AmountInput label="Sparrate pro Monat" value={rate} onChange={setRate} error={errors.rate} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Zieldatum (optional)" type="month" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} error={errors.targetDate} />
          <TextInput label="Rate gilt ab (optional)" type="month" value={rateFrom} onChange={(e) => setRateFrom(e.target.value)} hint="Leer = ab sofort" />
        </div>
        <SelectInput label="Liegt auf Konto" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Kein bestimmtes Konto</option>
          {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </SelectInput>
        <Field label="Farbe">
          <div className="flex flex-wrap gap-2">
            {GOAL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Farbe ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={cx('h-9 w-9 rounded-full ring-offset-2 dark:ring-offset-slate-900', color === c && 'ring-2 ring-slate-900 dark:ring-white')}
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>
        <TextInput label="Notiz (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
      </div>
    </Modal>
  )
}

function DepositForm({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { update } = useStore()
  const [mode, setMode] = useState<'ein' | 'aus'>('ein')
  const [amount, setAmount] = useState(goal.monthlyRate ? toInputString(goal.monthlyRate) : '')
  const [error, setError] = useState<string>()
  const save = () => {
    const a = validateAmount(amount)
    if (!a.ok) return setError(a.error)
    if (mode === 'aus' && a.value > goal.current) return setError(`Im Topf sind nur ${formatMoney(goal.current)}.`)
    update((d) => {
      const g = d.goals.find((x) => x.id === goal.id)!
      g.current = round2(g.current + (mode === 'ein' ? a.value : -a.value))
    })
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={`${goal.emoji} ${goal.name}`} footer={<><Button variant="secondary" onClick={onClose}>Abbrechen</Button><Button onClick={save}>Speichern</Button></>}>
      <div className="space-y-4">
        <Segmented label="Art" value={mode} onChange={setMode} options={[{ value: 'ein', label: 'Einzahlen' }, { value: 'aus', label: 'Entnehmen' }]} />
        <AmountInput label="Betrag" value={amount} onChange={setAmount} error={error} autoFocus />
        <p className="text-sm text-slate-500">Aktueller Stand: <Money value={goal.current} /></p>
      </div>
    </Modal>
  )
}

export default function Ziele() {
  const { data, update } = useStore()
  const { period, result } = usePlan()
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)
  const [deposit, setDeposit] = useState<Goal | null>(null)
  const [deleting, setDeleting] = useState<Goal | null>(null)
  const goals = sortByPriority(data.goals)

  const move = (id: string, dir: -1 | 1) =>
    update((d) => {
      const sorted = sortByPriority(d.goals)
      const i = sorted.findIndex((g) => g.id === id)
      const j = i + dir
      if (j < 0 || j >= sorted.length) return
      ;[sorted[i], sorted[j]] = [sorted[j], sorted[i]]
      sorted.forEach((g, k) => (g.priority = k + 1))
      d.goals = sorted
    })

  const chartData = useMemo(
    () =>
      Array.from({ length: CHART_MONTHS }, (_, i) => {
        const row: Record<string, string | number> = { label: monthLabel(addMonths(period, i)) }
        for (const g of data.goals) row[g.id] = result.balances[g.id]?.[i] ?? 0
        return row
      }),
    [data.goals, result, period],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sparziele"
        subtitle="Deine Töpfe – oben steht, was zuerst voll wird."
        action={<Button onClick={() => setEditing('new')}><Plus size={18} /> <span className="hidden sm:inline">Ziel</span></Button>}
      />

      <Card>
        <Toggle
          checked={data.settings.overflow}
          onChange={(v) => update((d) => { d.settings.overflow = v })}
          label="Überschuss automatisch verteilen"
          description="Geld, das nach Fixkosten, Leben und Sparraten übrig ist, fließt ins oberste offene Ziel. Ist ein Ziel voll, geht seine Rate ans nächste."
        />
      </Card>

      {goals.length === 0 ? (
        <EmptyState
          icon={<Target size={36} />}
          title="Noch keine Sparziele"
          text="Starte mit einem Notgroschen (3 Monatsausgaben). Danach kommen Wünsche wie Urlaub oder Auto."
          action={<Button onClick={() => setEditing('new')}><Plus size={18} /> Ziel anlegen</Button>}
        />
      ) : (
        <ol className="space-y-3">
          {goals.map((g, i) => {
            const done = isGoalDone(g.target, g.current)
            const reached = result.reached[g.id]
            const minReached = result.minReached[g.id]
            const need = requiredMonthly(g, period)
            const onTrack = g.targetDate ? !!reached && reached <= g.targetDate : null
            const simple = monthsToGoal(g)
            const account = data.accounts.find((a) => a.id === g.accountId)
            return (
              <li key={g.id}>
                <Card>
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ background: `${g.color}22` }} aria-hidden>
                      {g.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{g.name}</h2>
                        <Badge>Priorität {i + 1}</Badge>
                        {done && <Badge tone="green">erreicht ✓</Badge>}
                        {!done && onTrack === true && <Badge tone="green">im Plan</Badge>}
                        {!done && onTrack === false && <Badge tone="red">zu spät</Badge>}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {account ? account.name : 'kein Konto'}{g.note ? ` · ${g.note}` : ''}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col sm:flex-row">
                      <IconButton label="Priorität höher" disabled={i === 0} onClick={() => move(g.id, -1)} className="disabled:opacity-30"><ArrowUp size={17} /></IconButton>
                      <IconButton label="Priorität niedriger" disabled={i === goals.length - 1} onClick={() => move(g.id, 1)} className="disabled:opacity-30"><ArrowDown size={17} /></IconButton>
                    </div>
                  </div>

                  <div className="mt-4 flex items-baseline justify-between gap-2">
                    <Money value={g.current} className="text-2xl font-bold" />
                    <span className="text-sm text-slate-500">{g.target !== null ? <>von <Money value={g.target} /></> : 'offenes Ziel'}</span>
                  </div>
                  <Progress className="mt-2 h-3" value={g.current} max={g.target ?? Math.max(1, g.current)} color={g.color} />

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Sparrate</dt>
                      <dd className="font-semibold"><Money value={g.monthlyRate} />/Monat{g.rateFrom && g.rateFrom > period && <span className="block text-xs font-normal text-slate-500">ab {monthLabel(g.rateFrom)}</span>}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Zieldatum</dt>
                      <dd className="font-semibold">{g.targetDate ? monthLabel(g.targetDate) : '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Erreicht voraussichtlich</dt>
                      <dd className="font-semibold">
                        {g.target === null ? '—' : done ? 'schon erreicht' : reached ? `${monthLabel(reached)} (in ${diffMonths(period, reached)} Mon.)` : 'nicht in 10 Jahren'}
                        {g.minTarget !== undefined && minReached && !done && (
                          <span className="block text-xs font-normal text-slate-500">Minimum {formatMoney(g.minTarget)}: {monthLabel(minReached)}</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Nötig fürs Zieldatum</dt>
                      <dd className="font-semibold">
                        {need === null ? '—' : need === 0 ? 'nichts mehr' : <><Money value={need} />/Monat</>}
                      </dd>
                    </div>
                  </dl>
                  {!done && g.target !== null && simple !== null && (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Nur mit der eigenen Rate (ohne Überschuss): {simple} {simple === 1 ? 'Monat' : 'Monate'}
                      {g.rateFrom && g.rateFrom > period ? ` ab ${monthLabel(g.rateFrom)}` : ''}.
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setDeposit(g)}><PiggyBank size={16} /> Ein-/Auszahlen</Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(g)}><Pencil size={16} /> Bearbeiten</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(g)}><Trash2 size={16} /> Löschen</Button>
                  </div>
                </Card>
              </li>
            )
          })}
        </ol>
      )}

      {goals.length > 0 && (
        <Card title="So füllen sich deine Töpfe">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={28} />
                <YAxis {...axisProps} tickFormatter={compactMoney} width={72} />
                <Tooltip contentStyle={tooltipStyle} formatter={moneyTooltip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {goals.map((g) => (
                  <Line key={g.id} type="monotone" dataKey={g.id} name={`${g.emoji} ${g.name}`} stroke={g.color} strokeWidth={2} dot={false} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Hochrechnung für die nächsten {CHART_MONTHS} Monate mit deinem aktuellen Plan.</p>
        </Card>
      )}

      {editing && <GoalForm goal={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {deposit && <DepositForm goal={deposit} onClose={() => setDeposit(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Ziel löschen?"
        text={deleting && <>„{deleting.name}“ mit einem Stand von {formatMoney(deleting.current)} wird gelöscht. Das Geld auf deinen Konten bleibt natürlich unverändert.</>}
        onConfirm={() =>
          deleting &&
          update((d) => {
            d.goals = sortByPriority(d.goals.filter((g) => g.id !== deleting.id))
            d.goals.forEach((g, k) => (g.priority = k + 1))
          })
        }
      />
    </div>
  )
}

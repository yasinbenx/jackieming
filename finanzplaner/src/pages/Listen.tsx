import { CheckCircle2, Circle, ExternalLink, Gift, Hourglass, ListTodo, Plus, ShoppingBag, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  AmountInput, Badge, Button, Callout, Card, EmptyState, IconButton, Money, PageHeader, Progress, Segmented, TextInput, cx,
} from '../components/ui'
import { uid } from '../lib/defaults'
import { round2, validateAmount } from '../lib/money'
import { wishStatus } from '../lib/wishes'
import { useStore } from '../store/store'

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

function safeLink(link?: string): string | undefined {
  if (!link) return undefined
  try {
    const u = new URL(link.startsWith('http') ? link : `https://${link}`)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined
  } catch {
    return undefined
  }
}

function Wishlist() {
  const { data, update } = useStore()
  const now = useNow()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [link, setLink] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const add = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Was wünschst du dir?'
    const p = validateAmount(price)
    if (!p.ok) e.price = p.error
    setErrors(e)
    if (Object.keys(e).length || !p.ok) return
    update((d) => {
      d.wishes.unshift({ id: uid(), name: name.trim(), price: p.value, createdAt: new Date().toISOString(), bought: false, link: link.trim() || undefined })
    })
    setName('')
    setPrice('')
    setLink('')
  }

  const open = data.wishes.filter((w) => !w.bought)
  const bought = data.wishes.filter((w) => w.bought)
  const allowedSum = round2(open.filter((w) => wishStatus(w.createdAt, now).allowed).reduce((s, w) => s + w.price, 0))

  return (
    <div className="space-y-4">
      <Callout tone="info" icon={<Hourglass size={18} />}>
        <b>48-Stunden-Regel:</b> Schreib Wünsche erst auf. Nach 48 Stunden wird der Eintrag freigegeben – wenn du es dann immer noch willst, kauf es mit gutem Gewissen.
      </Callout>

      <Card title="Neuer Wunsch">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_9rem]"
          onSubmit={(ev) => {
            ev.preventDefault()
            add()
          }}
        >
          <TextInput label="Was?" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="z. B. Kopfhörer" maxLength={60} />
          <AmountInput label="Preis" value={price} onChange={setPrice} error={errors.price} />
          <div className="sm:col-span-2">
            <TextInput label="Link (optional)" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" inputMode="url" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" className="w-full sm:w-auto"><Plus size={18} /> Auf die Liste</Button>
          </div>
        </form>
      </Card>

      {open.length === 0 ? (
        <EmptyState icon={<Gift size={36} />} title="Keine offenen Wünsche" text="Wenn du etwas kaufen willst, trag es hier ein und warte 48 Stunden. Oft ist der Wunsch dann weg." />
      ) : (
        <Card title="Wunschliste" action={allowedSum > 0 ? <Badge tone="green">freigegeben: <Money value={allowedSum} /></Badge> : undefined}>
          <ul className="space-y-3">
            {open.map((w) => {
              const { allowed, hoursLeft: left, progress } = wishStatus(w.createdAt, now)
              const href = safeLink(w.link)
              return (
                <li key={w.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 font-medium">
                        {w.name}
                        {href && (
                          <a href={href} target="_blank" rel="noopener noreferrer" aria-label="Link öffnen" className="text-slate-400 hover:text-brand-600">
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                      <Money value={w.price} className="text-lg font-bold" />
                    </div>
                    {allowed ? <Badge tone="green">kaufen erlaubt ✓</Badge> : <Badge tone="yellow">noch {left} Std.</Badge>}
                  </div>
                  {!allowed && <Progress className="mt-2 h-1.5" value={progress} max={1} tone="yellow" />}
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant={allowed ? 'primary' : 'secondary'} disabled={!allowed} onClick={() => update((d) => { d.wishes.find((x) => x.id === w.id)!.bought = true })}>
                      <ShoppingBag size={16} /> Gekauft
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => update((d) => { d.wishes = d.wishes.filter((x) => x.id !== w.id) })}>
                      <Trash2 size={16} /> Doch nicht
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {bought.length > 0 && (
        <Card title="Gekauft">
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {bought.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-2 py-2">
                <span className="text-slate-500 line-through">{w.name}</span>
                <span className="flex items-center gap-1">
                  <Money value={w.price} />
                  <IconButton label="Zurück auf die Liste" onClick={() => update((d) => { d.wishes.find((x) => x.id === w.id)!.bought = false })}><Undo2 size={16} /></IconButton>
                  <IconButton label="Entfernen" onClick={() => update((d) => { d.wishes = d.wishes.filter((x) => x.id !== w.id) })}><Trash2 size={16} /></IconButton>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Tipp: Erfasse den Kauf auch als Ausgabe (Plus-Knopf), damit dein Budget stimmt.</p>
        </Card>
      )}
    </div>
  )
}

function Todos() {
  const { data, update } = useStore()
  const [text, setText] = useState('')
  const [error, setError] = useState<string>()
  const done = data.todos.filter((t) => t.done).length

  const add = () => {
    if (!text.trim()) return setError('Bitte eine Aufgabe eingeben.')
    setError(undefined)
    update((d) => { d.todos.push({ id: uid(), text: text.trim(), done: false }) })
    setText('')
  }

  return (
    <div className="space-y-4">
      <Card>
        <form
          className="flex items-start gap-2"
          onSubmit={(ev) => {
            ev.preventDefault()
            add()
          }}
        >
          <div className="flex-1">
            <TextInput label="Neue Finanz-Aufgabe" value={text} onChange={(e) => setText(e.target.value)} error={error} placeholder="z. B. Kfz-Versicherungen vergleichen" maxLength={100} />
          </div>
          <Button type="submit" className="mt-6" aria-label="Aufgabe hinzufügen"><Plus size={18} /></Button>
        </form>
      </Card>

      {data.todos.length === 0 ? (
        <EmptyState icon={<ListTodo size={36} />} title="Keine Aufgaben" text="Sammle hier Dinge wie „Handytarif wechseln“ oder „Freistellungsauftrag stellen“." />
      ) : (
        <Card
          title={<>Aufgaben <span className="font-normal text-slate-500">· {done} von {data.todos.length} erledigt</span></>}
          action={done > 0 && <Button size="sm" variant="ghost" onClick={() => update((d) => { d.todos = d.todos.filter((t) => !t.done) })}>Erledigte entfernen</Button>}
        >
          <Progress value={done} max={data.todos.length} className="mb-3" />
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.todos.map((t) => (
              <li key={t.id} className="flex items-center gap-2 py-1">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={t.done}
                  onClick={() => update((d) => { const x = d.todos.find((y) => y.id === t.id)!; x.done = !x.done })}
                  className="flex min-h-11 flex-1 items-center gap-3 text-left"
                >
                  {t.done ? <CheckCircle2 className="shrink-0 text-brand-600 dark:text-brand-400" size={22} /> : <Circle className="shrink-0 text-slate-400" size={22} />}
                  <span className={cx(t.done && 'text-slate-400 line-through')}>{t.text}</span>
                </button>
                <IconButton label="Aufgabe löschen" onClick={() => update((d) => { d.todos = d.todos.filter((y) => y.id !== t.id) })}><Trash2 size={16} /></IconButton>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

export default function Listen() {
  const [tab, setTab] = useState<'wunsch' | 'todo'>('wunsch')
  return (
    <div className="space-y-4">
      <PageHeader title="Listen" subtitle="Wünsche mit Bedenkzeit und deine Finanz-To-dos." />
      <Segmented label="Liste" value={tab} onChange={setTab} options={[{ value: 'wunsch', label: 'Wunschliste' }, { value: 'todo', label: 'To-dos' }]} />
      {tab === 'wunsch' ? <Wishlist /> : <Todos />}
    </div>
  )
}

import { AlertTriangle, HandCoins, Info, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import LiveAmount from '../components/LiveAmount'
import { axisProps, compactMoney, moneyTooltip, tooltipStyle } from '../components/charts'
import {
  AmountInput, Badge, Button, Callout, Card, EmptyState, IconButton, Money, PageHeader, Segmented, Stat, TextInput, Toggle,
} from '../components/ui'
import { dateLabel, today } from '../lib/dates'
import { uid } from '../lib/defaults'
import { formatMoney, validateAmount } from '../lib/money'
import { calculateZakat, etfSeries, HAUL_DAYS, purificationSummary } from '../lib/halal'
import { accountsTotal } from '../lib/selectors'
import type { HalalState, PurificationEntry } from '../lib/types'
import { useStore } from '../store/store'

type Tab = 'zakat' | 'reinigung' | 'etf'

function useHalal() {
  const { data, update } = useStore()
  const set = (recipe: (h: HalalState) => void) => update((d) => recipe(d.halal))
  return { data, halal: data.halal, set }
}

function Zakat() {
  const { data, halal, set } = useHalal()
  const a = halal.zakatAssets
  const cash = halal.useAccountBalances ? accountsTotal(data) : a.cash
  const r = calculateZakat({ ...a, cash, nisab: halal.nisab, haulStart: halal.haulStart, today: today() })

  return (
    <div className="space-y-4">
      <Card title="1. Nisab und Haul">
        <div className="grid gap-4 sm:grid-cols-2">
          <LiveAmount
            label="Nisab (aktueller Wert)"
            value={halal.nisab}
            onChange={(v) => set((h) => { h.nisab = v ?? 0 })}
            hint="Wert von 85 g Gold – ändert sich mit dem Goldpreis, bitte selbst nachschlagen."
          />
          <TextInput
            label="Haul-Start"
            type="date"
            value={halal.haulStart}
            max={today()}
            onChange={(e) => set((h) => { h.haulStart = e.target.value })}
            hint={`Tag, an dem dein Vermögen erstmals den Nisab erreicht hat. Ein Haul = ${HAUL_DAYS} Tage (Mondjahr).`}
          />
        </div>
      </Card>

      <Card title="2. Vermögen">
        <div className="space-y-4">
          <Toggle
            checked={halal.useAccountBalances}
            onChange={(v) => set((h) => { h.useAccountBalances = v })}
            label="Kontostände übernehmen"
            description={`Bargeld & Konten = Summe deiner Konten (${formatMoney(accountsTotal(data))})`}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {!halal.useAccountBalances && (
              <LiveAmount label="Bargeld & Konten" value={a.cash} onChange={(v) => set((h) => { h.zakatAssets.cash = v ?? 0 })} />
            )}
            <LiveAmount label="Gold & Silber (Wert)" value={a.gold} onChange={(v) => set((h) => { h.zakatAssets.gold = v ?? 0 })} />
            <LiveAmount
              label="Investments (zakatpflichtiger Teil)"
              value={a.investments}
              onChange={(v) => set((h) => { h.zakatAssets.investments = v ?? 0 })}
              hint={halal.useAccountBalances ? 'Achtung: Ist das Depot schon in den Konten enthalten, hier 0 eintragen.' : undefined}
            />
            <LiveAmount label="Forderungen (Geld, das du sicher zurückbekommst)" value={a.receivables} onChange={(v) => set((h) => { h.zakatAssets.receivables = v ?? 0 })} />
            <LiveAmount label="Fällige Schulden (werden abgezogen)" value={a.debts} onChange={(v) => set((h) => { h.zakatAssets.debts = v ?? 0 })} />
          </div>
        </div>
      </Card>

      <Card className="border-brand-200 dark:border-brand-900">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Zakatpflichtiges Vermögen" value={<Money value={r.wealth} />} />
          <Stat label="Zakat (2,5 %)" value={<Money value={r.zakat} />} tone={r.due ? 'brand' : undefined} />
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {halal.nisab <= 0 ? <Badge tone="yellow">Nisab eintragen</Badge> : r.aboveNisab ? <Badge tone="green">über Nisab</Badge> : <Badge>unter Nisab</Badge>}
              {r.haulEnd ? (r.haulComplete ? <Badge tone="green">Haul vollendet</Badge> : <Badge tone="blue">noch {r.daysLeft} Tage</Badge>) : <Badge tone="yellow">Haul-Start fehlt</Badge>}
            </div>
          </div>
        </div>
        <div className="mt-4">
          {r.due ? (
            <Callout tone="success" icon={<HandCoins size={18} />}>
              Deine Zakat ist fällig: <b>{formatMoney(r.zakat)}</b>. Danach beginnt ein neuer Haul – trag das neue Startdatum ein.
            </Callout>
          ) : r.aboveNisab && r.haulEnd ? (
            <Callout tone="info" icon={<Info size={18} />}>
              Bleibt dein Vermögen über dem Nisab, ist am {dateLabel(r.haulEnd)} Zakat fällig – nach heutigem Stand {formatMoney(r.zakat)}.
            </Callout>
          ) : halal.nisab > 0 && !r.aboveNisab ? (
            <Callout tone="info" icon={<Info size={18} />}>Dein Vermögen liegt unter dem Nisab – aktuell ist keine Zakat fällig.</Callout>
          ) : null}
        </div>
      </Card>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Vereinfachte Rechnung als Orientierung. Bei Fragen zu Aktien, Rente oder besonderen Fällen bitte eine/n Gelehrte/n fragen.
      </p>
    </div>
  )
}

function Purification() {
  const { halal, set } = useHalal()
  const [type, setType] = useState<PurificationEntry['type']>('unrein')
  const [source, setSource] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const s = purificationSummary(halal.purification)
  const list = [...halal.purification].sort((a, b) => b.date.localeCompare(a.date))

  const add = () => {
    const e: Record<string, string> = {}
    const a = validateAmount(amount)
    if (!a.ok) e.amount = a.error
    if (!source.trim()) e.source = type === 'unrein' ? 'Woher kommt der Ertrag?' : 'Wohin ging die Spende?'
    if (!date) e.date = 'Bitte ein Datum wählen.'
    setErrors(e)
    if (Object.keys(e).length || !a.ok) return
    set((h) => { h.purification.push({ id: uid(), type, source: source.trim(), amount: a.value, date }) })
    setSource('')
    setAmount('')
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card><Stat label="Unrein" value={<Money value={s.impure} />} /></Card>
        <Card><Stat label="Gespendet" value={<Money value={s.donated} />} /></Card>
        <Card><Stat label="Noch spenden" value={<Money value={s.open} />} tone={s.open > 0 ? 'yellow' : 'green'} /></Card>
      </div>

      <Card title="Eintrag hinzufügen">
        <form
          className="space-y-4"
          onSubmit={(ev) => {
            ev.preventDefault()
            add()
          }}
        >
          <Segmented label="Art" value={type} onChange={setType} options={[{ value: 'unrein', label: 'Unreiner Ertrag' }, { value: 'gespendet', label: 'Gespendet' }]} />
          <div className="grid gap-3 sm:grid-cols-[1fr_9rem_10rem]">
            <TextInput
              label={type === 'unrein' ? 'Quelle' : 'Empfänger'}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              error={errors.source}
              placeholder={type === 'unrein' ? 'z. B. Zinsgutschrift, Dividenden-Anteil' : 'z. B. Moschee, Hilfsorganisation'}
              maxLength={60}
            />
            <AmountInput label="Betrag" value={amount} onChange={setAmount} error={errors.amount} />
            <TextInput label="Datum" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
          </div>
          <Button type="submit"><Plus size={18} /> Hinzufügen</Button>
        </form>
      </Card>

      {list.length === 0 ? (
        <EmptyState
          icon={<HandCoins size={36} />}
          title="Noch nichts eingetragen"
          text="Hast du ungewollt Zinsen bekommen oder hat ein Unternehmen im Depot unreine Umsätze? Trag den Betrag ein – die App zeigt, was du noch spenden solltest."
        />
      ) : (
        <Card title="Verlauf">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.map((e) => (
              <li key={e.id} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{e.source}</div>
                  <div className="text-xs text-slate-500">{dateLabel(e.date)} · {e.type === 'unrein' ? 'unreiner Ertrag' : 'Spende'}</div>
                </div>
                <Money value={e.type === 'unrein' ? e.amount : -e.amount} signed className={e.type === 'unrein' ? 'font-semibold text-amber-600' : 'font-semibold text-emerald-600'} />
                <IconButton label="Eintrag löschen" onClick={() => set((h) => { h.purification = h.purification.filter((x) => x.id !== e.id) })}><Trash2 size={16} /></IconButton>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function Etf() {
  const { halal, set } = useHalal()
  const e = halal.etf
  const series = useMemo(() => etfSeries(e.monthly, e.years, e), [e])
  const last = series.at(-1)!

  return (
    <div className="space-y-4">
      <Callout tone="warn" icon={<AlertTriangle size={20} />}>
        <b className="text-base">Keine Garantie, Kurse schwanken, 30 bis 50 % Rückgang sind möglich.</b>
        <div className="mt-1">
          Die Zahlen sind Rechenbeispiele, keine Vorhersage. Investiere nur Geld, das du viele Jahre nicht brauchst – Notgroschen zuerst.
        </div>
      </Callout>

      <Card title="Sparplan">
        <div className="grid gap-4 sm:grid-cols-2">
          <LiveAmount label="Monatsrate" value={e.monthly} onChange={(v) => set((h) => { h.etf.monthly = v ?? 0 })} max={100000} />
          <LiveAmount label="Laufzeit" suffix="Jahre" value={e.years} onChange={(v) => set((h) => { h.etf.years = Math.round(v ?? 0) })} max={60} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <LiveAmount label="Pessimistisch" suffix="%" value={e.pessimistic} onChange={(v) => set((h) => { h.etf.pessimistic = v ?? 0 })} max={30} />
          <LiveAmount label="Normal" suffix="%" value={e.normal} onChange={(v) => set((h) => { h.etf.normal = v ?? 0 })} max={30} />
          <LiveAmount label="Optimistisch" suffix="%" value={e.optimistic} onChange={(v) => set((h) => { h.etf.optimistic = v ?? 0 })} max={30} />
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Angenommene Rendite pro Jahr, nach Kosten. Alles anpassbar.</p>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><Stat label="Eingezahlt" value={<Money value={last.invested} />} /></Card>
        <Card><Stat label={`Pessimistisch ${e.pessimistic} %`} value={<Money value={last.pessimistic} />} /></Card>
        <Card><Stat label={`Normal ${e.normal} %`} value={<Money value={last.normal} />} tone="brand" /></Card>
        <Card><Stat label={`Optimistisch ${e.optimistic} %`} value={<Money value={last.optimistic} />} /></Card>
      </div>

      {e.years > 0 && e.monthly > 0 && (
        <Card title={`Entwicklung über ${e.years} Jahre`}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series.map((p) => ({ ...p, label: `${p.year} J.` }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={20} />
                <YAxis {...axisProps} tickFormatter={compactMoney} width={72} />
                <Tooltip contentStyle={tooltipStyle} formatter={moneyTooltip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="invested" name="Eingezahlt" stroke="var(--chart-text)" strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="pessimistic" name="Pessimistisch" stroke="#f43f5e" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="normal" name="Normal" stroke="var(--chart-save)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line dataKey="optimistic" name="Optimistisch" stroke="var(--chart-fix)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Ein Einbruch von 40 % kurz vor Ende würde aus {formatMoney(last.normal)} nur noch {formatMoney(last.normal * 0.6)} machen. Plane deshalb Zeit zum Aussitzen ein.
          </p>
        </Card>
      )}
    </div>
  )
}

export default function Halal() {
  const [tab, setTab] = useState<Tab>('zakat')
  return (
    <div className="space-y-4">
      <PageHeader title="Halal-Finanzen" subtitle="Zakat, Reinigung unreiner Erträge und ETF-Sparplan." />
      <Callout tone="success" icon={<ShieldCheck size={18} />}>
        Dieser Bereich enthält bewusst keine Zins-Funktionen, keine Kredite und keine Spekulation. Achte beim Investieren auf Shariah-konforme Fonds.
      </Callout>
      <Segmented
        label="Bereich"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'zakat', label: 'Zakat' },
          { value: 'reinigung', label: 'Reinigung' },
          { value: 'etf', label: 'ETF-Sparplan' },
        ]}
      />
      {tab === 'zakat' && <Zakat />}
      {tab === 'reinigung' && <Purification />}
      {tab === 'etf' && <Etf />}
    </div>
  )
}

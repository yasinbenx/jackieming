import { Bell, CalendarPlus, Check, Pencil, Plus, Repeat, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  AmountInput, Badge, Button, Card, ConfirmDialog, EmptyState, IconButton, Modal, Money, PageHeader, Segmented, SelectInput, Stat,
  TextInput, Toggle,
} from '../components/ui'
import {
  cancelDeadline, cancelReminders, contractStatus, contractTotals, noticeText, reminderIcs, type ContractStatus,
} from '../lib/contracts'
import { dateLabel, monthOf, today } from '../lib/dates'
import { uid } from '../lib/defaults'
import { toInputString, validateAmount } from '../lib/money'
import { monthlyAmount, RHYTHM_LABEL } from '../lib/plan'
import { currentPeriod } from '../lib/selectors'
import { downloadFile } from '../lib/storage'
import type { Contract, NoticeUnit, Rhythm } from '../lib/types'
import { useStore } from '../store/store'

const STATUS: Record<ContractStatus, { label: string; tone: 'slate' | 'green' | 'yellow' | 'red' | 'blue' }> = {
  aktiv: { label: 'läuft', tone: 'green' },
  'laeuft-bald-aus': { label: 'läuft bald aus', tone: 'yellow' },
  'frist-bald': { label: 'Kündigungsfrist bald', tone: 'red' },
  ausgelaufen: { label: 'ausgelaufen', tone: 'slate' },
  gekuendigt: { label: 'gekündigt', tone: 'blue' },
}

function ContractForm({ contract, onClose }: { contract?: Contract; onClose: () => void }) {
  const { data, update } = useStore()
  const [name, setName] = useState(contract?.name ?? '')
  const [kind, setKind] = useState<Contract['kind']>(contract?.kind ?? 'abo')
  const [amount, setAmount] = useState(toInputString(contract?.amount))
  const [rhythm, setRhythm] = useState<Rhythm>(contract?.rhythm ?? 'monatlich')
  const [accountId, setAccountId] = useState(contract?.accountId ?? data.accounts[0]?.id ?? '')
  const [startDate, setStartDate] = useState(contract?.startDate ?? '')
  const [endDate, setEndDate] = useState(contract?.endDate ?? '')
  const [noticeValue, setNoticeValue] = useState(String(contract?.noticeValue ?? 1))
  const [noticeUnit, setNoticeUnit] = useState<NoticeUnit>(contract?.noticeUnit ?? 'monate')
  const [cancelled, setCancelled] = useState(contract?.cancelled ?? false)
  const [note, setNote] = useState(contract?.note ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const save = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Bitte einen Namen eingeben.'
    const a = validateAmount(amount)
    if (!a.ok) e.amount = a.error
    const n = Number(noticeValue || '0')
    if (!Number.isInteger(n) || n < 0 || n > 36) e.notice = 'Bitte eine ganze Zahl von 0 bis 36.'
    if (startDate && endDate && endDate < startDate) e.endDate = 'Das Ende liegt vor dem Start.'
    setErrors(e)
    if (Object.keys(e).length || !a.ok) return
    const item: Contract = {
      id: contract?.id ?? uid(),
      name: name.trim(),
      kind,
      amount: a.value,
      rhythm,
      accountId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      noticeValue: n,
      noticeUnit,
      cancelled,
      note: note.trim() || undefined,
    }
    update((d) => {
      const i = d.contracts.findIndex((c) => c.id === item.id)
      if (i >= 0) d.contracts[i] = item
      else d.contracts.push(item)
    })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={contract ? 'Vertrag bearbeiten' : 'Abo oder Vertrag hinzufügen'}
      footer={<><Button variant="secondary" onClick={onClose}>Abbrechen</Button><Button onClick={save}>Speichern</Button></>}
    >
      <div className="space-y-4">
        <Segmented label="Art" value={kind} onChange={setKind} options={[{ value: 'abo', label: 'Abo / Vertrag' }, { value: 'fix', label: 'Fixkosten' }]} />
        <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="z. B. Spotify" autoFocus={!contract} maxLength={40} />
        <div className="grid grid-cols-2 gap-3">
          <AmountInput label="Betrag" value={amount} onChange={setAmount} error={errors.amount} />
          <SelectInput label="Rhythmus" value={rhythm} onChange={(e) => setRhythm(e.target.value as Rhythm)}>
            {(Object.keys(RHYTHM_LABEL) as Rhythm[]).map((r) => <option key={r} value={r}>{RHYTHM_LABEL[r]}</option>)}
          </SelectInput>
        </div>
        <SelectInput label="Wird abgebucht von" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Ohne Konto</option>
          {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </SelectInput>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Beginn (optional)" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <TextInput label="Enddatum (optional)" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} error={errors.endDate} hint="Laufzeitende oder letzter Monat" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Kündigungsfrist" inputMode="numeric" value={noticeValue} onChange={(e) => setNoticeValue(e.target.value.replace(/\D/g, ''))} error={errors.notice} hint="0 = jederzeit" />
          <SelectInput label="Einheit" value={noticeUnit} onChange={(e) => setNoticeUnit(e.target.value as NoticeUnit)}>
            <option value="tage">Tage</option>
            <option value="wochen">Wochen</option>
            <option value="monate">Monate</option>
          </SelectInput>
        </div>
        <Toggle checked={cancelled} onChange={setCancelled} label="Bereits gekündigt" description="Läuft bis zum Enddatum weiter und zählt danach nicht mehr." />
        <TextInput label="Notiz (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
      </div>
    </Modal>
  )
}

export default function Abos() {
  const { data, update } = useStore()
  const now = today()
  const period = currentPeriod(data, now)
  const [filter, setFilter] = useState<'alle' | 'abo' | 'fix'>('alle')
  const [editing, setEditing] = useState<Contract | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Contract | null>(null)
  const totals = contractTotals(data.contracts, period)
  const reminders = cancelReminders(data.contracts, now)
  const accountName = (id: string) => data.accounts.find((a) => a.id === id)?.name ?? 'ohne Konto'

  const order: Record<ContractStatus, number> = { 'frist-bald': 0, 'laeuft-bald-aus': 1, aktiv: 2, gekuendigt: 3, ausgelaufen: 4 }
  const list = data.contracts
    .filter((c) => filter === 'alle' || c.kind === filter)
    .map((c) => ({ c, status: contractStatus(c, now) }))
    .sort((a, b) => order[a.status] - order[b.status] || monthlyAmount(b.c) - monthlyAmount(a.c))

  return (
    <div className="space-y-4">
      <PageHeader
        title="Abos & Verträge"
        subtitle="Alle festen Kosten an einem Ort – inklusive Kündigungsfristen."
        action={<Button onClick={() => setEditing('new')}><Plus size={18} /> <span className="hidden sm:inline">Hinzufügen</span></Button>}
      />

      <div className="grid grid-cols-2 gap-3">
        <Card><Stat label="Pro Monat" value={<Money value={totals.monthly} />} hint={`${totals.count} laufende Posten`} /></Card>
        <Card><Stat label="Pro Jahr" value={<Money value={totals.yearly} />} /></Card>
      </div>

      <Card title={<span className="flex items-center gap-2"><Bell size={18} /> Kündigungs-Erinnerungen</span>}>
        {reminders.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Keine Verträge mit Enddatum. Trag bei Verträgen mit Laufzeit ein Enddatum ein, dann erinnert dich die App an die Kündigungsfrist.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {reminders.map((r) => (
              <li key={r.contract.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{r.contract.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    kündigen bis <b>{dateLabel(r.deadline)}</b> · endet {dateLabel(r.contract.endDate!)} · Frist {noticeText(r.contract)}
                  </div>
                </div>
                {r.daysLeft < 0 ? (
                  <Badge tone="red">Frist verpasst</Badge>
                ) : r.daysLeft <= 30 ? (
                  <Badge tone="yellow">noch {r.daysLeft} Tage</Badge>
                ) : (
                  <Badge>in {r.daysLeft} Tagen</Badge>
                )}
                <div className="flex gap-1">
                  <IconButton
                    label="Erinnerung in den Kalender"
                    onClick={() => downloadFile(`kuendigen-${r.contract.name.replace(/\W+/g, '-')}.ics`, reminderIcs(r), 'text/calendar')}
                  >
                    <CalendarPlus size={17} />
                  </IconButton>
                  <IconButton
                    label="Als gekündigt markieren"
                    onClick={() => update((d) => { d.contracts.find((c) => c.id === r.contract.id)!.cancelled = true })}
                  >
                    <Check size={17} />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex justify-between gap-2">
        <Segmented
          label="Filter"
          value={filter}
          onChange={setFilter}
          options={[{ value: 'alle', label: 'Alle' }, { value: 'abo', label: 'Abos' }, { value: 'fix', label: 'Fixkosten' }]}
        />
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<Repeat size={36} />}
          title="Nichts eingetragen"
          text="Trag Handy, Streaming, Ticket und andere feste Kosten ein. So siehst du, was jeden Monat automatisch weggeht."
          action={<Button onClick={() => setEditing('new')}><Plus size={18} /> Hinzufügen</Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map(({ c, status }) => {
            const deadline = cancelDeadline(c)
            return (
              <Card key={c.id} className={status === 'ausgelaufen' ? 'opacity-60' : undefined}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{c.name}</h2>
                      <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {c.kind === 'abo' ? 'Abo' : 'Fixkosten'} · {accountName(c.accountId)}
                    </div>
                  </div>
                  <div className="flex shrink-0">
                    <IconButton label={`${c.name} bearbeiten`} onClick={() => setEditing(c)}><Pencil size={16} /></IconButton>
                    <IconButton label={`${c.name} löschen`} onClick={() => setDeleting(c)}><Trash2 size={16} /></IconButton>
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <div>Kündigungsfrist: {noticeText(c)}</div>
                    {c.endDate && <div>Ende: {dateLabel(c.endDate)}{deadline && !c.cancelled && ` · kündigen bis ${dateLabel(deadline)}`}</div>}
                    {c.startDate && monthOf(c.startDate) > period && <div>startet {dateLabel(c.startDate)}</div>}
                  </div>
                  <div className="text-right">
                    <Money value={c.amount} className="text-lg font-bold" />
                    <div className="text-xs text-slate-500">
                      {RHYTHM_LABEL[c.rhythm]}
                      {c.rhythm !== 'monatlich' && <> · <Money value={monthlyAmount(c)} />/Monat</>}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {editing && <ContractForm contract={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Eintrag löschen?"
        text={deleting && <>„{deleting.name}“ wird gelöscht und zählt nicht mehr zu deinen Fixkosten.</>}
        onConfirm={() => deleting && update((d) => { d.contracts = d.contracts.filter((c) => c.id !== deleting.id) })}
      />
    </div>
  )
}

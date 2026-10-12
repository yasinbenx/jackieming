import { Landmark, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  AmountInput, Button, Card, ConfirmDialog, EmptyState, Field, IconButton, InlineAmount, Modal, Money, PageHeader, Stat, TextInput, cx,
} from '../components/ui'
import { dateLabel, today } from '../lib/dates'
import { ACCOUNT_COLORS, uid } from '../lib/defaults'
import { toInputString, validateAmount } from '../lib/money'
import { accountsTotal } from '../lib/selectors'
import type { Account } from '../lib/types'
import { useStore } from '../store/store'

function AccountForm({ open, onClose, account }: { open: boolean; onClose: () => void; account?: Account }) {
  const { data, update } = useStore()
  const [name, setName] = useState(account?.name ?? '')
  const [purpose, setPurpose] = useState(account?.purpose ?? '')
  const [balance, setBalance] = useState(account ? toInputString(account.balance) : '0')
  const [color, setColor] = useState(account?.color ?? ACCOUNT_COLORS[data.accounts.length % ACCOUNT_COLORS.length])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const save = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Bitte einen Namen eingeben.'
    const b = validateAmount(balance, { allowZero: true })
    if (!b.ok) e.balance = b.error
    setErrors(e)
    if (Object.keys(e).length || !b.ok) return
    update((d) => {
      const item: Account = {
        id: account?.id ?? uid(),
        name: name.trim(),
        purpose: purpose.trim(),
        balance: b.value,
        color,
        updatedAt: account && account.balance === b.value ? account.updatedAt : today(),
      }
      const i = d.accounts.findIndex((a) => a.id === item.id)
      if (i >= 0) d.accounts[i] = item
      else d.accounts.push(item)
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={account ? 'Konto bearbeiten' : 'Konto hinzufügen'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button onClick={save}>Speichern</Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="z. B. Tagesgeld" autoFocus maxLength={40} />
        <TextInput label="Aufgabe des Kontos" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="z. B. Alltag und Spaß" maxLength={60} hint="Eine feste Aufgabe pro Konto schafft Ordnung." />
        <AmountInput label="Kontostand" value={balance} onChange={setBalance} error={errors.balance} />
        <Field label="Farbe">
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Farbe ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={cx('h-9 w-9 rounded-full ring-offset-2 transition dark:ring-offset-slate-900', color === c && 'ring-2 ring-slate-900 dark:ring-white')}
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  )
}

export default function Konten() {
  const { data, update } = useStore()
  const [editing, setEditing] = useState<Account | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Account | null>(null)
  const total = accountsTotal(data)

  const usage = (id: string) => ({
    expenses: data.expenses.filter((e) => e.accountId === id).length,
    contracts: data.contracts.filter((c) => c.accountId === id).length,
    goals: data.goals.filter((g) => g.accountId === id),
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Konten"
        subtitle="Jedes Konto hat eine feste Aufgabe. Kontostände trägst du selbst ein."
        action={<Button onClick={() => setEditing('new')}><Plus size={18} /> <span className="hidden sm:inline">Konto</span></Button>}
      />

      <Card>
        <Stat label="Gesamt auf allen Konten" value={<Money value={total} />} />
      </Card>

      {data.accounts.length === 0 ? (
        <EmptyState
          icon={<Landmark size={36} />}
          title="Noch keine Konten"
          text="Lege deine Konten an, z. B. Girokonto für Gehalt und Fixkosten, eins für den Alltag und eins zum Investieren."
          action={<Button onClick={() => setEditing('new')}><Plus size={18} /> Konto hinzufügen</Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.accounts.map((a) => {
            const u = usage(a.id)
            const potSum = u.goals.reduce((s, g) => s + g.current, 0)
            return (
              <Card key={a.id} className="relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: a.color }} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">{a.name}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{a.purpose || 'Keine Aufgabe festgelegt'}</p>
                  </div>
                  <div className="flex shrink-0">
                    <IconButton label={`${a.name} bearbeiten`} onClick={() => setEditing(a)}><Pencil size={17} /></IconButton>
                    <IconButton label={`${a.name} löschen`} onClick={() => setDeleting(a)}><Trash2 size={17} /></IconButton>
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Stand vom {dateLabel(a.updatedAt)}
                    {u.goals.length > 0 && (
                      <div className="mt-1">
                        Töpfe hier: {u.goals.map((g) => g.emoji).join(' ')} <Money value={potSum} />
                      </div>
                    )}
                  </div>
                  <InlineAmount
                    className="w-40"
                    label={`Kontostand ${a.name}`}
                    value={a.balance}
                    onCommit={(v) =>
                      update((d) => {
                        const acc = d.accounts.find((x) => x.id === a.id)!
                        acc.balance = v
                        acc.updatedAt = today()
                      })
                    }
                  />
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {editing && (
        <AccountForm open onClose={() => setEditing(null)} account={editing === 'new' ? undefined : editing} />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Konto löschen?"
        text={
          deleting && (
            <>
              <p><b>{deleting.name}</b> wird gelöscht.</p>
              {(() => {
                const u = usage(deleting.id)
                const n = u.expenses + u.contracts + u.goals.length
                return n > 0 ? (
                  <p className="mt-2 text-sm">
                    {n} Einträge (Ausgaben, Verträge, Töpfe) sind diesem Konto zugeordnet. Sie bleiben erhalten, stehen danach aber „ohne Konto“.
                  </p>
                ) : null
              })()}
            </>
          )
        }
        onConfirm={() =>
          deleting &&
          update((d) => {
            d.accounts = d.accounts.filter((a) => a.id !== deleting.id)
            for (const e of d.expenses) if (e.accountId === deleting.id) e.accountId = ''
            for (const c of d.contracts) if (c.accountId === deleting.id) c.accountId = ''
            for (const g of d.goals) if (g.accountId === deleting.id) g.accountId = undefined
          })
        }
      />
    </div>
  )
}

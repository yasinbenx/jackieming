import { useEffect, useState } from 'react'
import { today } from '../lib/dates'
import { uid } from '../lib/defaults'
import { toInputString, validateAmount } from '../lib/money'
import type { Expense } from '../lib/types'
import { useStore } from '../store/store'
import { AmountInput, Button, Field, Modal, SelectInput, TextInput, cx } from './ui'

const LAST_ACCOUNT_KEY = 'finanzplaner:letztes-konto'

function defaultAccount(accounts: { id: string; purpose: string }[]): string {
  try {
    const last = localStorage.getItem(LAST_ACCOUNT_KEY)
    if (last && accounts.some((a) => a.id === last)) return last
  } catch {
    /* egal */
  }
  return accounts.find((a) => /alltag/i.test(a.purpose))?.id ?? accounts[0]?.id ?? ''
}

export default function ExpenseForm({ open, onClose, expense }: { open: boolean; onClose: () => void; expense?: Expense }) {
  const { data, update } = useStore()
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [accountId, setAccountId] = useState('')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setAmount(expense ? toInputString(expense.amount) : '')
    setCategory(expense?.category ?? '')
    setAccountId(expense?.accountId ?? defaultAccount(data.accounts))
    setDate(expense?.date ?? today())
    setNote(expense?.note ?? '')
    setErrors({})
  }, [open, expense])

  const save = () => {
    const e: Record<string, string> = {}
    const a = validateAmount(amount)
    if (!a.ok) e.amount = a.error
    if (!category) e.category = 'Bitte eine Kategorie wählen.'
    if (!date) e.date = 'Bitte ein Datum wählen.'
    setErrors(e)
    if (!a.ok || Object.keys(e).length) return
    const item: Expense = { id: expense?.id ?? uid(), amount: a.value, category, accountId, date, note: note.trim() || undefined }
    update((d) => {
      const i = d.expenses.findIndex((x) => x.id === item.id)
      if (i >= 0) d.expenses[i] = item
      else d.expenses.push(item)
    })
    try {
      localStorage.setItem(LAST_ACCOUNT_KEY, accountId)
    } catch {
      /* egal */
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={expense ? 'Ausgabe bearbeiten' : 'Ausgabe erfassen'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button onClick={save}>Speichern</Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(ev) => {
          ev.preventDefault()
          save()
        }}
      >
        <AmountInput label="Betrag" value={amount} onChange={setAmount} error={errors.amount} autoFocus />
        <Field label="Kategorie" error={errors.category}>
          <div className="flex flex-wrap gap-2">
            {data.settings.categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={cx(
                  'rounded-full border px-3 py-1.5 text-sm transition',
                  category === c
                    ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-400 dark:bg-brand-500 dark:text-slate-950'
                    : 'border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <SelectInput label="Konto" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Ohne Konto</option>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </SelectInput>
          <TextInput label="Datum" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
        </div>
        <TextInput label="Notiz (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Döner mit Freunden" maxLength={80} />
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

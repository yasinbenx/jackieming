import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
} from 'react'
import { addMonths, monthLabel } from '../lib/dates'
import { formatMoney, toInputString, validateAmount } from '../lib/money'
import type { Traffic } from '../lib/selectors'
import type { Month } from '../lib/types'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/* ---------- Layout ---------- */

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section
      className={cx(
        'rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Traffic | 'brand' }) {
  const toneCls =
    tone === 'green' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'yellow' ? 'text-amber-600 dark:text-amber-400'
    : tone === 'red' ? 'text-rose-600 dark:text-rose-400'
    : tone === 'brand' ? 'text-brand-700 dark:text-brand-300'
    : ''
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className={cx('tabular mt-1 text-2xl font-bold sm:text-3xl', toneCls)}>{value}</div>
      {hint && <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</div>}
    </div>
  )
}

export function Money({ value, className, signed }: { value: number; className?: string; signed?: boolean }) {
  return (
    <span className={cx('tabular whitespace-nowrap', className)}>
      {signed && value > 0 ? '+' : ''}
      {formatMoney(value)}
    </span>
  )
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
      {icon && <div className="mb-3 text-slate-400">{icon}</div>}
      <div className="font-semibold">{title}</div>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'yellow' | 'red' | 'brand' | 'blue' }) {
  const map = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    yellow: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    red: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
    brand: 'bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-300',
    blue: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  }
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', map[tone])}>{children}</span>
}

export function Progress({ value, max, color, tone, className }: { value: number; max: number; color?: string; tone?: Traffic; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const toneCls = tone === 'green' ? 'bg-emerald-500' : tone === 'yellow' ? 'bg-amber-500' : tone === 'red' ? 'bg-rose-500' : 'bg-brand-500'
  return (
    <div
      className={cx('h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cx('h-full rounded-full transition-all', !color && toneCls)} style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function Callout({ tone = 'info', children, icon }: { tone?: 'info' | 'warn' | 'danger' | 'success'; children: ReactNode; icon?: ReactNode }) {
  const map = {
    info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200',
    warn: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
    danger: 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200',
    success: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
  }
  return (
    <div className={cx('flex gap-3 rounded-xl border p-3 text-sm', map[tone])}>
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/* ---------- Buttons ---------- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' }

export function Button({ variant = 'primary', size = 'md', className, ...rest }: BtnProps) {
  const v = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:text-slate-950 dark:hover:bg-brand-400',
    secondary: 'border border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800',
    ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  }[variant]
  const s = size === 'sm' ? 'h-9 px-3 text-sm' : 'h-11 px-4'
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        v, s, className,
      )}
      {...rest}
    />
  )
}

export function IconButton({ label, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
        className,
      )}
      {...rest}
    />
  )
}

/* ---------- Formular ---------- */

const inputCls =
  'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-950'

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  )
}

export function TextInput({ label, error, hint, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const id = useId()
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id}>
      <input id={id} className={cx(inputCls, error && 'border-rose-500', className)} aria-invalid={!!error} {...rest} />
    </Field>
  )
}

export function AmountInput({
  label, value, onChange, error, hint, suffix = '€', autoFocus, placeholder = '0,00',
}: { label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; suffix?: string; autoFocus?: boolean; placeholder?: string }) {
  const id = useId()
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id}>
      <div className="relative">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cx(inputCls, 'tabular pr-10', error && 'border-rose-500')}
          aria-invalid={!!error}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">{suffix}</span>
      </div>
    </Field>
  )
}

export function SelectInput({ label, error, hint, children, className, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: string }) {
  const id = useId()
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id}>
      <select id={id} className={cx(inputCls, 'appearance-auto', className)} {...rest}>
        {children}
      </select>
    </Field>
  )
}

/**
 * Betrag direkt in einer Liste ändern. Speichert beim Verlassen des Feldes oder mit Enter,
 * zeigt bei ungültiger Eingabe einen Hinweis und stellt den alten Wert wieder her.
 */
export function InlineAmount({
  value, onCommit, label, allowZero = true, className,
}: { value: number; onCommit: (v: number) => void; label: string; allowZero?: boolean; className?: string }) {
  const [text, setText] = useState(toInputString(value))
  const [error, setError] = useState<string>()
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(toInputString(value))
  }, [value])
  const commit = () => {
    focused.current = false
    const r = validateAmount(text, { allowZero })
    if (!r.ok) {
      setError(r.error)
      setText(toInputString(value))
      setTimeout(() => setError(undefined), 3000)
      return
    }
    setError(undefined)
    if (r.value !== value) onCommit(r.value)
    setText(toInputString(r.value))
  }
  return (
    <div className={className}>
      <div className="relative">
        <input
          aria-label={label}
          inputMode="decimal"
          value={text}
          onFocus={(e) => {
            focused.current = true
            e.target.select()
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className={cx(inputCls, 'tabular h-10 pr-8 text-right font-semibold', error && 'border-rose-500')}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">€</span>
      </div>
      {error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  )
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-sm text-slate-500 dark:text-slate-400">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-brand-600 dark:bg-brand-500' : 'bg-slate-300 dark:bg-slate-700')}
      >
        <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  )
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition',
            value === o.value ? 'bg-white shadow-sm dark:bg-slate-950' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- Dialoge ---------- */

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold">{title}</h2>
          <IconButton label="Schließen" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="pb-safe flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, text, confirmLabel = 'Löschen', danger = true,
}: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; text: ReactNode; confirmLabel?: string; danger?: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-slate-600 dark:text-slate-300">{text}</div>
    </Modal>
  )
}

/** Monat vor/zurück blättern */
export function MonthSwitcher({ value, onChange, sub }: { value: Month; onChange: (m: Month) => void; sub?: string }) {
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
      <IconButton label="Vorheriger Monat" onClick={() => onChange(addMonths(value, -1))}>
        <ChevronLeft size={20} />
      </IconButton>
      <div className="min-w-32 text-center">
        <div className="font-semibold">{monthLabel(value, true)}</div>
        {sub && <div className="text-xs text-slate-500 dark:text-slate-400">{sub}</div>}
      </div>
      <IconButton label="Nächster Monat" onClick={() => onChange(addMonths(value, 1))}>
        <ChevronRight size={20} />
      </IconButton>
    </div>
  )
}

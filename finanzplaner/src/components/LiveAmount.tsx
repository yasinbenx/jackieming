import { useEffect, useState } from 'react'
import { toInputString, validateAmount } from '../lib/money'
import { AmountInput } from './ui'

/** Betragsfeld, das bei gültiger Eingabe sofort übernimmt. Leer = null (wenn erlaubt). */
export default function LiveAmount({
  label, value, onChange, nullable, placeholder, hint, suffix, max,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  nullable?: boolean
  placeholder?: string
  hint?: string
  suffix?: string
  max?: number
}) {
  const [text, setText] = useState(toInputString(value))
  const [error, setError] = useState<string>()
  useEffect(() => {
    setText((t) => {
      const r = validateAmount(t, { allowZero: true })
      const same = (r.ok && r.value === value) || (!t.trim() && (value === null || value === 0))
      return same ? t : toInputString(value)
    })
  }, [value])
  return (
    <AmountInput
      label={label}
      value={text}
      placeholder={placeholder}
      hint={hint}
      suffix={suffix}
      error={error}
      onChange={(t) => {
        setText(t)
        if (!t.trim()) {
          setError(undefined)
          onChange(nullable ? null : 0)
          return
        }
        const r = validateAmount(t, { allowZero: true, max })
        if (!r.ok) return setError(r.error)
        setError(undefined)
        onChange(r.value)
      }}
    />
  )
}


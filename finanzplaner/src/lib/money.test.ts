import { describe, expect, it } from 'vitest'
import { formatMoney, parseAmount, validateAmount } from './money'

describe('parseAmount', () => {
  it.each([
    ['8,99', 8.99],
    ['1.234,56', 1234.56],
    ['1234.5', 1234.5],
    ['1.200', 1200],
    ['1 200 €', 1200],
    ['12.50', 12.5],
    ['-5', -5],
    ['0', 0],
  ])('%s → %s', (input, expected) => expect(parseAmount(input)).toBe(expected))

  it.each(['', '  ', 'abc', '1,2,3', '12a'])('ungültig: "%s"', (input) => expect(parseAmount(input)).toBeNull())
})

describe('validateAmount', () => {
  it('lehnt leere, negative und Null-Beträge ab', () => {
    expect(validateAmount('').ok).toBe(false)
    expect(validateAmount('-3').ok).toBe(false)
    expect(validateAmount('0').ok).toBe(false)
    expect(validateAmount('0', { allowZero: true })).toEqual({ ok: true, value: 0 })
    expect(validateAmount('9,99')).toEqual({ ok: true, value: 9.99 })
  })
})

describe('formatMoney', () => {
  it('formatiert deutsch', () => {
    expect(formatMoney(1234.5).replace(/\s/g, ' ')).toBe('1.234,50 €')
    expect(formatMoney(500).replace(/\s/g, ' ')).toBe('500 €')
  })
})

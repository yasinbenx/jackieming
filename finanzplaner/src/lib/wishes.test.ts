import { describe, expect, it } from 'vitest'
import { wishStatus } from './wishes'

describe('48-Stunden-Regel', () => {
  const created = '2026-10-10T12:00:00.000Z'
  const at = (iso: string) => new Date(iso).getTime()
  it('gesperrt direkt nach dem Eintragen', () => {
    expect(wishStatus(created, at('2026-10-10T12:00:00Z'))).toEqual({ allowed: false, hoursLeft: 48, progress: 0 })
  })
  it('nach 47,5 Stunden noch gesperrt', () => {
    expect(wishStatus(created, at('2026-10-12T11:30:00Z')).allowed).toBe(false)
    expect(wishStatus(created, at('2026-10-12T11:30:00Z')).hoursLeft).toBe(1)
  })
  it('ab 48 Stunden erlaubt', () => {
    expect(wishStatus(created, at('2026-10-12T12:00:00Z')).allowed).toBe(true)
  })
})

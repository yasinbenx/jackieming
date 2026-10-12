import { describe, expect, it } from 'vitest'
import { cancelDeadline, cancelReminders, contractStatus, contractTotals } from './contracts'
import { sampleData } from './defaults'
import type { Contract } from './types'

const c: Contract = {
  id: 'x', name: 'Handy', amount: 65, rhythm: 'monatlich', accountId: 'db', kind: 'fix',
  endDate: '2026-12-31', noticeValue: 3, noticeUnit: 'monate', cancelled: false,
}

describe('Kündigungsfristen', () => {
  it('Frist in Monaten, Tagen, Wochen', () => {
    expect(cancelDeadline(c)).toBe('2026-09-30')
    expect(cancelDeadline({ ...c, noticeUnit: 'tage', noticeValue: 14 })).toBe('2026-12-17')
    expect(cancelDeadline({ ...c, noticeUnit: 'wochen', noticeValue: 2 })).toBe('2026-12-17')
    expect(cancelDeadline({ ...c, endDate: '2027-05-31', noticeValue: 3 })).toBe('2027-02-28')
    expect(cancelDeadline({ ...c, endDate: undefined })).toBeNull()
  })
  it('Status', () => {
    expect(contractStatus(c, '2026-12-01')).toBe('laeuft-bald-aus')
    expect(contractStatus(c, '2027-01-01')).toBe('ausgelaufen')
    expect(contractStatus(c, '2026-09-15')).toBe('frist-bald')
    expect(contractStatus({ ...c, cancelled: true }, '2026-12-01')).toBe('gekuendigt')
    expect(contractStatus({ ...c, endDate: undefined }, '2026-12-01')).toBe('aktiv')
  })
  it('Erinnerungen sortiert nach Frist', () => {
    const r = cancelReminders(sampleData().contracts, '2026-10-12')
    // Kronenrechnung: Fixkosten ohne Frist → endet von selbst, keine Erinnerung
    expect(r.map((x) => x.contract.name)).toEqual(['Handy'])
    expect(r[0].deadline).toBe('2026-11-30')
    expect(r[0].daysLeft).toBe(49)
  })
})

describe('Summen', () => {
  it('Summe pro Monat und Jahr', () => {
    const t = contractTotals(sampleData().contracts, '2027-02')
    expect(t.monthly).toBe(311.97)
    expect(t.yearly).toBe(3743.64)
  })
})

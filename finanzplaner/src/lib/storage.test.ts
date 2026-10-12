import { describe, expect, it } from 'vitest'
import { sampleData } from './defaults'
import { parseImport, toCSV } from './storage'

describe('Import', () => {
  it('Export → Import ergibt dieselben Daten', () => {
    const d = sampleData()
    expect(parseImport(JSON.stringify(d))).toEqual(d)
  })
  it('lehnt kaputte oder fremde Dateien ab', () => {
    expect(() => parseImport('kein json')).toThrow(/JSON/)
    expect(() => parseImport('{"foo": 1}')).toThrow(/keine gültigen/)
    expect(() => parseImport('{"goals": "x"}')).toThrow(/beschädigt/)
  })
  it('ergänzt fehlende Felder', () => {
    const d = parseImport('{"goals": []}')
    expect(d.settings.currency).toBe('EUR')
    expect(d.halal.etf.normal).toBe(5)
  })
})

describe('CSV', () => {
  it('Semikolon, Dezimalkomma und Escaping', () => {
    const csv = toCSV(['Name', 'Betrag'], [['Döner; groß', 8.5]])
    expect(csv).toBe('﻿Name;Betrag\r\n"Döner; groß";8,5')
  })
})

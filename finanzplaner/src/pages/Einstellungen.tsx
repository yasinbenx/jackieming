import { AlertTriangle, Download, FileSpreadsheet, Plus, RotateCcw, Smartphone, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  Button, Callout, Card, ConfirmDialog, Modal, PageHeader, Segmented, SelectInput, TextInput,
} from '../components/ui'
import { dateLabel, monthLabel, today } from '../lib/dates'
import { emptyData, sampleData } from '../lib/defaults'
import { RHYTHM_LABEL, monthlyAmount } from '../lib/plan'
import { downloadFile, parseImport, toCSV } from '../lib/storage'
import type { AppData, Theme } from '../lib/types'
import { useStore } from '../store/store'

const CURRENCIES = [
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'CHF', label: 'Schweizer Franken (CHF)' },
  { code: 'USD', label: 'US-Dollar ($)' },
  { code: 'GBP', label: 'Britisches Pfund (£)' },
  { code: 'TRY', label: 'Türkische Lira (₺)' },
]

const LAST_EXPORT_KEY = 'finanzplaner:letzter-export'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

function useInstallPrompt() {
  const [evt, setEvt] = useState<InstallPromptEvent | null>(null)
  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault()
      setEvt(e as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', on)
    return () => window.removeEventListener('beforeinstallprompt', on)
  }, [])
  return evt
}

function readLastExport(): string | null {
  try {
    return localStorage.getItem(LAST_EXPORT_KEY)
  } catch {
    return null
  }
}

export default function Einstellungen() {
  const { data, update, replace } = useStore()
  const s = data.settings
  const [newCat, setNewCat] = useState('')
  const [catError, setCatError] = useState<string>()
  const [importData, setImportData] = useState<AppData | null>(null)
  const [importError, setImportError] = useState<string>()
  const [message, setMessage] = useState<string>()
  const [resetOpen, setResetOpen] = useState(false)
  const [resetText, setResetText] = useState('')
  const [sampleOpen, setSampleOpen] = useState(false)
  const [lastExport, setLastExport] = useState(readLastExport)
  const fileRef = useRef<HTMLInputElement>(null)
  const install = useInstallPrompt()
  const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches

  const exportJson = () => {
    downloadFile(`finanzplaner-backup-${today()}.json`, JSON.stringify(data, null, 2), 'application/json')
    try {
      localStorage.setItem(LAST_EXPORT_KEY, today())
    } catch {
      /* egal */
    }
    setLastExport(today())
  }

  const accountName = (id: string) => data.accounts.find((a) => a.id === id)?.name ?? ''
  const csvExports: { label: string; file: string; make: () => string }[] = [
    {
      label: 'Ausgaben',
      file: 'ausgaben',
      make: () =>
        toCSV(
          ['Datum', 'Betrag', 'Kategorie', 'Konto', 'Notiz'],
          [...data.expenses].sort((a, b) => a.date.localeCompare(b.date)).map((e) => [dateLabel(e.date), e.amount, e.category, accountName(e.accountId), e.note ?? '']),
        ),
    },
    {
      label: 'Abos & Verträge',
      file: 'vertraege',
      make: () =>
        toCSV(
          ['Name', 'Art', 'Betrag', 'Rhythmus', 'Pro Monat', 'Konto', 'Beginn', 'Ende', 'Kündigungsfrist', 'Gekündigt'],
          data.contracts.map((c) => [
            c.name, c.kind === 'abo' ? 'Abo' : 'Fixkosten', c.amount, RHYTHM_LABEL[c.rhythm], monthlyAmount(c), accountName(c.accountId),
            c.startDate ? dateLabel(c.startDate) : '', c.endDate ? dateLabel(c.endDate) : '', `${c.noticeValue} ${c.noticeUnit}`, c.cancelled ? 'ja' : 'nein',
          ]),
        ),
    },
    {
      label: 'Sparziele',
      file: 'sparziele',
      make: () =>
        toCSV(
          ['Priorität', 'Name', 'Stand', 'Ziel', 'Mindestens', 'Zieldatum', 'Sparrate', 'Rate ab'],
          [...data.goals].sort((a, b) => a.priority - b.priority).map((g) => [
            g.priority, g.name, g.current, g.target ?? 'offen', g.minTarget ?? '', g.targetDate ? monthLabel(g.targetDate) : '', g.monthlyRate, g.rateFrom ? monthLabel(g.rateFrom) : '',
          ]),
        ),
    },
    {
      label: 'Konten',
      file: 'konten',
      make: () => toCSV(['Name', 'Aufgabe', 'Stand', 'Stand vom'], data.accounts.map((a) => [a.name, a.purpose, a.balance, dateLabel(a.updatedAt)])),
    },
    {
      label: 'Check-ins',
      file: 'checkins',
      make: () => toCSV(['Datum', 'Konten', 'Töpfe', 'Ausgaben 7 Tage', 'Notiz'], data.checkIns.map((c) => [dateLabel(c.date), c.accountsTotal, c.potsTotal, c.weekSpent, c.note ?? ''])),
    },
  ]

  const onFile = async (file: File) => {
    setImportError(undefined)
    try {
      if (file.size > 10_000_000) throw new Error('Die Datei ist zu groß.')
      setImportData(parseImport(await file.text()))
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import fehlgeschlagen.')
    }
  }

  const addCategory = () => {
    const c = newCat.trim()
    if (!c) return setCatError('Bitte einen Namen eingeben.')
    if (s.categories.some((x) => x.toLowerCase() === c.toLowerCase())) return setCatError('Gibt es schon.')
    setCatError(undefined)
    update((d) => { d.settings.categories.push(c) })
    setNewCat('')
  }

  const daysSinceExport = lastExport ? Math.round((Date.parse(today()) - Date.parse(lastExport)) / 86_400_000) : null

  return (
    <div className="space-y-4">
      <PageHeader title="Einstellungen" subtitle="Darstellung, Daten sichern und mehr." />

      {message && <Callout tone="success">{message}</Callout>}

      <Card title="Darstellung">
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Farbmodus</div>
            <Segmented<Theme>
              label="Farbmodus"
              value={s.theme}
              onChange={(v) => update((d) => { d.settings.theme = v })}
              options={[{ value: 'system', label: 'Automatisch' }, { value: 'light', label: 'Hell' }, { value: 'dark', label: 'Dunkel' }]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectInput label="Währung" value={s.currency} onChange={(e) => update((d) => { d.settings.currency = e.target.value })}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </SelectInput>
            <SelectInput
              label="Monatsbeginn"
              value={s.monthStartDay}
              onChange={(e) => update((d) => { d.settings.monthStartDay = Number(e.target.value) })}
              hint="Bekommst du dein Gehalt z. B. am 27., beginnt dein Budgetmonat am 27."
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d === 1 ? '1. (Kalendermonat)' : `${d}.`}</option>
              ))}
            </SelectInput>
          </div>
        </div>
      </Card>

      <Card title="Ausgaben-Kategorien">
        <div className="flex flex-wrap gap-2">
          {s.categories.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pr-1 pl-3 text-sm dark:bg-slate-800">
              {c}
              <button
                type="button"
                aria-label={`${c} entfernen`}
                disabled={s.categories.length <= 1}
                onClick={() => update((d) => { d.settings.categories = d.settings.categories.filter((x) => x !== c) })}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-700"
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
        <form
          className="mt-3 flex items-start gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            addCategory()
          }}
        >
          <div className="flex-1">
            <TextInput label="Neue Kategorie" value={newCat} onChange={(e) => setNewCat(e.target.value)} error={catError} maxLength={30} />
          </div>
          <Button type="submit" variant="secondary" className="mt-6" aria-label="Kategorie hinzufügen"><Plus size={18} /></Button>
        </form>
        <p className="mt-2 text-xs text-slate-500">Bereits erfasste Ausgaben behalten ihre Kategorie.</p>
      </Card>

      <Card title="Daten sichern">
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Deine Daten liegen nur in diesem Browser. Wenn du den Browser-Speicher löschst oder das Handy wechselst, sind sie weg – exportiere deshalb regelmäßig ein Backup.
        </p>
        {daysSinceExport === null ? (
          <div className="mb-3"><Callout tone="warn">Du hast noch nie ein Backup gemacht.</Callout></div>
        ) : daysSinceExport > 30 ? (
          <div className="mb-3"><Callout tone="warn">Letztes Backup vor {daysSinceExport} Tagen.</Callout></div>
        ) : (
          <p className="mb-3 text-sm text-emerald-600 dark:text-emerald-400">Letztes Backup: {dateLabel(lastExport!)}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportJson}><Download size={18} /> Backup exportieren (JSON)</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload size={18} /> Backup importieren</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
              e.target.value = ''
            }}
          />
        </div>
        {importError && <div className="mt-3"><Callout tone="danger">{importError}</Callout></div>}

        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="mb-2 text-sm font-medium">Als Tabelle (CSV, öffnet in Excel/Numbers)</div>
          <div className="flex flex-wrap gap-2">
            {csvExports.map((c) => (
              <Button key={c.file} size="sm" variant="secondary" onClick={() => downloadFile(`${c.file}-${today()}.csv`, c.make(), 'text/csv;charset=utf-8')}>
                <FileSpreadsheet size={16} /> {c.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {!standalone && (
        <Card title={<span className="flex items-center gap-2"><Smartphone size={18} /> Als App installieren</span>}>
          {install ? (
            <Button onClick={() => install.prompt()}>Auf dem Startbildschirm installieren</Button>
          ) : (
            <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
              <li><b>iPhone (Safari):</b> Teilen-Symbol → „Zum Home-Bildschirm“</li>
              <li><b>Android (Chrome):</b> Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“</li>
              <li><b>Desktop (Chrome/Edge):</b> Installieren-Symbol rechts in der Adressleiste</li>
            </ul>
          )}
          <p className="mt-2 text-xs text-slate-500">Die App funktioniert danach auch offline.</p>
        </Card>
      )}

      <Card title="Neu anfangen" className="border-rose-200 dark:border-rose-900">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setSampleOpen(true)}><RotateCcw size={18} /> Beispieldaten laden</Button>
          <Button variant="danger" onClick={() => { setResetText(''); setResetOpen(true) }}><AlertTriangle size={18} /> Alles zurücksetzen</Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Tipp: Exportiere vorher ein Backup.</p>
      </Card>

      <p className="pb-4 text-center text-xs text-slate-400">Finanzplaner · alle Daten bleiben lokal auf deinem Gerät · nichts wird an einen Server gesendet</p>

      <ConfirmDialog
        open={!!importData}
        onClose={() => setImportData(null)}
        title="Backup importieren?"
        confirmLabel="Importieren und ersetzen"
        text={
          importData && (
            <>
              Deine aktuellen Daten werden durch das Backup ersetzt: {importData.accounts.length} Konten, {importData.goals.length} Ziele,{' '}
              {importData.expenses.length} Ausgaben, {importData.contracts.length} Verträge.
            </>
          )
        }
        onConfirm={() => {
          if (importData) replace(importData)
          setMessage('Backup erfolgreich importiert.')
        }}
      />

      <ConfirmDialog
        open={sampleOpen}
        onClose={() => setSampleOpen(false)}
        title="Beispieldaten laden?"
        confirmLabel="Beispieldaten laden"
        text="Alle aktuellen Einträge werden durch die Beispieldaten (Startplan) ersetzt. Deine Einstellungen bleiben erhalten."
        onConfirm={() => {
          replace({ ...sampleData(), settings: data.settings })
          setMessage('Beispieldaten geladen.')
        }}
      />

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Wirklich alles löschen?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetOpen(false)}>Abbrechen</Button>
            <Button
              variant="danger"
              disabled={resetText.trim().toUpperCase() !== 'LÖSCHEN'}
              onClick={() => {
                replace(emptyData())
                setResetOpen(false)
                setMessage('Alle Daten wurden gelöscht. Du startest jetzt mit einer leeren App.')
              }}
            >
              Endgültig löschen
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Callout tone="danger" icon={<AlertTriangle size={18} />}>
            Konten, Ausgaben, Ziele, Verträge, Listen, Check-ins und Halal-Einträge werden unwiderruflich gelöscht.
          </Callout>
          <TextInput label='Tippe „LÖSCHEN“ zur Bestätigung' value={resetText} onChange={(e) => setResetText(e.target.value)} autoComplete="off" />
        </div>
      </Modal>
    </div>
  )
}

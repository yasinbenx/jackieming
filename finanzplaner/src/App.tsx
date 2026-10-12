import { MoreHorizontal, Plus } from 'lucide-react'
import { useState } from 'react'
import ExpenseForm from './components/ExpenseForm'
import { MOBILE_TABS, NAV } from './components/nav'
import { Callout, Modal, cx } from './components/ui'
import Abos from './pages/Abos'
import Budget from './pages/Budget'
import CheckInPage from './pages/CheckIn'
import Dashboard from './pages/Dashboard'
import Einstellungen from './pages/Einstellungen'
import Halal from './pages/Halal'
import Konten from './pages/Konten'
import Listen from './pages/Listen'
import Szenario from './pages/Szenario'
import Ziele from './pages/Ziele'
import { navigate, useRoute, type RouteId } from './store/router'
import { useStore } from './store/store'

const PAGES: Record<RouteId, () => React.JSX.Element> = {
  dashboard: Dashboard,
  konten: Konten,
  budget: Budget,
  ziele: Ziele,
  szenario: Szenario,
  abos: Abos,
  listen: Listen,
  checkin: CheckInPage,
  halal: Halal,
  einstellungen: Einstellungen,
}

export default function App() {
  const route = useRoute()
  const { saveFailed } = useStore()
  const [moreOpen, setMoreOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const Page = PAGES[route]
  const moreActive = !MOBILE_TABS.includes(route)

  return (
    <div className="min-h-dvh lg:flex">
      {/* Seitenleiste Desktop */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-5 lg:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-2 px-3">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-8 w-8 rounded-lg" />
          <span className="text-lg font-bold">Finanzplaner</span>
        </div>
        <button
          type="button"
          onClick={() => setExpenseOpen(true)}
          className="mb-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 font-medium text-white hover:bg-brand-700 dark:bg-brand-500 dark:text-slate-950"
        >
          <Plus size={18} /> Ausgabe erfassen
        </button>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto" aria-label="Hauptmenü">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#/${n.id}`}
              aria-current={route === n.id ? 'page' : undefined}
              className={cx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                route === n.id
                  ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
              )}
            >
              <n.icon size={19} />
              {n.label}
            </a>
          ))}
        </nav>
        <p className="px-3 pt-3 text-xs text-slate-400">Alle Daten bleiben auf diesem Gerät.</p>
      </aside>

      <main className="mx-auto w-full max-w-5xl px-4 pt-5 pb-32 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12">
        {saveFailed && (
          <div className="mb-4">
            <Callout tone="danger">
              Speichern im Browser ist gerade nicht möglich (z. B. privater Modus oder Speicher voll). Bitte exportiere deine Daten unter Einstellungen.
            </Callout>
          </div>
        )}
        <Page />
      </main>

      {/* Schnell-Erfassen am Handy */}
      <button
        type="button"
        onClick={() => setExpenseOpen(true)}
        aria-label="Ausgabe erfassen"
        className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-900/20 active:scale-95 lg:hidden dark:bg-brand-500 dark:text-slate-950"
      >
        <Plus size={26} />
      </button>

      {/* Tab-Leiste Handy */}
      <nav
        aria-label="Hauptmenü"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {MOBILE_TABS.map((id) => {
            const n = NAV.find((x) => x.id === id)!
            const active = route === id
            return (
              <a
                key={id}
                href={`#/${id}`}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium',
                  active ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400',
                )}
              >
                <n.icon size={22} strokeWidth={active ? 2.4 : 2} />
                {n.short}
              </a>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cx(
              'flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium',
              moreActive ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400',
            )}
          >
            <MoreHorizontal size={22} />
            Mehr
          </button>
        </div>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Mehr">
        <div className="grid grid-cols-3 gap-2 pb-2">
          {NAV.filter((n) => !MOBILE_TABS.includes(n.id)).map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                setMoreOpen(false)
                navigate(n.id)
              }}
              className={cx(
                'flex flex-col items-center gap-2 rounded-2xl border p-3 text-center text-xs font-medium transition',
                route === n.id
                  ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-300'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800',
              )}
            >
              <n.icon size={24} />
              {n.label}
            </button>
          ))}
        </div>
      </Modal>

      <ExpenseForm open={expenseOpen} onClose={() => setExpenseOpen(false)} />
    </div>
  )
}

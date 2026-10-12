import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { sampleData } from '../lib/defaults'
import { setCurrency } from '../lib/money'
import { loadData, saveData } from '../lib/storage'
import type { AppData } from '../lib/types'

interface Store {
  data: AppData
  /** Änderungen an einer Kopie vornehmen – wird automatisch gespeichert. */
  update: (recipe: (draft: AppData) => void) => void
  replace: (data: AppData) => void
  saveFailed: boolean
}

const StoreContext = createContext<Store | null>(null)

function initialData(): AppData {
  return loadData() ?? sampleData()
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(initialData)
  const [saveFailed, setSaveFailed] = useState(false)

  setCurrency(data.settings.currency)

  useEffect(() => {
    setSaveFailed(!saveData(data))
  }, [data])

  // Hell/Dunkel
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = data.settings.theme === 'dark' || (data.settings.theme === 'system' && mq.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#020617' : '#0f766e')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [data.settings.theme])

  const update = useCallback((recipe: (draft: AppData) => void) => {
    setData((prev) => {
      const draft = structuredClone(prev)
      recipe(draft)
      return draft
    })
  }, [])

  const replace = useCallback((d: AppData) => setData(d), [])

  const value = useMemo(() => ({ data, update, replace, saveFailed }), [data, update, replace, saveFailed])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore außerhalb des StoreProvider')
  return s
}

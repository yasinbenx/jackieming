import { useEffect, useState } from 'react'

export type RouteId =
  | 'dashboard'
  | 'konten'
  | 'budget'
  | 'ziele'
  | 'szenario'
  | 'abos'
  | 'listen'
  | 'checkin'
  | 'halal'
  | 'einstellungen'

const ROUTES: RouteId[] = [
  'dashboard', 'konten', 'budget', 'ziele', 'szenario', 'abos', 'listen', 'checkin', 'halal', 'einstellungen',
]

function parse(): RouteId {
  const id = window.location.hash.replace(/^#\/?/, '').split('?')[0] as RouteId
  return ROUTES.includes(id) ? id : 'dashboard'
}

export function navigate(id: RouteId) {
  window.location.hash = `/${id}`
}

export function useRoute(): RouteId {
  const [route, setRoute] = useState<RouteId>(parse)
  useEffect(() => {
    const on = () => {
      setRoute(parse())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

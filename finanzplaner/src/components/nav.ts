import {
  CalendarCheck, FlaskConical, LayoutDashboard, Landmark, ListChecks, Moon, Repeat, Settings, Target, Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { RouteId } from '../store/router'

export interface NavItem {
  id: RouteId
  label: string
  short: string
  icon: LucideIcon
}

export const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Übersicht', short: 'Übersicht', icon: LayoutDashboard },
  { id: 'budget', label: 'Monatsbudget', short: 'Budget', icon: Wallet },
  { id: 'ziele', label: 'Sparziele', short: 'Ziele', icon: Target },
  { id: 'checkin', label: 'Wochen-Check-in', short: 'Check-in', icon: CalendarCheck },
  { id: 'konten', label: 'Konten', short: 'Konten', icon: Landmark },
  { id: 'abos', label: 'Abos & Verträge', short: 'Abos', icon: Repeat },
  { id: 'szenario', label: 'Was wäre wenn', short: 'Szenario', icon: FlaskConical },
  { id: 'listen', label: 'Listen', short: 'Listen', icon: ListChecks },
  { id: 'halal', label: 'Halal-Finanzen', short: 'Halal', icon: Moon },
  { id: 'einstellungen', label: 'Einstellungen', short: 'Einstellungen', icon: Settings },
]

/** Diese Seiten stehen am Handy direkt in der Tab-Leiste, der Rest unter "Mehr". */
export const MOBILE_TABS: RouteId[] = ['dashboard', 'budget', 'ziele', 'checkin']

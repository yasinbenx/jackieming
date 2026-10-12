/** Monat im Format "YYYY-MM" */
export type Month = string
/** Datum im Format "YYYY-MM-DD" */
export type ISODate = string

export interface Account {
  id: string
  name: string
  purpose: string
  balance: number
  color: string
  updatedAt: ISODate
}

export interface IncomePeriod {
  id: string
  label: string
  amount: number
  from: Month
  /** einschließlich; leer = unbegrenzt */
  to?: Month
}

export type Rhythm = 'woechentlich' | 'monatlich' | 'vierteljaehrlich' | 'halbjaehrlich' | 'jaehrlich'
export type NoticeUnit = 'tage' | 'wochen' | 'monate'

export interface Contract {
  id: string
  name: string
  amount: number
  rhythm: Rhythm
  accountId: string
  /** 'fix' = Fixkosten (z. B. Miete, Vater), 'abo' = Abo/Vertrag */
  kind: 'fix' | 'abo'
  startDate?: ISODate
  endDate?: ISODate
  noticeValue: number
  noticeUnit: NoticeUnit
  cancelled: boolean
  note?: string
}

export interface Expense {
  id: string
  date: ISODate
  amount: number
  category: string
  accountId: string
  note?: string
}

export interface Goal {
  id: string
  name: string
  emoji: string
  /** null = offenes Ziel ohne Endbetrag (z. B. langfristig investieren) */
  target: number | null
  /** optionaler Mindestbetrag, z. B. Auto 5.000 bis 10.000 € */
  minTarget?: number
  targetDate?: Month
  current: number
  monthlyRate: number
  /** Sparrate gilt ab diesem Monat; davor nur Überschuss */
  rateFrom?: Month
  priority: number
  accountId?: string
  color: string
  note?: string
}

export interface Wish {
  id: string
  name: string
  price: number
  createdAt: string
  bought: boolean
  link?: string
}

export interface Todo {
  id: string
  text: string
  done: boolean
}

export interface CheckIn {
  id: string
  date: ISODate
  balances: Record<string, number>
  accountsTotal: number
  potsTotal: number
  weekSpent: number
  note?: string
}

export interface PurificationEntry {
  id: string
  date: ISODate
  source: string
  amount: number
  type: 'unrein' | 'gespendet'
}

export interface HalalState {
  nisab: number
  haulStart: ISODate | ''
  zakatAssets: {
    cash: number
    gold: number
    investments: number
    receivables: number
    debts: number
  }
  useAccountBalances: boolean
  purification: PurificationEntry[]
  etf: {
    monthly: number
    years: number
    pessimistic: number
    normal: number
    optimistic: number
  }
}

export interface Scenario {
  salary: number | null
  salaryFrom: Month
  /** null = Wert aus dem Plan übernehmen */
  studyFee: number | null
  rent: number
  rentFrom: Month
  carCosts: number
  carFrom: Month
  lifeBudget: number | null
}

export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  currency: string
  monthStartDay: number
  theme: Theme
  overflow: boolean
  categories: string[]
}

export interface AppData {
  version: 1
  accounts: Account[]
  incomes: IncomePeriod[]
  contracts: Contract[]
  lifeBudget: number
  /** Studiengebühren pro Monat ab Studienstart */
  study: { fee: number; from: Month }
  expenses: Expense[]
  goals: Goal[]
  wishes: Wish[]
  todos: Todo[]
  checkIns: CheckIn[]
  halal: HalalState
  scenario: Scenario
  settings: Settings
}

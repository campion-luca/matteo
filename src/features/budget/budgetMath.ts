import type { BudgetDream, BudgetItem, BudgetState } from '@/store/useJarvisStore'
import { getLang, LANG_TAGS } from '@/lib/i18n'

export interface BigCoverage {
  item: BudgetItem
  covered: boolean     // rientra nel risparmio a 12 mesi (greedy, dalla più economica)
  cumulative: number   // costo cumulato fino a questa voce inclusa
}

export interface BudgetSummary {
  income: number          // stipendio mensile
  fixedTotal: number      // totale spese fisse / mese
  variableTotal: number   // totale spese variabili / mese
  monthlyExpenses: number // fisse + variabili
  monthlyLeft: number     // stipendio − uscite mensili (può essere negativo)
  yearlySaved: number     // monthlyLeft × 12
  bigTotal: number        // somma di tutte le spese grosse imminenti
  coverage: BigCoverage[] // spese grosse ordinate dalla più economica, con flag "coperta"
  coveredCount: number    // quante spese grosse copre il risparmio a 12 mesi
  bigLeftover: number     // risparmio a 12 mesi che resta dopo le spese grosse coperte
}

const sum = (items: BudgetItem[]) => items.reduce((a, i) => a + (Number.isFinite(i.amount) ? i.amount : 0), 0)

// Dato lo stato budget calcola i totali mensili, il risparmio a 12 mesi e quante
// delle "spese grosse imminenti" quel risparmio riesce a coprire. La copertura è
// greedy dalla voce più economica: massimizza il numero di spese sostenibili.
export function computeBudget(b: BudgetState): BudgetSummary {
  const income        = Number.isFinite(b.salary) ? b.salary : 0
  const fixedTotal    = sum(b.fixed)
  const variableTotal = sum(b.variable)
  const monthlyExpenses = fixedTotal + variableTotal
  const monthlyLeft   = income - monthlyExpenses
  const yearlySaved   = monthlyLeft * 12
  const bigTotal      = sum(b.big)

  const sorted = [...b.big].sort((a, c) => a.amount - c.amount)
  let running = 0
  let budgetLeft = Math.max(0, yearlySaved)
  const coverage: BigCoverage[] = sorted.map(item => {
    running += item.amount
    const covered = item.amount <= budgetLeft
    if (covered) budgetLeft -= item.amount
    return { item, covered, cumulative: running }
  })
  const coveredCount = coverage.filter(c => c.covered).length

  return {
    income, fixedTotal, variableTotal, monthlyExpenses, monthlyLeft,
    yearlySaved, bigTotal, coverage, coveredCount,
    bigLeftover: budgetLeft,
  }
}

// ── Il sogno da raggiungere ────────────────────────────────────
export interface DreamProgress {
  remaining: number             // quanto manca (≥ 0)
  pct: number                   // 0–100: quota già accantonata
  monthsNeeded: number | null   // mesi al traguardo col risparmio attuale; null se non risparmi nulla
  readyOn: string | null        // YYYY-MM-DD stimato del traguardo; null se irraggiungibile
  monthsToTarget: number | null // mesi che mancano alla data desiderata; null se non l'hai indicata
  requiredPerMonth: number | null // quanto dovresti accantonare al mese per arrivarci in tempo
  onTrack: boolean | null       // sei sulla giusta strada? null senza data desiderata
  done: boolean                 // già raggiunto
}

// Mesi interi tra due date (approssimati sul giorno del mese: se il giorno
// target è precedente, il mese non è ancora compiuto).
function monthsBetween(from: Date, to: Date): number {
  let m = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  if (to.getDate() < from.getDate()) m -= 1
  return m
}

function addMonthsISO(from: Date, months: number): string {
  const d = new Date(from.getFullYear(), from.getMonth() + months, 1)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(from.getDate(), lastDay))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Confronta il risparmio mensile con quanto manca al sogno. `monthlyLeft` è ciò
// che avanza ogni mese (da computeBudget): se ≤ 0 il sogno è irraggiungibile
// finché non si tagliano le spese.
export function computeDream(dream: BudgetDream, monthlyLeft: number, today = new Date()): DreamProgress {
  const amount = Math.max(0, Number.isFinite(dream.amount) ? dream.amount : 0)
  const saved  = Math.max(0, Number.isFinite(dream.saved) ? dream.saved : 0)
  const remaining = Math.max(0, amount - saved)
  const pct = amount > 0 ? Math.min(100, Math.round((saved / amount) * 100)) : 0
  const done = amount > 0 && remaining === 0

  const monthsNeeded = done ? 0 : monthlyLeft > 0 ? Math.ceil(remaining / monthlyLeft) : null
  const readyOn = monthsNeeded === null ? null : addMonthsISO(today, monthsNeeded)

  let monthsToTarget: number | null = null
  let requiredPerMonth: number | null = null
  let onTrack: boolean | null = null
  if (dream.targetDate) {
    const [y, m, d] = dream.targetDate.split('-').map(Number)
    monthsToTarget = Math.max(0, monthsBetween(today, new Date(y, m - 1, d)))
    // Con 0 mesi residui serve tutto subito: il fabbisogno è l'intero residuo.
    requiredPerMonth = done ? 0 : monthsToTarget > 0 ? remaining / monthsToTarget : remaining
    onTrack = done || (monthsNeeded !== null && monthsNeeded <= monthsToTarget)
  }

  return { remaining, pct, monthsNeeded, readyOn, monthsToTarget, requiredPerMonth, onTrack, done }
}

// Formattazione € coerente in tutta la feature.
export function fmtEur(n: number): string {
  const rounded = Math.round(n)
  // Il locale segue la lingua scelta nell'app, non quella del dispositivo. Le due
  // convenzioni coincidono quasi del tutto — punto per le migliaia, euro in coda —
  // ma passarlo esplicito evita che un telefono in inglese stampi "1,234 €" dentro
  // una schermata italiana.
  return `${rounded < 0 ? '−' : ''}${Math.abs(rounded).toLocaleString(LANG_TAGS[getLang()])} €`
}

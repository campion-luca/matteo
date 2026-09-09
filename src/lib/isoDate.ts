// Date in formato ISO locale e settimana ISO 8601: le due convenzioni di tempo
// condivise da palestra, schede e Personal Coach.
import { getLang } from '@/lib/i18n'

export function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function todayISO(): string {
  return localISO(new Date())
}

// ── Settimana ISO 8601 ─────────────────────────────────────────
// Una sola definizione di settimana per tutta l'app: inizia di LUNEDÌ e appartiene
// all'anno del suo giovedì. Le statistiche palestra usavano una versione naive che
// iniziava di domenica, e la sessione della domenica finiva così nella settimana
// successiva del grafico volume.
export interface IsoWeek { year: number; week: number }

export function isoWeek(iso: string): IsoWeek {
  const [y, m, d] = iso.split('-').map(Number)
  // Il giovedì della stessa settimana: è lui a decidere sia il numero sia l'anno
  // ISO, e per questo il 1° gennaio può appartenere alla W52/53 dell'anno prima.
  const thu = new Date(Date.UTC(y, m - 1, d))
  thu.setUTCDate(thu.getUTCDate() - ((thu.getUTCDay() + 6) % 7) + 3)
  const firstThu = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4))
  firstThu.setUTCDate(firstThu.getUTCDate() - ((firstThu.getUTCDay() + 6) % 7) + 3)
  return {
    year: thu.getUTCFullYear(),
    week: 1 + Math.round((thu.getTime() - firstThu.getTime()) / 604800000),
  }
}

// Etichetta compatta mostrata all'utente: "W28" in italiano, "KW28" in tedesco.
// Non è una traduzione di comodo — "KW" (Kalenderwoche) è la sigla che in Germania
// sta sui calendari e nei fogli di allenamento, e "W28" lì non si legge come una
// settimana.
export function isoWeekLabel(iso: string): string {
  return `${getLang() === 'de' ? 'KW' : 'W'}${isoWeek(iso).week}`
}

// Chiave di ordinamento cronologica (anno ISO + settimana zero-padded, es. "2026-W05"):
// evita l'ordinamento lessicografico ("W10" prima di "W2") e la collisione W1/2025↔W1/2026.
export function isoWeekSortKey(iso: string): string {
  const { year, week } = isoWeek(iso)
  return `${year}-W${String(week).padStart(2, '0')}`
}

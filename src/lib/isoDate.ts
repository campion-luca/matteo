// Date in formato ISO locale e settimana ISO 8601: le due convenzioni di tempo
// condivise da palestra, schede e Personal Coach.

export function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function todayISO(): string {
  return localISO(new Date())
}

/** Quanti giorni di calendario passano da una data all'altra ("YYYY-MM-DD").
 *  In UTC, e non sottraendo due `Date` locali: a cavallo del cambio d'ora un
 *  giorno dura 23 o 25 ore, e la differenza divisa per 24 non torna intera. */
export function giorniTra(da: string, a: string): number {
  const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) }
  return Math.round((utc(a) - utc(da)) / 86_400_000)
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

// Etichetta compatta mostrata all'utente: "W28", in italiano come in inglese.
export function isoWeekLabel(iso: string): string {
  return `W${isoWeek(iso).week}`
}

// Chiave di ordinamento cronologica (anno ISO + settimana zero-padded, es. "2026-W05"):
// evita l'ordinamento lessicografico ("W10" prima di "W2") e la collisione W1/2025↔W1/2026.
export function isoWeekSortKey(iso: string): string {
  const { year, week } = isoWeek(iso)
  return `${year}-W${String(week).padStart(2, '0')}`
}

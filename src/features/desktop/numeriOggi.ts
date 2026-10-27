// I numeri della pagina «Oggi» su desktop (ott 2026): gli allenamenti fatti, i
// record, la costanza, il volume della settimana, le pesate.
//
// Puro e senza React, come allenamenti.ts da cui parte: la pagina li disegna, i
// conti si provano nei test. I casi che rompono in silenzio sono quelli di
// sempre — la settimana appena cominciata, il primo mese, un solo allenamento.
import type { PalestraExercise, PalestraHistoryEntry, WeightLogEntry } from '@/store/useJarvisStore'
import { entry1RM, entryVolume, sortedHistory } from '@/features/gym/gymModel'
import { quotaCorpo } from '@/features/gym/catalogo'
import { lunediDi } from '@/features/dashboard/allenamenti'
import { localISO } from '@/lib/isoDate'

// ── I record ───────────────────────────────────────────────────

export interface RecordFatto {
  esercizio: PalestraExercise
  alzata: PalestraHistoryEntry
}

/** Le alzate che hanno battuto il massimale stimato di tutte quelle venute
 *  prima, dalla più recente. È il confronto dell'avviso a fine allenamento
 *  (`recordFor`), col massimo tenuto man mano invece di rifarlo per ogni
 *  alzata: la prima alzata di un esercizio non è un record, e pareggiare non è
 *  battere. */
export function recordFatti(palestra: PalestraExercise[], pesoCorporeo: number): RecordFatto[] {
  const out: RecordFatto[] = []
  for (const ex of palestra) {
    const bw = pesoCorporeo * quotaCorpo(ex)
    let migliore: number | null = null
    for (const h of sortedHistory(ex.history)) {
      const v = entry1RM(h, bw)
      if (migliore !== null && v > migliore && h.date) out.push({ esercizio: ex, alzata: h })
      migliore = migliore === null ? v : Math.max(migliore, v)
    }
  }
  return out.sort((a, b) => (b.alzata.date ?? '').localeCompare(a.alzata.date ?? ''))
}

// ── Gli allenamenti fatti ──────────────────────────────────────

/** Un allenamento: una scheda eseguita un giorno, o le alzate registrate a
 *  parte quel giorno (`scheda` null). La stessa scheda due volte nello stesso
 *  giorno è un allenamento solo, come nel calendario (vedi `raggruppaGiorno`). */
export interface SessioneFatta {
  data: string
  scheda: { id: string; nome: string } | null
  esercizi: number
  serie: number
  /** I chili sollevati, peso corporeo compreso a corpo libero. */
  volume: number
  /** Quanto è durato, se l'allenamento l'ha salvato (vedi `durataSec`). */
  durataSec: number | null
  /** Quante alzate di quel giorno hanno battuto il loro massimale. */
  record: number
}

const chiave = (data: string, schedaId: string | undefined) => `${data}|${schedaId ?? ''}`

/** Gli allenamenti fatti, dal più recente. */
export function sessioniFatte(palestra: PalestraExercise[], pesoCorporeo: number, record = recordFatti(palestra, pesoCorporeo)): SessioneFatta[] {
  const per = new Map<string, SessioneFatta & { ids: Set<string> }>()
  for (const ex of palestra) {
    const bw = pesoCorporeo * quotaCorpo(ex)
    for (const h of ex.history) {
      if (!h.date) continue
      const k = chiave(h.date, h.scheda?.id)
      let s = per.get(k)
      if (!s) {
        s = { data: h.date, scheda: h.scheda ?? null, esercizi: 0, serie: 0, volume: 0, durataSec: null, record: 0, ids: new Set() }
        per.set(k, s)
      }
      s.ids.add(ex.id)
      s.serie += h.sets_n
      s.volume += entryVolume(h, bw)
      // La durata è di tutto l'allenamento, scritta uguale su ogni sua alzata.
      if (h.durataSec) s.durataSec = Math.max(s.durataSec ?? 0, h.durataSec)
    }
  }
  for (const r of record) {
    const s = r.alzata.date ? per.get(chiave(r.alzata.date, r.alzata.scheda?.id)) : undefined
    if (s) s.record++
  }
  return [...per.values()]
    .map(({ ids, ...s }) => ({ ...s, esercizi: ids.size }))
    .sort((a, b) => b.data.localeCompare(a.data) || (a.scheda?.nome ?? '').localeCompare(b.scheda?.nome ?? ''))
}

/** Gli allenamenti fra due date ISO, estremi compresi. */
export function sessioniFra(sessioni: SessioneFatta[], da: string, a: string): SessioneFatta[] {
  return sessioni.filter(s => s.data >= da && s.data <= a)
}

/** Il giorno ISO `n` giorni prima di `iso`. */
export function giorniPrima(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return localISO(new Date(y, m - 1, d - n))
}

// ── Il volume della settimana ──────────────────────────────────

/** Quanti chili si sono sollevati nella settimana di `oggi` (da lunedì), e la
 *  media delle otto settimane prima. Si contano solo le settimane da quella del
 *  primo allenamento in poi: chi ha cominciato da tre settimane non si vede
 *  sotto la media per le cinque in cui l'app non c'era. `media` è null senza
 *  una settimana prima con cui confrontarsi. */
export function volumeSettimana(sessioni: SessioneFatta[], oggi: string): { questa: number; media: number | null } {
  const lunedi = lunediDi(oggi)
  const perSettimana = new Map<string, number>()
  let primo: string | null = null
  for (const s of sessioni) {
    const l = lunediDi(s.data)
    perSettimana.set(l, (perSettimana.get(l) ?? 0) + s.volume)
    if (!primo || l < primo) primo = l
  }
  const prima: number[] = []
  for (let k = 1; k <= 8; k++) {
    const l = giorniPrima(lunedi, 7 * k)
    if (!primo || l < primo) break
    prima.push(perSettimana.get(l) ?? 0)
  }
  return {
    questa: perSettimana.get(lunedi) ?? 0,
    media: prima.length ? prima.reduce((a, b) => a + b, 0) / prima.length : null,
  }
}

// ── La costanza ────────────────────────────────────────────────

/** La serie più lunga di settimane di fila con almeno un allenamento, di
 *  sempre: il record con cui si confronta quella in corso. */
export function settimaneDiFilaRecord(date: Iterable<string>): number {
  const lunedi = [...new Set([...date].map(lunediDi))].sort()
  let migliore = 0, corrente = 0
  let prima: string | null = null
  for (const l of lunedi) {
    corrente = prima && giorniPrima(l, 7) === prima ? corrente + 1 : 1
    migliore = Math.max(migliore, corrente)
    prima = l
  }
  return migliore
}

// ── Il peso ────────────────────────────────────────────────────

/** Di quanto è cambiato il peso dall'ultima pesata a quella prima. Null con
 *  meno di due pesate: con una sola non c'è un prima. */
export function variazionePeso(log: WeightLogEntry[]): { delta: number; da: string } | null {
  const ordinate = [...log].filter(e => e.kg > 0).sort((a, b) => a.date.localeCompare(b.date))
  if (ordinate.length < 2) return null
  const ultima = ordinate[ordinate.length - 1], prima = ordinate[ordinate.length - 2]
  return { delta: Math.round((ultima.kg - prima.kg) * 10) / 10, da: prima.date }
}

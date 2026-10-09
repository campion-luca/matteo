// Cosa si legge di una scheda PRIMA di aprirla: che muscoli tocca, e quanto
// tempo ci vuole. Nell'elenco delle schede c'erano solo il nome e il numero
// di esercizi — "Giovedì · 11 esercizi" non dice se è il giorno delle gambe né
// se sta nell'ora che si ha.
//
// Logica pura: l'elenco la disegna (vedi SchedeListPage), i conti si provano qui.
import type { GymScheda, GymSchedaExercise, PalestraExercise } from '@/store/useJarvisStore'
import { colpiPrevisti, displayMuscle } from './gymModel'
import { localISO } from '@/lib/isoDate'

/** Il recupero fra una serie e l'altra: un minuto e mezzo, lo stesso del timer
 *  dell'allenamento (vedi TimerRecupero). Lo ha fissato chi usa l'app. */
export const RECUPERO_SEC = 90
/** Quanto dura un colpo, andata e ritorno. Con dieci colpi una serie sta sui
 *  quaranta secondi. */
const SECONDI_A_COLPO = 4
/** I colpi di una serie quando la scheda non li dice ("max", o un testo). */
const COLPI_SE_NON_SI_SA = 10
/** Una serie non dura meno di così né più di così, quanti che siano i colpi:
 *  sotto c'è comunque da mettersi in posizione, sopra è una stima di troppo. */
const SERIE_MIN_SEC = 20
const SERIE_MAX_SEC = 120
/** Sopra questo numero le serie di una riga sono un errore di battitura, e
 *  non devono trasformare la stima in una giornata intera. */
const SERIE_MAX = 20

export interface MuscoloToccato {
  muscolo: string
  /** Quanti esercizi della scheda sono per questo gruppo. */
  esercizi: number
}

/** Il gruppo muscolare di una riga: quello scritto sulla riga, o quello
 *  dell'esercizio a cui è collegata (per id, poi per nome — una scheda arrivata
 *  da un allenatore ha i nomi, non gli id). "Altro" se non si sa. */
function muscoloDi(riga: GymSchedaExercise, palestra: PalestraExercise[]): string {
  if (riga.muscle?.trim()) return displayMuscle(riga.muscle.trim())
  const nome = riga.name.trim().toLowerCase()
  const ex = (riga.linkedExerciseId ? palestra.find(e => e.id === riga.linkedExerciseId) : undefined)
    ?? palestra.find(e => e.n.trim().toLowerCase() === nome)
  return ex?.muscle?.trim() ? displayMuscle(ex.muscle.trim()) : 'Altro'
}

/** I gruppi muscolari che la scheda tocca, dal più presente. A parità, resta
 *  l'ordine in cui compaiono nella scheda: il primo che si allena viene prima. */
export function muscoliDellaScheda(scheda: GymScheda, palestra: PalestraExercise[] = []): MuscoloToccato[] {
  const conto = new Map<string, number>()
  for (const riga of scheda.exercises) {
    if (!riga.name.trim()) continue
    const m = muscoloDi(riga, palestra)
    conto.set(m, (conto.get(m) ?? 0) + 1)
  }
  // `sort` è stabile: a parità di esercizi vale l'ordine di inserimento.
  return [...conto.entries()]
    .map(([muscolo, esercizi]) => ({ muscolo, esercizi }))
    .sort((a, b) => b.esercizi - a.esercizi)
}

/** Quanto dura la scheda, in secondi: per ogni serie il tempo di farla più il
 *  recupero. È una stima — non conta il riscaldamento né la coda alla
 *  macchina — e chi la mostra la arrotonda (vedi `durataArrotondata`).
 *
 *  In un superset fra i due esercizi non ci si ferma: il recupero è uno solo,
 *  dopo il secondo. */
export function durataPrevista(scheda: GymScheda): number {
  return durataRimanente(scheda, {})
}

/** Quanto pesa ogni serie di una riga, recupero compreso, in secondi. Vuoto
 *  per una riga senza nome. */
function secondiPerSerie(riga: GymSchedaExercise): number[] {
  if (!riga.name.trim()) return []
  const serie = Math.min(SERIE_MAX, Math.max(1, Math.floor(riga.sets) || 1))
  const recupero = riga.supersetWithNext ? 0 : RECUPERO_SEC
  return colpiPrevisti(riga.reps, serie).map(colpi => {
    const lavoro = (colpi || COLPI_SE_NON_SI_SA) * SECONDI_A_COLPO
    return Math.min(SERIE_MAX_SEC, Math.max(SERIE_MIN_SEC, lavoro)) + recupero
  })
}

/** Quanto MANCA alla fine, in secondi, durante l'allenamento: lo stesso conto
 *  di `durataPrevista`, sulle sole serie non ancora spuntate. `spuntate` va per
 *  id della riga; una riga che non c'è è tutta da fare.
 *
 *  Non guarda l'orologio: scende a ogni spunta, non col passare dei minuti. Chi
 *  si ferma a parlare non vede il numero calare da solo — quello che manca è
 *  ancora tutto lì. */
export function durataRimanente(scheda: GymScheda, spuntate: Record<string, boolean[] | undefined>): number {
  let sec = 0
  for (const riga of scheda.exercises) {
    const fatte = spuntate[riga.id]
    secondiPerSerie(riga).forEach((s, i) => { if (!fatte?.[i]) sec += s })
  }
  return sec
}

/** La stima ai cinque minuti: "53 minuti" promette una precisione che il conto
 *  non ha. 0 se la scheda è vuota. */
export function durataArrotondata(sec: number): number {
  if (sec <= 0) return 0
  return Math.max(5, Math.round(sec / 300) * 5) * 60
}

// ── Da quanto tempo esiste una scheda ──────────────────────────
// Una scheda si cambia ogni tot settimane, e per saperlo serve leggere da
// quanto la si sta usando. Si conta dal giorno in cui è stata scritta; per una
// scheda mandata dal coach, dal giorno in cui la si è ricevuta la prima volta
// (ritoccarla o rimandarla non lo sposta).

/** Il giorno di nascita di una scheda, "YYYY-MM-DD". Le schede scritte qui
 *  portano già il giorno; quelle arrivate da un coach un istante intero, che si
 *  legge nel fuso del telefono. `null` se non si sa. */
export function natalDi(valore: string | null | undefined): string | null {
  if (!valore) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(valore)) return valore
  const d = new Date(valore)
  return Number.isNaN(d.getTime()) ? null : localISO(d)
}

/** "da oggi" · "da 9 giorni" · "da 5 settimane" · "da 4 mesi" · "da 2 anni".
 *  In settimane finché le settimane si contano a mente (è l'unità con cui si
 *  ragiona su una scheda), poi in mesi. `t` arriva da chi chiama: questo file
 *  non conosce la lingua. */
export function etaScheda(giorni: number, t: (s: string, v?: Record<string, string | number>) => string): string {
  if (giorni <= 0) return t('da oggi')
  if (giorni === 1) return t('da ieri')
  if (giorni < 14) return t('da {n} giorni', { n: giorni })
  if (giorni < 70) return t('da {n} settimane', { n: Math.floor(giorni / 7) })
  const mesi = Math.floor(giorni / 30.44)
  if (mesi < 24) return t('da {n} mesi', { n: mesi })
  return t('da {n} anni', { n: Math.floor(mesi / 12) })
}

/** Le schede divise per mese e anno di nascita, dal più recente. Dentro un mese
 *  resta l'ordine in cui arrivano (prima quelle del coach, poi le proprie come
 *  le si è messe in fila). Quelle senza una data stanno in fondo, a parte. */
export function schedePerMese<T extends { id: string }>(
  schede: readonly T[],
  nateIl: Map<string, string>,
): Array<{ chiave: string; anno: number | null; mese: number | null; schede: T[] }> {
  const gruppi = new Map<string, T[]>()
  for (const s of schede) {
    const k = nateIl.get(s.id)?.slice(0, 7) ?? ''
    gruppi.set(k, [...(gruppi.get(k) ?? []), s])
  }
  return [...gruppi.entries()]
    // "" (senza data) è la più piccola: finisce in fondo da sola.
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([chiave, lista]) => {
      const [anno, mese] = chiave ? chiave.split('-').map(Number) : [null, null]
      return { chiave: chiave || 'senza-data', anno, mese: mese === null ? null : mese - 1, schede: lista }
    })
}

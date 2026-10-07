// Cosa si legge di una scheda PRIMA di aprirla: che muscoli tocca, e quanto
// tempo ci vuole. Nell'elenco delle schede c'erano solo il nome e il numero
// di esercizi — "Giovedì · 11 esercizi" non dice se è il giorno delle gambe né
// se sta nell'ora che si ha.
//
// Logica pura: l'elenco la disegna (vedi SchedeListPage), i conti si provano qui.
import type { GymScheda, GymSchedaExercise, PalestraExercise } from '@/store/useJarvisStore'
import { colpiPrevisti, displayMuscle } from './gymModel'

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
  let sec = 0
  for (const riga of scheda.exercises) {
    if (!riga.name.trim()) continue
    const serie = Math.min(SERIE_MAX, Math.max(1, Math.floor(riga.sets) || 1))
    const recupero = riga.supersetWithNext ? 0 : RECUPERO_SEC
    for (const colpi of colpiPrevisti(riga.reps, serie)) {
      const lavoro = (colpi || COLPI_SE_NON_SI_SA) * SECONDI_A_COLPO
      sec += Math.min(SERIE_MAX_SEC, Math.max(SERIE_MIN_SEC, lavoro)) + recupero
    }
  }
  return sec
}

/** La stima ai cinque minuti: "53 minuti" promette una precisione che il conto
 *  non ha. 0 se la scheda è vuota. */
export function durataArrotondata(sec: number): number {
  if (sec <= 0) return 0
  return Math.max(5, Math.round(sec / 300) * 5) * 60
}

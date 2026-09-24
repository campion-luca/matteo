// ── Il carico consigliato ──────────────────────────────────────
// Guardando com'è andata l'ultima volta su questo esercizio, dice con che peso
// partire oggi. La regola è quella della doppia progressione, che è come si
// lavora con una scheda "3 × 8-10":
//
//   · tutte le serie fatte, tutti i colpi in cima all'intervallo, stesso peso
//     su ogni serie → si sale;
//   · stesso peso per due settimane di fila, serie e colpi dentro l'obiettivo
//     → si sale anche senza aver toccato la cima: il corpo ci si è abituato;
//   · una serie saltata, una serie chiusa sotto l'obiettivo, o il peso abbassato
//     a metà allenamento → si scende;
//   · tutto il resto → si resta dove si è.
//
// Si guarda prima lo storico fatto CON QUESTA SCHEDA: lo stesso esercizio in un
// "5 × 5" e in un "3 × 12" ha obiettivi diversi, e confrontare le 5 ripetizioni
// di uno con il 12 dell'altro direbbe di scendere a chi sta andando benissimo.
// Solo se con questa scheda non c'è niente si ripiega su tutto lo storico.
//
// Niente consiglio sulle alzate a corpo libero e sui massimali: le prime non
// hanno un peso da spostare, i secondi non sono un allenamento.

import type { PalestraHistoryEntry } from '@/store/useJarvisStore'
import { sortedHistory, setLoads, setRepsOf } from './gymModel'

export type Verso = 'su' | 'giu' | 'uguale'

/** Perché si consiglia quel carico. Un codice e non una frase: la frase la
 *  compone chi mostra il consiglio, nella lingua dell'app. */
export type Motivo =
  | 'completo'        // tutte le serie in cima all'intervallo
  | 'dueSettimane'    // stesso peso, a obiettivo, per due settimane di fila
  | 'serieMancanti'   // meno serie del previsto
  | 'colpiCorti'      // almeno una serie sotto l'obiettivo
  | 'pesoCalato'      // peso abbassato durante l'allenamento
  | 'mantieni'        // a obiettivo, ma non ancora in cima

export interface Consiglio {
  verso: Verso
  /** Il carico consigliato per oggi. */
  kg: number
  /** Il carico più pesante dell'ultima volta, da cui si parte. */
  da: number
  motivo: Motivo
  /** Per i motivi che lo citano: quante serie fatte, e il bersaglio di colpi. */
  fatte?: number
  cima?: number
}

/** L'intervallo di colpi di una riga di scheda: "8-10" → 8…10, "10" → 10…10.
 *  `null` per "max" e per tutto ciò che un numero non è. */
export function intervalloColpi(reps: string): { min: number; max: number } | null {
  const m = /^\s*(\d+)\s*(?:[-–/]\s*(\d+))?\s*$/.exec(reps ?? '')
  if (!m) return null
  const a = parseInt(m[1]), b = m[2] ? parseInt(m[2]) : a
  if (!a) return null
  return { min: Math.min(a, b), max: Math.max(a, b) }
}

/** Di quanto salire o scendere. Sui pesi leggeri 2,5 kg sono un salto enorme
 *  (da 8 a 10,5 è un quarto in più), sui bilancieri sono il passo normale. */
export function passo(kg: number): number {
  if (kg < 10) return 1
  if (kg < 30) return 2
  return 2.5
}

const arrotonda = (n: number) => Math.round(n * 100) / 100

/** Un'alzata è andata "a obiettivo" se ha tutte le serie e nessuna sotto il minimo. */
function aObiettivo(h: PalestraHistoryEntry, serie: number, colpi: { min: number; max: number } | null): boolean {
  if (h.sets_n < serie) return false
  if (!colpi) return true
  return setRepsOf(h).every(r => r >= colpi.min)
}

/** Il peso è sceso da una serie a una successiva: si è dovuto alleggerire. */
function haCalato(pesi: number[]): boolean {
  for (let i = 1; i < pesi.length; i++) {
    if (pesi.slice(0, i).some(p => p > pesi[i])) return true
  }
  return false
}

export function caricoConsigliato(
  storico: PalestraHistoryEntry[],
  riga: { sets: number; reps: string },
  schedaId?: string,
): Consiglio | null {
  const valide = sortedHistory(storico).filter(h => !h.maxLift && !h.bodyweight && h.kg > 0)
  const conScheda = schedaId ? valide.filter(h => h.scheda?.id === schedaId) : []
  const lista = conScheda.length ? conScheda : valide
  const ultima = lista[lista.length - 1]
  if (!ultima) return null

  const serie = Math.max(1, riga.sets)
  const colpi = intervalloColpi(riga.reps)
  const pesi = setLoads(ultima)
  const reps = setRepsOf(ultima)
  const da = Math.max(...pesi)
  const p = passo(da)
  const giu = (motivo: Motivo, extra: Partial<Consiglio> = {}): Consiglio =>
    ({ verso: 'giu', kg: arrotonda(Math.max(p, da - p)), da, motivo, ...extra })
  const su = (motivo: Motivo, extra: Partial<Consiglio> = {}): Consiglio =>
    ({ verso: 'su', kg: arrotonda(da + p), da, motivo, ...extra })

  // Prima quello che è andato storto: basta una cosa sola per non salire.
  if (ultima.sets_n < serie) return giu('serieMancanti', { fatte: ultima.sets_n })
  if (colpi && reps.some(r => r < colpi.min)) return giu('colpiCorti', { cima: colpi.min })
  if (haCalato(pesi)) return giu('pesoCalato')

  // In cima all'intervallo su ogni serie, con lo stesso peso su tutte.
  const stessoPeso = pesi.every(k => k === da)
  if (colpi && stessoPeso && reps.every(r => r >= colpi.max)) {
    return su('completo', { cima: colpi.max })
  }

  // Due settimane allo stesso peso, a obiettivo tutte e due le volte. "Settimane"
  // e non "sessioni": due allenamenti nella stessa settimana non dicono che il
  // corpo si è abituato, dicono che si è andati in palestra due volte.
  const prima = [...lista].reverse().find(h => h !== ultima && h.d !== ultima.d)
  if (prima && Math.max(...setLoads(prima)) === da && aObiettivo(prima, serie, colpi)) {
    return su('dueSettimane')
  }

  return { verso: 'uguale', kg: da, da, motivo: 'mantieni', cima: colpi?.max }
}

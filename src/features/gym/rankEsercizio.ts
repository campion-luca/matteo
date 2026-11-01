// I rank: uno per esercizio, dal massimale sul peso corporeo. Logica pura, niente JSX.
//
// Cinque rank, uno per ogni fascia delle tabelle: sotto il 20° percentile Bronzo,
// poi Argento, Oro dal 50°, Platino dall'80°, Diamante dal 95°. Dire "sei Oro" vuol
// dire "alzi quello che alza di norma chi pesa come te, o qualcosa di più".
//
// I numeri vengono da tabelleForza dove gli studi hanno misurato l'esercizio. Per
// squat, stacco, rematore e panca presa stretta, che lì non ci sono, valgono le
// soglie di gymStrength. Gli altri esercizi non hanno un rank: non c'è una tabella
// libera da usare, e un rank sbagliato è peggio di nessun rank.
//
// DERIVATO dallo storico, come i traguardi (vedi gymStrength): niente da salvare,
// niente da sincronizzare. Le alzate delle schede e quelle singole stanno nello
// stesso storico e contano allo stesso modo.
import type { GymScheda, PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'
import { colpiMigliori, entry1RM, recordFor, type LiftRecord } from './gymModel'
import { aColpi, quotaCorpo } from './catalogo'
import { BIG_LIFTS, eAlzata } from './gymMaxLifts'
import { soglieDistretto } from './gymStrength'
import { soglieAlPeso, type AlzataTabella } from './tabelleForza'
import { esercizioDellaRiga } from './anteprimaScheda'

export interface Rank {
  /** Chiave del dizionario: la traduce chi la mostra. */
  nome: string
  /** Il fondo della medaglia: sopra ci va `accentFgFor` (vedi RankCard). */
  colore: string
}

export const RANK: readonly Rank[] = [
  { nome: 'Bronzo',   colore: '#B87333' },
  { nome: 'Argento',  colore: '#AEB6BD' },
  { nome: 'Oro',      colore: '#E3B53B' },
  { nome: 'Platino',  colore: '#8CC4BA' },
  { nome: 'Diamante', colore: '#5BB8E8' },
]

interface Alzata {
  id: string
  name: string
  /** Il distretto della soglia, per chi non ha una tabella sua. */
  district: string
  include: RegExp
  exclude?: RegExp
  /** La tabella degli studi. Il curl a bilanciere Z usa quella del curl su panca
   *  Scott, fatto nello studio con la stessa barra: non è lo stesso esercizio, ma
   *  è il più vicino che c'è. */
  tabella?: AlzataTabella
}

const ALZATE: readonly Alzata[] = [
  ...BIG_LIFTS.map(l => (l.id === 'panca' ? { ...l, tabella: 'panca' as const } : l)),
  { id: 'lat', name: 'Lat machine', district: 'Dorso', tabella: 'lat', include: /lat machine|lat pulldown|pulldown/, exclude: /braccia tese|straight/ },
  { id: 'lento', name: 'Lento avanti', district: 'Spalle', tabella: 'lento', include: /military|lento avanti|overhead press|shoulder press/, exclude: /manubri|dumbbell/ },
  { id: 'curl', name: 'Curl', district: 'Bicipiti', tabella: 'curl', include: /curl/, exclude: /leg curl|manubri|dumbbell|martello|hammer|cavo|cable/ },
  { id: 'pressa', name: 'Leg press', district: 'Gambe', tabella: 'pressa', include: /leg press|pressa/, exclude: /polpacc|calf/ },
  { id: 'rematore', name: 'Rematore', district: 'Dorso', include: /rematore|barbell row|bent.?over row/, exclude: /manubri|dumbbell/ },
  { id: 'presa', name: 'Panca presa stretta', district: 'Tricipiti', include: /(panca|bench).*(presa stretta|close.?grip)/ },
]

// Le soglie di gymStrength arrivano a "forte", che sta intorno all'80° percentile.
// Il Diamante è più in là di quanto il 95° stia sopra l'80° nelle tabelle: fra 1,13
// e 1,25 a seconda dell'esercizio, 1,17 in media.
const DIAMANTE_SU_PLATINO = 1.17

/** I massimali in kg che aprono Argento, Oro, Platino e Diamante. */
function soglieDi(alzata: Alzata, pesoKg: number, sex?: 'M' | 'F'): number[] | null {
  if (alzata.tabella) return soglieAlPeso(alzata.tabella, pesoKg, sex)
  const multipli = soglieDistretto(alzata.district, sex, pesoKg)
  if (!multipli) return null
  const kg = multipli.map(m => m * pesoKg)
  return [...kg, kg[2] * DIAMANTE_SU_PLATINO]
}

export interface RankEsercizio {
  rank: Rank
  /** 1 = Bronzo, 5 = Diamante. */
  posto: number
  /** Il rank dopo, a quanti chili di massimale si raggiunge e quanti ne mancano.
   *  `null` al Diamante: non c'è un dopo. */
  prossimo: { rank: Rank; kg: number; mancano: number } | null
  /** 0–1: quanta strada è fatta fra questo rank e il prossimo. */
  avanzamento: number
}

/** Il rank di un esercizio. `pesoKg` è il peso corporeo intero. `null` se
 *  l'esercizio non ha una soglia, se non è mai stato fatto, o se il peso non si sa:
 *  senza, nessun massimale dice niente. */
export function rankEsercizio(ex: PalestraExercise, pesoKg: number, sex?: 'M' | 'F'): RankEsercizio | null {
  const alzata = ALZATE.find(l => eAlzata(ex.n, l))
  if (!alzata || !ex.history.length || pesoKg <= 0) return null
  const soglie = soglieDi(alzata, pesoKg, sex)
  const massimale = Math.max(...ex.history.map(h => entry1RM(h, pesoKg * quotaCorpo(ex))))
  if (!soglie || massimale <= 0) return null

  const indice = soglie.filter(s => massimale >= s).length
  const rank = RANK[indice]
  const dopo = RANK[indice + 1]
  if (!dopo) return { rank, posto: indice + 1, prossimo: null, avanzamento: 1 }
  const da = indice > 0 ? soglie[indice - 1] : 0
  const a = soglie[indice]
  return {
    rank, posto: indice + 1,
    prossimo: { rank: dopo, kg: Math.ceil(a), mancano: Math.ceil(a - massimale) },
    avanzamento: (massimale - da) / (a - da),
  }
}

export interface Traguardo {
  esercizio: string
  rank: Rank
  mancano: number
}

/** Il traguardo più vicino fra gli esercizi di una scheda: quello a cui manca meno,
 *  in proporzione. Cinque chili sul curl sono più lontani di cinque sulla panca. */
export function traguardoScheda(scheda: GymScheda, palestra: PalestraExercise[], pesoKg: number, sex?: 'M' | 'F'): Traguardo | null {
  let meglio: (Traguardo & { quota: number }) | null = null
  for (const riga of scheda.exercises) {
    const ex = esercizioDellaRiga(riga, palestra)
    const prossimo = ex && rankEsercizio(ex, pesoKg, sex)?.prossimo
    if (!ex || !prossimo) continue
    const quota = prossimo.mancano / prossimo.kg
    if (!meglio || quota < meglio.quota) meglio = { esercizio: ex.n, rank: prossimo.rank, mancano: prossimo.mancano, quota }
  }
  return meglio
}

function recordColpi(prima: PalestraHistoryEntry[], alzata: PalestraHistoryEntry): LiftRecord | null {
  if (!prima.length) return null
  const meglio = Math.max(...prima.map(colpiMigliori))
  const ora = colpiMigliori(alzata)
  return ora > meglio ? { prev: meglio, next: ora } : null
}

export interface RecordConRank extends LiftRecord {
  /** Il record è in colpi e non in chili. */
  colpi?: true
  /** Il nome del rank appena raggiunto, se l'alzata ne ha fatto salire uno. */
  salitoA?: string
}

/** Il record di un'alzata che sta per entrare nello storico, e il rank che porta.
 *  Va chiamata PRIMA di scriverla, come `recordFor`. */
export function recordAlzata(ex: PalestraExercise, alzata: PalestraHistoryEntry, pesoKg: number, sex?: 'M' | 'F'): RecordConRank | null {
  const storico = [...ex.history, alzata]
  const colpi = aColpi(ex) && storico.every(h => h.kg === 0)
  const record = colpi ? recordColpi(ex.history, alzata) : recordFor(ex.history, alzata, pesoKg * quotaCorpo(ex))
  if (!record) return null
  const prima = rankEsercizio(ex, pesoKg, sex)
  const dopo = rankEsercizio({ ...ex, history: storico }, pesoKg, sex)
  return {
    ...record,
    ...(colpi ? { colpi: true as const } : {}),
    ...(dopo && dopo.posto > (prima?.posto ?? 0) ? { salitoA: dopo.rank.nome } : {}),
  }
}

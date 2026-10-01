// ── Il carico consigliato ──────────────────────────────────────
// Guardando com'è andata l'ultima volta con QUESTA scheda, dice con che peso
// fare oggi ogni serie. Le regole, in ordine:
//
//   · più di dieci giorni senza farla → né su né giù: dopo uno stop si fa più
//     fatica con gli stessi carichi, e dire "sali" a chi torna dalle ferie è il
//     consiglio sbagliato nel momento peggiore;
//   · la scheda è cambiata da allora (serie o colpi diversi) → si riparte dai
//     carichi che si avevano: l'ultima volta non si può giudicare col programma
//     di oggi;
//   · una serie saltata, una serie chiusa sotto l'obiettivo, o il peso abbassato
//     a metà allenamento → si scende;
//   · l'ultima serie (o le ultime) fatte con un peso più alto delle altre, e
//     tutto a obiettivo → una serie in più col peso alto: 60·60·62,5 diventa
//     60·62,5·62,5, e la settimana dopo 62,5 su tutte e tre;
//   · tutte le serie e tutti i colpi, stesso peso su ogni serie → si può
//     valutare un aumento leggero;
//   · così per due settimane di fila, allo stesso peso → si deve salire;
//   · tutto il resto (una piramide, per esempio) → si ripete l'ultima volta.
//
// Solo lo storico fatto CON QUESTA SCHEDA, senza ripiegare sul resto: lo stesso
// esercizio in un "5 × 5" e in un "3 × 12" ha obiettivi diversi, e un'alzata
// singola registrata a mano non dice niente su come va il programma. E solo dopo
// almeno una settimana di scheda: due allenamenti nella stessa settimana non
// sono "la settimana scorsa".
//
// Il salto è sempre piccolo (vedi `passo`): lo stesso numero su due macchine di
// marche diverse non è lo stesso carico, e su un attrezzo che non si conosce
// 2,5 kg sono già un cambio che si sente.
//
// Niente consiglio sulle alzate a corpo libero e sui massimali: le prime non
// hanno un peso da spostare, i secondi non sono un allenamento.

import type { PalestraHistoryEntry } from '@/store/useJarvisStore'
import { giorniTra, isoWeekSortKey, todayISO } from '@/lib/isoDate'
import { sortedHistory, setLoads, setRepsOf } from './gymModel'

export type Verso = 'su' | 'giu' | 'uguale'

/** Perché si consiglia quel carico. Un codice e non una frase: la frase la
 *  compone chi mostra il consiglio, nella lingua dell'app. */
export type Motivo =
  | 'valuta'          // settimana scorsa tutto fatto, stesso peso: si può provare a salire
  | 'devi'            // due settimane di fila tutto fatto allo stesso peso: si sale
  | 'estendi'         // l'ultima serie è salita: una serie in più col peso alto
  | 'serieMancanti'   // meno serie del previsto
  | 'colpiCorti'      // almeno una serie sotto l'obiettivo
  | 'pesoCalato'      // peso abbassato durante l'allenamento
  | 'mantieni'        // ripetere l'ultima volta
  | 'stop'            // troppi giorni senza farla: né su né giù
  | 'schedaCambiata'  // serie o colpi della scheda cambiati dall'ultima volta

export interface Consiglio {
  verso: Verso
  /** Il carico più pesante consigliato per oggi. */
  kg: number
  /** Il carico consigliato serie per serie: uno per ogni serie della scheda. */
  pesi: number[]
  /** Il carico più pesante della settimana scorsa, da cui si parte. */
  da: number
  motivo: Motivo
  /** Per i motivi che lo citano: quante serie fatte, il bersaglio di colpi,
   *  quante serie col peso alto, da quanti giorni non si faceva. */
  fatte?: number
  cima?: number
  alte?: number
  giorni?: number
}

/** Oltre quanti giorni senza fare la scheda si smette di consigliare su o giù. */
export const GIORNI_DI_STOP = 10

/** L'intervallo di colpi di una riga di scheda: "8-10" → 8…10, "10" → 10…10.
 *  `null` per "max" e per tutto ciò che un numero non è. */
export function intervalloColpi(reps: string): { min: number; max: number } | null {
  const m = /^\s*(\d+)\s*(?:[-–/]\s*(\d+))?\s*$/.exec(reps ?? '')
  if (!m) return null
  const a = parseInt(m[1]), b = m[2] ? parseInt(m[2]) : a
  if (!a) return null
  return { min: Math.min(a, b), max: Math.max(a, b) }
}

/** Di quanto salire o scendere: mai più di 2,5 kg. Sui pesi leggeri anche 2,5
 *  sono un salto enorme (da 8 a 10,5 è un quarto in più), sui bilancieri sono
 *  il passo normale. */
export function passo(kg: number): number {
  if (kg < 10) return 1
  if (kg < 30) return 2
  return 2.5
}

const arrotonda = (n: number) => Math.round(n * 100) / 100

/** Il peso è sceso da una serie a una successiva: si è dovuto alleggerire. */
function haCalato(pesi: number[]): boolean {
  for (let i = 1; i < pesi.length; i++) {
    if (pesi.slice(0, i).some(p => p > pesi[i])) return true
  }
  return false
}

/** La settimana dell'alzata. Le voci senza data (vecchissime) hanno solo
 *  l'etichetta, che basta a separarle fra loro. */
const settimana = (h: PalestraHistoryEntry) => h.date ? isoWeekSortKey(h.date) : h.d

/** La scheda chiedeva altro, il giorno di quell'alzata? Solo se l'alzata se lo
 *  ricorda (`piano`): quelle più vecchie non lo sanno, e si giudicano con la
 *  scheda di oggi come si è sempre fatto. */
function pianoDiverso(h: PalestraHistoryEntry, riga: { sets: number; reps: string }): boolean {
  return !!h.piano && (h.piano.sets !== riga.sets || h.piano.reps.trim() !== riga.reps.trim())
}

/** Un'alzata "piena": tutte le serie, nessuna sotto il minimo di colpi, mai
 *  alleggerito, e lo stesso peso dalla prima all'ultima serie. */
function piena(h: PalestraHistoryEntry, serie: number, colpi: { min: number } | null): boolean {
  if (h.sets_n < serie) return false
  if (colpi && setRepsOf(h).some(r => r < colpi.min)) return false
  const pesi = setLoads(h)
  return pesi.every(k => k === pesi[0])
}

export function caricoConsigliato(
  storico: PalestraHistoryEntry[],
  riga: { sets: number; reps: string },
  schedaId: string | undefined,
  oggi: string = todayISO(),
): Consiglio | null {
  if (!schedaId) return null
  const valide = sortedHistory(storico)
    .filter(h => h.scheda?.id === schedaId && !h.maxLift && !h.bodyweight && h.kg > 0)

  // Una sessione per settimana, l'ultima: è "com'è andata quella settimana".
  const perSettimana: PalestraHistoryEntry[] = []
  for (const h of valide) {
    const ultima = perSettimana[perSettimana.length - 1]
    if (ultima && settimana(ultima) === settimana(h)) perSettimana[perSettimana.length - 1] = h
    else perSettimana.push(h)
  }
  // Almeno una settimana di scheda alle spalle: se la prima volta è stata in
  // questa settimana, non c'è ancora una "settimana scorsa" da cui partire.
  if (!perSettimana.length || settimana(perSettimana[0]) >= isoWeekSortKey(oggi)) return null

  const ultima = perSettimana[perSettimana.length - 1]
  const prima = perSettimana[perSettimana.length - 2]
  const serie = Math.max(1, riga.sets)
  const colpi = intervalloColpi(riga.reps)
  const pesi = setLoads(ultima)
  const reps = setRepsOf(ultima)
  const da = Math.max(...pesi)
  const p = passo(da)
  // L'ultima volta serie per serie, portata al numero di serie di oggi.
  const comePrima = Array.from({ length: serie }, (_, i) => pesi[i] ?? da)
  const tutte = (kg: number) => Array(serie).fill(arrotonda(kg)) as number[]
  const consiglio = (verso: Verso, motivo: Motivo, perSerie: number[], extra: Partial<Consiglio> = {}): Consiglio =>
    ({ verso, kg: Math.max(...perSerie), pesi: perSerie, da, motivo, ...extra })

  // Dopo uno stop non si sale e non si scende: si riparte da dov'era rimasto,
  // sapendo che peserà di più. Viene prima di tutto il resto perché vale
  // comunque sia andata l'ultima volta.
  const giorni = ultima.date ? giorniTra(ultima.date, oggi) : 0
  if (giorni > GIORNI_DI_STOP) return consiglio('uguale', 'stop', comePrima, { giorni })

  // La scheda è cambiata: tre serie su tre di allora non sono "tre su quattro".
  if (pianoDiverso(ultima, riga)) return consiglio('uguale', 'schedaCambiata', comePrima)

  // Prima quello che è andato storto: basta una cosa sola per non salire.
  // Se l'ultima serie era salita di peso ed è lì che non si è retto, si torna al
  // peso di prima, che era già il proprio; altrimenti si scende di un passo.
  const calato = haCalato(pesi)
  const sotto = pesi.filter(k => k < da)
  const giu = (motivo: Motivo, extra: Partial<Consiglio> = {}) =>
    consiglio('giu', motivo, tutte(!calato && sotto.length ? Math.max(...sotto) : Math.max(p, da - p)), extra)
  if (ultima.sets_n < serie) return giu('serieMancanti', { fatte: ultima.sets_n })
  if (colpi && reps.some(r => r < colpi.min)) return giu('colpiCorti', { cima: colpi.min })
  if (calato) return giu('pesoCalato')

  // Tutto fatto, stesso peso su ogni serie. Due settimane così allo stesso peso
  // e il corpo ci si è abituato: si sale. Una settimana sola: si può provare.
  if (sotto.length === 0) {
    // "Di fila": la volta prima dev'essere la settimana prima, non un mese fa.
    // Tredici giorni sono il massimo fra due settimane attaccate (lunedì → la
    // domenica dopo).
    const diFila = !!prima?.date && !!ultima.date && giorniTra(prima.date, ultima.date) <= 13
    const devi = !!prima && diFila && !pianoDiverso(prima, riga) && piena(prima, serie, colpi) && Math.max(...setLoads(prima)) === da
    return consiglio('su', devi ? 'devi' : 'valuta', tutte(da + p))
  }

  // Le ultime serie sono salite di peso, e hanno retto: una serie in più col
  // peso alto, partendo dal fondo. Solo con due pesi in tutto — 60·60·62,5 —
  // perché una piramide (50·55·60) è un riscaldamento, non un aumento a metà.
  if (new Set(comePrima).size === 2) {
    const alte = Math.min(serie, comePrima.filter(k => k === da).length + 1)
    return consiglio('su', 'estendi', comePrima.map((k, i) => i >= serie - alte ? da : k), { alte })
  }

  return consiglio('uguale', 'mantieni', comePrima)
}

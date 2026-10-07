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
//     a metà allenamento → si scende. Tranne se allora il muscolo era già
//     stanco da un altro esercizio e oggi no: si riprova con gli stessi carichi;
//   · oggi il muscolo arriva più stanco dell'ultima volta (la panca fatta per
//     seconda invece che per prima) → né su né giù: sarà più faticoso;
//   · l'esercizio è nuovo, lo si fa da meno di due settimane → non si sale: la
//     priorità è l'esecuzione, e del peso si riparla dopo la seconda settimana;
//   · oggi il muscolo arriva più fresco dell'ultima volta (le spinte fatte per
//     prime invece che dopo la panca) → si sale, di un passo su ogni serie;
//   · l'ultima serie (o le ultime) fatte con un peso più alto delle altre, e
//     tutto a obiettivo → una serie in più col peso alto: 60·60·62,5 diventa
//     60·62,5·62,5, e la settimana dopo 62,5 su tutte e tre;
//   · tutte le serie e tutti i colpi, stesso peso su ogni serie → si può
//     valutare un aumento leggero;
//   · così per due settimane di fila, allo stesso peso → si deve salire. Non
//     alla terza settimana di un esercizio nuovo: lì è ancora un "puoi", e poco;
//   · tutto il resto (una piramide, per esempio) → si ripete l'ultima volta.
//
// "Più fresco" e "più stanco" si leggono da `giaFatti`: quanti esercizi dello
// stesso gruppo muscolare c'erano prima di questo, quel giorno e oggi. L'ordine
// cambia quando la scheda viene riordinata, o quando l'esercizio che veniva
// prima l'ultima volta è stato saltato. Le alzate che non se lo ricordano
// (quelle di prima) non fanno scattare niente.
//
// Solo lo storico fatto CON QUESTA SCHEDA, senza ripiegare sul resto: lo stesso
// esercizio in un "5 × 5" e in un "3 × 12" ha obiettivi diversi, e un'alzata
// singola registrata a mano non dice niente su come va il programma. E solo dopo
// almeno una settimana di scheda: due allenamenti nella stessa settimana non
// sono "la settimana scorsa". Dal resto dello storico si legge una cosa sola:
// da quante settimane si fa l'esercizio, per sapere se è nuovo.
//
// Il salto è sempre piccolo (vedi `passo`): lo stesso numero su due macchine di
// marche diverse non è lo stesso carico, e su un attrezzo che non si conosce
// 2,5 kg sono già un cambio che si sente.
//
// Niente consiglio sulle alzate a corpo libero e sui massimali: le prime non
// hanno un peso da spostare, i secondi non sono un allenamento.

import type { PalestraHistoryEntry } from '@/store/useJarvisStore'
import { giorniTra, isoWeekSortKey, todayISO } from '@/lib/isoDate'
import { displayMuscle, sortedHistory, setLoads, setRepsOf, colpiPrevisti } from './gymModel'

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
  | 'nuovo'           // esercizio fatto da meno di due settimane: prima l'esecuzione
  | 'primoAumento'    // esercizio nuovo, due settimane fatte: si può salire, di poco
  | 'fresco'          // oggi il muscolo arriva più fresco dell'ultima volta
  | 'affaticato'      // oggi il muscolo arriva più stanco dell'ultima volta

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

/** Per quante settimane un esercizio è "nuovo": finché non sono passate non si
 *  consiglia di salire. */
export const SETTIMANE_DA_NUOVO = 2

/** Conta gli esercizi di una sessione nell'ordine in cui si fanno: a ogni
 *  chiamata dice quanti, fra quelli già passati, lavoravano lo stesso gruppo
 *  muscolare. Chi un gruppo non ce l'ha ('Altro', vuoto) non stanca nessuno e
 *  non è stancato da nessuno: due esercizi "Altro" non sono lo stesso muscolo. */
export function contaPerMuscolo(): (muscolo: string | undefined) => number {
  const visti = new Map<string, number>()
  return muscolo => {
    const m = displayMuscle(muscolo ?? '').trim().toLowerCase()
    if (!m || m === 'altro') return 0
    const prima = visti.get(m) ?? 0
    visti.set(m, prima + 1)
    return prima
  }
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

/** La prima serie rimasta sotto il suo minimo di colpi, o -1. Ogni serie ha il
 *  suo (vedi `colpiPrevisti`): in un "10-8-6" la terza a 6 è a posto. Qui le
 *  serie ci sono tutte — a una serie mancante ci si ferma prima — quindi la
 *  prima fatta è la prima prevista. */
function serieCorta(colpi: number[], minimi: number[]): number {
  return colpi.findIndex((c, i) => c < (minimi[Math.min(i, minimi.length - 1)] ?? 0))
}

/** Un'alzata "piena": tutte le serie, nessuna sotto il minimo di colpi, mai
 *  alleggerito, e lo stesso peso dalla prima all'ultima serie. */
function piena(h: PalestraHistoryEntry, serie: number, minimi: number[]): boolean {
  if (h.sets_n < serie) return false
  if (serieCorta(setRepsOf(h), minimi) >= 0) return false
  const pesi = setLoads(h)
  return pesi.every(k => k === pesi[0])
}

export function caricoConsigliato(
  storico: PalestraHistoryEntry[],
  /** La riga della scheda, e quanti esercizi dello stesso gruppo muscolare ha
   *  davanti oggi (`giaFatti`, vedi `contaPerMuscolo`). Senza, l'ordine non si
   *  guarda. */
  riga: { sets: number; reps: string; giaFatti?: number },
  schedaId: string | undefined,
  oggi: string = todayISO(),
): Consiglio | null {
  if (!schedaId) return null
  const questa = isoWeekSortKey(oggi)
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
  if (!perSettimana.length || settimana(perSettimana[0]) >= questa) return null

  const ultima = perSettimana[perSettimana.length - 1]
  const prima = perSettimana[perSettimana.length - 2]
  const serie = Math.max(1, riga.sets)
  const minimi = colpiPrevisti(riga.reps, serie)
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

  // Da quante settimane si fa l'esercizio. Con qualunque scheda, e anche a
  // mano: è la confidenza col gesto che conta, non quella con questo programma.
  const settimaneFatte = new Set(storico.filter(h => !h.date || isoWeekSortKey(h.date) < questa).map(settimana)).size

  // Il muscolo oggi rispetto all'ultima volta: quanti esercizi dello stesso
  // gruppo ha davanti. Solo se lo sanno tutti e due — l'alzata e la scheda.
  const allora = ultima.giaFatti
  const piuFresco = allora !== undefined && riga.giaFatti !== undefined && riga.giaFatti < allora
  const piuStanco = allora !== undefined && riga.giaFatti !== undefined && riga.giaFatti > allora

  // Prima quello che è andato storto: basta una cosa sola per non salire.
  // Se l'ultima serie era salita di peso ed è lì che non si è retto, si torna al
  // peso di prima, che era già il proprio; altrimenti si scende di un passo.
  // Ma se allora il muscolo era già stanco e oggi arriva più fresco, quello che
  // non ha retto può essere stato l'ordine e non il peso: si riprova con gli
  // stessi carichi, senza i cali fatti a metà allenamento.
  const calato = haCalato(pesi)
  const sotto = pesi.filter(k => k < da)
  const giu = (motivo: Motivo, extra: Partial<Consiglio> = {}) =>
    piuFresco
      ? consiglio('uguale', 'fresco', comePrima.map((_, i) => Math.max(...comePrima.slice(0, i + 1))))
      : consiglio('giu', motivo, tutte(!calato && sotto.length ? Math.max(...sotto) : Math.max(p, da - p)), extra)
  if (ultima.sets_n < serie) return giu('serieMancanti', { fatte: ultima.sets_n })
  const corta = serieCorta(reps, minimi)
  if (corta >= 0) return giu('colpiCorti', { cima: minimi[Math.min(corta, minimi.length - 1)] })
  if (calato) return giu('pesoCalato')

  // Da qui in giù l'ultima volta è andata bene, e si tratta di capire se salire.
  // Non se oggi il muscolo arriva più stanco: gli stessi chili peseranno di più.
  if (piuStanco) return consiglio('uguale', 'affaticato', comePrima)
  // Non su un esercizio nuovo: per le prime settimane conta come lo si esegue,
  // e un gesto ancora da imparare non va caricato.
  if (settimaneFatte < SETTIMANE_DA_NUOVO) return consiglio('uguale', 'nuovo', comePrima)
  // E se arriva più fresco si sale comunque, un passo su ogni serie: quei
  // carichi erano stati scelti per un muscolo già stanco.
  if (piuFresco) return consiglio('su', 'fresco', comePrima.map(k => arrotonda(k + passo(k))))

  // Tutto fatto, stesso peso su ogni serie. Due settimane così allo stesso peso
  // e il corpo ci si è abituato: si sale. Una settimana sola: si può provare.
  if (sotto.length === 0) {
    // "Di fila": la volta prima dev'essere la settimana prima, non un mese fa.
    // Tredici giorni sono il massimo fra due settimane attaccate (lunedì → la
    // domenica dopo).
    const diFila = !!prima?.date && !!ultima.date && giorniTra(prima.date, ultima.date) <= 13
    const devi = !!prima && diFila && !pianoDiverso(prima, riga) && piena(prima, serie, minimi) && Math.max(...setLoads(prima)) === da
    // Appena uscito dalle prime settimane, un esercizio nuovo ha proprio due
    // settimane piene alle spalle: lì è un permesso, e piccolo, non un ordine.
    const motivo: Motivo = settimaneFatte === SETTIMANE_DA_NUOVO ? 'primoAumento' : devi ? 'devi' : 'valuta'
    return consiglio('su', motivo, tutte(da + p))
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

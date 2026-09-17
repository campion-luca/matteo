// Hyrox a metà distanza, e come se ne ricava un tempo di gara.
//
// ── Il "mezzo esercizio" ───────────────────────────────────────
// In allenamento raramente si fa la stazione intera: 500 m di SkiErg invece di
// 1000, 50 wall ball invece di 100, 500 m di corsa invece di 1 km. Non serve un
// campo nuovo per dirlo: ogni sessione registra già la distanza fatta davvero
// (`units`), e quello basta a classificarla. Niente da migrare, niente da
// sincronizzare, e i dati vecchi finiscono da soli nel posto giusto.
//
// ── Come ragiona la stima ──────────────────────────────────────
// Ogni sessione è stata fatta in condizioni diverse: una gara, una simulazione a
// metà, un allenamento a gambe fresche; da solo o in coppia. Sommarle così come
// sono vorrebbe dire sommare mele e pere. Il ragionamento è in tre passi:
//
//   1. RIPORTARE ogni sessione a una misura comune: "tu, da solo, fresco, sulla
//      distanza di gara". Una corsa fatta in gara si spoglia della fatica delle
//      stazioni; una stazione di una gara in coppia si spoglia dei turni col
//      compagno; una mezza si porta alla distanza intera con Riegel.
//   2. COMPLETARE i segmenti che mancano col tuo profilo: se sei il 10% più lento
//      di un tempo di riferimento dove hai dati, lo sei probabilmente anche dove
//      non ne hai. Serve almeno qualche segmento misurato.
//   3. RIMONTARE la gara nella categoria scelta: la corsa riprende la sua fatica
//      (meno in coppia, perché le stazioni si dividono), le stazioni in coppia si
//      fanno a turni, e si aggiungono i passaggi in Roxzone.
//
// Una gara o una simulazione si riconoscono da sole: sono il giorno in cui hai
// registrato almeno 5 segmenti della stessa distanza. Contano più
// dell'allenamento, perché dentro c'è già quello che un allenamento non ha — il
// ritmo tenuto con tutto il resto intorno.
//
// ── Da mezza a intera: la formula di Riegel ────────────────────
//     T₂ = T₁ × (D₂ / D₁)^k
// Pete Riegel (1977) la ricavò sui tempi di gara di corsa, nuoto e ciclismo: il
// tempo non cresce in proporzione alla distanza, ma un po' di più, perché il
// ritmo cala man mano che ci si stanca. Con k = 1,06 raddoppiare la distanza
// costa 2,085 volte il tempo, non 2. La stessa formula, letta al contrario, dice
// quanto si guadagna spezzando una stazione in turni più corti.
//
// Tutti i coefficienti qui sotto sono IPOTESI dichiarate — il valore di Riegel è
// pubblicato per l'endurance, non per le stazioni Hyrox — e appena i tuoi dati
// lo permettono (una intera e una mezza della stessa stazione) k si ricava dai
// tuoi tempi invece che dalle ipotesi.

import type { HyroxExercise, HyroxHistoryEntry } from '@/store/useJarvisStore'
import { sortedHistory } from './gymModel'

export type FormatoHyrox = 'intero' | 'mezzo'
export type Categoria = 'double' | 'singolo'
/** In che condizioni è stata fatta una sessione. */
export type Contesto = 'gara' | 'simulazione' | 'allenamento'

/** Oltre i tre quarti della distanza di gara una sessione conta come intera: un
 *  800 m di SkiErg è una prova da 1000 fatta un po' corta, non una mezza. */
const SOGLIA_MEZZO = 0.75

export function formatoSessione(h: Pick<HyroxHistoryEntry, 'units'>, target: number): FormatoHyrox {
  if (!(h.units > 0) || !(target > 0)) return 'intero'
  return h.units <= target * SOGLIA_MEZZO ? 'mezzo' : 'intero'
}

export function sessioniDel<T extends Pick<HyroxHistoryEntry, 'units'>>(hist: T[], target: number, formato: FormatoHyrox): T[] {
  return hist.filter(h => formatoSessione(h, target) === formato)
}

/** La distanza da proporre quando si registra: quella di gara o la sua metà. */
export function unitaFormato(target: number, formato: FormatoHyrox): number {
  return formato === 'mezzo' ? target / 2 : target
}

/** "1 km", "500 m", "100 rep": la distanza come la si dice, non come la si salva.
 *  Mezzo chilometro è "500 m" — "0.5 km" non lo scrive nessuno. */
export function distanzaLeggibile(units: number, unit: HyroxExercise['unit']): string {
  if (unit === 'km') return units < 1 ? `${Math.round(units * 1000)} m` : `${Number(units.toFixed(2))} km`
  return `${Number(units.toFixed(1))} ${unit}`
}

// ── Esponenti di Riegel per segmento ───────────────────────────
// Corsa ed ergometri: il valore di Riegel per l'endurance. Le altre stazioni:
// ipotesi, crescenti con quanto la prestazione si sgretola sulla durata — una
// slitta o cento wall ball si fermano, un remo no.
export const ESPONENTE: Record<string, number> = {
  hx_run:    1.06,
  hx_ski:    1.06,
  hx_row:    1.06,
  hx_bbj:    1.10,
  hx_farm:   1.10,
  hx_lunge:  1.10,
  hx_sled_p: 1.12,
  hx_sled_u: 1.12,
  hx_wb:     1.12,
}
/** Esercizi creati dall'utente: nessuna idea di che sforzo siano, quindi a metà
 *  strada fra un ergometro e una slitta. */
export const ESPONENTE_DEFAULT = 1.08

/** Il k personale non può uscire da qui. Sotto 1 vorrebbe dire che la distanza
 *  intera è più veloce, al metro, della metà — succede solo se la mezza è stata
 *  fatta stanchi, e fidarsene butterebbe la stima. Sopra 1,25 è quasi sempre una
 *  sessione intera andata male, non la tua curva di fatica. */
const K_MIN = 1.0
const K_MAX = 1.25

/** Quante sessioni fanno la stima di un segmento: le ultime, non tutte. Tre
 *  bastano a smussare una giornata storta, e non trascinano dentro la forma di sei
 *  mesi fa. */
const RECENTI = 3

/** Il tempo che servirebbe su un'altra distanza, con Riegel. */
export function proietta(sec: number, daUnita: number, aUnita: number, k: number): number {
  if (!(daUnita > 0) || daUnita === aUnita) return sec
  return sec * Math.pow(aUnita / daUnita, k)
}

const media = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
const mediana = (xs: number[]) => {
  const o = [...xs].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

export const CORSA_ID = 'hx_run'
const isCorsa = (id: string) => id === CORSA_ID

// ── Gare e simulazioni ─────────────────────────────────────────
/** Da quanti segmenti registrati nello stesso giorno, e alla stessa distanza, si
 *  capisce che quel giorno era una gara (intera) o una simulazione (a metà).
 *  Cinque su nove: una gara registrata a pezzi resta una gara, mentre un
 *  allenamento con due stazioni e una corsa resta un allenamento. */
export const SOGLIA_GARA = 5

export interface GiorniDiGara { gara: Set<string>; simulazione: Set<string> }

type Segmento = Pick<HyroxExercise, 'id' | 'target' | 'history'>

export function giorniDiGara(segmenti: Segmento[]): GiorniDiGara {
  const conta: Record<FormatoHyrox, Map<string, number>> = { intero: new Map(), mezzo: new Map() }
  for (const s of segmenti) {
    // Un segmento conta una volta per giorno: due SkiErg lo stesso giorno non
    // fanno due segmenti.
    const visti: Record<FormatoHyrox, Set<string>> = { intero: new Set(), mezzo: new Set() }
    for (const h of s.history) if (h.date) visti[formatoSessione(h, s.target)].add(h.date)
    for (const f of ['intero', 'mezzo'] as const) {
      for (const d of visti[f]) conta[f].set(d, (conta[f].get(d) ?? 0) + 1)
    }
  }
  const sopra = (m: Map<string, number>) => new Set([...m].filter(([, n]) => n >= SOGLIA_GARA).map(([d]) => d))
  return { gara: sopra(conta.intero), simulazione: sopra(conta.mezzo) }
}

export function contestoSessione(h: Pick<HyroxHistoryEntry, 'units' | 'date'>, target: number, giorni: GiorniDiGara): Contesto {
  const f = formatoSessione(h, target)
  if (f === 'intero' && giorni.gara.has(h.date)) return 'gara'
  if (f === 'mezzo' && giorni.simulazione.has(h.date)) return 'simulazione'
  return 'allenamento'
}

// ── Fatica e coppia ────────────────────────────────────────────
/** Quanto rallenta il chilometro di gara rispetto a uno corso fresco. In singolo
 *  ogni chilometro arriva dopo una stazione fatta tutta da te: +10%. In double le
 *  stazioni si dividono, e ne arriva addosso circa metà: +5%. Ipotesi. */
export const FATICA_CORSA: Record<Categoria, number> = { singolo: 1.10, double: 1.05 }
/** Una simulazione a metà ha metà stazioni fra una corsa e l'altra: la sua corsa
 *  porta circa metà della fatica di una gara singola. Ipotesi. */
export const FATICA_CORSA_SIMULAZIONE = 1.05

/** Come si divide una stazione in double: in quanti turni (sommati fra i due) e
 *  quanto costa ogni cambio. Un turno corto si tiene a un ritmo più alto di uno
 *  lungo — è Riegel letto al contrario — e il compagno intanto recupera.
 *  Ergometri: quattro turni, e scendere dal remo coi piedi legati costa. Slitte:
 *  una vasca a testa. Farmers: 100 m a testa. Wall ball: sei blocchi, il cambio è
 *  un passaggio di palla. Ipotesi, da sostituire coi tuoi turni veri. */
export const TURNI_DOUBLE: Record<string, { turni: number; cambioSec: number }> = {
  hx_ski:    { turni: 4, cambioSec: 5 },
  hx_sled_p: { turni: 4, cambioSec: 3 },
  hx_sled_u: { turni: 4, cambioSec: 4 },
  hx_bbj:    { turni: 4, cambioSec: 2 },
  hx_row:    { turni: 4, cambioSec: 6 },
  hx_farm:   { turni: 2, cambioSec: 3 },
  hx_lunge:  { turni: 4, cambioSec: 4 },
  hx_wb:     { turni: 6, cambioSec: 2 },
}
const TURNI_DEFAULT = { turni: 4, cambioSec: 3 }

/** Da una stazione fatta da solo e fresco, al tempo della coppia in gara. Ogni
 *  turno è 1/turni della distanza: con Riegel il totale è fresco × turni^(1−k),
 *  più i cambi.
 *
 *  k qui è sempre quello di partenza, mai quello tarato su di te. Il k personale
 *  può scendere fino a 1, e con k = 1 i turni non farebbero guadagnare niente:
 *  restavano solo i secondi dei cambi, e la coppia usciva PIÙ LENTA di te da
 *  solo. E un k che dipende dalle gare in double, usato per leggere le gare in
 *  double, girerebbe in tondo. */
export function stazioneDouble(fresco: number, id: string): number {
  const p = TURNI_DOUBLE[id] ?? TURNI_DEFAULT
  const k = ESPONENTE[id] ?? ESPONENTE_DEFAULT
  return fresco * Math.pow(p.turni, 1 - k) + (p.turni - 1) * p.cambioSec
}

/** L'inverso: da una stazione di una gara in coppia, a te da solo e fresco. Il
 *  tetto al raddoppio protegge da un tempo registrato male (pochi secondi), che
 *  tolti i cambi diventerebbe zero o negativo. */
function stazioneDaDouble(sec: number, id: string): number {
  const p = TURNI_DOUBLE[id] ?? TURNI_DEFAULT
  const k = ESPONENTE[id] ?? ESPONENTE_DEFAULT
  const netto = (sec - (p.turni - 1) * p.cambioSec) / Math.pow(p.turni, 1 - k)
  return Math.min(sec * 2, Math.max(sec, netto))
}

/** Passo 1: una sessione riportata a "tu, da solo, fresco", sulla SUA distanza.
 *  La categoria serve a leggere le gare: una gara registrata vale per quella che
 *  corri (double o singolo). */
export function secFresco(h: Pick<HyroxHistoryEntry, 'sec'>, id: string, contesto: Contesto, categoria: Categoria): number {
  if (isCorsa(id)) {
    if (contesto === 'gara') return h.sec / FATICA_CORSA[categoria]
    if (contesto === 'simulazione') return h.sec / FATICA_CORSA_SIMULAZIONE
    return h.sec
  }
  if (contesto === 'gara' && categoria === 'double') return stazioneDaDouble(h.sec, id)
  return h.sec
}

/** Quanto possono stare lontane un'intera e una mezza per dire qualcosa sulla
 *  distanza. Oltre, la differenza fra le due è soprattutto forma cambiata: una
 *  gara di giugno e una simulazione di settembre darebbero un k che si mangia il
 *  miglioramento, e la simulazione non abbasserebbe mai la stima. */
export const GIORNI_K = 21
const GIORNO_MS = 86_400_000

/** k ricavato dai tuoi tempi: serve un'intera e una mezza vicine nel tempo.
 *  Si confrontano dopo averle riportate entrambe a "fresco, da solo", così una
 *  gara e una simulazione non scambiano la fatica di gara per fatica da distanza. */
export function esponentePersonale(seg: Segmento, giorni: GiorniDiGara, categoria: Categoria, kBase: number): number | null {
  const ord = sortedHistory(seg.history)
  const fresco = (h: HyroxHistoryEntry) => secFresco(h, seg.id, contestoSessione(h, seg.target, giorni), categoria)
  const tutteIntere = sessioniDel(ord, seg.target, 'intero')
  const vicina = (m: HyroxHistoryEntry) => tutteIntere.some(i => Math.abs(Date.parse(i.date) - Date.parse(m.date)) <= GIORNI_K * GIORNO_MS)
  const mezze = sessioniDel(ord, seg.target, 'mezzo').filter(vicina).slice(-RECENTI)
  if (!mezze.length) return null
  const ultimaMezza = Date.parse(mezze[mezze.length - 1].date)
  const primaMezza = Date.parse(mezze[0].date)
  const intere = tutteIntere
    .filter(i => Date.parse(i.date) >= primaMezza - GIORNI_K * GIORNO_MS && Date.parse(i.date) <= ultimaMezza + GIORNI_K * GIORNO_MS)
    .slice(-RECENTI)
  if (!intere.length) return null
  const tIntera = media(intere.map(h => proietta(fresco(h), h.units, seg.target, kBase)))
  const tMezza  = media(mezze.map(h => proietta(fresco(h), h.units, seg.target / 2, kBase)))
  if (!(tIntera > 0) || !(tMezza > 0)) return null
  return Math.min(K_MAX, Math.max(K_MIN, Math.log2(tIntera / tMezza)))
}

const ORDINE_CONTESTI: Contesto[] = ['gara', 'simulazione', 'allenamento']

export interface StimaSegmento {
  /** Tu, da solo, fresco, sulla distanza di gara, in secondi. `null` se mancano i
   *  dati (e il profilo non basta a completarli). */
  fresco: number | null
  /** misura = dalle tue sessioni; profilo = completato dagli altri segmenti. */
  fonte: 'misura' | 'profilo' | 'mancante'
  /** Da che tipo di sessioni viene, in ordine di peso. */
  contesti: Contesto[]
  /** Almeno una delle sessioni usate era a metà distanza. */
  daMezza: boolean
  k: number
  /** true = k ricavato dai tuoi tempi, false = ipotesi di partenza. */
  kPersonale: boolean
  /** Quante sessioni entrano nella stima. */
  sessioni: number
}

/** Passo 1 per un segmento intero.
 *
 *  Gare e simulazioni, quando ci sono, vincono sull'allenamento: sono state fatte
 *  con tutto il resto intorno, e il ritmo tenuto lì vale più di un 500 m a gambe
 *  fresche. L'allenamento serve dove di gare non ce n'è. Fra le sessioni scelte
 *  contano le ultime tre, intere o mezze che siano: la forma di oggi. */
export function stimaSegmento(seg: Segmento, giorni: GiorniDiGara, categoria: Categoria): StimaSegmento {
  const kBase = ESPONENTE[seg.id] ?? ESPONENTE_DEFAULT
  const kPers = esponentePersonale(seg, giorni, categoria, kBase)
  const k = kPers ?? kBase
  const base = { k, kPersonale: kPers !== null }

  const valide = sortedHistory(seg.history).filter(h => h.sec > 0)
  const contesto = (h: HyroxHistoryEntry) => contestoSessione(h, seg.target, giorni)
  const daGara = valide.filter(h => contesto(h) !== 'allenamento')
  const usate = (daGara.length ? daGara : valide).slice(-RECENTI)
  if (!usate.length) return { ...base, fresco: null, fonte: 'mancante', contesti: [], daMezza: false, sessioni: 0 }

  const fresco = media(usate.map(h => proietta(secFresco(h, seg.id, contesto(h), categoria), h.units, seg.target, k)))
  return {
    ...base,
    fresco,
    fonte: 'misura',
    contesti: ORDINE_CONTESTI.filter(c => usate.some(h => contesto(h) === c)),
    daMezza: usate.some(h => formatoSessione(h, seg.target) === 'mezzo'),
    sessioni: usate.length,
  }
}

// ── Passo 2: il profilo ────────────────────────────────────────
/** Un'amatore di riferimento, da solo e fresco, sulla distanza di gara. Non conta
 *  il valore assoluto: conta la PROPORZIONE fra i segmenti, che serve a dire
 *  quanto verrebbe una stazione mai registrata sapendo come vai nelle altre. */
export const RIFERIMENTO: Record<string, number> = {
  hx_run:    300,   // 5:00 al km
  hx_ski:    270,
  hx_sled_p: 180,
  hx_sled_u: 240,
  hx_bbj:    270,
  hx_row:    290,
  hx_farm:   120,
  hx_lunge:  240,
  hx_wb:     330,
}
/** Sotto questi segmenti misurati il profilo è un'impressione, non una misura:
 *  la stima resta parziale invece di inventare il resto. */
export const MIN_PER_PROFILO = 3

// ── Passo 3: la gara ───────────────────────────────────────────
/** Ogni stazione si entra e si esce passando dalla Roxzone: 8 × 2. */
export const ROXZONE_PASSAGGI = 16
/** Ipotesi per un amatore: il cambio, la ricerca della propria corsia, il tempo
 *  per riprendere fiato. Uguale in double: si entra e si esce insieme. */
export const ROXZONE_SEC = 25

export interface TempiGara {
  /** Un chilometro di gara, con la sua fatica. */
  corsaKm: number
  /** La fatica aggiunta alla corsa, sugli 8 km. */
  faticaCorsa: number
  corsa: number
  stazioni: number
  roxzone: number
  totale: number
  /** Il tempo di gara di ogni stazione, per id. */
  perStazione: Record<string, number>
}

export interface StimaGara {
  categoria: Categoria
  corsa: StimaSegmento
  stazioni: Array<{ ex: HyroxExercise; stima: StimaSegmento }>
  misurati: number
  daProfilo: number
  totaleSegmenti: number
  /** Quanto sei più lento (>1) o più veloce (<1) del riferimento. */
  fattoreProfilo: number | null
  /** I giorni di gara e simulazione trovati, i più recenti per ultimi. */
  gare: string[]
  simulazioni: string[]
  /** La gara nelle due categorie; `null` se i dati non bastano. */
  tempi: Record<Categoria, TempiGara | null>
  /** Quanto fidarsi, in secondi, sul totale della categoria scelta: ± margine. */
  margine: number | null
}

function tempiGara(categoria: Categoria, corsa: StimaSegmento, stazioni: Array<{ ex: HyroxExercise; stima: StimaSegmento }>): TempiGara | null {
  if (corsa.fresco === null || stazioni.some(s => s.stima.fresco === null)) return null
  const corsaKm = corsa.fresco * FATICA_CORSA[categoria]
  const perStazione: Record<string, number> = {}
  for (const { ex, stima } of stazioni) {
    perStazione[ex.id] = categoria === 'double' ? stazioneDouble(stima.fresco!, ex.id) : stima.fresco!
  }
  const corsaTot = corsaKm * 8
  const stazioniTot = Object.values(perStazione).reduce((s, x) => s + x, 0)
  const roxzone = ROXZONE_PASSAGGI * ROXZONE_SEC
  return {
    corsaKm, corsa: corsaTot, stazioni: stazioniTot, roxzone,
    faticaCorsa: corsaTot - corsa.fresco * 8,
    totale: corsaTot + stazioniTot + roxzone,
    perStazione,
  }
}

/** `categoria` è quella che corri: dice come leggere le gare registrate e quale
 *  tempo mettere in primo piano. L'altra categoria nasce dagli STESSI tempi
 *  freschi — cambia solo il passo 3 — così il confronto fra le due è onesto. */
export function stimaGara(corsaEx: HyroxExercise, stazioniEx: HyroxExercise[], categoria: Categoria): StimaGara {
  const giorni = giorniDiGara([corsaEx, ...stazioniEx])
  const corsa = stimaSegmento(corsaEx, giorni, categoria)
  const stazioni = stazioniEx.map(ex => ({ ex, stima: stimaSegmento(ex, giorni, categoria) }))
  const tutti = [{ id: corsaEx.id, stima: corsa }, ...stazioni.map(s => ({ id: s.ex.id, stima: s.stima }))]

  // Passo 2: il profilo si misura dove ci sono dati, e completa dove mancano.
  const misurati = tutti.filter(s => s.stima.fresco !== null).length
  const rapporti = tutti
    .filter(s => s.stima.fresco !== null && RIFERIMENTO[s.id])
    .map(s => s.stima.fresco! / RIFERIMENTO[s.id])
  const fattore = rapporti.length >= MIN_PER_PROFILO ? mediana(rapporti) : null
  let daProfilo = 0
  if (fattore !== null) {
    for (const s of tutti) {
      if (s.stima.fresco === null && RIFERIMENTO[s.id]) {
        s.stima.fresco = RIFERIMENTO[s.id] * fattore
        s.stima.fonte = 'profilo'
        daProfilo++
      }
    }
  }

  // Passo 3, nelle due categorie.
  const tempi: Record<Categoria, TempiGara | null> = {
    double:  tempiGara('double', corsa, stazioni),
    singolo: tempiGara('singolo', corsa, stazioni),
  }

  // Il margine cresce con quello che la stima deve supporre invece di misurare:
  // una base del 3%, un punto e mezzo per ogni segmento dal profilo, tre punti se
  // non c'è nessuna gara né simulazione a dare il ritmo vero.
  const conGara = giorni.gara.size > 0 || giorni.simulazione.size > 0
  const quota = 0.03 + 0.015 * daProfilo + (conGara ? 0 : 0.03)
  const scelti = tempi[categoria]

  return {
    categoria, corsa, stazioni, misurati, daProfilo,
    totaleSegmenti: stazioniEx.length + 1,
    fattoreProfilo: fattore,
    gare: [...giorni.gara].sort(),
    simulazioni: [...giorni.simulazione].sort(),
    tempi,
    margine: scelti ? scelti.totale * quota : null,
  }
}

/** Un tempo di gara si scrive con le ore: "1:12:40", non "72:40". */
export function fmtTempoGara(sec: number): string {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`
}

// Hyrox: le distanze, e il tempo di gara che i tuoi allenamenti promettono.
//
// ── Il "mezzo esercizio" ───────────────────────────────────────
// In allenamento raramente si fa la stazione intera: 500 m di SkiErg invece di
// 1000, 50 wall ball invece di 100, 500 m di corsa invece di 1 km. Non serve un
// campo nuovo per dirlo: ogni sessione registra già la distanza fatta davvero
// (`units`), e quello basta a classificarla.
//
// ── La stima: la somma dei tuoi PB ─────────────────────────────
// Il tempo di gara stimato è la somma dei tuoi tempi migliori, segmento per
// segmento: la corsa (il tuo miglior passo al km × 8), le otto stazioni, la
// Roxzone. Ogni numero viene da una cosa che hai fatto davvero, e la pagina dice
// quale — l'allenamento del 12 settembre, la gara di maggio.
//
// Prima la stima era un modello: riportava ogni sessione a "da solo, fresco",
// la proiettava con Riegel, la rimontava con fatica e turni in coppia, e
// riconosceva gare e simulazioni contando le stazioni registrate lo stesso
// giorno. Ogni passo aveva la sua ragione, ma messi in fila facevano un numero
// che nessuno poteva controllare: una simulazione da 1:30 registrata con
// l'interruttore su 500 m diventava "una simulazione a metà" da raddoppiare, e la
// stima diceva 2:16. Adesso le gare e le simulazioni intere si registrano come
// tali (HyroxGara), e la stima è una somma che si rifà a mano.
//
// Restano due supposizioni, dette in chiaro dove compaiono:
//  · una stazione fatta solo a metà distanza si porta all'intera con Riegel —
//    finché non ce n'è una intera, che vince sempre;
//  · con almeno tre segmenti misurati, quelli che mancano si completano col tuo
//    profilo, e la Roxzone senza una gara registrata è un'ipotesi.

import type { HyroxExercise, HyroxGara, HyroxHistoryEntry } from '@/store/useJarvisStore'

export type FormatoHyrox = 'intero' | 'mezzo'
export type Categoria = HyroxGara['categoria']

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

/** Il tempo che servirebbe su un'altra distanza, con la formula di Riegel:
 *      T₂ = T₁ × (D₂ / D₁)^k
 *  Pete Riegel (1977) la ricavò sui tempi di gara di corsa, nuoto e ciclismo: il
 *  tempo non cresce in proporzione alla distanza ma un po' di più, perché il
 *  ritmo cala con la fatica. Con k = 1,06 raddoppiare la distanza costa 2,085
 *  volte il tempo, non 2. */
export function proietta(sec: number, daUnita: number, aUnita: number, k: number): number {
  if (!(daUnita > 0) || daUnita === aUnita) return sec
  return sec * Math.pow(aUnita / daUnita, k)
}

const mediana = (xs: number[]) => {
  const o = [...xs].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

export const CORSA_ID = 'hx_run'

// ── Il profilo, per i segmenti che mancano ──────────────────────
/** Un'amatore di riferimento, da solo e fresco, sulla distanza di gara (la
 *  corsa è al km). Non conta il valore assoluto: conta la PROPORZIONE fra i
 *  segmenti, che dice quanto verrebbe una stazione mai registrata sapendo come
 *  vai nelle altre. */
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

// ── La Roxzone ─────────────────────────────────────────────────
/** Senza una gara registrata la Roxzone è un'ipotesi: ogni stazione si entra e
 *  si esce passando di lì (8 × 2), e a un amatore ogni passaggio costa sui 25 s. */
export const ROXZONE_PASSAGGI = 16
export const ROXZONE_SEC = 25

/** Il "nell'ultimo mese" accanto alla stima e alle stazioni. */
export const GIORNI_DELTA = 30

// ── La stima ───────────────────────────────────────────────────
/** Da dove viene un tempo. È quello che la pagina scrive sotto ogni numero. */
export type Fonte =
  | { tipo: 'allenamento'; data: string }
  /** Una sessione a metà distanza, portata all'intera con Riegel. */
  | { tipo: 'mezza'; data: string; daUnita: number; k: number }
  | { tipo: 'gara' | 'simulazione'; data: string }
  | { tipo: 'profilo' }
  | { tipo: 'ipotesi' }

export interface PB {
  /** Sulla distanza di gara, in secondi. `null` = nessun dato. */
  sec: number | null
  fonte: Fonte | null
  /** Rispetto a un mese fa, in secondi: negativo = migliorato. `null` se un
   *  mese fa il tempo non c'era, o se uno dei due è supposto e non misurato. */
  delta: number | null
}

export interface StimaPB {
  /** La categoria della stima: quella della tua ultima gara registrata. `null`
   *  senza gare — gli allenamenti valgono per entrambe. */
  categoria: Categoria | null
  /** Gli 8 km. `passoKm` è il passo che li fa. */
  corsa: PB & { passoKm: number | null }
  stazioni: Array<{ id: string; pb: PB }>
  roxzone: PB
  parti: { corsa: number; stazioni: number; roxzone: number } | null
  totale: number | null
  /** Il totale rispetto a un mese fa. */
  delta: number | null
  misurati: number
  daProfilo: number
}

type Segmento = Pick<HyroxExercise, 'id' | 'target' | 'history'>
interface Candidato { sec: number; fonte: Fonte }

const migliore = (c: Candidato[]): Candidato | null =>
  c.reduce<Candidato | null>((m, x) => (m === null || x.sec < m.sec ? x : m), null)

const misurato = (f: Fonte | null) => f !== null && f.tipo !== 'profilo' && f.tipo !== 'ipotesi'

/** Le sessioni fino a quel giorno (incluso). Senza `fino`, tutte. */
const entro = (data: string | undefined, fino?: string) => !fino || !data || data <= fino

/** Il miglior tempo di una stazione. Una sessione intera, di allenamento o di
 *  gara, vince sempre su una mezza: la mezza serve solo dove di intere non ce
 *  n'è, perché la sua proiezione è una supposizione. Le gare contano solo se
 *  della categoria della stima — in double la stazione si fa in due. */
function pbStazione(ex: Segmento, gare: HyroxGara[], categoria: Categoria | null, fino?: string): Candidato | null {
  const k = ESPONENTE[ex.id] ?? ESPONENTE_DEFAULT
  const intere: Candidato[] = []
  const mezze: Candidato[] = []
  for (const h of ex.history) {
    if (!(h.sec > 0) || !entro(h.date, fino)) continue
    const sec = proietta(h.sec, h.units, ex.target, k)
    if (formatoSessione(h, ex.target) === 'intero') intere.push({ sec, fonte: { tipo: 'allenamento', data: h.date } })
    else mezze.push({ sec, fonte: { tipo: 'mezza', data: h.date, daUnita: h.units, k } })
  }
  for (const g of gare) {
    const sec = g.stazioni[ex.id]
    if (!(sec > 0) || !entro(g.date, fino) || (categoria && g.categoria !== categoria)) continue
    intere.push({ sec, fonte: { tipo: g.tipo, data: g.date } })
  }
  return migliore(intere) ?? migliore(mezze)
}

/** Il miglior passo al km. Dalle sessioni di corsa (registrate al km, o su più
 *  km: il passo è la media) e dalle gare, dove gli 8 km si fanno in due anche in
 *  double — corrono tutti e due — quindi valgono in entrambe le categorie. */
function pbCorsa(ex: Segmento, gare: HyroxGara[], fino?: string): Candidato | null {
  const k = ESPONENTE[ex.id] ?? ESPONENTE_DEFAULT
  const intere: Candidato[] = []
  const mezze: Candidato[] = []
  for (const h of ex.history) {
    if (!(h.sec > 0) || !(h.units > 0) || !entro(h.date, fino)) continue
    if (formatoSessione(h, ex.target) === 'intero') intere.push({ sec: h.sec / h.units, fonte: { tipo: 'allenamento', data: h.date } })
    else mezze.push({ sec: proietta(h.sec, h.units, 1, k), fonte: { tipo: 'mezza', data: h.date, daUnita: h.units, k } })
  }
  for (const g of gare) {
    if (!(g.corsa > 0) || !entro(g.date, fino)) continue
    intere.push({ sec: g.corsa / 8, fonte: { tipo: g.tipo, data: g.date } })
  }
  return migliore(intere) ?? migliore(mezze)
}

function pbRoxzone(gare: HyroxGara[], fino?: string): Candidato {
  const viste = gare
    .filter(g => g.roxzone > 0 && entro(g.date, fino))
    .map(g => ({ sec: g.roxzone, fonte: { tipo: g.tipo, data: g.date } as Fonte }))
  return migliore(viste) ?? { sec: ROXZONE_PASSAGGI * ROXZONE_SEC, fonte: { tipo: 'ipotesi' } }
}

interface Calcolo {
  corsaKm: Candidato | null
  stazioni: Array<{ id: string; c: Candidato | null }>
  roxzone: Candidato
  totale: number | null
  misurati: number
  daProfilo: number
}

function calcola(corsaEx: Segmento, stazioniEx: Segmento[], gare: HyroxGara[], categoria: Categoria | null, fino?: string): Calcolo {
  let corsaKm = pbCorsa(corsaEx, gare, fino)
  const stazioni = stazioniEx.map(ex => ({ id: ex.id, c: pbStazione(ex, gare, categoria, fino) }))
  const roxzone = pbRoxzone(gare, fino)

  // Il profilo: quanto sei più lento o più veloce del riferimento dove ci sono
  // dati, applicato dove non ce n'è. La corsa entra col suo passo al km.
  const misurati = (corsaKm ? 1 : 0) + stazioni.filter(s => s.c).length
  const rapporti = [
    ...(corsaKm && RIFERIMENTO[corsaEx.id] ? [corsaKm.sec / RIFERIMENTO[corsaEx.id]] : []),
    ...stazioni.filter(s => s.c && RIFERIMENTO[s.id]).map(s => s.c!.sec / RIFERIMENTO[s.id]),
  ]
  let daProfilo = 0
  if (rapporti.length >= MIN_PER_PROFILO) {
    const fattore = mediana(rapporti)
    if (!corsaKm && RIFERIMENTO[corsaEx.id]) {
      corsaKm = { sec: RIFERIMENTO[corsaEx.id] * fattore, fonte: { tipo: 'profilo' } }
      daProfilo++
    }
    for (const s of stazioni) {
      if (!s.c && RIFERIMENTO[s.id]) {
        s.c = { sec: RIFERIMENTO[s.id] * fattore, fonte: { tipo: 'profilo' } }
        daProfilo++
      }
    }
  }

  const completa = corsaKm !== null && stazioni.every(s => s.c !== null)
  const totale = completa
    ? corsaKm!.sec * 8 + stazioni.reduce((t, s) => t + s.c!.sec, 0) + roxzone.sec
    : null
  return { corsaKm, stazioni, roxzone, totale, misurati, daProfilo }
}

/** Un giorno ISO spostato di `giorni`, senza passare dal fuso del telefono. */
function spostaGiorni(iso: string, giorni: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + giorni)
  return d.toISOString().slice(0, 10)
}

const differenza = (ora: Candidato | null, prima: Candidato | null, scala = 1): number | null =>
  ora && prima && misurato(ora.fonte) && misurato(prima.fonte) ? Math.round((ora.sec - prima.sec) * scala) : null

/** La categoria della stima: quella dell'ultima gara registrata. */
export function categoriaStima(gare: HyroxGara[]): Categoria | null {
  const ultima = [...gare].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).pop()
  return ultima?.categoria ?? null
}

/** Il tempo di gara stimato: la somma dei tuoi PB, e com'era un mese fa. */
export function stimaPB(corsaEx: Segmento, stazioniEx: Segmento[], gare: HyroxGara[], oggi: string): StimaPB {
  const categoria = categoriaStima(gare)
  const ora = calcola(corsaEx, stazioniEx, gare, categoria)
  const prima = calcola(corsaEx, stazioniEx, gare, categoria, spostaGiorni(oggi, -GIORNI_DELTA))

  const pb = (c: Candidato | null, d: number | null): PB => ({ sec: c?.sec ?? null, fonte: c?.fonte ?? null, delta: d })
  const corsaSec = ora.corsaKm ? ora.corsaKm.sec * 8 : null
  const stazioniSec = ora.stazioni.every(s => s.c) ? ora.stazioni.reduce((t, s) => t + s.c!.sec, 0) : null

  return {
    categoria,
    corsa: {
      sec: corsaSec,
      fonte: ora.corsaKm?.fonte ?? null,
      delta: differenza(ora.corsaKm, prima.corsaKm, 8),
      passoKm: ora.corsaKm?.sec ?? null,
    },
    stazioni: ora.stazioni.map((s, i) => ({ id: s.id, pb: pb(s.c, differenza(s.c, prima.stazioni[i].c)) })),
    roxzone: pb(ora.roxzone, differenza(ora.roxzone, prima.roxzone)),
    parti: ora.totale !== null ? { corsa: corsaSec!, stazioni: stazioniSec!, roxzone: ora.roxzone.sec } : null,
    totale: ora.totale,
    delta: ora.totale !== null && prima.totale !== null ? Math.round(ora.totale - prima.totale) : null,
    misurati: ora.misurati,
    daProfilo: ora.daProfilo,
  }
}

/** Il tempo totale di una gara registrata. */
export function totaleGara(g: Pick<HyroxGara, 'corsa' | 'stazioni' | 'roxzone'>): number {
  return g.corsa + Object.values(g.stazioni).reduce((t, x) => t + (x > 0 ? x : 0), 0) + g.roxzone
}

// ── Le giornate da controllare ─────────────────────────────────
/** Da quante stazioni registrate a metà distanza nello stesso giorno quel giorno
 *  merita una domanda: cinque mezze stazioni in un pomeriggio sono più spesso
 *  una simulazione intera registrata con l'interruttore su "500 m" che una
 *  mezza simulazione vera. */
export const SOGLIA_GIORNATA = 5

/** I giorni con almeno `SOGLIA_GIORNATA` segmenti registrati a metà distanza,
 *  dal più recente. Chi chiama decide cosa chiedere. */
export function giornateAMeta(segmenti: Segmento[]): Array<{ data: string; segmenti: string[] }> {
  const perGiorno = new Map<string, Set<string>>()
  for (const s of segmenti) {
    for (const h of s.history) {
      if (!h.date || formatoSessione(h, s.target) !== 'mezzo') continue
      const ids = perGiorno.get(h.date) ?? new Set<string>()
      ids.add(s.id)
      perGiorno.set(h.date, ids)
    }
  }
  return [...perGiorno]
    .filter(([, ids]) => ids.size >= SOGLIA_GIORNATA)
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([data, ids]) => ({ data, segmenti: [...ids] }))
}

/** Le sessioni a metà di quel giorno riportate alla distanza di gara: il tempo
 *  resta quello, cambia solo la distanza a cui si riferisce. */
export function aDistanzaIntera(history: HyroxHistoryEntry[], target: number, data: string): HyroxHistoryEntry[] {
  return history.map(h => (h.date === data && formatoSessione(h, target) === 'mezzo' ? { ...h, units: target } : h))
}

/** "−0:08", "+1:05": quanto è cambiato un tempo. */
export function fmtDelta(sec: number): string {
  const a = Math.abs(Math.round(sec))
  const testo = a >= 3600 ? fmtTempoGara(a) : `${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`
  return `${sec < 0 ? '−' : '+'}${testo}`
}

// ── Il campo tempo ─────────────────────────────────────────────
// Si battono solo le cifre e i due punti li mette il campo (vedi RegistraGaraModal).

/** Le cifre battute come tempo: "425" → 4:25, "11500" → 1:15:00. */
export function cifreInTempo(cifre: string): string {
  const c = cifre.replace(/\D/g, '').replace(/^0+/, '')
  if (!c) return ''
  const p = c.padStart(3, '0')
  const sec = p.slice(-2)
  const resto = p.slice(0, -2)
  if (resto.length <= 2) return `${Number(resto)}:${sec}`
  return `${Number(resto.slice(0, -2))}:${resto.slice(-2)}:${sec}`
}

/** I secondi di quelle cifre; `null` se minuti o secondi passano 59. */
export function cifreInSec(cifre: string): number | null {
  const c = cifre.replace(/\D/g, '')
  if (!c) return 0
  const n = c.padStart(6, '0')
  const h = Number(n.slice(0, -4)), m = Number(n.slice(-4, -2)), s = Number(n.slice(-2))
  if (s > 59 || (h > 0 && m > 59)) return null
  return h * 3600 + m * 60 + s
}

/** L'inverso, per riaprire una gara già registrata. */
export function secInCifre(sec: number): string {
  if (!(sec > 0)) return ''
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  return h > 0 ? `${h}${String(m).padStart(2, '0')}${String(s).padStart(2, '0')}` : `${m}${String(s).padStart(2, '0')}`
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

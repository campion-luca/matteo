// Modello e helper condivisi della sezione Palestra/Hyrox (logica pura, niente JSX).
import type { HyroxExercise, PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'
import { isoWeekLabel, isoWeekSortKey } from '@/lib/isoDate'

// Palette categorica calda Journal (mid-tone, visibile su carta e su copertina).
export const MUSCLE_COLORS: Record<string, string> = {
  'Petto':     '#3f7357',
  'Dorso':     '#2f7a6b',
  'Gambe':     '#b0562f',
  'Spalle':    '#b0873f',
  'Bicipiti':  '#8a5a6e',
  'Tricipiti': '#6e7a38',
  'Core':      '#5f7e86',
  'Glutei':    '#a2687a',
  'Altro':     '#8a7440',
}
export const COLOR_PALETTE = ['#3f7357','#2f7a6b','#6e7a38','#b0873f','#c08a2e','#b0562f','#a2687a','#8a5a6e','#b07a5e','#5f7e86']

// I gruppi muscolari sono DATI, non interfaccia: questa stessa stringa finisce in
// `ex.muscle` dentro lo store e fa da chiave in `muscleColors`. Resta italiana
// ovunque; a tradurla quando si stampa è `tData`.
export const MUSCLE_OPTIONS = ['Petto', 'Dorso', 'Gambe', 'Spalle', 'Bicipiti', 'Tricipiti', 'Core', 'Glutei', 'Altro']

// L'elenco COMPLETO: gli otto di serie più quelli creati dall'utente. I nuovi si
// infilano prima di 'Altro' e non in fondo — 'Altro' è il cassetto delle cose che
// non hanno un gruppo, e deve restare l'ultima voce di ogni elenco e di ogni
// select, altrimenti smette di leggersi come tale.
//
// Un gruppo custom che si chiama come uno di serie non raddoppia la voce: il
// nome è la chiave, e due chiavi uguali sarebbero lo stesso gruppo scritto due
// volte.
export function gruppiMuscolari(custom?: { name: string }[]): string[] {
  const noti = new Set(MUSCLE_OPTIONS.map(m => m.toLowerCase()))
  const extra: string[] = []
  for (const c of custom ?? []) {
    const n = c.name.trim()
    if (!n || noti.has(n.toLowerCase())) continue
    noti.add(n.toLowerCase())
    extra.push(n)
  }
  if (!extra.length) return MUSCLE_OPTIONS
  const i = MUSCLE_OPTIONS.indexOf('Altro')
  return [...MUSCLE_OPTIONS.slice(0, i), ...extra, ...MUSCLE_OPTIONS.slice(i)]
}

// retrocompatibilità: esercizi salvati con 'Schiena' vengono mostrati come 'Dorso'
const MUSCLE_ALIASES: Record<string, string> = { 'Schiena': 'Dorso' }
export function displayMuscle(m: string): string { return MUSCLE_ALIASES[m] ?? m }

// `muscleColors` arriva risolto da `useMuscleColors()`: contiene già ogni gruppo noto,
// desaturato se il layout è "Notte". 'Altro' fa da fallback per i gruppi legacy o
// sconosciuti, così seguono il tema anche loro (prima era un '#8a7440' fisso, ripetuto
// in sei punti, che in monocromatico sarebbe rimasto oro).
export function exColor(ex: PalestraExercise, muscleColors: Record<string, string>): string {
  const m = displayMuscle(ex.muscle)
  return muscleColors[m] ?? muscleColors[ex.muscle] ?? muscleColors.Altro ?? MUSCLE_COLORS.Altro
}

// ── Numeri decimali scritti a mano ───────────────────────
// Un campo peso deve accettare sia 62.5 sia 62,5.
//
// Non è pignoleria: il tastierino decimale di iOS mostra il punto o la virgola a
// seconda della lingua del sistema, e non c'è modo per la pagina di sapere quale
// dei due comparirà. Un campo che ne accetta uno solo è un campo in cui metà
// delle persone non riesce a scrivere mezzo chilo — ed è esattamente il bug che
// si vedeva registrando le serie di una scheda.
//
// Dentro si conserva la VIRGOLA, che è il separatore italiano: quello che si
// rilegge dallo storico è sempre scritto allo stesso modo, comunque lo si sia
// digitato. A `parseFloat` va comunque il punto — è l'unico che capisce.

/** Ripulisce quello che si sta digitando: cifre e UNA virgola. Il punto entra e
 *  diventa virgola sotto le dita, senza che il cursore salti. */
export function normalizzaDecimale(v: string): string {
  const solo = v.replace(/\./g, ',').replace(/[^0-9,]/g, '')
  const i = solo.indexOf(',')
  // Dalla seconda virgola in poi si buttano: "6,2,5" non è un numero, e lasciarlo
  // scrivere significa scoprirlo solo al salvataggio, con il valore già sbagliato.
  return i < 0 ? solo : solo.slice(0, i + 1) + solo.slice(i + 1).replace(/,/g, '')
}

/** Il numero dietro a quello che è stato scritto. 0 se non c'è un numero. */
export function parseNum(v: string | undefined | null): number {
  if (!v) return 0
  return parseFloat(String(v).replace(',', '.')) || 0
}

/** Il numero come si scrive: virgola, e i decimali solo se ci sono davvero
 *  (70 resta "70", non diventa "70,0"). */
export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

// ── Helpers ────────────────────────────────────────────────────
export function fmtKg(h: { kg: number; bodyweight?: true; setWeights?: number[] }): string {
  const sw = h.setWeights
  if (sw && sw.length) {
    const min = Math.min(...sw), max = Math.max(...sw)
    if (min !== max) {
      // Serie a carico variabile: mostra l'intervallo (es. "60–70 kg").
      if (!h.bodyweight) return `${fmtNum(min)}–${fmtNum(max)} kg`
      return max > 0 ? `BW +${fmtNum(min)}–${fmtNum(max)} kg` : 'BW'
    }
    // pesi tutti uguali → ricade sulla formattazione a valore singolo
  }
  if (!h.bodyweight) return `${fmtNum(h.kg)} kg`
  return h.kg > 0 ? `BW +${fmtNum(h.kg)} kg` : 'BW'
}

/** Come `fmtKg`, ma dice anche il VERSO quando i chili cambiano fra le serie:
 *  "30 → 32,5 kg" se dalla prima all'ultima si è solo saliti (o solo scesi).
 *  L'intervallo "30–35 kg" resta per chi è andato su e giù, dove una freccia
 *  racconterebbe un percorso che non c'è stato. */
export function fmtKgVerso(h: { kg: number; bodyweight?: true; setWeights?: number[] }): string {
  const sw = h.setWeights
  if (!sw || sw.length < 2) return fmtKg(h)
  const primo = sw[0], ultimo = sw[sw.length - 1]
  const sale = sw.every((w, i) => i === 0 || w >= sw[i - 1])
  const scende = sw.every((w, i) => i === 0 || w <= sw[i - 1])
  if (primo === ultimo || (!sale && !scende)) return fmtKg(h)
  const tratto = `${fmtNum(primo)} → ${fmtNum(ultimo)} kg`
  return h.bodyweight ? `BW +${tratto}` : tratto
}

// I colpi dell'alzata, come li si legge in lista. Gemello di `fmtKg`: con colpi
// per serie mostra l'intervallo ("6–10"), perché scrivere il solo valore
// rappresentativo farebbe leggere "3 × 10" a un allenamento che è andato 10, 8, 6.
export function fmtReps(h: { reps: number; setReps?: number[] }): string {
  const sr = h.setReps
  if (sr && sr.length) {
    const min = Math.min(...sr), max = Math.max(...sr)
    if (min !== max) return `${min}–${max}`
  }
  return String(h.reps)
}

export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function pace(sec: number, units: number, unit: string): string {
  if (unit === 'km') {
    const s = Math.round(sec / units)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}/km`
  }
  if (unit === 'm') {
    const per500 = Math.round((sec / units) * 500)
    return `${Math.floor(per500 / 60)}:${String(per500 % 60).padStart(2, '0')}/500m`
  }
  return `${Math.round((units / sec) * 60)} rep/min`
}

// Volume in forma compatta: 12.4k invece di 12400. Sta qui e non nella dashboard
// perché lo stesso numero compare anche nelle barre "Volume per muscolo".
export const fmtVol = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(Math.round(v))

// La settimana è quella ISO di tutta l'app (lunedì→domenica): la versione
// naive che stava qui iniziava di DOMENICA, così la sessione della domenica finiva
// nella settimana successiva del grafico volume e la stessa data mostrava due
// numeri W diversi fra palestra e calendario.
export const weekLabel = isoWeekLabel

export const weekSortKey = isoWeekSortKey

// Storico ordinato cronologicamente. Le nuove sessioni vengono accodate in ordine
// di inserimento: registrandone una con data arretrata finiva in fondo, e grafici,
// etichette settimana e "ultima alzata" la trattavano come la più recente.
// Le voci legacy senza `date` restano davanti (sono le più vecchie).
//
// Il confronto è quello semplice fra stringhe, non `localeCompare`: le date sono
// ISO, e per "2026-09-23" l'ordine dei caratteri è già l'ordine del calendario.
// `localeCompare` passa dalle regole di collazione della lingua, ed è decine di
// volte più lento — su uno storico lungo, riordinato a ogni apertura di pagina.
export function sortedHistory<T extends { date?: string }>(hist: T[]): T[] {
  return [...hist].sort((a, b) => {
    const x = a.date ?? '', y = b.date ?? ''
    return x < y ? -1 : x > y ? 1 : 0
  })
}

/** L'ultima voce in ordine di data, cioè `sortedHistory(hist).at(-1)`, senza
 *  copiare e riordinare tutto lo storico per leggerne una. A pari data vince la
 *  più in fondo, come nell'ordinamento (che è stabile). */
export function ultimaVoce<T extends { date?: string }>(hist: T[]): T | undefined {
  let ultima: T | undefined
  for (const h of hist) if (!ultima || (h.date ?? '') >= (ultima.date ?? '')) ultima = h
  return ultima
}

// Carico effettivamente spostato in una serie. Per un esercizio a corpo libero
// `kg` è la sola ZAVORRA: senza sommare il peso corporeo, una serie di trazioni
// senza zavorra valeva 0 kg → volume 0, massimale 0, esercizio escluso da tutti i
// grafici. `bodyWeightKg` è il peso dell'utente (0 se non l'ha inserito).
export function effectiveLoad(h: Pick<PalestraHistoryEntry, 'kg' | 'bodyweight'>, bodyWeightKg = 0): number {
  return h.bodyweight ? bodyWeightKg + h.kg : h.kg
}

// Carichi effettivi serie per serie. Con `setWeights` usa i pesi reali di ogni
// serie, altrimenti replica `kg` su tutte le serie. Il peso corporeo viene
// sommato a corpo libero.
export function setLoads(h: Pick<PalestraHistoryEntry, 'kg' | 'bodyweight' | 'sets_n' | 'setWeights'>, bodyWeightKg = 0): number[] {
  const raw = h.setWeights && h.setWeights.length ? h.setWeights : Array(Math.max(1, h.sets_n)).fill(h.kg)
  return raw.map(w => h.bodyweight ? bodyWeightKg + w : w)
}

// Colpi effettivi serie per serie — gemello di `setLoads`. Senza `setReps`
// replica `reps` su tutte le serie, che è esattamente il vecchio comportamento:
// le alzate registrate prima che i colpi per serie esistessero non cambiano
// né volume né massimale.
export function setRepsOf(h: Pick<PalestraHistoryEntry, 'reps' | 'sets_n' | 'setReps'>): number[] {
  if (h.setReps && h.setReps.length) return h.setReps
  return Array(Math.max(1, h.sets_n)).fill(h.reps)
}

/** I colpi della serie più lunga dell'alzata. È il "meglio" di un esercizio
 *  che non va a chili (addominali, polpacci a corpo libero): lì non c'è un
 *  massimale da stimare, c'è quante se ne fanno. */
export function colpiMigliori(h: Pick<PalestraHistoryEntry, 'reps' | 'sets_n' | 'setReps'>): number {
  return Math.max(...setRepsOf(h))
}

// Volume totale di chili spostati nell'alzata (Σ carico-serie × colpi-serie): con
// serie variabili è la somma reale, non `carico × serie × colpi`. I due array
// vanno accoppiati per indice, non moltiplicati fra somme: 60×10 + 40×6 fa 840,
// mentre (60+40) × (10+6)/2 ne farebbe 800.
export function entryVolume(h: PalestraHistoryEntry, bodyWeightKg = 0): number {
  const reps = setRepsOf(h)
  return setLoads(h, bodyWeightKg).reduce((s, w, i) => s + w * (reps[i] ?? h.reps), 0)
}

// ── Massimale stimato (1RM) ────────────────────────────────────
// Formula di Epley: kg × (1 + rep/30). Mette sulla stessa scala alzate con
// ripetizioni diverse — 50×8 → 63 kg, 40×15 → 60 kg — e risponde a "quanto
// alzerei per una singola", che è forza, non fatica.
//
// Oltre le ~12 ripetizioni Epley sovrastima: da lì in poi entrano in gioco
// resistenza e respiro più della forza massimale. Il numero resta indicativo e
// l'app lo dice nella ⓘ invece di fingere una precisione che non ha.
export function estimate1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0
  return weightKg * (1 + reps / 30)
}

// Il massimale stimato dell'alzata è quello della serie MIGLIORE, non della media:
// con carico variabile (60, 60, 50) la serie da 50 abbasserebbe una prestazione
// che il corpo ha comunque espresso a 60.
export function entry1RM(h: PalestraHistoryEntry, bodyWeightKg = 0): number {
  const loads = setLoads(h, bodyWeightKg)
  const reps = setRepsOf(h)
  // Un massimale DICHIARATO non si stima: quel carico è stato sollevato, e il
  // massimale è quello. Epley su una singola lo gonfierebbe del 3% (× 1 + 1/30),
  // cioè la stima batterebbe la misura — e un 100 kg provato diventerebbe 103.
  if (h.maxLift) return Math.max(...loads)
  // Ogni serie con i SUOI colpi: la serie migliore può essere quella corta e
  // pesante come quella lunga e leggera, e stimarle tutte sui colpi del valore
  // rappresentativo darebbe a un 40×6 finale il credito di un 40×10.
  return Math.max(...loads.map((w, i) => estimate1RM(w, reps[i] ?? h.reps)))
}

// ── Record personale ───────────────────────────────────────────
// Un'alzata è un record se batte il massimale stimato di TUTTE le precedenti su
// quell'esercizio. Sul massimale e non sui chili, così 100×1 conta più di 50×10
// invece di pareggiare con qualunque serie leggera abbastanza lunga.
//
// `prev` è lo storico PRIMA di questa alzata. La prima alzata di un esercizio non
// è un record: non c'è niente che abbia battuto, e festeggiarla renderebbe la
// medaglia un rumore che accompagna ogni esercizio nuovo.
export interface LiftRecord { prev: number; next: number }

export function recordFor(prev: PalestraHistoryEntry[], entry: PalestraHistoryEntry, bodyWeightKg = 0): LiftRecord | null {
  if (!prev.length) return null
  const best = Math.max(...prev.map(h => entry1RM(h, bodyWeightKg)))
  const next = entry1RM(entry, bodyWeightKg)
  // Pareggiare non è battere: con `>=` un allenamento ripetuto uguale avrebbe
  // annunciato un record ogni volta.
  return next > best ? { prev: Math.round(best), next: Math.round(next) } : null
}

// ── Quanto è cambiato il carico dalla volta prima ──────────────
// Il segnale sotto ogni alzata dello storico: verde se si è saliti, rosso se si
// è scesi, e di quanto. Si confronta il carico più ALTO delle due alzate — con
// 60·60·62,5 il carico della giornata è 62,5, non la media — e il peso corporeo
// non c'entra: a corpo libero si confronta la sola zavorra, che è la parte che
// si sceglie.
//
// Un massimale dichiarato sta fuori dal confronto, da tutte e due le parti: è
// una singola a un carico che non è quello di lavoro, e messo in fila direbbe
// "+40 kg" quel giorno e "−40 kg" la volta dopo.
export interface VariazioneCarico { delta: number; unita: 'kg' | 'colpi' }

const caricoAlto = (h: PalestraHistoryEntry) => Math.max(...setLoads(h))

/** La variazione di `questa` rispetto a `prima`. `soloColpi` per gli esercizi
 *  che non vanno a chili: lì si confronta la serie più lunga. `null` se non
 *  c'è una volta prima, o se una delle due è un massimale. */
export function variazioneCarico(
  prima: PalestraHistoryEntry | undefined,
  questa: PalestraHistoryEntry,
  soloColpi = false,
): VariazioneCarico | null {
  if (!prima || prima.maxLift || questa.maxLift) return null
  if (soloColpi) return { delta: colpiMigliori(questa) - colpiMigliori(prima), unita: 'colpi' }
  return { delta: Math.round((caricoAlto(questa) - caricoAlto(prima)) * 100) / 100, unita: 'kg' }
}

/** Per ogni alzata di uno storico GIÀ in ordine di data: quanto è cambiato il
 *  carico dall'ultima alzata di lavoro prima di lei, e se quel giorno è stato
 *  un record (stessa regola di `recordFor`, o i colpi per chi va a colpi). */
export function andamentoStorico(
  hist: PalestraHistoryEntry[],
  bodyWeightKg = 0,
  soloColpi = false,
): Array<{ variazione: VariazioneCarico | null; record: boolean }> {
  const metro = (h: PalestraHistoryEntry) => soloColpi ? colpiMigliori(h) : entry1RM(h, bodyWeightKg)
  let ultimaDiLavoro: PalestraHistoryEntry | undefined
  let meglio = -Infinity
  return hist.map((h, i) => {
    const variazione = variazioneCarico(ultimaDiLavoro, h, soloColpi)
    // La prima alzata non batte niente: come in `recordFor`.
    const record = i > 0 && metro(h) > meglio
    meglio = Math.max(meglio, metro(h))
    if (!h.maxLift) ultimaDiLavoro = h
    return { variazione, record }
  })
}

// ── Da quanto non ci si allena ─────────────────────────────────
// Due domande diverse: "da quanto non mi alleno" (qualunque cosa, pesi o hyrox)
// e "da quanto non faccio QUESTA scheda". La seconda è quella che cambia il
// consiglio sui carichi: dopo dieci giorni senza una scheda, i suoi pesi sono
// più pesanti di come li si era lasciati (vedi caricoConsigliato).

/** L'ultimo giorno in cui si è registrato qualcosa. `null` se mai. Le voci
 *  senza data (vecchissime) non contano: non si sa quando sono state. */
export function ultimoAllenamento(
  palestra: { history: { date?: string }[] }[],
  hyrox: { history: { date?: string }[] }[] = [],
): string | null {
  let ultimo: string | null = null
  for (const ex of [...palestra, ...hyrox]) {
    for (const h of ex.history) if (h.date && (!ultimo || h.date > ultimo)) ultimo = h.date
  }
  return ultimo
}

/** Per ogni scheda (per id), l'ultimo giorno in cui è stata eseguita. */
export function ultimaVoltaPerScheda(palestra: PalestraExercise[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const ex of palestra) {
    for (const h of ex.history) {
      if (!h.scheda || !h.date) continue
      const gia = out.get(h.scheda.id)
      if (!gia || h.date > gia) out.set(h.scheda.id, h.date)
    }
  }
  return out
}

/** "oggi" · "ieri" · "12 giorni fa". `t` arriva da chi chiama: questo file non
 *  conosce la lingua. */
export function quantoFa(giorni: number, t: (s: string, v?: Record<string, string | number>) => string): string {
  return giorni <= 0 ? t('oggi') : giorni === 1 ? t('ieri') : t('{n} giorni fa', { n: giorni })
}

// ── Hyrox Race Stations ────────────────────────────────────────
export const RACE_STATIONS: Array<{ id: string; n: string; unit: HyroxExercise['unit']; target: number }> = [
  { id: 'hx_ski',    n: 'SkiErg',             unit: 'm',   target: 1000 },
  { id: 'hx_sled_p', n: 'Sled Push',          unit: 'm',   target: 50   },
  { id: 'hx_sled_u', n: 'Sled Pull',          unit: 'm',   target: 50   },
  { id: 'hx_bbj',    n: 'Burpees Broad Jump', unit: 'm',   target: 80   },
  { id: 'hx_row',    n: 'Rowing',             unit: 'm',   target: 1000 },
  { id: 'hx_farm',   n: 'Farmers Carry',      unit: 'm',   target: 200  },
  { id: 'hx_lunge',  n: 'Sandbag Lunges',     unit: 'm',   target: 100  },
  { id: 'hx_wb',     n: 'Wall Balls',         unit: 'rep', target: 100  },
]
export const RUNNING_STATION: HyroxExercise = { id: 'hx_run', n: 'Corsa avg pace', unit: 'km', target: 1, history: [] }
export const RACE_IDS = new Set([...RACE_STATIONS.map(s => s.id), RUNNING_STATION.id])

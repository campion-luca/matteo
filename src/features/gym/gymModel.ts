// Modello e helper condivisi della sezione Palestra/Hyrox (logica pura, niente JSX).
import type { HyroxExercise, PalestraExercise, PalestraHistoryEntry, GymTechnique } from '@/store/useJarvisStore'
import { isoWeekLabel, isoWeekSortKey } from '@/lib/isoDate'

// ── Tecniche di intensità ──────────────────────────────────────
// Restano un'ETICHETTA sull'alzata, non un moltiplicatore: pesavano l'EVL, che
// era la stima di fatica, e la fatica non è più una cosa che l'app misura.
// I nomi restano in italiano: sono le CHIAVI del dizionario (vedi i18n.ts) e chi
// li stampa li passa da `t`. Qui siamo a livello di modulo, dove la lingua scelta
// non è ancora nota.
export const TECHNIQUE_LABELS: Record<GymTechnique, string> = {
  slowEccentric:  'Eccentrica lenta',
  slowConcentric: 'Concentrica lenta',
  peakHold:       'Isometria al picco',
  dropSet:        'Drop Set',
}

export const TECHNIQUES = Object.keys(TECHNIQUE_LABELS) as GymTechnique[]

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
export function sortedHistory<T extends { date?: string }>(hist: T[]): T[] {
  return [...hist].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
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
export const RUNNING_STATION: HyroxExercise = { id: 'hx_run', n: 'Corsa (1 km)', unit: 'km', target: 1, history: [] }
export const RACE_IDS = new Set([...RACE_STATIONS.map(s => s.id), RUNNING_STATION.id])

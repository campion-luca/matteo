import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AccentColor } from '@/lib/jarvis-tokens'
// Solo il tipo: `import type` sparisce alla compilazione, quindi il fatto che
// `i18n` importi a sua volta lo store non crea un ciclo a runtime.
import type { Lang } from '@/lib/i18n'

// ── Types ──────────────────────────────────────────────────────

export interface HyroxHistoryEntry {
  d: string; date: string; sec: number; units: number
  kg?: number; sets_n?: number
}
export interface HyroxExercise {
  id: string; n: string; unit: 'km' | 'm' | 'rep'; target: number
  history: HyroxHistoryEntry[]
}

export type GymTechnique = 'slowEccentric' | 'slowConcentric' | 'peakHold' | 'dropSet'

export interface PalestraHistoryEntry {
  d: string; date?: string; kg: number; reps: number; sets_n: number
  // Peso per singola serie (opzionale): consente serie a carico variabile.
  // Se presente, `kg` resta il valore rappresentativo (serie più pesante) usato
  // per grafici/PR, mentre volume ed EVL si calcolano sui pesi effettivi.
  setWeights?: number[]
  // Colpi per singola serie (opzionale): stesso patto di `setWeights`. Serve
  // all'esecuzione di una scheda, dove le ultime serie calano — 10, 8, 6 — e
  // registrarle tutte come "10" gonfierebbe il volume di un allenamento che non
  // c'è stato. Se presente, `reps` resta il valore rappresentativo (i colpi
  // della serie più pesante), mentre volume e 1RM si calcolano serie per serie.
  setReps?: number[]
  techniques?: GymTechnique[]
  machineModel?: 'panatta'
  bodyweight?: true
  // L'alzata è un MASSIMALE dichiarato: una singola ripetizione al carico massimo,
  // provata davvero. Non è un'etichetta estetica — cambia il numero: su un massimale
  // il 1RM è il carico, non la stima di Epley (vedi `entry1RM`).
  maxLift?: true
}
export interface PalestraExercise {
  // Il colore non è per esercizio: deriva dal gruppo muscolare (vedi `muscleColors`).
  id: string; n: string; muscle: string; muscle2?: string; note?: string
  current: { kg: number; reps: number; sets_n: number }
  history: PalestraHistoryEntry[]
}

export interface GymSchedaExercise {
  id: string
  name: string
  sets: number             // numero di serie
  reps: string             // numero di colpi/ripetizioni (stringa: consente es. "8-10")
  linkedExerciseId?: string // id del PalestraExercise collegato (scelto dai suggerimenti o creato all'esecuzione)
  muscle?: string          // gruppo muscolare — usato per creare l'esercizio in automatico se nuovo
  note?: string            // appunto libero (es. "presa larga", "tempo 3-1-1"): mostrato anche in allenamento
  supersetWithNext?: boolean // questo esercizio è in superset con il SUCCESSIVO (nessun rest tra i due)
}

export interface GymScheda {
  id: string
  title: string
  exercises: GymSchedaExercise[]
  createdAt: string
  updatedAt: string
  draft?: boolean          // true = bozza incompleta (salvata comunque per non perdere il lavoro)
}

// ── Budget / Finanza ───────────────────────────────────────────
// Una voce di spesa: mensile (fisse/variabili) o "grossa imminente" (importo
// totale una tantum, es. tagliando auto o vacanza).
export interface BudgetItem {
  id: string
  name: string
  amount: number  // €
}
// L'obiettivo di risparmio a lungo termine: una cosa che si vuole comprare, con
// quanto si è già messo da parte e — se c'è — la data entro cui la si vuole.
export interface BudgetDream {
  name: string
  amount: number       // costo totale
  saved: number        // già accantonato
  targetDate?: string  // YYYY-MM-DD
}
export interface BudgetState {
  salary: number            // stipendio mensile netto
  fixed: BudgetItem[]       // spese fisse (ogni mese)
  variable: BudgetItem[]    // spese eccezionali/variabili (stima mensile: cinema, uscite…)
  big: BudgetItem[]         // spese grosse imminenti (importo totale una tantum)
  dream?: BudgetDream       // il "sogno da raggiungere"
}

// ── Peso ───────────────────────────────────────────────────────
// Lo storico delle pesate. Stava dentro `kcal` insieme a fabbisogno calorico,
// obiettivo e proteine; quella parte non esiste più — Matteo misura la forza, non
// la dieta — ma le pesate restano, perché sono il denominatore di tutta la forza
// relativa e la curva che un allenatore guarda per prima.
export interface WeightLogEntry {
  date: string  // YYYY-MM-DD
  kg: number
}

// Da che parte sta il tasto di navigazione, su telefono. Non è una preferenza
// estetica: chi tiene il telefono con la destra arriva male all'angolo sinistro e
// viceversa, e il tasto è l'unico comando fisso dell'app.
export type NavPos = 'sinistra' | 'centro' | 'destra'

// Layout dell'app. Trasversale al "tema colore": 'notte' e 'nero' spengono il colore
// ovunque (accent, gruppi muscolari) lasciando bianco/nero.
// Perciò non sono AccentColor: convivono con `accentColor`, che resta memorizzato e
// torna buono appena si rimette 'standard'.
//
// La differenza fra i due: 'notte' segue l'interruttore chiaro/scuro (di giorno è
// grigio su bianco), 'nero' è sempre nero pieno con testo bianco e ignora quello
// stesso interruttore.
export type LayoutMode = 'standard' | 'notte' | 'nero'

export interface JarvisState {
  userName: string
  // La lingua dell'interfaccia. Sta nello stato sincronizzato, non nel
  // localStorage del dispositivo: chi sceglie il tedesco lo sceglie per sé, non
  // per il telefono, e se lo ritrova anche aprendo l'app altrove.
  // `undefined` = italiano, che è la lingua in cui l'app è scritta.
  lang?: Lang
  userAge?: number
  userSex?: 'M' | 'F'
  userWeight?: number  // kg
  userHeight?: number  // cm
  userDob?: string     // YYYY-MM-DD
  darkMode?: boolean
  layout?: LayoutMode
  navPos?: NavPos
  accentColor: AccentColor
  customAccentHex?: string
  hyroxExercises: HyroxExercise[]
  palestraExercises: PalestraExercise[]
  muscleColors: Record<string, string>
  gymSchede: GymScheda[]
  budget: BudgetState
  weightLog: WeightLogEntry[]
  onboardingSeen?: string[]  // id delle schede di cui l'intro è già stata mostrata
  /** Quale azzeramento del catalogo è già stato applicato a questo account.
   *  Vive nello stato perché viaggia col blob: il telefono che lo fa lo dice al
   *  portatile, e il portatile non lo rifà. Vedi resetCatalogo.ts. */
  catalogoReset?: string
}

export const EMPTY_STATE: JarvisState = {
  userName: '',
  accentColor: 'green',
  hyroxExercises: [],
  palestraExercises: [],
  muscleColors: {},
  gymSchede: [],
  budget: { salary: 0, fixed: [], variable: [], big: [] },
  weightLog: [],
}

// Chiavi che l'app conosce davvero. Sia il cloud sia il localStorage possono
// portare campi delle schede rimosse (agenda, attività, lavori, readiness,
// idratazione, ciclo): senza questo filtro rientrerebbero nello store a ogni
// riavvio e il salvataggio, che manda su l'intero stato, li ripubblicherebbe
// per sempre.
const STATE_KEYS: (keyof JarvisState)[] = [
  'userName', 'lang', 'userAge', 'userSex', 'userWeight', 'userHeight', 'userDob',
  'darkMode', 'layout', 'navPos', 'accentColor', 'customAccentHex',
  'hyroxExercises', 'palestraExercises', 'muscleColors', 'gymSchede',
  'budget', 'weightLog', 'onboardingSeen', 'catalogoReset',
]

// Il filtro a lista chiusa lavora sul PRIMO livello. Quello che vive più in basso
// gli sfugge, e va potato o recuperato a mano qui. Sono tutti campi che stavano
// dentro `kcal`, il contenitore del vecchio calcolo calorico: quando una scheda
// muore, i suoi dati non muoiono con lei — restano nel blob e vengono risalvati
// per sempre finché qualcuno non li tocca.
function migrateNested(data: Partial<JarvisState>): Partial<JarvisState> {
  const out: Partial<JarvisState> = { ...data }

  // `rir` (ripetizioni in riserva) non è più chiesto né usato: senza questa
  // potatura resterebbe negli oggetti storici e verrebbe risalvato per sempre.
  // Stesso discorso per `img`, l'immagine che per un giro si poteva agganciare a
  // mano agli esercizi: le foto non ci sono più, e un nome di file che punta a
  // niente è peggio di un campo assente — il giorno che le immagini tornassero,
  // riapparirebbero scelte fatte mesi prima su un catalogo diverso.
  if (out.palestraExercises) {
    out.palestraExercises = out.palestraExercises.map(ex => {
      const copia = { ...ex } as PalestraExercise & { img?: string }
      delete copia.img
      return {
        ...copia,
        history: (ex.history ?? []).map(h => {
          const copy = { ...h } as PalestraHistoryEntry & { rir?: number }
          delete copy.rir
          return copy as PalestraHistoryEntry
        }),
      } as PalestraExercise
    })
  }

  // `kcal` non esiste più: portava fabbisogno, obiettivo e proteine, che sono
  // usciti dall'app insieme alla scheda Personal Coach. Due cose che conteneva
  // però servono ancora e vanno salvate prima che la lista chiusa scarti il
  // contenitore: l'altezza (salita a dato utente) e lo storico delle pesate.
  const legacyKcal = (out as { kcal?: { height?: number; weightLog?: WeightLogEntry[] } }).kcal
  if (legacyKcal) {
    if (out.userHeight === undefined && legacyKcal.height !== undefined) {
      out.userHeight = legacyKcal.height
    }
    if (out.weightLog === undefined && legacyKcal.weightLog) {
      out.weightLog = legacyKcal.weightLog
    }
    delete (out as { kcal?: unknown }).kcal
  }

  return out
}

function pickKnown(data: Partial<JarvisState>): Partial<JarvisState> {
  const src = migrateNested(data)
  const out: Record<string, unknown> = {}
  for (const k of STATE_KEYS) if (src[k] !== undefined) out[k] = src[k]
  return out as Partial<JarvisState>
}

export const JARVIS_STORE_KEY = 'jarvis-store-v4'

// ── Zustand store ──────────────────────────────────────────────
const useJarvisStoreBase = create<JarvisState>()(
  persist(
    () => ({ ...EMPTY_STATE }),
    {
      name: JARVIS_STORE_KEY,
      merge: (persisted, current) => {
        const p = pickKnown(persisted as Partial<JarvisState>)
        return {
          ...current,
          ...p,
          budget: { ...current.budget, ...(p.budget ?? {}) },
          weightLog: p.weightLog ?? current.weightLog,
        }
      },
    }
  )
)

type StoreUpdater = Partial<JarvisState> | ((s: JarvisState) => Partial<JarvisState>)

export function useStore(): [JarvisState, (updater: StoreUpdater) => void] {
  const state = useJarvisStoreBase()
  const setState = useJarvisStoreBase.setState
  return [state, setState]
}

export { useJarvisStoreBase as useJarvisStore }

// Applica uno stato parziale proveniente dal cloud. `setState` fa un merge
// SHALLOW al primo livello: un `budget` remoto salvato prima che un campo
// esistesse sostituirebbe in blocco quello locale, lasciando chiavi a `undefined`
// → crash su .map/.filter. Qui lo ri-normalizziamo sui default.
export function applyRemoteState(data: Partial<JarvisState>): void {
  const known = pickKnown(data)
  useJarvisStoreBase.setState({
    ...known,
    ...(known.budget ? { budget: { ...EMPTY_STATE.budget, ...known.budget } } : {}),
    // `setState` fonde: una chiave che il blob remoto non ha si terrebbe il
    // valore locale. Per quasi tutto va bene — è quello che salva un campo
    // nuovo quando arriva un blob salvato da una versione vecchia.
    //
    // Per `catalogoReset` no, e va scritta anche quando è assente. Quel campo
    // non è un dato dell'utente: dice che cosa è già stato FATTO a questo
    // account, e adesso l'account è quello che dice il cloud. Tenendo il
    // valore locale sopra un blob pre-azzeramento si ottiene il caso peggiore:
    // gli esercizi vecchi tornano dentro e il marcatore giura che l'operazione
    // è già stata fatta, quindi non si ripete mai più e nessuno se ne accorge.
    catalogoReset: known.catalogoReset,
  })
}

// ── Onboarding ─────────────────────────────────────────────────
export function markOnboardingSeen(tab: string): void {
  useJarvisStoreBase.setState(s => (
    s.onboardingSeen?.includes(tab)
      ? s
      : { onboardingSeen: [...(s.onboardingSeen ?? []), tab] }
  ))
}

import { create } from 'zustand'
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware'
import { temaFisso, type AccentColor, type LayoutFisso } from '@/lib/jarvis-tokens'
// Solo il tipo: `import type` sparisce alla compilazione, quindi il fatto che
// `i18n` importi a sua volta lo store non crea un ciclo a runtime.
import type { Lang } from '@/lib/i18n'
import { conSegnoCorpoLibero } from '@/features/gym/catalogo'

// ── Types ──────────────────────────────────────────────────────

export interface HyroxHistoryEntry {
  d: string; date: string; sec: number; units: number
  kg?: number; sets_n?: number
}
export interface HyroxExercise {
  id: string; n: string; unit: 'km' | 'm' | 'rep'; target: number
  history: HyroxHistoryEntry[]
}

// Una gara Hyrox intera, o una simulazione intera fatta in allenamento, registrata
// come un evento solo: non otto sessioni sparse negli storici delle stazioni.
// Prima una gara si "riconosceva" contando quante stazioni erano state registrate
// lo stesso giorno, e bastava un interruttore lasciato su 500 m per trasformare
// una simulazione da 1:30 in una stima da 2:16. Qui non c'è niente da indovinare:
// è una gara perché la si è registrata come tale, ogni tempo è sulla distanza di
// gara, e c'è anche la Roxzone, che nessuna sessione di allenamento ha.
export interface HyroxGara {
  id: string
  date: string
  /** Una gara ufficiale, o una simulazione intera fatta in allenamento. */
  tipo: 'gara' | 'simulazione'
  /** In double le stazioni si fanno in due: i loro tempi valgono per il double. */
  categoria: 'singolo' | 'double'
  /** Gli 8 km di corsa, sommati, in secondi. 0 = non registrata. */
  corsa: number
  /** Le stazioni per id (`hx_ski`, …), in secondi. Una che manca non è stata registrata. */
  stazioni: Record<string, number>
  /** Tutti i passaggi in Roxzone, sommati, in secondi. */
  roxzone: number
}

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
  machineModel?: 'panatta'
  bodyweight?: true
  // L'alzata è un MASSIMALE dichiarato: una singola ripetizione al carico massimo,
  // provata davvero. Non è un'etichetta estetica — cambia il numero: su un massimale
  // il 1RM è il carico, non la stima di Epley (vedi `entry1RM`).
  maxLift?: true
  // La scheda da cui viene l'alzata, se è stata registrata eseguendone una. Il
  // nome è copiato e non letto dalla scheda: rinominarla o cancellarla non deve
  // riscrivere com'era chiamato l'allenamento di quel giorno. Serve al calendario
  // degli allenamenti, che raggruppa il giorno per scheda.
  scheda?: { id: string; nome: string }
  // Cosa chiedeva la scheda QUEL giorno. La scheda si modifica — una serie in
  // più, i colpi da 8 a 10 — e senza questo l'alzata di ieri verrebbe giudicata
  // col programma di oggi: tre serie su tre diventano "tre su quattro, meglio
  // scendere" (vedi caricoConsigliato).
  piano?: { sets: number; reps: string }
  // Quanti esercizi dello STESSO gruppo muscolare erano già stati fatti, in
  // quella sessione, prima di questo: la panca per prima è 0, le spinte con i
  // manubri subito dopo sono 1. Gli stessi chili non valgono uguale a muscolo
  // fresco e a muscolo stanco, e il consiglio sui carichi deve saperlo (vedi
  // caricoConsigliato). Assente sulle alzate di prima, e su quelle a mano.
  giaFatti?: number
  // Il nome dell'allenatore che ha corretto questa alzata (vedi lib/correzioni).
  // Sta scritto sull'alzata perché chi la rilegge deve sapere che quei numeri
  // non sono più quelli che aveva scritto lui.
  correttaDa?: string
  // Un appunto sulla sessione, scritto mentre ci si allena ("spalla che tira",
  // "sedile al 4"). Resta attaccato a QUESTA alzata, e alla successiva sullo
  // stesso esercizio si rilegge come "nota dell'ultima volta".
  note?: string
}
export interface PalestraExercise {
  // Il colore non è per esercizio: deriva dal gruppo muscolare (vedi `muscleColors`).
  id: string; n: string; muscle: string; muscle2?: string; note?: string
  // A corpo libero (piegamenti, trazioni): il carico è il proprio peso e i chili
  // scritti sono la sola zavorra. Si sceglie creando l'esercizio. Assente = non
  // ancora scelto, e decide il catalogo (vedi `corpoLibero`); `false` è una
  // scelta, e il catalogo non la ribalta.
  bodyweight?: boolean
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
  bodyweight?: boolean     // a corpo libero — come `muscle`, serve a creare l'esercizio se è nuovo
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

// ── Gruppi muscolari creati dall'utente ────────────────────────
// Gli otto distretti di serie stanno in `MUSCLE_OPTIONS` (gymModel): sono una
// costante perché sono anche le chiavi delle figure e dei colori di default.
// Questi sono quelli che l'utente aggiunge, e vivono nello stato perché sono suoi
// e devono seguirlo da un dispositivo all'altro.
//
// Il COLORE non è qui: sta in `muscleColors`, la stessa mappa che tiene gli
// override dei gruppi di serie. Duplicarlo vorrebbe dire due posti da cui leggere
// il colore di un gruppo, e il picker della palestra scrive già lì.
export interface CustomMuscle {
  /** Il nome È la chiave: finisce in `ex.muscle` e in `muscleColors`. */
  name: string
  /** Quale figura accendere: uno dei gruppi di serie (Petto, Dorso, …). Le
   *  sagome esistono solo per quegli otto — vedi MuscleIcons. */
  icon: string
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

// Layout dell'app. Trasversale al "tema colore": 'premium' spegne il colore ovunque
// (accent, gruppi muscolari) e resta sempre nero — vetro, contorni bianchi, niente
// ombre — ignorando l'interruttore chiaro/scuro.
// Perciò non è un AccentColor: convive con `accentColor`, che resta memorizzato e
// torna buono appena si rimette 'standard'.
//
// Prima c'erano 'notte' (bianco/nero che seguiva chiaro/scuro) e 'nero', che è
// diventato 'premium'. Il valore salvato si converte in `migrateNested`.
//
// 'neon' e 'logbook' (ott 2026) sono fatti come 'premium': scuri sempre, con un
// accent proprio. L'elenco di quelli a tema fisso sta in jarvis-tokens
// (`ACCENT_FISSI`), accanto ai loro colori.
export type LayoutMode = 'standard' | LayoutFisso

export interface JarvisState {
  userName: string
  // La lingua dell'interfaccia. Sta nello stato sincronizzato, non nel
  // localStorage del dispositivo: chi sceglie l'inglese lo sceglie per sé, non
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
  /** Sfondo "fuso": nero, arancione e grigio-azzurro sovrapposti invece dei due
   *  soli aloni caldi di serie. In prova — assente = acceso, vedi globals.css. */
  bgFuso?: boolean
  accentColor: AccentColor
  customAccentHex?: string
  hyroxExercises: HyroxExercise[]
  palestraExercises: PalestraExercise[]
  muscleColors: Record<string, string>
  /** I gruppi muscolari aggiunti dall'utente (vedi CustomMuscle). */
  customMuscles?: CustomMuscle[]
  gymSchede: GymScheda[]
  /** Gare e simulazioni intere (vedi HyroxGara). Assente sugli account di prima. */
  hyroxGare?: HyroxGara[]
  weightLog: WeightLogEntry[]
  /** Quale azzeramento del catalogo è già stato applicato a questo account.
   *  Vive nello stato perché viaggia col blob: il telefono che lo fa lo dice al
   *  portatile, e il portatile non lo rifà. Vedi resetCatalogo.ts. */
  catalogoReset?: string
  /** Quale passaggio di tema è già stato applicato a questo account (vedi
   *  `migrateNested`). Viaggia col blob per lo stesso motivo di `catalogoReset`:
   *  il passaggio va fatto una volta per account, non una per dispositivo. */
  temaVersione?: number
}

// La versione del tema corrente. Alzarla rimette tutti gli account sul layout di
// default una volta, al primo caricamento dopo l'aggiornamento; poi la scelta
// dell'utente torna a valere.
export const TEMA_VERSIONE = 2

export const EMPTY_STATE: JarvisState = {
  userName: '',
  // Standard SCURO è il tema con cui l'app si presenta (ott 2026; da metà
  // settembre era Premium). Scuro e non solo Standard: da solo vorrebbe dire la
  // carta chiara, e l'app è scura da quando è nata Premium — fondo, superfici,
  // schermata d'avvio. Un account nuovo parte già alla versione di tema
  // corrente: il passaggio forzato è per chi c'era prima.
  layout: 'standard',
  darkMode: true,
  temaVersione: TEMA_VERSIONE,
  accentColor: 'green',
  hyroxExercises: [],
  palestraExercises: [],
  muscleColors: {},
  gymSchede: [],
  weightLog: [],
}

// Chiavi che l'app conosce davvero. Sia il cloud sia il localStorage possono
// portare campi delle schede rimosse (agenda, attività, lavori, readiness,
// idratazione, ciclo, budget, i suggerimenti d'uso, la posizione del tasto di
// navigazione): senza questo filtro rientrerebbero nello store a ogni
// riavvio e il salvataggio, che manda su l'intero stato, li ripubblicherebbe
// per sempre.
const STATE_KEYS: (keyof JarvisState)[] = [
  'userName', 'lang', 'userAge', 'userSex', 'userWeight', 'userHeight', 'userDob',
  'darkMode', 'layout', 'bgFuso', 'accentColor', 'customAccentHex',
  'hyroxExercises', 'palestraExercises', 'muscleColors', 'customMuscles', 'gymSchede',
  'hyroxGare', 'weightLog', 'catalogoReset', 'temaVersione',
]

// Il filtro a lista chiusa lavora sul PRIMO livello. Quello che vive più in basso
// gli sfugge, e va potato o recuperato a mano qui. Sono tutti campi che stavano
// dentro `kcal`, il contenitore del vecchio calcolo calorico: quando una scheda
// muore, i suoi dati non muoiono con lei — restano nel blob e vengono risalvati
// per sempre finché qualcuno non li tocca.
function migrateNested(data: Partial<JarvisState>): Partial<JarvisState> {
  const out: Partial<JarvisState> = { ...data }

  // Layout rinominati/rimossi (set 2026): 'nero' è diventato 'premium', 'notte' non
  // esiste più e torna a 'standard'. Senza, un valore vecchio non combacerebbe con
  // nessun layout: il profilo non ne evidenzierebbe nessuno e App lo tratterebbe
  // come standard, ma il blob in cloud se lo porterebbe dietro per sempre.
  const layout = out.layout as string | undefined
  if (layout === 'nero') out.layout = 'premium'
  else if (layout !== undefined && layout !== 'standard' && !temaFisso(layout)) out.layout = 'standard'

  // Il tedesco non c'è più (ott 2026), al suo posto l'inglese. Chi l'aveva scelto
  // passa all'inglese e non all'italiano: aveva scelto di NON leggere l'italiano,
  // e fra le due lingue rimaste quella è la più vicina a ciò che voleva.
  const lang = out.lang as string | undefined
  if (lang === 'de') out.lang = 'en'
  else if (lang !== undefined && lang !== 'it' && lang !== 'en') delete out.lang

  // Il passaggio al tema di default, una volta sola per account: chi arriva con
  // un blob di PRIMA (o con niente) atterra sul layout con cui l'app si presenta
  // oggi — Standard scuro, lo stesso di EMPTY_STATE. Il marcatore resta nel blob,
  // e chi dopo sceglie altro lo tiene. (A metà settembre il default era Premium,
  // e questo passaggio ci ha portato tutti: chi è già passato non si tocca.)
  if ((out.temaVersione ?? 0) < TEMA_VERSIONE) {
    out.layout = 'standard'
    out.darkMode = true
    out.temaVersione = TEMA_VERSIONE
  } else if (out.darkMode === undefined) {
    // Un account già passato che l'interruttore chiaro/scuro non l'ha mai
    // toccato non ha la chiave nel blob: valeva "chiaro", e deve continuare a
    // valerlo. Senza dirlo qui erediterebbe lo scuro del nuovo default, e chi
    // aveva scelto Standard sulla carta chiara se lo troverebbe nero.
    out.darkMode = false
  }

  // `rir` (ripetizioni in riserva) non è più chiesto né usato: senza questa
  // potatura resterebbe negli oggetti storici e verrebbe risalvato per sempre.
  // Stesso discorso per `img`, l'immagine che per un giro si poteva agganciare a
  // mano agli esercizi: le foto non ci sono più, e un nome di file che punta a
  // niente è peggio di un campo assente — il giorno che le immagini tornassero,
  // riapparirebbero scelte fatte mesi prima su un catalogo diverso.
  //
  // E le alzate a 0 kg di un esercizio a corpo libero prendono il segno che gli
  // manca. Eseguendo una scheda, fino a ott 2026, trazioni e piegamenti venivano
  // salvati come "0 kg" e basta: volume zero, massimale zero — e la prima alzata
  // segnata bene dopo avrebbe annunciato un record di +99 kg su uno zero. Solo a
  // 0 kg: con dei chili scritti non si sa se fossero zavorra o altro, e quelle
  // restano come sono.
  if (out.palestraExercises) {
    out.palestraExercises = out.palestraExercises.map(ex => {
      const copia = { ...ex } as PalestraExercise & { img?: string }
      delete copia.img
      return conSegnoCorpoLibero({
        ...copia,
        history: (ex.history ?? []).map(h => {
          const copy = { ...h } as PalestraHistoryEntry & { rir?: number }
          delete copy.rir
          return copy as PalestraHistoryEntry
        }),
      } as PalestraExercise)
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

// ── Il disco, scritto un attimo dopo ───────────────────────────
// Lo storage di serie di `persist` trasforma TUTTO lo store in testo e lo scrive
// in localStorage a ogni `setState`, in modo sincrono, dentro il tocco che l'ha
// causato e prima che React ridisegni. Con un anno di storico sono centinaia di
// kilobyte: "Salva alzata", "Termina allenamento", le frecce delle schede
// pagavano questo prima di mostrare il risultato.
//
// Qui la scrittura aspetta 400ms di quiete, e intanto tiene da parte l'ULTIMO
// stato (gli stati dello store non si modificano mai, si sostituiscono: tenerne
// il riferimento è sicuro). Dieci modifiche in fila diventano una scrittura sola.
// Non si perde niente uscendo: quando l'app va in background o si chiude
// (`visibilitychange`, `pagehide`) la scrittura in attesa parte subito — sono gli
// stessi due segnali su cui il cloud fa il suo invio immediato.
const RITARDO_DISCO = 400
let inAttesa: { name: string; value: StorageValue<JarvisState> } | null = null
let timerDisco: ReturnType<typeof setTimeout> | undefined

/** Scrive subito l'eventuale stato in attesa. */
export function scriviSuDisco(): void {
  clearTimeout(timerDisco)
  if (!inAttesa) return
  const { name, value } = inAttesa
  inAttesa = null
  try { localStorage.setItem(name, JSON.stringify(value)) } catch { /* quota piena o storage negato */ }
}

const discoRimandato: PersistStorage<JarvisState> = {
  getItem: name => {
    // Una scrittura ancora in attesa è più recente di quello che c'è su disco.
    if (inAttesa?.name === name) return inAttesa.value
    try {
      const raw = localStorage.getItem(name)
      return raw ? JSON.parse(raw) as StorageValue<JarvisState> : null
    } catch { return null }
  },
  setItem: (name, value) => {
    inAttesa = { name, value }
    clearTimeout(timerDisco)
    timerDisco = setTimeout(scriviSuDisco, RITARDO_DISCO)
  },
  // Toglie anche quella in attesa: al logout lo stato vuoto non deve ricomparire
  // su disco quattrocento millisecondi dopo che il blob è stato cancellato.
  removeItem: name => {
    if (inAttesa?.name === name) { inAttesa = null; clearTimeout(timerDisco) }
    try { localStorage.removeItem(name) } catch { /* niente da fare */ }
  },
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', scriviSuDisco)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') scriviSuDisco()
  })
}

// ── Zustand store ──────────────────────────────────────────────
const useJarvisStoreBase = create<JarvisState>()(
  persist(
    () => ({ ...EMPTY_STATE }),
    {
      name: JARVIS_STORE_KEY,
      storage: discoRimandato,
      merge: (persisted, current) => {
        const p = pickKnown(persisted as Partial<JarvisState>)
        return {
          ...current,
          ...p,
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

// Applica uno stato parziale proveniente dal cloud, passato dal filtro delle chiavi.
export function applyRemoteState(data: Partial<JarvisState>): void {
  const known = pickKnown(data)
  useJarvisStoreBase.setState({
    ...known,
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

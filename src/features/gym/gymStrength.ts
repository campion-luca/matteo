// Forza per distretto muscolare e traguardi. Logica pura, niente JSX.
//
// Il problema che questo file risolve: i chili di due distretti NON sono
// confrontabili fra loro. Uno squat da 100 kg e un curl da 25 kg sono entrambi
// buoni — le gambe non sono "quattro volte più forti" delle braccia, sono più
// grosse. Una mappa del corpo colorata sui chili grezzi direbbe a chiunque che ha
// gambe fortissime e braccia inutili, il che è vero per tutti e quindi non informa.
//
// La scala che rende i distretti confrontabili è il MASSIMALE SUL PESO CORPOREO,
// con soglie diverse per distretto: 1.6× sulle gambe è lo stesso grado di 0.5×
// sulle braccia. Solo così "verde ovunque" vuol dire davvero equilibrato.
import type { PalestraExercise } from '@/store/useJarvisStore'
import { displayMuscle, effectiveLoad, entry1RM } from './gymModel'

// ── Soglie ─────────────────────────────────────────────────────
// Multipli del peso corporeo, sull'alzata rappresentativa del distretto (panca
// per il petto, rematore per il dorso, squat per le gambe, stacco per i glutei,
// lento avanti per le spalle, curl per i bicipiti, presa stretta per i tricipiti).
//
// Sono APPROSSIMAZIONI da standard diffusi, non misure: gli stessi chili su una
// macchina e su un bilanciere non valgono uguale, e questa tabella non lo sa.
// Servono a dare un ordine di grandezza e a rendere i distretti confrontabili fra
// loro — non a dire una verità sul singolo esercizio.
//
// Il core è il più incerto: non esiste uno standard per gli addominali sotto
// carico, e queste soglie sono una stima. La ⓘ del widget lo dice.
export type StrengthLevel = 0 | 1 | 2 | 3 | 4

// Chiavi del dizionario: le traduce chi le mostra (vedi BodyMap).
export const LEVEL_LABELS: Record<StrengthLevel, string> = {
  0: 'Mai allenato',
  1: 'Iniziale',
  2: 'Base',
  3: 'Buono',
  4: 'Forte',
}

type Thresholds = [number, number, number]   // base · buono · forte

const THRESHOLDS_M: Record<string, Thresholds> = {
  'Petto':     [0.75, 1.10, 1.50],
  'Dorso':     [0.70, 1.00, 1.35],
  'Gambe':     [1.10, 1.60, 2.20],
  'Glutei':    [1.35, 1.90, 2.60],
  'Spalle':    [0.50, 0.75, 1.00],
  'Bicipiti':  [0.35, 0.50, 0.68],
  'Tricipiti': [0.55, 0.80, 1.10],
  'Core':      [0.30, 0.50, 0.75],
}

// Le soglie femminili non sono le maschili scalate di un fattore unico: il
// divario è più ampio sulla parte alta del corpo che su gambe e glutei.
const THRESHOLDS_F: Record<string, Thresholds> = {
  'Petto':     [0.45, 0.65, 0.90],
  'Dorso':     [0.45, 0.65, 0.90],
  'Gambe':     [0.85, 1.25, 1.75],
  'Glutei':    [1.05, 1.50, 2.10],
  'Spalle':    [0.32, 0.48, 0.65],
  'Bicipiti':  [0.22, 0.32, 0.45],
  'Tricipiti': [0.32, 0.48, 0.68],
  'Core':      [0.22, 0.38, 0.55],
}

// I distretti che la mappa sa disegnare. 'Altro' resta fuori: non ha una regione
// del corpo né un'alzata di riferimento da cui ricavare una soglia.
export const MAPPED_MUSCLES = Object.keys(THRESHOLDS_M)

// Sesso ignoto → tabella maschile, che ha le soglie più alte. Sbagliare per
// eccesso mostra un livello più basso del reale; sbagliare per difetto
// regalerebbe un "Forte" a chi non c'è ancora arrivato.
function thresholdsFor(muscle: string, sex?: 'M' | 'F'): Thresholds | undefined {
  return (sex === 'F' ? THRESHOLDS_F : THRESHOLDS_M)[muscle]
}

export function strengthLevel(ratio: number, muscle: string, sex?: 'M' | 'F'): StrengthLevel {
  const soglie = thresholdsFor(muscle, sex)
  if (!soglie || !(ratio > 0)) return 0
  if (ratio >= soglie[2]) return 4
  if (ratio >= soglie[1]) return 3
  if (ratio >= soglie[0]) return 2
  return 1
}

export interface DistrictStrength {
  muscle: string
  /** Massimale stimato migliore del distretto, in kg. 0 = mai allenato. */
  best: number
  /** `best` diviso il peso corporeo. null se il peso non è noto. */
  ratio: number | null
  level: StrengthLevel
  /** 0–100: quanta parte della strada verso "Forte" è fatta. Vedi `scoreFor`. */
  score: number
}

// Il numero da mostrare accanto al distretto.
//
// "8 kg · 0.11×" erano due numeri che non si leggono al volo: i chili non si
// confrontano fra distretti (è tutto il punto di questo file) e il moltiplicatore
// del peso corporeo va confrontato con una soglia che l'utente non ha in testa.
// Qui la soglia è già dentro il numero: 100 = livello "Forte" di QUEL distretto.
// Così 70 sui bicipiti e 70 sulle gambe vogliono dire la stessa cosa, ed è
// esattamente ciò che una mappa del corpo deve saper dire.
//
// Oltre "Forte" il punteggio si ferma a 100: non è un fondoscala che si sfonda,
// è "obiettivo raggiunto". Chi arriva lì ha bisogno di standard veri, non di
// questa tabella.
export function scoreFor(ratio: number | null, muscle: string, sex?: 'M' | 'F'): number {
  const soglie = thresholdsFor(muscle, sex)
  if (!soglie || !ratio || ratio <= 0) return 0
  return Math.min(100, Math.round((ratio / soglie[2]) * 100))
}

// Un distretto prende il massimale dell'esercizio in cui vai meglio, non la media
// di tutti: la media punisce chi ha in lista un accessorio leggero, e "quanto sono
// forte di petto" è una domanda sul tuo massimo, non sul tuo repertorio.
//
// Il gruppo SECONDARIO conta a metà. Non contarlo lascerebbe i bicipiti vuoti a chi
// fa cento trazioni a settimana; contarlo per intero fa l'errore opposto e più
// grave — un rematore da 60 kg diceva "bicipiti: forte", mentre nessuno curla 60 kg.
// Il muscolo che assiste lavora, ma non con quel carico. Metà è una convenzione,
// non una misura: serve a mettere il distretto nella fascia giusta, non a dargli
// un numero esatto.
const SECONDARY_SHARE = 0.5

export function districtStrength(
  exercises: PalestraExercise[],
  bodyWeightKg: number,
  sex?: 'M' | 'F',
): DistrictStrength[] {
  const best: Record<string, number> = {}
  const consider = (m: string | undefined, value: number) => {
    if (!m) return
    const key = displayMuscle(m)
    if (value > (best[key] ?? 0)) best[key] = value
  }
  for (const ex of exercises) {
    if (!ex.history.length) continue
    const top = Math.max(...ex.history.map(h => entry1RM(h, bodyWeightKg)))
    consider(ex.muscle, top)
    consider(ex.muscle2, top * SECONDARY_SHARE)
  }
  return MAPPED_MUSCLES.map(muscle => {
    const b = best[muscle] ?? 0
    const ratio = bodyWeightKg > 0 && b > 0 ? b / bodyWeightKg : null
    return {
      muscle, best: b, ratio,
      level: ratio === null ? 0 : strengthLevel(ratio, muscle, sex),
      score: scoreFor(ratio, muscle, sex),
    }
  })
}

// ── Traguardi ──────────────────────────────────────────────────
// DERIVATI dallo storico, non salvati da nessuna parte. Un traguardo memorizzato
// è un traguardo che può desincronizzarsi: cancelli l'alzata e la medaglia resta,
// cambi dispositivo e sparisce. Ricalcolarlo ogni volta costa una scansione e non
// può mai mentire.
// I tre campi di testo sono CHIAVI di traduzione, non frasi già pronte: questo
// file è logica pura e non deve sapere in che lingua è l'app. Le traduce chi le
// disegna (vedi AchievementsSection), che è anche l'unico posto che si ridisegna
// al cambio lingua — comporle qui avrebbe legato il conteggio delle alzate alla
// lingua scelta, che è un rapporto che non esiste.
export interface Achievement {
  id: string
  title: string
  /** La frase che compare sulla medaglia sbloccata. */
  phrase: string
  /** Cosa serve per sbloccarla, detto all'utente mentre è ancora grigia. */
  goal: string
  /** I valori da mettere nei segnaposto di `goal`. */
  goalVars?: Record<string, string | number>
  /** Data della prima alzata che l'ha centrata, o null se ancora chiusa. */
  unlockedAt: string | null
}

const HUNDRED_KG = 100
// Quante alzate di dorso servono per "Light weight baby". Conta le alzate
// REGISTRATE, non i giorni: è un contatore di lavoro accumulato, e in un giorno di
// schiena se ne registrano tre o quattro.
const DORSO_TARGET = 100

export function achievements(exercises: PalestraExercise[], bodyWeightKg: number): Achievement[] {
  // Il carico EFFETTIVO, non `kg`: a corpo libero il campo contiene la sola
  // zavorra, e chi fa trazioni con 25 kg pesandone 78 ne ha spostati 103.
  // Con pesi diversi per serie vale la serie più pesante.
  let firstHundred: string | null = null
  for (const ex of exercises) {
    for (const h of ex.history) {
      const top = h.setWeights?.length
        ? Math.max(...h.setWeights.map(w => effectiveLoad({ kg: w, bodyweight: h.bodyweight }, bodyWeightKg)))
        : effectiveLoad(h, bodyWeightKg)
      if (top < HUNDRED_KG) continue
      const date = h.date ?? ''
      // La più VECCHIA che li ha centrati: è quella la prima volta. Le voci senza
      // data sono le più antiche dello storico e vincono su qualsiasi data.
      if (firstHundred === null || date < firstHundred) firstHundred = date
    }
  }

  // Il dorso è il gruppo PRIMARIO dell'esercizio: contare anche i secondari
  // avrebbe fatto arrivare al traguardo a forza di rematori messi in conto ai
  // bicipiti, e il goal dice "esercizi per il dorso".
  // La data del traguardo è quella della CENTESIMA alzata in ordine cronologico,
  // non l'ultima: la medaglia si è sbloccata quel giorno lì.
  const dorso: string[] = []
  for (const ex of exercises) {
    if (displayMuscle(ex.muscle) !== 'Dorso') continue
    for (const h of ex.history) dorso.push(h.date ?? '')
  }
  dorso.sort((a, b) => a.localeCompare(b))
  const dorsoFatte = dorso.length

  return [
    {
      id: 'primi100',
      title: 'I primi 100 kg',
      phrase: 'I primi 100 kg non si scordano mai.',
      goal: 'Solleva 100 kg in una singola serie.',
      unlockedAt: firstHundred,
    },
    {
      id: 'lightWeightBaby',
      title: 'Light weight baby',
      phrase: 'Cento alzate di schiena. Light weight, baby!',
      goal: 'Registra {target} alzate di dorso (ne hai {fatte}).',
      goalVars: { target: DORSO_TARGET, fatte: dorsoFatte },
      unlockedAt: dorsoFatte >= DORSO_TARGET ? dorso[DORSO_TARGET - 1] : null,
    },
  ]
}

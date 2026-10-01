// L'allenamento che stai facendo ADESSO, salvato fuori dalla memoria di React.
//
// Finché una sessione non finisce, quello che hai spuntato — serie fatte, chili,
// colpi — vive solo in un `useState` dentro la pagina. Basta che la pagina si
// rimonti e non c'è più niente: una ricarica, il tasto indietro premuto per
// sbaglio (che qui non chiede conferma), il browser che chiude la scheda, o iOS
// che scarta la pagina in background mentre il telefono è in tasca fra due serie.
// In palestra non è un caso limite: è il modo normale in cui si usa il telefono.
//
// Qui non si salva NIENTE nello store: una sessione a metà non è un dato, è un
// appunto. Finisce nello storico solo a fine allenamento, con `finishTraining`, e
// da lì in poi questo file non c'entra più. Per lo stesso motivo sta in
// `localStorage` e non nel blob cloud: è di questo telefono e di quest'ora.

import { readStorage, writeStorage, removeStorage } from '@/lib/safeStorage'
import type { GymScheda } from '@/store/useJarvisStore'

const KEY = 'jarvis-sessione-in-corso-v1'
/** Il timer di recupero fra le serie: vedi in fondo al file. */
const KEY_RECUPERO = 'jarvis-recupero-v1'

/** Quanto resta valida una sessione lasciata a metà. Un allenamento lungo dura
 *  due ore; dodici coprono anche chi si ferma a mangiare e torna. Oltre, quello
 *  che si ritrova spuntato non è più "dove ero rimasto" ma un ricordo di ieri,
 *  e ripresentarlo come sessione in corso farebbe registrare un allenamento
 *  falso. */
const VALIDA_PER_MS = 12 * 60 * 60 * 1000

export interface SerieInCorso {
  checks: boolean[]
  weights: string[]
  reps: string[]
  /** L'appunto sull'esercizio scritto durante la sessione. */
  note?: string
}

interface Salvata {
  schedaId: string
  salvataA: number
  progress: Record<string, SerieInCorso>
}

/** Una sessione salvata combacia con la scheda solo se gli esercizi sono ancora
 *  gli stessi e con lo stesso numero di serie. Se la scheda è stata modificata
 *  nel frattempo — un esercizio tolto, le serie portate da 4 a 3 — rimetterci
 *  dentro i vecchi array darebbe spunte su serie che non esistono più. */
function combacia(s: Salvata, scheda: GymScheda): boolean {
  if (s.schedaId !== scheda.id) return false
  if (Object.keys(s.progress).length !== scheda.exercises.length) return false
  return scheda.exercises.every(e => {
    const p = s.progress[e.id]
    const n = Math.max(1, e.sets)
    return !!p
      && Array.isArray(p.checks) && p.checks.length === n
      && Array.isArray(p.weights) && p.weights.length === n
      && Array.isArray(p.reps) && p.reps.length === n
  })
}

/** La sessione lasciata a metà su QUESTA scheda, se c'è ed è ancora valida.
 *  `null` in ogni altro caso: scheda diversa, scaduta, modificata, o illeggibile. */
export function leggiSessione(scheda: GymScheda, ora = Date.now()): Record<string, SerieInCorso> | null {
  const s = leggiSalvata(ora)
  return s && combacia(s, scheda) ? s.progress : null
}

function leggiSalvata(ora: number): Salvata | null {
  const raw = readStorage('local', KEY)
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as Salvata
    if (typeof s?.schedaId !== 'string' || typeof s.salvataA !== 'number' || ora - s.salvataA > VALIDA_PER_MS) return null
    if (!s.progress || typeof s.progress !== 'object') return null
    return s
  } catch {
    return null
  }
}

/** C'è dentro del lavoro: almeno una serie spuntata o una nota scritta. Una
 *  sessione appena aperta e mai toccata non è "un allenamento in corso". */
function haLavoro(progress: Record<string, SerieInCorso>): boolean {
  return Object.values(progress).some(p => p?.checks?.some(Boolean) || !!p?.note?.trim())
}

/** L'allenamento lasciato a metà, qualunque sia la scheda: serve a dirlo fuori
 *  dalla pagina dell'allenamento ("Riprendi"), che è dove lo si cerca dopo
 *  essere usciti. `null` se non c'è, se è scaduto o se non è mai stato toccato. */
export function sessioneAperta(ora = Date.now()): { schedaId: string; fatte: number; totali: number } | null {
  const s = leggiSalvata(ora)
  if (!s || !haLavoro(s.progress)) return null
  const tutte = Object.values(s.progress).flatMap(p => p?.checks ?? [])
  return { schedaId: s.schedaId, fatte: tutte.filter(Boolean).length, totali: tutte.length }
}

/** Salvare questa sessione cancellerebbe quella, già cominciata, di un'altra
 *  scheda? Succede aprendo un'altra scheda solo per guardarla: finché qui non
 *  si spunta niente, l'allenamento vero resta quello di prima. */
export function copreAltra(schedaId: string, progress: Record<string, SerieInCorso>, ora = Date.now()): boolean {
  const s = leggiSalvata(ora)
  return !!s && s.schedaId !== schedaId && haLavoro(s.progress) && !haLavoro(progress)
}

export function salvaSessione(schedaId: string, progress: Record<string, SerieInCorso>, ora = Date.now()): void {
  writeStorage('local', KEY, JSON.stringify({ schedaId, salvataA: ora, progress } satisfies Salvata))
}

/** Da chiamare quando la sessione è finita davvero: a quel punto i dati stanno
 *  nello storico, e lasciarla qui la farebbe riproporre al prossimo ingresso. */
export function scartaSessione(): void {
  removeStorage('local', KEY)
  // Con la sessione se ne va anche il suo timer: un recupero rimasto acceso
  // ripartirebbe da solo al prossimo allenamento.
  removeStorage('local', KEY_RECUPERO)
}

// ── Il recupero in corso ───────────────────────────────────────
// Il timer fra una serie e l'altra. Si salva l'ISTANTE in cui finisce, non i
// secondi che mancano: così sopravvive a tutto ciò a cui sopravvive la sessione
// — il telefono bloccato in tasca, il tasto indietro, la pagina scartata da iOS
// — e al ritorno segna il tempo giusto invece di ripartire da capo o di essersi
// fermato dove lo si era lasciato.

/** Quanto dura il recupero fra due serie. */
export const RECUPERO_SEC = 90

// Il quadrante chiuso (ridotto a icona in testata). È una preferenza di come
// si guarda la pagina su QUESTO telefono, non un dato della sessione: resta fra
// un allenamento e l'altro, e non la tocca `scartaSessione`.
const KEY_TIMER_CHIUSO = 'jarvis-timer-chiuso-v1'

export function timerChiuso(): boolean {
  return readStorage('local', KEY_TIMER_CHIUSO) === '1'
}

export function ricordaTimerChiuso(chiuso: boolean): void {
  if (chiuso) writeStorage('local', KEY_TIMER_CHIUSO, '1')
  else removeStorage('local', KEY_TIMER_CHIUSO)
}

/** Per quanto il timer continua a contare OLTRE lo zero prima di azzerarsi da
 *  sé. Mezz'ora: abbastanza per chi si ferma a parlare, non così tanto da
 *  ritrovare un "+3:12:40" di un allenamento abbandonato. */
export const OLTRE_MAX_SEC = 30 * 60

/** Quando finisce (o è finito) il recupero in corso su questa scheda, in ms.
 *  Anche se è già passato: da lì il timer conta in su. `null` se non ce n'è
 *  uno, o se è scaduto da più di `OLTRE_MAX_SEC`. */
export function leggiRecupero(schedaId: string, ora = Date.now()): number | null {
  const raw = readStorage('local', KEY_RECUPERO)
  if (!raw) return null
  try {
    const r = JSON.parse(raw) as { schedaId?: string; fine?: number }
    return r.schedaId === schedaId && typeof r.fine === 'number' && ora - r.fine < OLTRE_MAX_SEC * 1000 ? r.fine : null
  } catch {
    return null
  }
}

export function salvaRecupero(schedaId: string, fine: number): void {
  writeStorage('local', KEY_RECUPERO, JSON.stringify({ schedaId, fine }))
}

export function scartaRecupero(): void {
  removeStorage('local', KEY_RECUPERO)
}

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
  const raw = readStorage('local', KEY)
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as Salvata
    if (typeof s?.salvataA !== 'number' || ora - s.salvataA > VALIDA_PER_MS) return null
    if (!s.progress || typeof s.progress !== 'object') return null
    return combacia(s, scheda) ? s.progress : null
  } catch {
    return null
  }
}

export function salvaSessione(schedaId: string, progress: Record<string, SerieInCorso>, ora = Date.now()): void {
  writeStorage('local', KEY, JSON.stringify({ schedaId, salvataA: ora, progress } satisfies Salvata))
}

/** Da chiamare quando la sessione è finita davvero: a quel punto i dati stanno
 *  nello storico, e lasciarla qui la farebbe riproporre al prossimo ingresso. */
export function scartaSessione(): void {
  removeStorage('local', KEY)
}

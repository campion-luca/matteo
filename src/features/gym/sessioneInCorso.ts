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

// ── Quanto resta una sessione lasciata a metà ──────────────────
// Due soglie, non una.
//
// Dopo dodici ore non è più "dove ero rimasto": è l'allenamento di ieri rimasto
// aperto. Prima a quel punto spariva, in silenzio — e con lei le serie di chi
// aveva solo dimenticato "Salva e chiudi". Adesso resta, ma si presenta per
// quello che è (`vecchia`): chi la ritrova decide se salvarla o scartarla, e se
// la salva finisce nel GIORNO in cui è stata fatta, non in quello in cui la si
// chiude.
//
// Dopo una settimana si butta davvero: nessuno torna a chiudere un allenamento
// di sette giorni prima, e tenerlo vorrebbe dire chiedere per sempre "ne hai già
// uno aperto" a chi vuole solo cominciare.
const VECCHIA_DOPO_MS = 12 * 60 * 60 * 1000
const VALIDA_PER_MS = 7 * 24 * 60 * 60 * 1000

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
  /** Quando è stata spuntata la PRIMA serie: da lì si misura quanto è durato
   *  l'allenamento, e quel giorno è la sua data. Assente finché non si spunta
   *  niente, e nelle sessioni salvate da una versione precedente. */
  iniziataA?: number
  /** Quando si è entrati nell'allenamento per cominciarlo: l'ultima volta che
   *  la pagina è stata aperta senza ancora niente di spuntato. È da qui che si
   *  misura la DURATA, non dalla prima spunta: chi spunta le serie tutte
   *  insieme alla fine avrebbe un allenamento di due minuti. */
  avviataA?: number
  /** L'inizio è stato ricostruito, non visto (una sessione salvata dalla
   *  versione di prima, che non lo scriveva): il giorno è attendibile, la
   *  durata no, e non la si registra. */
  stimata?: boolean
  progress: Record<string, SerieInCorso>
}

/** Porta le serie salvate al numero di serie di oggi: quelle in più si
 *  tagliano, quelle che mancano nascono non spuntate, col peso e i colpi
 *  dell'ultima che c'era. */
function ridimensiona(p: SerieInCorso, n: number): SerieInCorso {
  const lungo = <T,>(v: T[], vuoto: T) => Array.from({ length: n }, (_, i) => v[i] ?? v[v.length - 1] ?? vuoto)
  return {
    checks: Array.from({ length: n }, (_, i) => p.checks[i] === true),
    weights: lungo(p.weights, ''),
    reps: lungo(p.reps, ''),
    ...(p.note ? { note: p.note } : {}),
  }
}

const integra = (p: SerieInCorso | undefined): p is SerieInCorso =>
  !!p && Array.isArray(p.checks) && Array.isArray(p.weights) && Array.isArray(p.reps)

/** La sessione lasciata a metà su QUESTA scheda, adattata a com'è la scheda
 *  adesso. `null` se non c'è, se è di un'altra scheda o se è scaduta.
 *
 *  Se nel frattempo la scheda è cambiata — una serie in più, un esercizio tolto,
 *  l'allenatore che l'ha ritoccata mentre ci si allenava — non si butta tutto
 *  come si faceva: quello che è stato spuntato sugli esercizi che ci sono ancora
 *  resta. Degli esercizi tolti si perdono le spunte (non c'è più dove metterle);
 *  quelli nuovi non compaiono qui, e chi chiama li fa partire da zero. */
export function leggiSessione(scheda: GymScheda, ora = Date.now()): Record<string, SerieInCorso> | null {
  const s = leggiSalvata(ora)
  if (!s || s.schedaId !== scheda.id) return null
  const out: Record<string, SerieInCorso> = {}
  for (const e of scheda.exercises) {
    const p = s.progress[e.id]
    if (integra(p)) out[e.id] = ridimensiona(p, Math.max(1, e.sets))
  }
  return out
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

export interface SessioneAperta {
  schedaId: string
  fatte: number
  totali: number
  /** Quando è cominciata (la prima spunta), in ms. Per le sessioni di prima,
   *  che non lo sapevano, l'ultima volta che sono state toccate. */
  iniziataA: number
  /** Ferma da più di dodici ore: è un allenamento rimasto aperto, non uno in
   *  corso. */
  vecchia: boolean
}

/** L'allenamento lasciato a metà, qualunque sia la scheda: serve a dirlo fuori
 *  dalla pagina dell'allenamento ("Riprendi"), e a chiedere prima di cominciarne
 *  un altro. `null` se non c'è, se è scaduto o se non è mai stato toccato. */
export function sessioneAperta(ora = Date.now()): SessioneAperta | null {
  const s = leggiSalvata(ora)
  if (!s || !haLavoro(s.progress)) return null
  const tutte = Object.values(s.progress).flatMap(p => p?.checks ?? [])
  return {
    schedaId: s.schedaId,
    fatte: tutte.filter(Boolean).length,
    totali: tutte.length,
    iniziataA: s.iniziataA ?? s.salvataA,
    // Sull'INIZIO e non sull'ultima volta che è stata toccata: basta riaprire la
    // pagina perché venga risalvata, e un allenamento di venerdì riaperto il
    // mercoledì tornava a dirsi "in corso".
    vecchia: ora - (s.iniziataA ?? s.salvataA) > VECCHIA_DOPO_MS,
  }
}

/** Quando è cominciato l'allenamento in corso su questa scheda (la prima
 *  spunta), in ms. `null` se non è ancora stato spuntato niente. È il GIORNO
 *  dell'allenamento. */
export function inizioSessione(schedaId: string, ora = Date.now()): number | null {
  const s = leggiSalvata(ora)
  return s && s.schedaId === schedaId && typeof s.iniziataA === 'number' ? s.iniziataA : null
}

/** Da quando far partire l'orologio della durata, in ms: da quando si è entrati
 *  per cominciare, o in mancanza dalla prima spunta. `null` se non c'è, o se
 *  l'inizio è solo stimato — allora la durata non si misura. */
export function orologioSessione(schedaId: string, ora = Date.now()): number | null {
  const s = leggiSalvata(ora)
  if (!s || s.schedaId !== schedaId || s.stimata) return null
  return s.avviataA ?? s.iniziataA ?? null
}

/** Da chiamare entrando nell'allenamento. Finché non c'è niente di spuntato
 *  l'orologio riparte a ogni ingresso: aprire la scheda la mattina per
 *  guardarla e allenarsi la sera non è un allenamento di otto ore. Con delle
 *  serie già spuntate non fa niente — si sta riprendendo. */
export function segnaAvvio(schedaId: string, ora = Date.now()): void {
  const s = leggiSalvata(ora)
  const stessa = s && s.schedaId === schedaId ? s : null
  // L'allenamento vero è su un'altra scheda: questa è solo aperta, e scrivere
  // qui lo cancellerebbe (vedi `copreAltra`).
  if (s && !stessa && haLavoro(s.progress)) return
  if (stessa && Object.values(stessa.progress).some(p => p?.checks?.some(Boolean))) return
  const salvata: Salvata = { schedaId, salvataA: ora, avviataA: ora, progress: stessa?.progress ?? {} }
  writeStorage('local', KEY, JSON.stringify(salvata))
}

/** Salvare questa sessione cancellerebbe quella, già cominciata, di un'altra
 *  scheda? Succede aprendo un'altra scheda solo per guardarla: finché qui non
 *  si spunta niente, l'allenamento vero resta quello di prima. (Per cominciarne
 *  davvero un altro si passa dalla domanda di GymSchede, che chiude il primo.) */
export function copreAltra(schedaId: string, progress: Record<string, SerieInCorso>, ora = Date.now()): boolean {
  const s = leggiSalvata(ora)
  return !!s && s.schedaId !== schedaId && haLavoro(s.progress) && !haLavoro(progress)
}

export function salvaSessione(schedaId: string, progress: Record<string, SerieInCorso>, ora = Date.now()): void {
  // L'inizio si scrive una volta, alla prima spunta, e poi si conserva: a ogni
  // salvataggio si rilegge quello di prima. Se le spunte tornano tutte a zero
  // l'allenamento non è più cominciato, e l'orologio riparte con la prossima.
  const prima = leggiSalvata(ora)
  const stessa = prima && prima.schedaId === schedaId ? prima : null
  const spuntato = Object.values(progress).some(p => p?.checks?.some(Boolean))
  // Una sessione salvata dalla versione di prima ha le spunte ma non l'inizio.
  // Prenderlo da adesso la sposterebbe a oggi: si prende l'ultima volta che è
  // stata toccata, che è il meglio che si sa, e si ricorda che è una stima.
  const avevaSpunte = !!stessa && Object.values(stessa.progress).some(p => p?.checks?.some(Boolean))
  const ricostruita = !!stessa && stessa.iniziataA === undefined && avevaSpunte
  const iniziataA = spuntato ? stessa?.iniziataA ?? (ricostruita ? stessa!.salvataA : ora) : undefined
  const stimata = spuntato && (stessa?.stimata === true || ricostruita)
  const salvata: Salvata = {
    schedaId, salvataA: ora,
    ...(iniziataA !== undefined ? { iniziataA } : {}),
    ...(stessa?.avviataA !== undefined ? { avviataA: stessa.avviataA } : {}),
    ...(stimata ? { stimata: true } : {}),
    progress,
  }
  writeStorage('local', KEY, JSON.stringify(salvata))
}

/** L'allenamento a metà così com'è scritto, per metterlo da parte quando
 *  l'account esce (vedi lib/proprietario). `null` se non c'è niente di fatto. */
export function esportaSessione(ora = Date.now()): string | null {
  const s = leggiSalvata(ora)
  return s && haLavoro(s.progress) ? JSON.stringify(s) : null
}

/** Rimette al suo posto un allenamento messo da parte con `esportaSessione`. */
export function importaSessione(raw: string): void {
  writeStorage('local', KEY, raw)
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

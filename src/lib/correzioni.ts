// ── Le correzioni dell'allenatore alle alzate di un allievo ────
// Un allievo sbaglia a scrivere — 80 al posto di 85, una serie in più — e chi lo
// segue se ne accorge guardando le sessioni. Deve poterlo sistemare da lì.
//
// ── Perché una tabella a parte e non una scrittura nei suoi dati ──
// I dati di allenamento stanno in un blob unico che l'app dell'allievo riscrive
// per intero a ogni salvataggio (vedi cloudSync). Chiunque altro ci scrivesse
// dentro verrebbe sovrascritto alla prima modifica dell'allievo, o peggio
// sovrascriverebbe lui un allenamento appena registrato. È lo stesso motivo per
// cui le schede assegnate e le note stanno in tabelle loro (vedi coach.ts).
//
// Quindi l'allenatore non modifica: PROPONE. Scrive una riga in
// `coach_correzioni` — "questa alzata, così" — e a riscrivere il dato è l'app
// dell'allievo, l'unica che ne ha il diritto, la prossima volta che si apre.
// Fino ad allora l'allenatore vede comunque i dati già corretti: la stessa
// funzione che applica le correzioni in casa dell'allievo le applica, in sola
// lettura, a quello che l'allenatore sta guardando.
//
// ── Come si riconosce l'alzata ─────────────────────────────────
// Le alzate non hanno un id. La correzione porta con sé l'alzata com'era
// (`vecchia`) e la si ritrova per uguaglianza esatta. Niente ripieghi "a
// occhio" (l'unica alzata di quel giorno, la più simile): se l'allievo nel
// frattempo l'ha riscritta a mano, sovrascrivergliela sarebbe peggio che non
// correggere. Se non si trova, la correzione non ha più un bersaglio.
//
// ── Quando si toglie dalla tabella ─────────────────────────────
// Non appena applicata: dopo, e solo quando il dato corretto è arrivato al
// cloud. Applicarla in locale e cancellarla subito lascerebbe un buco — se quel
// salvataggio perde un conflitto con un altro dispositivo, la correzione è
// persa e nessuno la riproporrà. Tenendola, alla volta dopo o risulta già
// fatta (e allora si toglie) o si riapplica.
import { supabase } from './supabase'
import { translateCoachError } from './coach'
import type { PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'

export interface Correzione {
  id: string
  coach_id: string
  athlete_id: string
  /** L'id del PalestraExercise nell'app dell'allievo. */
  exercise_id: string
  vecchia: PalestraHistoryEntry
  nuova: PalestraHistoryEntry
  coach_name: string | null
  created_at: string
}

const CAMPI = 'id, coach_id, athlete_id, exercise_id, vecchia, nuova, coach_name, created_at'

/** Le correzioni in attesa per questo allievo, dalla più vecchia: vanno
 *  applicate in ordine, perché una seconda correzione alla stessa alzata parte
 *  dal risultato della prima. */
export async function correzioniPer(athleteId: string): Promise<Correzione[]> {
  const { data, error } = await supabase
    .from('coach_correzioni')
    .select(CAMPI)
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(translateCoachError(error.message))
  return (data ?? []) as Correzione[]
}

export async function salvaCorrezione(
  coachId: string, athleteId: string, exerciseId: string, coachName: string,
  vecchia: PalestraHistoryEntry, nuova: PalestraHistoryEntry,
): Promise<void> {
  const { error } = await supabase.from('coach_correzioni').insert({
    coach_id: coachId, athlete_id: athleteId, exercise_id: exerciseId,
    vecchia, nuova, coach_name: coachName || null,
  })
  if (error) throw new Error(translateCoachError(error.message))
}

/** Toglie le correzioni ormai applicate (o senza più un bersaglio). */
export async function eliminaCorrezioni(ids: string[]): Promise<void> {
  if (!ids.length) return
  const { error } = await supabase.from('coach_correzioni').delete().in('id', ids)
  if (error) throw new Error(translateCoachError(error.message))
}

// ── Applicarle ─────────────────────────────────────────────────

/** Le chiavi in ordine: il database restituisce un jsonb con le chiavi messe
 *  come vuole lui, e due alzate uguali non devono risultare diverse per questo. */
function canonica(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonica).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonica(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

const trova = (history: PalestraHistoryEntry[], alzata: PalestraHistoryEntry): number => {
  const bersaglio = canonica(alzata)
  return history.findIndex(h => canonica(h) === bersaglio)
}

// ── La forma dell'alzata corretta ──────────────────────────────
// `nuova` la scrive un altro utente in un jsonb di cui il database non controlla
// la forma: l'app dell'allenatore la manda giusta, una chiamata REST scritta a
// mano ci mette quello che vuole. Prima si univa così com'era: una `date` che
// non era un testo faceva esplodere l'ordinamento — la correzione non si
// applicava, non si toglieva, e si ritentava a ogni apertura per sempre — e
// qualunque altra cosa finiva tale e quale nei dati dell'allievo.
//
// Un controllo per campo, sul tipo vero: un campo aggiunto all'alzata e non qui
// non compila. Le chiavi che l'alzata non ha si lasciano cadere.
const numero = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const testo = (v: unknown) => typeof v === 'string'
const elenco = (ok: (x: unknown) => boolean) => (v: unknown) => Array.isArray(v) && v.every(ok)
const oggetto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

const CAMPI_ALZATA: Record<keyof PalestraHistoryEntry, (v: unknown) => boolean> = {
  d: testo, date: testo, kg: numero, reps: numero, sets_n: numero,
  setWeights: elenco(numero), setReps: elenco(numero),
  machineModel: v => v === 'panatta', bodyweight: v => v === true, maxLift: v => v === true,
  attrezzo: numero, durataSec: numero, giaFatti: numero,
  scheda: v => oggetto(v) && testo(v.id) && testo(v.nome),
  piano: v => oggetto(v) && numero(v.sets) && testo(v.reps) && (v.riga === undefined || testo(v.riga)),
  correttaDa: testo, note: testo,
  setRir: elenco(x => x === null || numero(x)),
}
const OBBLIGATORI: Array<keyof PalestraHistoryEntry> = ['d', 'kg', 'reps', 'sets_n']

/** L'alzata ripulita, o `null` se un campo ha il tipo sbagliato. */
function alzataValida(v: unknown): PalestraHistoryEntry | null {
  if (!oggetto(v) || OBBLIGATORI.some(k => v[k] === undefined)) return null
  const out: Record<string, unknown> = {}
  for (const [k, ok] of Object.entries(CAMPI_ALZATA)) {
    if (v[k] === undefined) continue
    if (!ok(v[k])) return null
    out[k] = v[k]
  }
  // Anche dentro `scheda` e `piano` passano solo i campi che hanno: copiati
  // interi, ci viaggiava qualunque altra cosa ci fosse stata messa dentro.
  const sc = out.scheda as { id: string; nome: string } | undefined
  if (sc) out.scheda = { id: sc.id, nome: sc.nome }
  const pi = out.piano as { sets: number; reps: string; riga?: string } | undefined
  if (pi) out.piano = { sets: pi.sets, reps: pi.reps, ...(pi.riga !== undefined ? { riga: pi.riga } : {}) }
  return out as unknown as PalestraHistoryEntry
}

export interface EsitoCorrezioni {
  /** Gli esercizi con le correzioni applicate. Lo stesso array in ingresso se
   *  non è cambiato niente. */
  esercizi: PalestraExercise[]
  /** Gli id di quelle applicate adesso. */
  applicate: string[]
  /** Già fatte: l'alzata corretta c'è già, non c'è niente da cambiare. */
  giaFatte: string[]
  /** Senza più un bersaglio: l'esercizio o l'alzata non esistono più così. E
   *  quelle malformate (vedi `alzataValida`): non si applicheranno mai, e vanno
   *  tolte come le altre. */
  perse: string[]
}

// Una data che non è un testo — rimasta da prima del controllo qui sopra — non
// deve far saltare l'ordinamento di tutte le altre.
const giorno = (h: PalestraHistoryEntry) => (typeof h.date === 'string' ? h.date : '')

/** Applica le correzioni nell'ordine in cui arrivano. Non tocca gli oggetti in
 *  ingresso, e non lancia: una correzione malformata finisce fra le perse. */
export function applicaCorrezioni(esercizi: PalestraExercise[], correzioni: Correzione[]): EsitoCorrezioni {
  const out = [...esercizi]
  const applicate: string[] = [], giaFatte: string[] = [], perse: string[] = []
  for (const c of correzioni) {
    const nuova = alzataValida(c.nuova)
    if (!nuova) { perse.push(c.id); continue }
    const i = out.findIndex(e => e.id === c.exercise_id)
    const j = i < 0 ? -1 : trova(out[i].history, c.vecchia)
    if (j < 0) {
      if (i >= 0 && trova(out[i].history, nuova) >= 0) giaFatte.push(c.id)
      else perse.push(c.id)
      continue
    }
    // Per data, come ovunque: correggendo la data l'alzata può cambiare posto,
    // e "l'ultima volta" dev'essere l'alzata più recente, non l'ultima toccata.
    const history = out[i].history.map((h, k) => (k === j ? nuova : h))
      .sort((a, b) => giorno(a).localeCompare(giorno(b)))
    const last = history[history.length - 1]
    out[i] = { ...out[i], history, current: { kg: last.kg, reps: last.reps, sets_n: last.sets_n } }
    applicate.push(c.id)
  }
  return { esercizi: applicate.length ? out : esercizi, applicate, giaFatte, perse }
}

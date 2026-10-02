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

export interface EsitoCorrezioni {
  /** Gli esercizi con le correzioni applicate. Lo stesso array in ingresso se
   *  non è cambiato niente. */
  esercizi: PalestraExercise[]
  /** Gli id di quelle applicate adesso. */
  applicate: string[]
  /** Già fatte: l'alzata corretta c'è già, non c'è niente da cambiare. */
  giaFatte: string[]
  /** Senza più un bersaglio: l'esercizio o l'alzata non esistono più così. */
  perse: string[]
}

/** Applica le correzioni nell'ordine in cui arrivano. Non tocca gli oggetti in
 *  ingresso. */
export function applicaCorrezioni(esercizi: PalestraExercise[], correzioni: Correzione[]): EsitoCorrezioni {
  const out = [...esercizi]
  const applicate: string[] = [], giaFatte: string[] = [], perse: string[] = []
  for (const c of correzioni) {
    const i = out.findIndex(e => e.id === c.exercise_id)
    const j = i < 0 ? -1 : trova(out[i].history, c.vecchia)
    if (j < 0) {
      if (i >= 0 && trova(out[i].history, c.nuova) >= 0) giaFatte.push(c.id)
      else perse.push(c.id)
      continue
    }
    // Per data, come ovunque: correggendo la data l'alzata può cambiare posto,
    // e "l'ultima volta" dev'essere l'alzata più recente, non l'ultima toccata.
    const history = out[i].history.map((h, k) => (k === j ? c.nuova : h))
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    const last = history[history.length - 1]
    out[i] = { ...out[i], history, current: { kg: last.kg, reps: last.reps, sets_n: last.sets_n } }
    applicate.push(c.id)
  }
  return { esercizi: applicate.length ? out : esercizi, applicate, giaFatte, perse }
}

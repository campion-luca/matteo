// Le richieste di essere seguiti (vedi supabase/richieste_schema.sql).
//
// L'allievo sceglie un coach dall'elenco «Trova un coach» e gli chiede di
// seguirlo; il coach la vede nel suo Coaching e accetta o rifiuta. Una
// richiesta per volta: per chiederlo a un altro si annulla prima questa.
//
// A dire chi può chiedere cosa a chi resta il database: qui si scrive e si
// legge, e si traducono i suoi rifiuti in parole.
import { supabase } from './supabase'
import { translateCoachError } from './coach'
import { t } from './i18n'

export interface RichiestaCoach {
  athlete_id: string
  coach_id: string
  /** Il nome dell'allievo quando ha chiesto. */
  athlete_name: string | null
  created_at: string
}

const CAMPI = 'athlete_id, coach_id, athlete_name, created_at'

/** I rifiuti del database, detti in parole. */
function traduci(message: string): string {
  const m = message.toUpperCase()
  // La chiave è l'allievo, una richiesta per volta: ce n'è già una in attesa.
  if (m.includes('DUPLICATE KEY') || m.includes('23505') || m.includes('COACH_RICHIESTE_PKEY')) {
    return t('Hai già una richiesta in attesa: annullala per chiederlo a un altro coach.')
  }
  if (m.includes('RICHIESTA_SPARITA')) return t('La richiesta non c’è più: è stata annullata nel frattempo.')
  // La regola di inserimento: un coach ce l'ha già, o quello scelto non lo è più.
  if (m.includes('ROW-LEVEL SECURITY')) return t('Non si può chiedere: hai già un coach, o questa persona non segue più nessuno.')
  return translateCoachError(message)
}

/** La richiesta che ho in attesa, se c'è. */
export async function miaRichiesta(athleteId: string): Promise<RichiestaCoach | null> {
  const { data, error } = await supabase.from('coach_richieste').select(CAMPI).eq('athlete_id', athleteId).limit(1)
  if (error) throw new Error(traduci(error.message))
  return ((data ?? [])[0] as RichiestaCoach | undefined) ?? null
}

/** Le richieste arrivate a questo coach, dalla più vecchia: chi aspetta da più
 *  tempo viene prima. */
export async function richiesteRicevute(coachId: string): Promise<RichiestaCoach[]> {
  const { data, error } = await supabase.from('coach_richieste').select(CAMPI).eq('coach_id', coachId).order('created_at', { ascending: true })
  if (error) throw new Error(traduci(error.message))
  return (data ?? []) as RichiestaCoach[]
}

/** Nome e foto di chi mi ha chiesto di seguirlo, per id. Non dal profilo: chi
 *  chiede non è ancora collegato, e il suo profilo intero non si legge (vedi
 *  `facce_richiedenti` in richieste_schema.sql). */
export interface FacciaRichiedente { nome: string | null; cognome: string | null; foto: string | null }

export async function facceRichiedenti(): Promise<Record<string, FacciaRichiedente>> {
  const { data, error } = await supabase.rpc('facce_richiedenti')
  if (error) throw new Error(traduci(error.message))
  const out: Record<string, FacciaRichiedente> = {}
  for (const r of (data ?? []) as Array<FacciaRichiedente & { user_id: string }>) out[r.user_id] = { nome: r.nome, cognome: r.cognome, foto: r.foto }
  return out
}

/** Chiedere a un coach di seguirmi. */
export async function chiediDiEssereSeguito(athleteId: string, coachId: string, athleteName: string): Promise<RichiestaCoach> {
  const { data, error } = await supabase
    .from('coach_richieste')
    .insert({ athlete_id: athleteId, coach_id: coachId, athlete_name: athleteName.trim().slice(0, 200) || null })
    .select(CAMPI)
  if (error) throw new Error(traduci(error.message))
  const riga = (data ?? [])[0] as RichiestaCoach | undefined
  if (!riga) throw new Error(t('Non si può chiedere: hai già un coach, o questa persona non segue più nessuno.'))
  return riga
}

/** Annullare la mia richiesta in attesa. Già tolta (il coach l'ha rifiutata o
 *  accettata nel frattempo) va bene lo stesso: quello che si voleva è fatto. */
export async function annullaRichiesta(athleteId: string): Promise<void> {
  const { error } = await supabase.from('coach_richieste').delete().eq('athlete_id', athleteId)
  if (error) throw new Error(traduci(error.message))
}

/** Rifiutare una richiesta arrivata. */
export async function rifiutaRichiesta(coachId: string, athleteId: string): Promise<void> {
  const { error } = await supabase.from('coach_richieste').delete().eq('coach_id', coachId).eq('athlete_id', athleteId)
  if (error) throw new Error(traduci(error.message))
}

/** Accettare: il database crea il collegamento e toglie la richiesta. */
export async function accettaRichiesta(athleteId: string, coachName: string): Promise<void> {
  const { error } = await supabase.rpc('accetta_richiesta', { p_athlete: athleteId, p_coach_name: coachName || null })
  if (error) throw new Error(traduci(error.message))
}

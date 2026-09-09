// Collegamento personal trainer ⇄ atleta: il livello che parla con Supabase.
// Le regole vere stanno nel database (supabase/coach_schema.sql); qui c'è solo
// come chiamarle e come tradurre i suoi errori in italiano.
//
// Il verso del collegamento: l'ATLETA genera un codice e lo dà all'allenatore,
// che lo inserisce. Chi condivide i propri dati compie il gesto — non li si
// ritrova condivisi da una richiesta altrui accettata di fretta.
import { supabase } from './supabase'
import { t } from '@/lib/i18n'

export interface CoachLink {
  coach_id: string
  athlete_id: string
  athlete_name: string | null
  coach_name: string | null
  created_at: string
}

export interface CoachInvite {
  code: string
  expires_at: string
}

// Alfabeto senza 0/O e 1/I/L: il codice si detta a voce o si copia da uno
// screenshot, e quelle coppie sono il modo principale in cui un codice giusto
// viene digitato sbagliato.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const CODE_LEN = 6

function randomCode(): string {
  const bytes = new Uint32Array(CODE_LEN)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('')
}

/** L'invito attivo dell'utente, se ce n'è uno non scaduto. */
export async function activeInvite(userId: string): Promise<CoachInvite | null> {
  const { data, error } = await supabase
    .from('coach_invites')
    .select('code, expires_at')
    .eq('athlete_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return (data?.[0] as CoachInvite) ?? null
}

/** Genera un codice nuovo, sostituendo quello eventualmente in corso.
 *
 *  Un utente per volta ha UN codice valido: due codici in giro significano due
 *  allenatori collegati senza che il secondo sia stato deciso. */
export async function createInvite(userId: string, athleteName: string): Promise<CoachInvite> {
  await supabase.from('coach_invites').delete().eq('athlete_id', userId)

  // Il codice è generato dal client e la chiave primaria è il codice stesso: una
  // collisione fa fallire l'insert invece di sovrascrivere l'invito di un altro.
  // Con 31^6 combinazioni capita quasi mai, ma "quasi mai" su una chiave che dà
  // accesso ai dati di qualcuno va gestito, non sperato.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode()
    const { data, error } = await supabase
      .from('coach_invites')
      .insert({ code, athlete_id: userId, athlete_name: athleteName || null })
      .select('code, expires_at')
      .single()
    if (!error) return data as CoachInvite
    // 23505 = violazione di unicità: codice già preso, se ne prova un altro.
    if ((error as { code?: string }).code !== '23505') throw error
  }
  throw new Error('Non è stato possibile generare un codice. Riprova.')
}

export async function revokeInvite(userId: string): Promise<void> {
  const { error } = await supabase.from('coach_invites').delete().eq('athlete_id', userId)
  if (error) throw error
}

/** Gli atleti che seguo (io sono l'allenatore). */
export async function myAthletes(userId: string): Promise<CoachLink[]> {
  const { data, error } = await supabase
    .from('coach_links')
    .select('coach_id, athlete_id, athlete_name, coach_name, created_at')
    .eq('coach_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as CoachLink[]
}

/** Chi segue me (io sono l'atleta). */
export async function myCoaches(userId: string): Promise<CoachLink[]> {
  const { data, error } = await supabase
    .from('coach_links')
    .select('coach_id, athlete_id, athlete_name, coach_name, created_at')
    .eq('athlete_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as CoachLink[]
}

export async function unlink(coachId: string, athleteId: string): Promise<void> {
  const { error } = await supabase
    .from('coach_links')
    .delete()
    .eq('coach_id', coachId)
    .eq('athlete_id', athleteId)
  if (error) throw error
}

/** Riscatta un codice: da qui in poi vedo gli allenamenti di chi me l'ha dato. */
export async function redeemCode(code: string, coachName: string): Promise<{ athlete_id: string; athlete_name: string | null }> {
  const { data, error } = await supabase.rpc('redeem_coach_code', {
    p_code: code.trim().toUpperCase(),
    p_coach_name: coachName || null,
  })
  if (error) throw new Error(translateCoachError(error.message))
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('Codice non valido o scaduto.')
  return row as { athlete_id: string; athlete_name: string | null }
}

// Il sottoinsieme di stato che l'allenatore può leggere. NON è `JarvisState`:
// budget, tema e preferenze non escono dal database — vedi il commento in
// coach_schema.sql, dove il taglio è fatto.
export interface AthleteData {
  userName?: string
  userSex?: 'M' | 'F'
  userAge?: number
  userWeight?: number
  userHeight?: number
  palestraExercises?: import('@/store/useJarvisStore').PalestraExercise[]
  hyroxExercises?: import('@/store/useJarvisStore').HyroxExercise[]
  gymSchede?: import('@/store/useJarvisStore').GymScheda[]
  weightLog?: import('@/store/useJarvisStore').WeightLogEntry[]
  updatedAt?: string
}

/** I dati di allenamento di un allievo. `null` se non ha ancora salvato nulla. */
export async function athleteData(athleteId: string): Promise<AthleteData | null> {
  const { data, error } = await supabase.rpc('athlete_training_data', { p_athlete: athleteId })
  if (error) throw new Error(translateCoachError(error.message))
  return (data as AthleteData | null) ?? null
}

// ── Schede assegnate dall'allenatore ──────────────────────
// Righe in `coach_schede`, non dentro il blob dell'atleta: il blob viene
// riscritto per intero dal client dell'atleta a ogni modifica, e una scheda
// scritta lì dall'allenatore sparirebbe al primo salvataggio. Vedi il commento
// esteso in supabase/coach_schema.sql.

export interface CoachScheda {
  id: string
  coach_id: string
  athlete_id: string
  scheda: import('@/store/useJarvisStore').GymScheda
  coach_name: string | null
  updated_at: string
}

const CAMPI = 'id, coach_id, athlete_id, scheda, coach_name, updated_at'

/** Le schede che QUESTO allenatore ha assegnato a QUESTO allievo. */
export async function schedeAssegnate(athleteId: string): Promise<CoachScheda[]> {
  const { data, error } = await supabase
    .from('coach_schede')
    .select(CAMPI)
    .eq('athlete_id', athleteId)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(translateCoachError(error.message))
  return (data ?? []) as CoachScheda[]
}

/** Le schede che gli allenatori hanno assegnato a ME.
 *
 *  Il filtro su `athlete_id` non è ridondante con la RLS: la policy lascia
 *  passare anche le righe in cui sono l'ALLENATORE, e chi allena qualcuno ed è
 *  a sua volta seguito si ritroverebbe in casa le schede che ha scritto per altri. */
export async function schedeRicevute(userId: string): Promise<CoachScheda[]> {
  const { data, error } = await supabase
    .from('coach_schede')
    .select(CAMPI)
    .eq('athlete_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(translateCoachError(error.message))
  return (data ?? []) as CoachScheda[]
}

/** Crea o aggiorna una scheda assegnata. L'id è quello della GymScheda: una
 *  scheda è una riga, e riscriverla non ne lascia in giro una copia vecchia. */
export async function salvaSchedaAssegnata(
  coachId: string, athleteId: string, coachName: string,
  scheda: import('@/store/useJarvisStore').GymScheda,
): Promise<void> {
  const { error } = await supabase.from('coach_schede').upsert({
    id: scheda.id,
    coach_id: coachId,
    athlete_id: athleteId,
    scheda,
    coach_name: coachName || null,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(translateCoachError(error.message))
}

export async function eliminaSchedaAssegnata(id: string): Promise<void> {
  const { error } = await supabase.from('coach_schede').delete().eq('id', id)
  if (error) throw new Error(translateCoachError(error.message))
}

// ── Note dell'allenatore sugli esercizi ────────────────────
// Righe in `coach_note`, per lo stesso motivo delle schede: il blob dell'allievo
// non è un posto in cui un altro utente possa scrivere senza essere cancellato.
// La nota dell'allenatore e quella dell'allievo restano due cose separate —
// l'allievo continua a scrivere la sua dentro `PalestraExercise.note` — e nella
// schermata dell'esercizio si leggono affiancate.

export interface NotaCoach {
  coach_id: string
  athlete_id: string
  exercise_id: string
  nota: string
  coach_name: string | null
  updated_at: string
}

const CAMPI_NOTA = 'coach_id, athlete_id, exercise_id, nota, coach_name, updated_at'

/** Le note su questo allievo (tutte, di qualunque suo allenatore). */
export async function noteAllievo(athleteId: string): Promise<NotaCoach[]> {
  const { data, error } = await supabase
    .from('coach_note')
    .select(CAMPI_NOTA)
    .eq('athlete_id', athleteId)
  if (error) throw new Error(translateCoachError(error.message))
  return (data ?? []) as NotaCoach[]
}

/** Le note che gli allenatori hanno scritto a ME. Il filtro su `athlete_id` non
 *  è ridondante con la RLS: la policy lascia passare anche le righe in cui sono
 *  io l'ALLENATORE, e me le ritroverei sui miei esercizi. */
export async function noteRicevute(userId: string): Promise<NotaCoach[]> {
  return noteAllievo(userId)
}

/** Scrive la nota. Vuota = la cancella: un campo svuotato vuole dire “non ho più
 *  niente da dire qui”, e lasciare una riga vuota mostrerebbe all'allievo
 *  un'intestazione “dal tuo allenatore” senza niente sotto. */
export async function salvaNotaCoach(
  coachId: string, athleteId: string, exerciseId: string, coachName: string, nota: string,
): Promise<void> {
  const testo = nota.trim()
  if (!testo) {
    const { error } = await supabase.from('coach_note').delete()
      .eq('coach_id', coachId).eq('athlete_id', athleteId).eq('exercise_id', exerciseId)
    if (error) throw new Error(translateCoachError(error.message))
    return
  }
  const { error } = await supabase.from('coach_note').upsert({
    coach_id: coachId, athlete_id: athleteId, exercise_id: exerciseId,
    nota: testo, coach_name: coachName || null,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(translateCoachError(error.message))
}

// Gli errori arrivano dalle RAISE EXCEPTION della funzione SQL, in maiuscolo.
export function translateCoachError(message: string): string {
  const m = message.toUpperCase()
  if (m.includes('CODICE_NON_VALIDO')) return t('Codice non valido o scaduto.')
  if (m.includes('CODICE_TUO')) return t('Questo è il tuo codice: dallo a chi deve seguirti.')
  if (m.includes('NON_AUTENTICATO')) return t('Sessione scaduta. Esci e rientra.')
  // Funzione o tabella mancanti: lo schema non è stato ancora eseguito.
  if (m.includes('DOES NOT EXIST') || m.includes('PGRST202') || m.includes('SCHEMA CACHE')
      || m.includes('PGRST205')) {
    return t('La funzione non è ancora attiva sul server.')
  }
  // La RLS non spiega mai PERCHÉ ha rifiutato — è il suo mestiere — e il messaggio
  // grezzo ("new row violates row-level security policy") non dice niente a chi
  // sta assegnando una scheda. Qui il caso è uno solo: il collegamento non c'è più.
  if (m.includes('ROW-LEVEL SECURITY')) {
    return t('Non sei più collegato a questa persona: il collegamento è stato sciolto.')
  }
  return message
}

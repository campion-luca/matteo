// Collegamento personal trainer ⇄ atleta: il livello che parla con Supabase.
// Le regole vere stanno nel database (supabase/coach_schema.sql); qui c'è solo
// come chiamarle e come tradurre i suoi errori in italiano.
//
// Il verso del collegamento: l'ATLETA genera un codice e lo dà all'allenatore,
// che lo inserisce. Chi condivide i propri dati compie il gesto — non li si
// ritrova condivisi da una richiesta altrui accettata di fretta.
import { supabase } from './supabase'
import { t } from '@/lib/i18n'
import { readStorage, writeStorage, removeStorage } from './safeStorage'
import { conSegnoCorpoLibero, conGruppo } from '@/features/gym/catalogo'

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
  // Il vecchio va tolto DAVVERO prima di farne un altro. Prima l'esito non si
  // guardava: se la cancellazione falliva (la rete che cade a metà) l'insert
  // dopo riusciva lo stesso, e in giro restavano due codici validi — proprio
  // quello che questa funzione esiste per evitare.
  const { error: vecchio } = await supabase.from('coach_invites').delete().eq('athlete_id', userId)
  if (vecchio) throw new Error(translateCoachError(vecchio.message))

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
  throw new Error(t('Non è stato possibile generare un codice. Riprova.'))
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

export interface CoachPubblico {
  user_id: string
  nome: string | null
  cognome: string | null
  foto: string | null
  focus: string | null
  bio: string | null
}

/** I coach dell'app, per chi ne cerca uno. Solo quello che raccontano del loro
 *  lavoro: il resto del profilo resta fra chi è collegato. */
export async function elencoCoach(): Promise<CoachPubblico[]> {
  const { data, error } = await supabase.rpc('elenco_coach')
  if (error) throw new Error(translateCoachError(error.message))
  return (data ?? []) as CoachPubblico[]
}

/** Riscatta un codice: da qui in poi vedo gli allenamenti di chi me l'ha dato. */
export async function redeemCode(code: string, coachName: string): Promise<{ athlete_id: string; athlete_name: string | null }> {
  const { data, error } = await supabase.rpc('redeem_coach_code', {
    p_code: code.trim().toUpperCase(),
    p_coach_name: coachName || null,
  })
  if (error) throw new Error(translateCoachError(error.message))
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error(t('Codice non valido o scaduto.'))
  return row as { athlete_id: string; athlete_name: string | null }
}

// Il sottoinsieme di stato che l'allenatore può leggere. NON è `JarvisState`:
// tema e preferenze non escono dal database — vedi il commento in
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
  const dati = (data as AthleteData | null) ?? null
  if (!dati?.palestraExercises) return dati
  // Lo stesso ritocco che l'app dell'allievo fa al caricamento: le alzate a
  // 0 kg degli esercizi a corpo libero prendono il loro segno. Il blob che
  // arriva da qui può essere di prima che lui riaprisse l'app, e senza questo
  // l'allenatore leggerebbe "0 kg" dove l'allievo legge "BW".
  return { ...dati, palestraExercises: dati.palestraExercises.map(e => conGruppo(conSegnoCorpoLibero(e))) }
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
  /** Quando la scheda è stata assegnata la prima volta. Non cambia modificandola
   *  o ricondividendola: è da qui che si contano le settimane dell'allievo. */
  created_at?: string
  updated_at: string
}

const CAMPI = 'id, coach_id, athlete_id, scheda, coach_name, created_at, updated_at'

// ── L'ordine delle schede ──────────────────────────────────────
// L'allenatore dà un numero alle schede di un allievo, e la home ne segue il giro
// (vedi `schedaDiOggi`). Il numero sta dentro la GymScheda e non in una colonna
// sua: così arriva all'allievo insieme alla scheda, anche nella copia che resta
// sul telefono. Il prezzo è che chi riscrive la riga deve rimettercelo: vedi
// `ordineDi`.

/** Le righe in ordine di numero. Quelle senza restano dopo, come sono arrivate. */
export function perOrdine(righe: CoachScheda[]): CoachScheda[] {
  const posto = (r: CoachScheda) => r.scheda.ordine ?? Number.MAX_SAFE_INTEGER
  return [...righe].sort((a, b) => posto(a) - posto(b))
}

/** Il numero di una scheda che si sta per scrivere. Quella che ce l'ha lo tiene:
 *  il form e la ricondivisione riscrivono la riga intera, e lo perderebbero. Una
 *  nuova va in fondo al giro, se l'allenatore i numeri li ha dati; altrimenti
 *  resta senza, e la home continua a fare da sé. */
export function ordineDi(righe: CoachScheda[], schedaId: string): number | undefined {
  const sua = righe.find(r => r.id === schedaId)?.scheda.ordine
  if (sua) return sua
  const numeri = righe.flatMap(r => r.scheda.ordine ?? [])
  return numeri.length ? Math.max(...numeri) + 1 : undefined
}

/** Mette la scheda al posto `numero` e rinumera tutte da 1: due schede col 2 non
 *  direbbero quale viene prima, e un buco resterebbe un buco. Le bozze restano
 *  fuori e in fondo: l'allievo non le vede, e il giro non deve contarle. */
export function numeraSchede(righe: CoachScheda[], id: string, numero: number): CoachScheda[] {
  const vere = perOrdine(righe.filter(r => !r.scheda.draft))
  const sua = vere.find(r => r.id === id)
  if (!sua) return righe
  const altre = vere.filter(r => r.id !== id)
  altre.splice(numero - 1, 0, sua)
  return [
    ...altre.map((r, i) => ({ ...r, scheda: { ...r.scheda, ordine: i + 1 } })),
    ...righe.filter(r => r.scheda.draft),
  ]
}

/** Le schede che QUESTO allenatore ha assegnato a QUESTO allievo. */
export async function schedeAssegnate(athleteId: string): Promise<CoachScheda[]> {
  const { data, error } = await supabase
    .from('coach_schede')
    .select(CAMPI)
    .eq('athlete_id', athleteId)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(translateCoachError(error.message))
  return perOrdine((data ?? []) as CoachScheda[])
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
  return perOrdine((data ?? []) as CoachScheda[])
}

// ── Le schede ricevute, anche senza rete ───────────────────────
// Le schede assegnate non stanno nel blob: si leggono dalla rete ogni volta. In
// palestra — che spesso è un seminterrato — voleva dire non trovare la scheda
// dell'allenatore proprio quando serviva, e non poter nemmeno riprendere un
// allenamento lasciato a metà su di essa. L'ultima lettura riuscita resta sul
// telefono, e si usa quando la rete non risponde.
//
// È una copia di sola lettura: quello che conta resta la tabella. Porta l'id di
// chi l'ha letta, e vale solo per lui.
const CHIAVE_RICEVUTE = 'jarvis-schede-ricevute-v1'
/** Detto a chi legge la copia (la home): è cambiata, va riletta. */
const EVENTO_RICEVUTE = 'jarvis-schede-ricevute'

export function ricordaSchedeRicevute(userId: string, righe: CoachScheda[]): void {
  writeStorage('local', CHIAVE_RICEVUTE, JSON.stringify({ userId, righe }))
  window.dispatchEvent(new Event(EVENTO_RICEVUTE))
}

/** Chiama `fn` ogni volta che la copia delle schede ricevute cambia. La home la
 *  legge una volta e poi resta montata sotto le altre pagine: senza questo, una
 *  scheda appena arrivata dall'allenatore non la vedeva finché non si
 *  riavviava l'app. Restituisce la funzione che smette di ascoltare. */
export function suSchedeRicevute(fn: () => void): () => void {
  window.addEventListener(EVENTO_RICEVUTE, fn)
  return () => window.removeEventListener(EVENTO_RICEVUTE, fn)
}

/** Rilegge le schede ricevute dalla rete e ne aggiorna la copia. Non fallisce:
 *  senza rete, o senza la tabella, resta la copia che c'era. */
export async function aggiornaSchedeRicevute(userId: string): Promise<void> {
  try {
    ricordaSchedeRicevute(userId, await schedeRicevute(userId))
  } catch { /* senza rete o senza tabella: resta quella di prima */ }
}

/** Le schede ricevute all'ultima lettura riuscita, se sono di questo utente. */
export function schedeRicevuteInCache(userId: string): CoachScheda[] {
  const raw = readStorage('local', CHIAVE_RICEVUTE)
  if (!raw) return []
  try {
    const c = JSON.parse(raw) as { userId?: string; righe?: CoachScheda[] }
    return c.userId === userId && Array.isArray(c.righe) ? c.righe : []
  } catch {
    return []
  }
}

/** Una scheda ricevuta, cercata per id nell'ultima lettura riuscita. Le bozze
 *  dell'allenatore no: sono lavoro suo lasciato a metà, non cose su cui
 *  allenarsi. */
export function schedaRicevutaInCache(userId: string, schedaId: string): import('@/store/useJarvisStore').GymScheda | undefined {
  return schedeRicevuteInCache(userId).find(r => r.scheda.id === schedaId && !r.scheda.draft)?.scheda
}

/** Al logout: sono dell'account, non del dispositivo. */
export function dimenticaSchedeRicevute(): void {
  removeStorage('local', CHIAVE_RICEVUTE)
}

/** Crea o aggiorna una scheda assegnata. L'id è quello della GymScheda: una
 *  scheda è una riga, e riscriverla non ne lascia in giro una copia vecchia.
 *
 *  Solo per una scheda NUOVA (o ricondivisa, vedi `condividiScheda`): una già
 *  assegnata passa da `aggiornaSchedaAssegnata`, che non la ricrea. */
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

// ── Le scritture che non toccano niente ────────────────────────
// Un UPDATE o un DELETE che la RLS non lascia passare non dà errore: non trova
// righe, e risponde "fatto" su zero righe. L'app lo prendeva per riuscito —
// "scheda eliminata", e la scheda ancora lì per l'allievo. Chiedendo indietro le
// righe toccate (`.select()`) lo zero si vede; resta da capire se la riga non
// c'è più (tolta dall'altro, o da un altro dispositivo) o se c'è ma non si
// poteva toccare. Lo dice una lettura: la SELECT la lascia vedere a entrambi
// anche a collegamento sciolto, modifica e cancellazione no.

/** La riga c'è ancora? Solo dopo una scrittura andata a vuoto. */
async function rigaRimasta(tabella: 'coach_schede' | 'coach_note', chiave: Record<string, string>): Promise<boolean> {
  let q = supabase.from(tabella).select('updated_at')
  for (const [k, v] of Object.entries(chiave)) q = q.eq(k, v)
  const { data, error } = await q
  if (error) throw new Error(translateCoachError(error.message))
  return (data ?? []).length > 0
}

// C'è ma la RLS non la lascia toccare: per chi l'ha scritta il motivo è uno
// solo, il collegamento che non c'è più (vedi le policy in coach_schema.sql).
const nonPiuCollegato = () => new Error(t('Non sei più collegato a questa persona: il collegamento è stato sciolto.'))

/** Riscrive una scheda GIÀ assegnata, e solo se c'è ancora. Prima passava anche
 *  lei dall'upsert, con la riga letta quando la pagina si era aperta: se nel
 *  frattempo l'allievo l'aveva tolta, ritoccarla la rimetteva in piedi — con la
 *  data di assegnazione di oggi. `false` = non c'è più, e non è stata ricreata. */
export async function aggiornaSchedaAssegnata(
  coachName: string,
  scheda: import('@/store/useJarvisStore').GymScheda,
): Promise<boolean> {
  const { data, error } = await supabase.from('coach_schede')
    .update({ scheda, coach_name: coachName || null, updated_at: new Date().toISOString() })
    .eq('id', scheda.id)
    .select('id')
  if (error) throw new Error(translateCoachError(error.message))
  if (data?.length) return true
  if (await rigaRimasta('coach_schede', { id: scheda.id })) throw nonPiuCollegato()
  return false
}

/** Dà il numero (vedi `numeraSchede`) e lo scrive, sulle righe rilette adesso.
 *  Prima si partiva dall'elenco a schermo, quello di quando la pagina si era
 *  aperta, e ogni riga rinumerata si riscriveva da lì per intero: tornava una
 *  scheda che l'allievo aveva tolto, e spariva il ritocco fatto da un altro
 *  dispositivo. Il numero sta dentro il JSON della scheda e non c'è modo di
 *  scrivere solo lui: della riga riletta cambia soltanto `ordine`.
 *
 *  Restituisce le righe come sono adesso; `sparita` se una non c'era più. */
export async function numeraSchedeAssegnate(
  athleteId: string, coachName: string, id: string, numero: number,
): Promise<{ righe: CoachScheda[]; sparita: boolean }> {
  const attuali = await schedeAssegnate(athleteId)
  if (!attuali.some(r => r.id === id)) return { righe: attuali, sparita: true }
  const nuove = numeraSchede(attuali, id, numero)
  const cambiate = nuove.filter(n => n.scheda.ordine !== attuali.find(a => a.id === n.id)?.scheda.ordine)
  const scritte = await Promise.all(cambiate.map(n => aggiornaSchedaAssegnata(coachName, n.scheda)))
  const via = new Set(cambiate.filter((_, i) => !scritte[i]).map(n => n.id))
  return { righe: nuove.filter(n => !via.has(n.id)), sparita: via.size > 0 }
}

export async function eliminaSchedaAssegnata(id: string): Promise<void> {
  const { data, error } = await supabase.from('coach_schede').delete().eq('id', id).select('id')
  if (error) throw new Error(translateCoachError(error.message))
  // Zero righe: già sparita va bene — era quello che si voleva —, ancora lì
  // vuol dire che non si poteva (vedi `rigaRimasta`).
  if (!data?.length && await rigaRimasta('coach_schede', { id })) throw nonPiuCollegato()
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
 *  io l'ALLENATORE, e me le ritroverei sui miei esercizi.
 *
 *  E solo di chi mi segue ANCORA, come per le correzioni (vedi CorrezioniBridge
 *  in App). Sciolto il collegamento, le note dell'ex restavano sui miei esercizi
 *  per sempre: io non ho un tasto per toglierle, e lui a rapporto chiuso non
 *  può più cancellarle. */
export async function noteRicevute(userId: string): Promise<NotaCoach[]> {
  const [note, coach] = await Promise.all([noteAllievo(userId), myCoaches(userId)])
  const legati = new Set(coach.map(l => l.coach_id))
  return note.filter(n => legati.has(n.coach_id))
}

/** Scrive la nota. Vuota = la cancella: un campo svuotato vuole dire “non ho più
 *  niente da dire qui”, e lasciare una riga vuota mostrerebbe all'allievo
 *  un'intestazione “dal tuo allenatore” senza niente sotto. */
export async function salvaNotaCoach(
  coachId: string, athleteId: string, exerciseId: string, coachName: string, nota: string,
): Promise<void> {
  const testo = nota.trim()
  if (!testo) {
    const chiave = { coach_id: coachId, athlete_id: athleteId, exercise_id: exerciseId }
    const { data, error } = await supabase.from('coach_note').delete()
      .eq('coach_id', coachId).eq('athlete_id', athleteId).eq('exercise_id', exerciseId)
      .select('exercise_id')
    if (error) throw new Error(translateCoachError(error.message))
    // Zero righe: vedi `rigaRimasta`, come per le schede.
    if (!data?.length && await rigaRimasta('coach_note', chiave)) throw nonPiuCollegato()
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
  // Un allenatore per volta (vedi redeem_coach_code): chi vuole cambiarlo si
  // scollega prima da quello che ha.
  if (m.includes('GIA_SEGUITO')) return t('Questa persona ha già un coach: deve prima scollegarsi da quello.')
  if (m.includes('NON_COACH')) return t('Solo un coach può seguire qualcuno.')
  // Dieci codici sbagliati in un'ora (vedi redeem_coach_code).
  if (m.includes('TROPPI_TENTATIVI')) return t('Troppi codici sbagliati: riprova fra un’ora.')
  // I tetti di lunghezza del database (vedi coach_schema.sql).
  if (m.includes('MESSAGGI_LUNGHEZZE') || m.includes('NOTE_LUNGHEZZE')) return t('Il testo è troppo lungo.')
  if (m.includes('NON_AUTENTICATO')) return t('Sessione scaduta. Esci e rientra.')
  // La rete: una richiesta lasciata cadere perché non rispondeva (vedi
  // `authedFetch`) o rifiutata dal browser. Prima arrivava a schermo il testo
  // grezzo dell'errore, in inglese.
  if (m.includes('ABORTERROR') || m.includes('ACCESSO NON RINNOVATO') || m.includes('FAILED TO FETCH') || m.includes('NETWORKERROR') || m.includes('LOAD FAILED')) {
    return t('La rete non risponde. Riprova fra poco.')
  }
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

// ── Condividere una propria scheda con chi si allena ───────────
// Chi allena qualcuno scrive spesso la stessa scheda due volte: una per sé nelle
// "Schede d'allenamento", una per l'allievo dalla sua scheda personale. Questo
// la copia di là.
//
// ── Perché una COPIA e non la stessa riga ──────────────────────
// La scheda condivisa vive in `coach_schede`, dove la chiave primaria è l'id
// della GymScheda. Riusare l'id della mia scheda funzionerebbe per il primo
// allievo e romperebbe al secondo: stessa chiave, riga sovrascritta, e il primo
// si ritroverebbe la scheda sparita senza che nessuno l'abbia toccata.
//
// L'id della copia è derivato e non casuale, così ricondividere la stessa scheda
// alla stessa persona AGGIORNA la sua invece di affiancargliene una seconda —
// che è quello che ci si aspetta dopo aver corretto un carico.

/** L'id della copia che riceve questo allievo. Deterministico di proposito. */
export function idSchedaCondivisa(schedaId: string, athleteId: string): string {
  return `${schedaId}~${athleteId.slice(0, 8)}`
}

/** La scheda come la riceverà questo allievo. Pura: costruisce e basta. */
export function copiaPerAllievo(
  scheda: import('@/store/useJarvisStore').GymScheda,
  athleteId: string,
  ora = new Date().toISOString(),
): import('@/store/useJarvisStore').GymScheda {
  const copia = {
    ...scheda,
    id: idSchedaCondivisa(scheda.id, athleteId),
    createdAt: ora,
    updatedAt: ora,
    // I collegamenti agli esercizi puntano a id del MIO archivio, che nel suo non
    // esistono. Portarseli dietro non romperebbe niente — l'app ricade sul nome —
    // ma sarebbero riferimenti a cose che non ci sono, e prima o poi qualcuno li
    // leggerebbe come veri. Il nome è l'unica cosa che i due archivi condividono.
    exercises: scheda.exercises.map(e => {
      const riga = { ...e }
      delete riga.linkedExerciseId
      return riga
    }),
  }
  // Una bozza è una scheda lasciata a metà per non perdere il lavoro: chi la
  // riceve non la vedrebbe nemmeno (l'elenco delle assegnate le filtra via).
  delete copia.draft
  // Il numero è il posto in un altro elenco: lo dà `condividiScheda`.
  delete copia.ordine
  return copia
}

/** Copia una propria scheda nell'elenco di chi si allena con noi. */
export async function condividiScheda(
  coachId: string, athleteId: string, coachName: string,
  scheda: import('@/store/useJarvisStore').GymScheda,
): Promise<void> {
  const copia = copiaPerAllievo(scheda, athleteId)
  const ordine = ordineDi(await schedeAssegnate(athleteId), copia.id)
  await salvaSchedaAssegnata(coachId, athleteId, coachName, { ...copia, ordine })
}

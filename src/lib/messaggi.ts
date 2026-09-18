// Le richieste su una scheda condivisa: il livello che parla con Supabase.
// Le regole vere stanno nel database (supabase/coach_schema.sql, in fondo).
//
// A cosa serve: una scheda assegnata l'allievo non può riscriverla — è il lavoro
// dell'allenatore, e due versioni diverse della stessa scheda sono il modo più
// veloce per allenarsi su cose diverse senza saperlo. Ma su una riga si ha da
// dire: "questo non so farlo", "la macchina è occupata, cosa metto al posto".
// Qui quella domanda resta ATTACCATA all'esercizio di cui parla, e la risposta
// torna nello stesso punto.
//
// Chi apre la conversazione è sempre l'allievo (dalla scheda, col punto
// interrogativo in testata); l'allenatore risponde dai suoi messaggi.
import { supabase } from './supabase'
import { translateCoachError } from './coach'
import { uid } from './uid'

/** Cosa sta chiedendo il messaggio. Non è cosmesi: dà all'elenco
 *  dell'allenatore la forma di una lista di cose da fare invece che di una chat
 *  in cui tutto pesa uguale. */
export type TipoMessaggio = 'info' | 'sostituzione' | 'risposta'

export interface Messaggio {
  id: string
  scheda_id: string
  scheda_titolo: string | null
  coach_id: string
  athlete_id: string
  /** Chi ha scritto: è `coach_id` o `athlete_id`, mai altro (vincolo in tabella). */
  autore: string
  autore_nome: string | null
  /** L'esercizio a cui si riferisce. `null` = domanda sulla scheda intera. */
  esercizio_id: string | null
  esercizio_nome: string | null
  tipo: TipoMessaggio
  testo: string
  letto_coach: boolean
  letto_atleta: boolean
  created_at: string
}

/** Quello che serve per scrivere un messaggio nuovo. Il resto (id, data, spunte
 *  di lettura) lo mette `creaMessaggio`. */
export type BozzaMessaggio = Omit<Messaggio, 'id' | 'created_at' | 'letto_coach' | 'letto_atleta'>

// Su una riga sola e senza concatenazioni: postgrest-js legge questa stringa
// come tipo letterale per dedurre la forma del risultato, e un `+` la riduce a
// `string` — da lì in poi `data` non è più tipizzabile come Messaggio[].
const CAMPI = 'id, scheda_id, scheda_titolo, coach_id, athlete_id, autore, autore_nome, esercizio_id, esercizio_nome, tipo, testo, letto_coach, letto_atleta, created_at'

/** Tutti i messaggi in cui sono una delle due parti, dal più vecchio al più
 *  recente (una conversazione si legge nell'ordine in cui è successa).
 *
 *  Non c'è un filtro su di me nella query: la RLS lascia passare solo le righe
 *  in cui sono allenatore o allievo, e qui — a differenza di `schedeRicevute` —
 *  le VOGLIO tutte e due, perché chi allena qualcuno ed è a sua volta seguito ha
 *  conversazioni aperte da entrambi i lati e le vede nello stesso posto. */
export async function messaggiDiUtente(): Promise<Messaggio[]> {
  const { data, error } = await supabase
    .from('coach_messaggi')
    .select(CAMPI)
    .order('created_at', { ascending: true })
  if (error) throw new Error(translateCoachError(error.message))
  return (data ?? []) as Messaggio[]
}

/** Costruisce il messaggio completo. Pura: serve anche all'eco immediata in
 *  locale, che deve mostrare ESATTAMENTE la riga che sta partendo. */
export function creaMessaggio(bozza: BozzaMessaggio, ora = new Date().toISOString()): Messaggio {
  return {
    ...bozza,
    id: uid('ms'),
    created_at: ora,
    // Chi scrive ha letto il proprio messaggio per definizione: senza questo,
    // l'autore si vedrebbe accendere il badge rosso da solo.
    letto_coach: bozza.autore === bozza.coach_id,
    letto_atleta: bozza.autore === bozza.athlete_id,
  }
}

export async function salvaMessaggio(m: Messaggio): Promise<void> {
  const { error } = await supabase.from('coach_messaggi').insert(m)
  if (error) throw new Error(translateCoachError(error.message))
}

/** Mette la spunta di letto sui messaggi indicati, dal lato giusto.
 *
 *  `ruolo` è il MIO ruolo in quelle righe, e va deciso riga per riga da chi
 *  chiama: la stessa persona è allenatore in una conversazione e allievo in
 *  un'altra, e una spunta messa dal lato sbagliato lascia il badge acceso per
 *  sempre su un messaggio che si è appena letto. */
export async function segnaLetti(ids: string[], ruolo: 'coach' | 'atleta'): Promise<void> {
  if (ids.length === 0) return
  const campo = ruolo === 'coach' ? 'letto_coach' : 'letto_atleta'
  const { error } = await supabase
    .from('coach_messaggi')
    .update({ [campo]: true })
    .in('id', ids)
  if (error) throw new Error(translateCoachError(error.message))
}

export async function eliminaMessaggio(id: string): Promise<void> {
  const { error } = await supabase.from('coach_messaggi').delete().eq('id', id)
  if (error) throw new Error(translateCoachError(error.message))
}

// ── Letture pure sopra l'elenco ────────────────────────────────
// Stanno qui e non nei componenti perché sono le regole che decidono se il badge
// rosso si accende, ed è la cosa di questa funzione che un test deve poter
// leggere senza montare mezza app.

/** Il mio ruolo in questa riga. */
export function ruoloIn(m: Messaggio, userId: string): 'coach' | 'atleta' | null {
  if (m.coach_id === userId) return 'coach'
  if (m.athlete_id === userId) return 'atleta'
  return null
}

/** L'ho già letto? Un messaggio scritto da me conta sempre come letto. */
export function letto(m: Messaggio, userId: string): boolean {
  if (m.autore === userId) return true
  const ruolo = ruoloIn(m, userId)
  if (!ruolo) return true
  return ruolo === 'coach' ? m.letto_coach : m.letto_atleta
}

/** Quelli che devo ancora leggere io. È il numero del badge rosso. */
export function nonLetti(messaggi: Messaggio[], userId: string): Messaggio[] {
  return messaggi.filter(m => !letto(m, userId))
}

/** Una conversazione: una scheda, una controparte, i messaggi in ordine. */
export interface Conversazione {
  /** La chiave: una scheda condivisa è un filo solo, anche se le domande sono
   *  su esercizi diversi. */
  schedaId: string
  schedaTitolo: string
  coachId: string
  athleteId: string
  /** Chi c'è dall'altra parte, dal mio punto di vista. */
  controparte: string
  /** Sono io l'allenatore in questa conversazione? */
  sonoCoach: boolean
  messaggi: Messaggio[]
  daLeggere: number
  ultimo: Messaggio
}

/** Raggruppa i messaggi per scheda, dal filo aggiornato più di recente.
 *
 *  L'ordine è quello: una conversazione a cui è appena arrivata una domanda deve
 *  stare in cima, non dove stava quando è nata. */
export function conversazioni(messaggi: Messaggio[], userId: string): Conversazione[] {
  const per = new Map<string, Messaggio[]>()
  for (const m of messaggi) {
    if (!ruoloIn(m, userId)) continue
    const lista = per.get(m.scheda_id)
    if (lista) lista.push(m)
    else per.set(m.scheda_id, [m])
  }
  const out: Conversazione[] = []
  for (const [schedaId, righe] of per) {
    const ordinati = [...righe].sort((a, b) => a.created_at.localeCompare(b.created_at))
    const ultimo = ordinati[ordinati.length - 1]
    const sonoCoach = ruoloIn(ultimo, userId) === 'coach'
    // Il nome della controparte si pesca dal messaggio che LEI ha scritto: il
    // proprio nome ce lo mette chi scrive, e nessuno dei due conosce l'anagrafica
    // dell'altro (è esattamente il permesso che coach_schema non concede).
    const suo = ordinati.find(m => m.autore !== userId)
    out.push({
      schedaId,
      schedaTitolo: ordinati.find(m => m.scheda_titolo)?.scheda_titolo ?? '',
      coachId: ultimo.coach_id,
      athleteId: ultimo.athlete_id,
      controparte: suo?.autore_nome?.trim() ?? '',
      sonoCoach,
      messaggi: ordinati,
      daLeggere: nonLetti(ordinati, userId).length,
      ultimo,
    })
  }
  return out.sort((a, b) => b.ultimo.created_at.localeCompare(a.ultimo.created_at))
}

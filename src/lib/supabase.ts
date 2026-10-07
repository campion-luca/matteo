import { AuthClient, isAuthRetryableFetchError } from '@supabase/auth-js'
import type { Session } from '@supabase/auth-js'
import { PostgrestClient } from '@supabase/postgrest-js'

// Il client è assemblato a mano invece di usare `createClient` di
// @supabase/supabase-js. Quel pacchetto tira dentro anche realtime, storage e
// functions — che qui non si usano da nessuna parte — e pesa 52.8 kB gzip
// contro i 27 di auth-js + postgrest-js: metà del chunk d'ingresso dell'app.
//
// In cambio i default vanno replicati a mano. Sono copiati da SupabaseClient
// (@supabase/supabase-js 2.107.0), non scelti: cambiarne uno significa
// cambiare comportamento rispetto a prima.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase env vars: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set'
  )
}

const baseUrl = new URL(supabaseUrl)

// Stessa chiave con cui supabase-js salvava la sessione in localStorage. Se
// cambiasse, ogni sessione già salvata diventerebbe invisibile e tutti si
// ritroverebbero al login.
export const storageKey = `sb-${baseUrl.hostname.split('.')[0]}-auth-token`

// ── La sessione com'è scritta sul telefono ─────────────────────
// `auth.getSession()` non è una lettura: se l'accesso è scaduto (dura un'ora)
// prova a rinnovarlo, e senza rete ci mette mezzo minuto prima di arrendersi e
// rispondere "nessuna sessione". Per chi apre l'app nel seminterrato della
// palestra voleva dire uno schermo nero e poi la pagina di login, con tutti i
// suoi dati lì sul telefono.
//
// Questa invece legge e basta: la sessione salvata, anche scaduta. Dice CHI era
// entrato su questo telefono — che è quello che serve per mostrargli i suoi dati
// locali — e non autorizza niente: a ogni richiesta al server il token lo
// controlla il server, e uno scaduto viene rinnovato o rifiutato come sempre.
export function sessioneSuDisco(): Session | null {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const s = JSON.parse(raw) as Partial<Session> | null
    return s && typeof s.access_token === 'string' && typeof s.user?.id === 'string' ? (s as Session) : null
  } catch {
    return null
  }
}

/** L'id di chi è entrato su questo telefono, senza aspettare la rete. */
export function idUtenteSuDisco(): string | null {
  return sessioneSuDisco()?.user.id ?? null
}

/** Il rinnovo dell'accesso è fallito per la RETE (e non perché l'accesso è
 *  stato revocato)? Solo nel primo caso si resta dentro con i dati locali. */
export const erroreDiRete = isAuthRetryableFetchError

export const auth = new AuthClient({
  url: new URL('auth/v1', baseUrl).href,
  headers: { Authorization: `Bearer ${supabaseKey}`, apikey: supabaseKey },
  storageKey,
  autoRefreshToken: true,
  persistSession: true,
  // Serve al link di recupero password: il token arriva nel frammento dell'URL.
  detectSessionInUrl: true,
  flowType: 'implicit',
})

// PostgREST deve parlare con il token dell'UTENTE, non con la chiave pubblica:
// è quello che le policy RLS leggono per capire chi sta chiedendo. Il token si
// rilegge a ogni richiesta perché il refresh automatico lo sostituisce mentre
// l'app è aperta. Senza sessione si ricade sulla chiave pubblica, esattamente
// come faceva `_getAccessToken` di supabase-js.
//
// ── Quanto si aspetta il token ─────────────────────────────────
// Leggere il token può voler dire rinnovarlo, e il rinnovo non ha una scadenza
// sua: con la rete che pende restava appeso fino a mezzo minuto, FUORI dai limiti
// che chi chiama mette sulla richiesta (sei secondi per leggere, quindici per
// salvare) — che cominciavano a contare solo dopo. Qui ha un limite suo, e
// allo scadere la richiesta fallisce come un errore di rete qualunque: chi
// chiama tiene il dato locale e riprova.
//
// E se il rinnovo fallisce per la rete NON si ricade sulla chiave pubblica: con
// quella il server risponde "nessuna riga" invece di un errore, e l'app lo
// leggeva come "utente nuovo".
const ATTESA_TOKEN_MS = 5000

// L'errore con cui si rinuncia ad aspettare il token porta il nome di una
// richiesta ANNULLATA, non di una fallita. Non è una finezza: il client REST
// riprova da sé le letture fallite (tre volte, con le attese in mezzo), e
// trattandolo da errore qualunque i cinque secondi diventavano mezzo minuto. Un
// annullamento invece lo lascia stare — a riprovare ci pensa chi ha chiamato.
function attesaInterrotta(): Error {
  const e = new Error('accesso non rinnovato in tempo')
  e.name = 'AbortError'
  return e
}

const authedFetch: typeof fetch = async (input, init) => {
  const segnale = init?.signal ?? undefined
  const { data, error } = await new Promise<Awaited<ReturnType<typeof auth.getSession>>>((si, no) => {
    const fine = () => { clearTimeout(scaduta); segnale?.removeEventListener('abort', interrotta) }
    const interrotta = () => { fine(); no(attesaInterrotta()) }
    const scaduta = setTimeout(interrotta, ATTESA_TOKEN_MS)
    // Anche il limite di chi chiama vale già qui, non solo sulla richiesta vera.
    if (segnale?.aborted) { interrotta(); return }
    segnale?.addEventListener('abort', interrotta, { once: true })
    auth.getSession().then(r => { fine(); si(r) }, e => { fine(); no(e) })
  })
  if (!data.session && error && isAuthRetryableFetchError(error)) throw attesaInterrotta()
  const token = data.session?.access_token ?? supabaseKey
  const headers = new Headers(init?.headers)
  if (!headers.has('apikey')) headers.set('apikey', supabaseKey)
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}

const rest = new PostgrestClient(new URL('rest/v1', baseUrl).href, {
  schema: 'public',
  fetch: authedFetch,
})

// Superficie identica a quella che il resto dell'app già usava (`supabase.auth`
// e `supabase.from`), così i punti di chiamata non cambiano.
//
// `rpc` si è aggiunto col collegamento allenatore ⇄ atleta: due operazioni lì
// devono girare come SECURITY DEFINER nel database (riscattare un codice altrui,
// leggere il sottoinsieme di dati di un allievo) e non esistono come tabella.
export const supabase = {
  auth,
  from: rest.from.bind(rest),
  rpc: rest.rpc.bind(rest),
}

/** Chiama una Edge Function col token dell'utente. È tutto quello che serve di
 *  `functions-js` — una POST — e non vale il pacchetto intero: le funzioni qui
 *  sono una sola (l'invio delle notifiche push, vedi lib/push.ts). */
export function chiamaFunzione(nome: string, corpo: unknown): Promise<Response> {
  return authedFetch(new URL(`functions/v1/${nome}`, baseUrl).href, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
}

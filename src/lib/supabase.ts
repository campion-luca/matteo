import { AuthClient } from '@supabase/auth-js'
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
const storageKey = `sb-${baseUrl.hostname.split('.')[0]}-auth-token`

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
const authedFetch: typeof fetch = async (input, init) => {
  const { data } = await auth.getSession()
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

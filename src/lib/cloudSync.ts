import { supabase } from './supabase'
import type { JarvisState } from '@/store/useJarvisStore'

// ── Quanto si aspetta una risposta ─────────────────────────────
// Senza un limite, una rete che PENDE invece di rifiutare — portale captive
// dell'hotel, DNS che non risponde, 4G che prende una tacca — lascia l'app sullo
// scheletro per sempre: `cloudLoading` non torna mai false perché la promise non
// si risolve né fallisce. Misurato senza rete: 7,5 secondi di scheletro prima che
// il client Supabase si arrendesse da solo.
//
// Sei secondi sono scelti così: stanno sopra un caricamento lento ma vero (il
// blob cresce con lo storico e su una rete scarsa può metterci qualche secondo) e
// sotto la soglia oltre la quale si smette di aspettare e si pensa che l'app sia
// rotta. Scadere non è un guasto: chi chiama tiene il dato locale e mostra la
// pill "tocca per riprovare" — che è già il percorso dell'errore di rete.
const ATTESA_MS = 6000

function scadenza(ms = ATTESA_MS): { signal: AbortSignal; fine: () => void } {
  // `AbortController` a mano e non `AbortSignal.timeout`: quest'ultimo manca su
  // iOS sotto la 16, che per una PWA da palestra è ancora un telefono in giro.
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), ms)
  return { signal: ac.signal, fine: () => clearTimeout(t) }
}

/** Il browser sa già di NON avere rete? Allora non vale nemmeno la pena provare.
 *  `onLine: true` non garantisce che internet funzioni — `false` invece è
 *  affidabile, ed è l'unico modo di rendere istantaneo il caso "sono in palestra
 *  nel seminterrato" invece di farlo aspettare il timeout. */
export function senzaRete(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export interface LoadResult {
  data: Partial<JarvisState>
  updatedAt: string | null
}

export async function loadUserData(userId: string): Promise<LoadResult | null> {
  const { signal, fine } = scadenza()
  // `try/finally` e non `.finally()`: il builder di PostgREST è "thenable", non
  // una Promise vera, e non espone `.finally`. Il timer va spento comunque, o
  // resta acceso fino alla scadenza anche quando la risposta è già arrivata.
  let data, error
  try {
    ({ data, error } = await supabase
      .from('user_data')
      .select('data, updated_at')
      .eq('user_id', userId)
      .abortSignal(signal)
      .maybeSingle())
  } finally { fine() }
  if (error) throw error          // errore rete/server: NON confonderlo con "nessun dato"
  if (!data) return null          // nessuna riga ancora (utente nuovo) → tieni lo stato locale
  return { data: data.data as Partial<JarvisState>, updatedAt: data.updated_at ?? null }
}

// Legge solo il timestamp della riga remota, senza scaricare il blob:
// serve al bridge per capire se un altro dispositivo ha salvato più di recente.
export async function fetchRemoteUpdatedAt(userId: string): Promise<string | null> {
  const { signal, fine } = scadenza()
  let data, error
  try {
    ({ data, error } = await supabase
      .from('user_data')
      .select('updated_at')
      .eq('user_id', userId)
      .abortSignal(signal)
      .maybeSingle())
  } finally { fine() }
  if (error) throw error
  return data?.updated_at ?? null
}

// Salva lo stato e restituisce l'`updated_at` scritto. Lancia in caso di errore
// (rete, sessione scaduta, RLS): nessun salvataggio può fallire in silenzio.
export async function saveUserData(userId: string, state: JarvisState): Promise<string> {
  const { data, error } = await supabase
    .from('user_data')
    .upsert(
      { user_id: userId, data: state, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select('updated_at')
    .single()
  if (error) throw error
  return data.updated_at as string
}

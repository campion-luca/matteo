// Edge Function `notifica` — manda la notifica push di un messaggio.
//
// La chiama l'app di chi ha appena scritto (src/lib/push.ts → notificaPush),
// con l'id del messaggio. Qui si controlla che il messaggio sia davvero suo, si
// trovano i dispositivi dell'ALTRA persona e si spedisce.
//
// ── Cosa NON si fida di chi chiama ─────────────────────────────
// Dal client arriva solo un id. Titolo, testo e destinatario si leggono dal
// database: se si prendessero dalla richiesta, chiunque abbia un account
// potrebbe mandare una notifica con un testo qualsiasi a chiunque altro.
// E il messaggio deve essere scritto da chi chiama — altrimenti basterebbe
// conoscere un id per far ripartire le notifiche degli altri.
//
// ── Da configurare (una volta) ─────────────────────────────────
// Secret della funzione, in Supabase → Edge Functions → Secrets:
//   VAPID_PUBLIC_KEY   la stessa di VITE_VAPID_PUBLIC_KEY nell'app
//   VAPID_PRIVATE_KEY  la sua metà privata: sta SOLO qui
//   VAPID_SUBJECT      un contatto, es. mailto:tu@esempio.it
// La coppia si genera con `npx web-push generate-vapid-keys`.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY li mette Supabase da sé.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const risposta = (stato: number, corpo: Record<string, unknown>) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: { ...CORS, 'Content-Type': 'application/json' } })

const taglia = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

interface Messaggio {
  id: string
  scheda_id: string
  scheda_titolo: string | null
  coach_id: string
  athlete_id: string
  autore: string
  autore_nome: string | null
  esercizio_nome: string | null
  tipo: string
  testo: string
}

/** Cosa si legge nella notifica. Il titolo è chi scrive; il testo è il
 *  messaggio, con davanti di cosa parla quando è una richiesta su una scheda. */
function contenuto(m: Messaggio) {
  const suScheda = m.tipo === 'info' || m.tipo === 'sostituzione'
  const soggetto = suScheda ? (m.esercizio_nome ?? m.scheda_titolo) : null
  return {
    title: m.autore_nome?.trim() || 'Matteo',
    body: taglia(soggetto ? `${soggetto}: ${m.testo}` : m.testo, 180),
    // Un filo, una notifica: i messaggi successivi la aggiornano.
    tag: m.scheda_id,
    url: '/?apri=messaggi',
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return risposta(405, { errore: 'solo POST' })

  try {
    const pubblica = Deno.env.get('VAPID_PUBLIC_KEY')
    const privata = Deno.env.get('VAPID_PRIVATE_KEY')
    const soggetto = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'
    if (!pubblica || !privata) return risposta(500, { errore: 'chiavi VAPID mancanti nei secret' })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Chi sta chiamando: il token è quello della sua sessione nell'app.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: chi, error: nonValido } = await admin.auth.getUser(token)
    if (nonValido || !chi.user) return risposta(401, { errore: 'sessione non valida' })

    const { messaggio_id } = await req.json().catch(() => ({}))
    if (typeof messaggio_id !== 'string' || !messaggio_id) return risposta(400, { errore: 'manca messaggio_id' })

    const { data: m } = await admin
      .from('coach_messaggi')
      .select('id, scheda_id, scheda_titolo, coach_id, athlete_id, autore, autore_nome, esercizio_nome, tipo, testo')
      .eq('id', messaggio_id)
      .maybeSingle<Messaggio>()
    if (!m) return risposta(404, { errore: 'messaggio non trovato' })
    if (m.autore !== chi.user.id) return risposta(403, { errore: 'il messaggio non è tuo' })

    const destinatario = m.autore === m.coach_id ? m.athlete_id : m.coach_id
    const { data: iscrizioni } = await admin
      .from('push_iscrizioni')
      .select('endpoint, p256dh, auth')
      .eq('user_id', destinatario)
    if (!iscrizioni?.length) return risposta(200, { inviate: 0, motivo: 'nessun dispositivo iscritto' })

    webpush.setVapidDetails(soggetto, pubblica, privata)
    const carico = JSON.stringify(contenuto(m))
    const esiti = await Promise.allSettled(iscrizioni.map(i =>
      webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, carico, { TTL: 60 * 60 * 24 }),
    ))

    // Un dispositivo che risponde 404 o 410 non esiste più (app disinstallata,
    // permesso tolto): la sua riga si cancella, o ogni messaggio continuerebbe a
    // bussare a una porta murata.
    const morte = iscrizioni
      .filter((_, k) => {
        const e = esiti[k]
        const stato = e.status === 'rejected' ? (e.reason as { statusCode?: number })?.statusCode : undefined
        return stato === 404 || stato === 410
      })
      .map(i => i.endpoint)
    if (morte.length) await admin.from('push_iscrizioni').delete().in('endpoint', morte)

    return risposta(200, { inviate: esiti.filter(e => e.status === 'fulfilled').length, tolte: morte.length })
  } catch (e) {
    return risposta(500, { errore: e instanceof Error ? e.message : String(e) })
  }
})

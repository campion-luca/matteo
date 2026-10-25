// Il profilo di ognuno: nome, cognome, foto, età e quello che racconta di sé.
// Le regole stanno nel database (supabase/profili_schema.sql): lo vede chi è
// collegato a me in uno dei due versi, lo scrivo solo io.
//
// Non sta nel blob dello stato. Il blob lo legge solo il suo titolare, e l'app
// lo rimanda per intero a ogni salvataggio: una foto lì dentro partirebbe a ogni
// serie spuntata. Qui si scrive quando cambia e si legge quando serve.
//
// ── Le foto restano sul telefono ───────────────────────────────
// I profili letti si tengono in memoria e sul disco, foto comprese: aprendo il
// Coaching le facce ci sono subito, anche senza rete. Al server si chiede tutto
// TRANNE le foto, e poi solo le foto cambiate (lo dice `foto_agg`, che decide il
// server): chi segue trenta persone non se ne riscarica trenta a ogni apertura.
import { create } from 'zustand'
import { supabase, idUtenteSuDisco } from './supabase'
import { translateCoachError } from './coach'
import { readStorage, writeStorage, removeStorage } from './safeStorage'

/** Quello che la persona racconta di sé. Un documento e non colonne: è la parte
 *  del profilo che cambierà, e un campo nuovo qui non chiede di toccare il
 *  database. Tutto facoltativo: un profilo mezzo vuoto è un profilo normale. */
export interface DettagliProfilo {
  /** Allena altre persone: il profilo mostra formazione ed esperienze. */
  pt?: boolean
  /** L'anno in cui ha cominciato ad allenarsi. Un anno e non "da quanti anni":
   *  così il numero cresce da solo, senza che nessuno torni a correggerlo. */
  dal?: number
  /** I focus principali, separati da virgole: "ipertrofia, forza, Hyrox". */
  focus?: string
  bio?: string
  obiettivi?: string
  /** Da dove arriva: sport fatti, pause, come è arrivato fin qui. */
  percorso?: string
  /** Infortuni, dolori, cose da evitare. È la prima cosa che un coach nuovo
   *  deve sapere, e quella che di solito si dimentica di chiedere. */
  limitazioni?: string
  /** Solo per chi allena. */
  curriculum?: string
  esperienze?: string
}

export interface Profilo {
  user_id: string
  nome: string | null
  cognome: string | null
  /** Data URL di un quadrato già piccolo (vedi fotoProfilo.ts). */
  foto: string | null
  /** Quando è cambiata la foto. Lo scrive il server. */
  foto_agg: string | null
  nascita: string | null
  eta: number | null
  dettagli: DettagliProfilo
  updated_at: string
}

// Su una riga sola e senza concatenazioni (vedi il commento in lib/messaggi).
const CAMPI_SENZA_FOTO = 'user_id, nome, cognome, foto_agg, nascita, eta, dettagli, updated_at'

// ── Quello che si sa già ───────────────────────────────────────
const CHIAVE = 'jarvis-profili-v1'

interface StatoProfili {
  /** Di chi è questa copia: chi entra dopo sullo stesso telefono non eredita le
   *  facce di chi seguiva l'altro. */
  owner: string | null
  profili: Record<string, Profilo>
}

function dalDisco(): StatoProfili {
  const io = idUtenteSuDisco()
  const raw = io ? readStorage('local', CHIAVE) : null
  if (!raw) return { owner: io, profili: {} }
  try {
    const c = JSON.parse(raw) as Partial<StatoProfili>
    return c.owner === io && c.profili && typeof c.profili === 'object'
      ? { owner: io, profili: c.profili }
      : { owner: io, profili: {} }
  } catch {
    return { owner: io, profili: {} }
  }
}

export const useProfiliStore = create<StatoProfili>(() => dalDisco())

/** Aggiunge (o toglie) profili da quelli noti, in memoria e sul disco. */
function ricorda(nuovi: Profilo[], tolti: string[] = []): void {
  const io = idUtenteSuDisco()
  const st = useProfiliStore.getState()
  const profili = { ...(st.owner === io ? st.profili : {}) }
  for (const id of tolti) delete profili[id]
  for (const p of nuovi) profili[p.user_id] = p
  useProfiliStore.setState({ owner: io, profili })
  if (io) writeStorage('local', CHIAVE, JSON.stringify({ owner: io, profili }))
}

/** Tiene sul telefono solo i profili di queste persone (e il mio): le altre
 *  sono collegamenti sciolti. `leggiProfili` dimentica chi le si chiede e non
 *  torna, ma a chi si è scollegato nessuno la chiede più — e foto, nome,
 *  data di nascita e infortuni dell'ex restavano qui, e nella Chat. */
export function tieniSoloProfili(ids: string[], io: string): void {
  const vivi = new Set([...ids, io])
  const tolti = Object.keys(useProfiliStore.getState().profili).filter(id => !vivi.has(id))
  if (tolti.length) ricorda([], tolti)
}

/** Al logout e al cambio d'account: sono dell'account, non del telefono. */
export function dimenticaProfili(): void {
  removeStorage('local', CHIAVE)
  useProfiliStore.setState({ owner: null, profili: {} })
}

/** Il profilo di una persona, se lo si conosce. Si aggiorna da solo quando
 *  `leggiProfili` ne porta uno nuovo. */
export function useProfilo(id: string | null | undefined): Profilo | undefined {
  return useProfiliStore(s => (id ? s.profili[id] : undefined))
}

// ── Il server ──────────────────────────────────────────────────
type RigaSenzaFoto = Omit<Profilo, 'foto'>

/** Rilegge dal server i profili di queste persone e li mette fra quelli noti.
 *
 *  Chi non torna indietro non si vede più — collegamento sciolto, o profilo
 *  mai compilato — e se ne dimentica anche la copia sul telefono: la faccia di
 *  chi ho scollegato non deve restare nel mio elenco. */
export async function leggiProfili(ids: string[]): Promise<Record<string, Profilo>> {
  const chi = [...new Set(ids.filter(Boolean))]
  if (!chi.length) return {}
  const { data, error } = await supabase.from('profili').select(CAMPI_SENZA_FOTO).in('user_id', chi)
  if (error) throw new Error(translateCoachError(error.message))
  const righe = (data ?? []) as RigaSenzaFoto[]

  const noti = useProfiliStore.getState().profili
  const daScaricare = righe
    .filter(r => r.foto_agg && (noti[r.user_id]?.foto_agg !== r.foto_agg || !noti[r.user_id]?.foto))
    .map(r => r.user_id)
  const foto = new Map<string, string | null>()
  if (daScaricare.length) {
    const { data: f, error: e } = await supabase.from('profili').select('user_id, foto').in('user_id', daScaricare)
    if (e) throw new Error(translateCoachError(e.message))
    for (const r of (f ?? []) as Array<{ user_id: string; foto: string | null }>) foto.set(r.user_id, r.foto)
  }

  const completi: Profilo[] = righe.map(r => {
    const prima = noti[r.user_id]
    // Una foto che doveva arrivare e non è arrivata: si tiene quella di prima
    // E la sua data, così al prossimo giro la si richiede.
    const arrivata = foto.has(r.user_id)
    return {
      ...r,
      dettagli: r.dettagli ?? {},
      foto: !r.foto_agg ? null : arrivata ? foto.get(r.user_id) ?? null : prima?.foto ?? null,
      foto_agg: !r.foto_agg || arrivata || !daScaricare.includes(r.user_id) ? r.foto_agg : prima?.foto_agg ?? null,
    }
  })
  const trovati = new Set(completi.map(p => p.user_id))
  ricorda(completi, chi.filter(id => !trovati.has(id)))
  return Object.fromEntries(completi.map(p => [p.user_id, p]))
}

export type CampiProfilo = Partial<Pick<Profilo, 'nome' | 'cognome' | 'nascita' | 'eta' | 'dettagli'>>

/** Scrive i campi del MIO profilo (solo quelli passati: gli altri restano come
 *  sono, foto compresa). */
export async function salvaProfilo(userId: string, campi: CampiProfilo): Promise<Profilo> {
  const { data, error } = await supabase.from('profili')
    .upsert({ user_id: userId, ...campi })
    .select(CAMPI_SENZA_FOTO)
    .single()
  if (error) throw new Error(translateCoachError(error.message))
  const riga = data as RigaSenzaFoto
  const p: Profilo = { ...riga, dettagli: riga.dettagli ?? {}, foto: riga.foto_agg ? useProfiliStore.getState().profili[userId]?.foto ?? null : null }
  ricorda([p])
  return p
}

/** Cambia (o toglie, con `null`) la MIA foto. */
export async function salvaFoto(userId: string, foto: string | null): Promise<Profilo> {
  const { data, error } = await supabase.from('profili')
    .upsert({ user_id: userId, foto })
    .select(CAMPI_SENZA_FOTO)
    .single()
  if (error) throw new Error(translateCoachError(error.message))
  const riga = data as RigaSenzaFoto
  const p: Profilo = { ...riga, dettagli: riga.dettagli ?? {}, foto }
  ricorda([p])
  return p
}

// ── Come si legge ──────────────────────────────────────────────

/** "Mario Rossi". Senza profilo, o con nome e cognome vuoti, il nome di riserva
 *  — quello copiato nel collegamento, che c'è sempre. */
export function nomeCompleto(p: Pick<Profilo, 'nome' | 'cognome'> | null | undefined, riserva: string): string {
  const pieno = [p?.nome, p?.cognome].map(x => x?.trim()).filter(Boolean).join(' ')
  return pieno || riserva
}

/** Gli anni compiuti. Dalla data di nascita se c'è, altrimenti il numero
 *  scritto. `null` se non si sa. */
export function etaDi(p: Pick<Profilo, 'nascita' | 'eta'> | null | undefined, oggi = new Date()): number | null {
  if (p?.nascita && /^\d{4}-\d{2}-\d{2}$/.test(p.nascita)) {
    const [a, m, g] = p.nascita.split('-').map(Number)
    let anni = oggi.getFullYear() - a
    if (oggi.getMonth() + 1 < m || (oggi.getMonth() + 1 === m && oggi.getDate() < g)) anni--
    return anni >= 0 && anni < 130 ? anni : null
  }
  return typeof p?.eta === 'number' ? p.eta : null
}

/** I focus scritti con le virgole, uno per uno. */
export function focusDi(d: DettagliProfilo | null | undefined): string[] {
  return (d?.focus ?? '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
}

/** C'è qualcosa da far vedere oltre a nome e foto? */
export function haDettagli(d: DettagliProfilo | null | undefined): boolean {
  if (!d) return false
  return !!(d.dal || d.focus?.trim() || d.bio?.trim() || d.obiettivi?.trim() || d.percorso?.trim()
    || d.limitazioni?.trim() || (d.pt && (d.curriculum?.trim() || d.esperienze?.trim())))
}

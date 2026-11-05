// Il diario personale: i file di ognuno, sotto la foto del profilo, visibili
// solo a chi li ha messi (vedi supabase/diario_schema.sql).
//
// Il file sta nello Storage, nel contenitore privato `diario`, nella cartella
// col proprio id; la riga di `diario_file` ne dice nome, tipo e peso. Una
// pagina HTML ha in più la sua MEMORIA: quello che salverebbe nel proprio
// localStorage — qui non può, perché gira isolata dall'app (vedi
// `conMemoria`) — arriva all'app, che lo scrive sulla riga. Così la si usa sul
// telefono e la si ritrova uguale sul computer.
import { supabase, chiamaStorage } from './supabase'
import { readStorage, writeStorage, removeStorage } from './safeStorage'
import { uid } from './uid'
import { t } from './i18n'

export interface DiarioFile {
  id: string
  nome: string
  /** Il tipo del file (MIME), o vuoto se il telefono non lo sa. */
  tipo: string
  dimensione: number
  /** Dove sta nello Storage: `<user_id>/<nome a caso>`. */
  percorso: string
  created_at: string
  /** Quando il CONTENUTO è cambiato (caricato o sostituito): la memoria di una
   *  pagina non lo sposta. */
  updated_at: string
}

/** Quello che una pagina HTML si è salvata: chiave → testo, come localStorage. */
export type Memoria = Record<string, string>

const BUCKET = 'diario'
const CAMPI = 'id, nome, tipo, dimensione, percorso, created_at, updated_at'

/** 10 MB a file: un HTML ne pesa decine di kB, una foto del telefono 3-5 MB, un
 *  PDF di qualche pagina meno di uno. Lo stesso tetto è sul contenitore. */
export const DIARIO_MAX_BYTE = 10 * 1024 * 1024
/** La memoria di una pagina: 1 MB, lo stesso tetto della riga nel database.
 *  Il gestionale della dieta ne usa una decina di kB. */
export const MEMORIA_MAX_BYTE = 1024 * 1024

/** "27 kB", "3,2 MB". */
export function pesoLeggibile(byte: number): string {
  if (byte < 1024) return `${byte} B`
  if (byte < 1024 * 1024) return `${Math.max(1, Math.round(byte / 1024))} kB`
  return `${(byte / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

export type Genere = 'html' | 'immagine' | 'pdf' | 'testo' | 'altro'

/** Come si apre: dal tipo, e dove il telefono non lo sa (succede, con i file
 *  arrivati da WhatsApp o da un'app di note) dall'estensione. */
export function genereDi(f: { nome: string; tipo: string }): Genere {
  const tipo = f.tipo.toLowerCase()
  const est = f.nome.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''
  if (tipo === 'text/html' || est === 'html' || est === 'htm') return 'html'
  if (tipo.startsWith('image/')) return 'immagine'
  if (tipo === 'application/pdf' || est === 'pdf') return 'pdf'
  if (tipo.startsWith('text/') || tipo === 'application/json' || ['txt', 'md', 'csv', 'json'].includes(est)) return 'testo'
  return 'altro'
}

/** I rifiuti del server, in parole. */
function traduci(message: string, status?: number): string {
  const m = message.toUpperCase()
  if (status === 413 || m.includes('PAYLOAD TOO LARGE') || m.includes('EXCEEDED THE MAXIMUM')) return t('Il file è troppo grande: al massimo 10 MB.')
  if (m.includes('ABORTERROR') || m.includes('ACCESSO NON RINNOVATO') || m.includes('FAILED TO FETCH') || m.includes('NETWORKERROR') || m.includes('LOAD FAILED')) {
    return t('La rete non risponde. Riprova fra poco.')
  }
  // Tabella o contenitore mancanti: diario_schema.sql non è ancora stato eseguito.
  if (m.includes('DOES NOT EXIST') || m.includes('PGRST205') || m.includes('SCHEMA CACHE') || m.includes('BUCKET NOT FOUND')) {
    return t('Il diario non è ancora attivo sul server.')
  }
  // La RLS non dice perché: qui o le regole non ci sono ancora, o il file non
  // è nella propria cartella — che dall'app non succede.
  if (m.includes('ROW-LEVEL SECURITY')) return t('Il server ha rifiutato il file. Se succede ancora, esci e rientra.')
  if (status === 401 || m.includes('JWT')) return t('Sessione scaduta. Esci e rientra.')
  if (m.includes('DIARIO_MEMORIA_PICCOLA')) return t('Questa pagina salva troppi dati: oltre 1 MB non si ricordano.')
  if (status === 404 || m.includes('NOT_FOUND') || m.includes('OBJECT NOT FOUND')) return t('Il file non c’è più sul server.')
  return message
}

/** Una risposta dello Storage che non è andata, detta in parole. */
async function erroreStorage(r: Response): Promise<Error> {
  let testo = ''
  try {
    const j = await r.json() as { message?: string; error?: string }
    testo = j.message || j.error || ''
  } catch { /* corpo vuoto o non JSON */ }
  return new Error(traduci(testo || r.statusText || String(r.status), r.status))
}

/** Una chiamata allo Storage: la rete che cade diventa la stessa frase delle
 *  altre, non un «Failed to fetch» in inglese. */
async function storage(percorso: string, init?: RequestInit): Promise<Response> {
  try {
    return await chiamaStorage(percorso, init)
  } catch (e) {
    throw new Error(traduci(e instanceof Error ? `${e.name} ${e.message}` : String(e)))
  }
}

/** Il percorso nell'URL: le due parti sono id e lettere a caso, ma un nome
 *  strano non deve poter uscire dalla cartella. */
const inUrl = (percorso: string) => percorso.split('/').map(encodeURIComponent).join('/')

/** I miei file, dal più recente. */
export async function elencoDiario(userId: string): Promise<DiarioFile[]> {
  const { data, error } = await supabase.from('diario_file').select(CAMPI).eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw new Error(traduci(`${error.code ?? ''} ${error.message}`))
  return (data ?? []) as DiarioFile[]
}

/** Il tipo da scrivere: quello del telefono, o dall'estensione per i due che
 *  si aprono dentro l'app e che il telefono a volte non riconosce. */
function tipoDi(file: File): string {
  if (file.type) return file.type.slice(0, 100)
  const g = genereDi({ nome: file.name, tipo: '' })
  return g === 'html' ? 'text/html' : g === 'pdf' ? 'application/pdf' : ''
}

function controllaPeso(file: File): void {
  if (file.size > DIARIO_MAX_BYTE) throw new Error(t('Il file è troppo grande: al massimo 10 MB.'))
  if (file.size === 0) throw new Error(t('Il file è vuoto.'))
}

async function mandaFile(percorso: string, file: File, sostituisce: boolean): Promise<void> {
  const r = await storage(`object/${BUCKET}/${inUrl(percorso)}`, {
    method: 'POST',
    headers: {
      'Content-Type': tipoDi(file) || 'application/octet-stream',
      // Sostituendo si riscrive lo stesso percorso: senza, il server lo rifiuta
      // perché c'è già.
      'x-upsert': sostituisce ? 'true' : 'false',
      'cache-control': 'no-cache',
    },
    body: file,
  })
  if (!r.ok) throw await erroreStorage(r)
}

/** Mette un file nel diario. Prima il file, poi la riga: una riga senza il suo
 *  file sarebbe una voce che non si apre. Se la riga non si scrive, il file
 *  già mandato si toglie. */
export async function caricaNelDiario(userId: string, file: File): Promise<DiarioFile> {
  controllaPeso(file)
  // Il nome vero sta nella riga; nello Storage un nome a caso, così accenti,
  // spazi e barre del nome non arrivano mai in un URL.
  const percorso = `${userId}/${uid('d')}`
  await mandaFile(percorso, file, false)
  const { data, error } = await supabase
    .from('diario_file')
    .insert({ user_id: userId, nome: file.name.slice(0, 200) || t('Senza nome'), tipo: tipoDi(file), dimensione: file.size, percorso })
    .select(CAMPI)
  const riga = (data ?? [])[0] as DiarioFile | undefined
  if (error || !riga) {
    void togliDalloStorage(percorso).catch(() => { /* resta un file orfano, invisibile */ })
    throw new Error(error ? traduci(`${error.code ?? ''} ${error.message}`) : t('Il file non si è salvato.'))
  }
  return riga
}

/** Sostituisce il contenuto tenendo la voce e la sua memoria: è come si
 *  aggiorna una pagina HTML senza perdere quello che ci si era scritto. */
export async function sostituisciFile(voce: DiarioFile, file: File): Promise<DiarioFile> {
  controllaPeso(file)
  await mandaFile(voce.percorso, file, true)
  const { data, error } = await supabase
    .from('diario_file')
    .update({ nome: file.name.slice(0, 200) || voce.nome, tipo: tipoDi(file), dimensione: file.size, updated_at: new Date().toISOString() })
    .eq('id', voce.id)
    .select(CAMPI)
  if (error) throw new Error(traduci(`${error.code ?? ''} ${error.message}`))
  return ((data ?? [])[0] as DiarioFile | undefined) ?? voce
}

/** Il contenuto, appena letto dal server: `no-store`, o dopo una sostituzione
 *  il browser poteva ridare quello di prima dalla sua cache. */
export async function scaricaDalDiario(voce: DiarioFile): Promise<Blob> {
  const r = await storage(`object/${BUCKET}/${inUrl(voce.percorso)}`, { cache: 'no-store' })
  if (!r.ok) throw await erroreStorage(r)
  const blob = await r.blob()
  // Col tipo della riga: è quello che dice come aprirlo.
  return voce.tipo && blob.type !== voce.tipo ? new Blob([blob], { type: voce.tipo }) : blob
}

async function togliDalloStorage(percorso: string): Promise<void> {
  const r = await storage(`object/${BUCKET}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: [percorso] }),
  })
  if (!r.ok) throw await erroreStorage(r)
}

/** Toglie un file. Prima il file e poi la riga: se la seconda non riesce, la
 *  voce resta e si può togliere di nuovo (lo Storage non si lamenta di un file
 *  che non c'è già più). Al contrario resterebbe un file senza voce, che occupa
 *  spazio e non si vede da nessuna parte. */
export async function eliminaDalDiario(voce: DiarioFile): Promise<void> {
  await togliDalloStorage(voce.percorso)
  const { error } = await supabase.from('diario_file').delete().eq('id', voce.id)
  if (error) throw new Error(traduci(`${error.code ?? ''} ${error.message}`))
  removeStorage('local', chiaveInSospeso(voce.id))
}

// ── La memoria delle pagine ───────────────────────────────────
// Ogni modifica fatta dentro una pagina arriva qui. Si scrive SUBITO sul
// telefono, «in sospeso», e poco dopo sul server; arrivata, la copia sul
// telefono si toglie. Riaprendo la pagina vince quella in sospeso, se c'è: è
// la più recente, anche quando il server non l'ha ancora (senza rete, o una
// pagina chiusa e riaperta prima che il salvataggio arrivasse).

const chiaveInSospeso = (id: string) => `matteo-diario-memoria:${id}`

interface InSospeso { memoria: Memoria; quando: string }

/** Un oggetto chiave → testo, e niente altro: arriva da una pagina, non ci si
 *  fida della forma. */
export function eMemoria(x: unknown): x is Memoria {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false
  return Object.values(x as Record<string, unknown>).every(v => typeof v === 'string')
}

/** Quanto pesa, come la conta il database (il testo JSON in byte). */
export function pesoMemoria(m: Memoria): number {
  return new TextEncoder().encode(JSON.stringify(m)).length
}

function leggiInSospeso(id: string): InSospeso | null {
  try {
    const raw = readStorage('local', chiaveInSospeso(id))
    const v = raw ? JSON.parse(raw) as Partial<InSospeso> : null
    return v && eMemoria(v.memoria) && typeof v.quando === 'string' ? v as InSospeso : null
  } catch {
    return null
  }
}

/** La memoria con cui aprire la pagina: quella in sospeso sul telefono, o
 *  quella del server. */
export async function leggiMemoria(id: string): Promise<Memoria> {
  const locale = leggiInSospeso(id)
  if (locale) return locale.memoria
  const { data, error } = await supabase.from('diario_file').select('memoria').eq('id', id).limit(1)
  if (error) throw new Error(traduci(`${error.code ?? ''} ${error.message}`))
  const m = ((data ?? [])[0] as { memoria?: unknown } | undefined)?.memoria
  return eMemoria(m) ? m : {}
}

/** Segna una modifica: sul telefono subito. Torna il segno con cui poi
 *  `inviaMemoria` sa se nel frattempo ne è arrivata un'altra. */
export function segnaMemoria(id: string, memoria: Memoria): string {
  const quando = new Date().toISOString() + Math.random().toString(36).slice(2, 6)
  writeStorage('local', chiaveInSospeso(id), JSON.stringify({ memoria, quando } satisfies InSospeso))
  return quando
}

/** Manda al server la memoria in sospeso, se c'è. Arrivata, la copia sul
 *  telefono si toglie — solo se è ancora quella mandata: una modifica arrivata
 *  mentre si inviava resta in sospeso per il giro dopo. */
export async function inviaMemoria(id: string): Promise<void> {
  const s = leggiInSospeso(id)
  if (!s) return
  const { error } = await supabase.from('diario_file').update({ memoria: s.memoria }).eq('id', id)
  if (error) throw new Error(traduci(`${error.code ?? ''} ${error.message}`))
  if (leggiInSospeso(id)?.quando === s.quando) removeStorage('local', chiaveInSospeso(id))
}

/** C'è qualcosa sul telefono che il server non ha ancora? */
export function memoriaInSospeso(id: string): boolean {
  return leggiInSospeso(id) !== null
}

// ── La pagina, isolata ────────────────────────────────────────
// Una pagina HTML gira in un riquadro `sandbox` senza `allow-same-origin`: ha
// un'origine sua, vuota, e non vede niente dell'app — né i dati, né l'accesso
// a Supabase. È questo che rende sicuro aprire un HTML qualunque.
//
// Il prezzo è che lì il localStorage vero non c'è (leggerlo lancia un errore).
// Prima che parta qualunque script della pagina, questo ne mette uno finto,
// con dentro la memoria salvata; a ogni modifica la manda all'app, che la
// scrive (vedi sopra). Anche sessionStorage, ma solo in memoria: dura quanto
// la pagina aperta, come il vero.
//
// Scritto in JavaScript semplice e come testo, non come funzione: gira nella
// pagina, non nell'app, e una funzione passata dal compilatore o dal
// minificatore potrebbe uscirne con riferimenti che lì non esistono.
//
// `data-theme` su <html> segue l'aspetto dell'app (chiaro o scuro) per le
// pagine che lo leggono, come quella del gestionale; alle altre non fa niente.
export const SCRIPT_MEMORIA = `(function (c) {
  var proprio = Object.prototype.hasOwnProperty;
  function nuova() { return Object.create(null); }
  var dati = nuova();
  for (var k in c.dati) if (proprio.call(c.dati, k) && typeof c.dati[k] === 'string') dati[k] = c.dati[k];
  function manda() {
    var copia = {};
    for (var x in dati) copia[x] = dati[x];
    try { parent.postMessage({ diario: c.id, memoria: copia }, '*'); } catch (e) {}
  }
  function finta(persiste) {
    var sua = nuova();
    function m() { return persiste ? dati : sua; }
    var s = {
      getItem: function (k) { k = String(k); return proprio.call(m(), k) ? m()[k] : null; },
      setItem: function (k, v) { m()[String(k)] = String(v); if (persiste) manda(); },
      removeItem: function (k) { k = String(k); if (!proprio.call(m(), k)) return; delete m()[k]; if (persiste) manda(); },
      clear: function () { var o = m(); for (var x in o) delete o[x]; if (persiste) manda(); },
      key: function (i) { var ks = Object.keys(m()); return i >= 0 && i < ks.length ? ks[i] : null; }
    };
    Object.defineProperty(s, 'length', { get: function () { return Object.keys(m()).length; } });
    return s;
  }
  try { Object.defineProperty(window, 'localStorage', { value: finta(true), configurable: true }); } catch (e) {}
  try { Object.defineProperty(window, 'sessionStorage', { value: finta(false), configurable: true }); } catch (e) {}
  try { document.documentElement.setAttribute('data-theme', c.tema); } catch (e) {}
})`

/** La pagina con lo script della memoria davanti a tutto il resto: subito dopo
 *  `<head>`, o dopo `<html>`, o dopo il doctype — mai prima del doctype, che
 *  manderebbe la pagina in modalità «quirks» e ne cambierebbe l'aspetto. */
export function conMemoria(html: string, opz: { id: string; memoria: Memoria; scuro: boolean }): string {
  // `<` in JSON come \\u003c: un «</script>» scritto dentro la memoria
  // chiuderebbe lo script a metà.
  const conf = JSON.stringify({ id: opz.id, dati: opz.memoria, tema: opz.scuro ? 'dark' : 'light' })
    .replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
  const script = `<script>${SCRIPT_MEMORIA}(${conf});</script>`
  for (const re of [/<head\b[^>]*>/i, /<html\b[^>]*>/i, /<!doctype[^>]*>/i]) {
    const m = re.exec(html)
    if (m) {
      const fine = m.index + m[0].length
      return html.slice(0, fine) + script + html.slice(fine)
    }
  }
  return script + html
}

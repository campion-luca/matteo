// Memoria persistente della sincronizzazione cloud.
//
// Serve a distinguere due situazioni che, senza questi due dati, sono
// indistinguibili all'avvio: "il remoto è cambiato davvero (altro dispositivo)"
// e "il remoto è quello che conoscevo già, ma ho modifiche locali mai inviate".
// Senza la distinzione, riaprire l'app dopo una sessione offline applicava il
// remoto stale sopra il lavoro locale e lo cancellava in silenzio.
//
// Vive fuori dallo store Zustand di proposito: `useJarvisStore` è il blob che
// viene salvato in cloud, e mettere qui dentro dei metadati di sync farebbe
// scattare un nuovo save a ogni loro variazione (loop).

const KEY = 'jarvis-sync-meta-v1'

export interface SyncMeta {
  /** `updated_at` dell'ultimo stato che sappiamo essere andato a buon fine in cloud. */
  lastSyncedAt: string | null
  /** true = ci sono modifiche locali non ancora confermate dal server. */
  dirty: boolean
}

const EMPTY: SyncMeta = { lastSyncedAt: null, dirty: false }

// Tutte le funzioni sono tolleranti a localStorage rotto, pieno o assente
// (Safari privato): la sincronizzazione degrada, non esplode.
export function getSyncMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw) as Partial<SyncMeta>
    return {
      lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
      dirty: parsed.dirty === true,
    }
  } catch {
    return { ...EMPTY }
  }
}

function write(meta: SyncMeta) {
  try { localStorage.setItem(KEY, JSON.stringify(meta)) } catch { /* storage pieno o non disponibile */ }
}

/** Da chiamare a ogni modifica locale, PRIMA di pianificare il save. */
export function markDirty(): void {
  const meta = getSyncMeta()
  if (meta.dirty) return                      // già sporco: niente scrittura inutile
  write({ ...meta, dirty: true })
}

/** Da chiamare quando il locale e il remoto coincidono (save riuscito, pull, load). */
export function setSynced(updatedAt: string | null): void {
  write({ lastSyncedAt: updatedAt, dirty: false })
}

export type InitialSyncDecision = 'applyRemote' | 'keepLocalAndPush' | 'applyRemoteConflict'

// Stessa semantica di `isNewer` nel bridge: parità di timestamp = NON più recente.
function isNewer(a: string | null, b: string | null): boolean {
  if (!a) return false
  const ta = new Date(a).getTime()
  if (Number.isNaN(ta)) return false
  if (!b) return true
  const tb = new Date(b).getTime()
  if (Number.isNaN(tb)) return true
  return ta > tb
}

/**
 * Cosa fare del dato remoto appena caricato all'avvio.
 *
 * - `applyRemote`          — nessuna modifica locale pendente: il remoto vince (come sempre).
 * - `keepLocalAndPush`     — ho modifiche offline e il remoto è fermo a dove l'avevo
 *                            lasciato: applicarlo cancellerebbe il mio lavoro. Tengo il
 *                            locale e lo spingo.
 * - `applyRemoteConflict`  — ho modifiche offline MA nel frattempo ha scritto un altro
 *                            dispositivo. La politica resta "vince il più recente", ma
 *                            l'utente deve saperlo: chi chiama mostra un avviso.
 */
export function decideInitialSync(remoteUpdatedAt: string | null, meta: SyncMeta): InitialSyncDecision {
  if (!meta.dirty) return 'applyRemote'
  return isNewer(remoteUpdatedAt, meta.lastSyncedAt) ? 'applyRemoteConflict' : 'keepLocalAndPush'
}

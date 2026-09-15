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

import type { NotiAlSync } from './syncMerge'

const KEY = 'jarvis-sync-meta-v1'

export interface SyncMeta {
  /** `updated_at` dell'ultimo stato che sappiamo essere andato a buon fine in cloud. */
  lastSyncedAt: string | null
  /** true = ci sono modifiche locali non ancora confermate dal server. */
  dirty: boolean
  /** Gli id di schede ed esercizi presenti all'ultimo sync: servono a capire,
   *  in un conflitto, cosa è nato qui e cosa è stato cancellato altrove (vedi
   *  syncMerge). `null` per le meta scritte da versioni precedenti. */
  noti: NotiAlSync | null
}

const EMPTY: SyncMeta = { lastSyncedAt: null, dirty: false, noti: null }

// Tutte le funzioni sono tolleranti a localStorage rotto, pieno o assente
// (Safari privato): la sincronizzazione degrada, non esplode.
export function getSyncMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw) as Partial<SyncMeta>
    const noti = parsed.noti
    return {
      lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
      dirty: parsed.dirty === true,
      noti: noti && Array.isArray(noti.schede) && Array.isArray(noti.esercizi) ? noti : null,
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

/** Da chiamare quando il locale e il remoto coincidono (save riuscito, pull, load).
 *  `noti` = gli id dello stato che in quel momento è uguale al remoto; senza, si
 *  tengono quelli di prima. */
export function setSynced(updatedAt: string | null, noti?: NotiAlSync): void {
  write({ lastSyncedAt: updatedAt, dirty: false, noti: noti ?? getSyncMeta().noti })
}

export type InitialSyncDecision = 'applyRemote' | 'keepLocalAndPush' | 'applyRemoteConflict'

/** Il remoto è stato scritto da qualcun altro dopo l'ultimo sync noto?
 *
 *  Si confronta per DIFFERENZA e non per "più recente": `updated_at` lo scrive
 *  l'orologio di chi salva, e l'orologio di un telefono e quello di un computer
 *  non coincidono. Con "più recente", un dispositivo indietro di un minuto
 *  scriveva un orario più vecchio di quello noto all'altro, che lo leggeva come
 *  "nessuno ha scritto" e lo sovrascriveva in silenzio. I due valori confrontati
 *  vengono entrambi dal server, nello stesso formato: se sono uguali è la stessa
 *  scrittura, se no ne è arrivata un'altra. */
export function remotoCambiato(remoto: string | null, noto: string | null): boolean {
  if (!remoto) return false
  return remoto !== noto
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
  return remotoCambiato(remoteUpdatedAt, meta.lastSyncedAt) ? 'applyRemoteConflict' : 'keepLocalAndPush'
}

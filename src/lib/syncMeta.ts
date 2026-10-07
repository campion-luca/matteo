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
  /** L'`updated_at` del salvataggio partito e non ancora confermato. Serve a
   *  riconoscere la PROPRIA scrittura quando la risposta si perde per strada
   *  (poco segnale, app sospesa): il dato è arrivato al server, noi non lo
   *  sappiamo, e al giro dopo il remoto risulta "cambiato da qualcun altro".
   *  Se l'orario remoto è questo, quel qualcun altro siamo noi. */
  inViaggio: string | null
}

const EMPTY: SyncMeta = { lastSyncedAt: null, dirty: false, noti: null, inViaggio: null }

// ── Dov'è la verità ────────────────────────────────────────────
// In MEMORIA. `localStorage` è solo il modo di farla sopravvivere a un riavvio.
//
// Prima era il contrario, e c'era un guasto silenzioso con le peggiori
// conseguenze possibili: `write()` ingoia l'eccezione (giusto: un'app che
// esplode perché non può scrivere una preferenza è peggio), e `getSyncMeta()`
// in errore tornava `dirty: false`. Quindi con lo storage negato (Safari
// privato) o PIENO — che è dove si finisce con anni di storico, visto che
// zustand/persist riscrive tutto il blob a ogni modifica — `markDirty()`
// falliva senza dirlo, `performSave` usciva alla prima riga, e l'utente si
// allenava per settimane senza che una riga arrivasse in cloud. Nessun errore,
// nessuna pill: lo stato restava `idle`, cioè "tutto a posto".
//
// Con la copia in memoria il caso peggiore torna a essere quello giusto: si
// perde la memoria di sync fra un riavvio e l'altro, non il salvataggio.
let memoria: SyncMeta | null = null

function dalloStorage(): SyncMeta {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw) as Partial<SyncMeta>
    const noti = parsed.noti
    return {
      lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
      dirty: parsed.dirty === true,
      noti: noti && Array.isArray(noti.schede) && Array.isArray(noti.esercizi) ? noti : null,
      inViaggio: typeof parsed.inViaggio === 'string' ? parsed.inViaggio : null,
    }
  } catch {
    return { ...EMPTY }
  }
}

// Tutte le funzioni sono tolleranti a localStorage rotto, pieno o assente
// (Safari privato): la sincronizzazione degrada, non esplode.
export function getSyncMeta(): SyncMeta {
  // Prima lettura della sessione: si idrata da disco. Dopo, comanda la memoria —
  // anche quando il disco non ha accettato l'ultima scrittura.
  if (!memoria) memoria = dalloStorage()
  return { ...memoria }
}

/** Solo per i test: butta la copia in memoria e riparte da localStorage. */
export function resetSyncMeta(): void {
  memoria = null
}

function write(meta: SyncMeta) {
  memoria = { ...meta }
  try { localStorage.setItem(KEY, JSON.stringify(meta)) } catch { /* storage pieno o negato: resta in memoria */ }
}

/** Da chiamare al logout: le meta sono dell'ACCOUNT, non del dispositivo.
 *  Senza, l'utente successivo eredita `dirty`, `lastSyncedAt` e soprattutto gli
 *  id `noti` di quello precedente — cioè `syncMerge` ragionerebbe sugli id di
 *  un altro account. */
export function clearSyncMeta(): void {
  memoria = { ...EMPTY }
  try { localStorage.removeItem(KEY) } catch { /* niente da fare */ }
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
  write({ lastSyncedAt: updatedAt, dirty: false, noti: noti ?? getSyncMeta().noti, inViaggio: null })
}

/** Da chiamare un attimo PRIMA di spedire un salvataggio, con l'orario che gli
 *  si sta per dare (vedi `inViaggio`). */
export function segnaInViaggio(marca: string): void {
  write({ ...getSyncMeta(), inViaggio: marca })
}

/** Il remoto porta l'orario del nostro salvataggio rimasto senza risposta: era
 *  arrivato. Si aggiorna quello che si sa del remoto e basta — `dirty` resta
 *  com'è, perché da allora qui può essere cambiato altro. */
export function confermaRemoto(updatedAt: string): void {
  write({ ...getSyncMeta(), lastSyncedAt: updatedAt, inViaggio: null })
}

/** Da chiamare quando si scopre che il cloud è stato scritto da un'app più
 *  NUOVA di questa (vedi `VERSIONE_DATI` nello store). Lo stato che c'è qui ha
 *  già perso le chiavi che questa versione non conosce: dopo l'aggiornamento
 *  NON deve risalire tale e quale, o le toglierebbe anche dal cloud. Senza un
 *  ultimo sync noto il prossimo avvio vede un conflitto — applica il remoto, e
 *  di qui recupera solo ciò che è stato creato (vedi syncMerge). */
export function dimenticaUltimoSync(): void {
  const meta = getSyncMeta()
  if (meta.lastSyncedAt === null && meta.inViaggio === null) return
  write({ ...meta, lastSyncedAt: null, inViaggio: null })
}

/** Rimette le meta com'erano: serve a chi riprende i dati messi da parte
 *  all'uscita (vedi lib/proprietario). */
export function ripristinaSyncMeta(meta: SyncMeta): void {
  write({ ...EMPTY, ...meta })
}

/** Due orari sono lo stesso istante? Non si confrontano le stringhe: il server
 *  restituisce "…+00:00" dove noi abbiamo scritto "…Z". */
export function stessoIstante(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const x = Date.parse(a), y = Date.parse(b)
  return Number.isFinite(x) && x === y
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
  // Il remoto è la nostra ultima scrittura, di cui non era tornata la risposta
  // (l'app chiusa a metà, il segnale caduto): non è un altro dispositivo. Quello
  // che c'è qui è almeno altrettanto recente, e si tiene.
  if (stessoIstante(remoteUpdatedAt, meta.inViaggio)) return 'keepLocalAndPush'
  return remotoCambiato(remoteUpdatedAt, meta.lastSyncedAt) ? 'applyRemoteConflict' : 'keepLocalAndPush'
}

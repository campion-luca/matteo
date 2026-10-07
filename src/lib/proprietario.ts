// Di chi sono i dati che stanno su questo telefono.
//
// Lo store locale è un blob solo, e fino a qui non portava scritto di chi fosse:
// l'unica cosa che lo svuotava era l'evento di uscita (`SIGNED_OUT`). Ma una
// sessione può cambiare senza che quell'evento arrivi — il link di conferma di
// un secondo account aperto nello stesso browser, per dire — e allora i dati del
// primo restavano lì, e al primo salvataggio finivano nel cloud del secondo.
//
// Qui c'è il nome sulla porta, e quello che ne segue:
//
//  • entrando, se sul telefono ci sono i dati di un ALTRO account si tolgono
//    prima di caricare i propri;
//
//  • quello che l'account che esce non aveva ancora mandato al cloud non si
//    butta: si mette da parte sotto il suo id (`parcheggia`) e gli viene
//    restituito al prossimo ingresso su questo telefono (`riprendi`), dove
//    riparte come qualunque modifica fatta senza rete. Prima un'uscita con
//    lavoro non sincronizzato lo cancellava e basta — ed era il modo in cui si
//    perdeva un allenamento uscendo dall'account in palestra. Insieme va
//    l'allenamento lasciato a metà, che in cloud non ci sta proprio.
//
// Il parcheggio resta sul telefono, non va in cloud, c'è solo se serve, e dopo
// un mese senza che il suo proprietario rientri si butta (`pulisciParcheggi`).
import { useJarvisStore, EMPTY_STATE, applyRemoteState, scriviSuDisco } from '@/store/useJarvisStore'
import type { JarvisState } from '@/store/useJarvisStore'
import { getSyncMeta, clearSyncMeta, ripristinaSyncMeta, type SyncMeta } from './syncMeta'
import { dimenticaSchedeRicevute } from './coach'
import { scartaSessione, esportaSessione, importaSessione } from '@/features/gym/sessioneInCorso'

const CHIAVE = 'jarvis-proprietario-v1'
const PARCHEGGIO = 'jarvis-parcheggio-v1-'

/** L'id dell'account a cui appartengono i dati locali. `null` se non lo si sa:
 *  telefono vuoto, o dati scritti prima che questo file esistesse. */
export function proprietario(): string | null {
  try { return localStorage.getItem(CHIAVE) } catch { return null }
}

export function segnaProprietario(userId: string | null): void {
  try {
    if (userId) localStorage.setItem(CHIAVE, userId)
    else localStorage.removeItem(CHIAVE)
  } catch { /* storage negato: si perde il nome sulla porta, non i dati */ }
}

interface Parcheggiato {
  /** Lo stato e le sue meta, se c'erano modifiche non inviate. */
  stato?: JarvisState
  meta?: SyncMeta
  /** L'allenamento lasciato a metà (vedi sessioneInCorso), se c'era. */
  sessione?: string
  quando: string
}

/** Oltre questo un parcheggio che nessuno è tornato a prendere si butta: sono i
 *  dati di una persona, rimasti su un telefono su cui non rientra più. */
const SCADE_DOPO_MS = 30 * 24 * 60 * 60 * 1000

/** Mette da parte, per questo account, quello che uscendo andrebbe perso: le
 *  modifiche non ancora inviate al cloud e l'allenamento lasciato a metà. Non
 *  fa niente se non c'è né l'uno né l'altro — quello che è già nel cloud si
 *  riscarica da lì. */
export function parcheggia(userId: string): void {
  const meta = getSyncMeta()
  const sessione = esportaSessione()
  if (!meta.dirty && !sessione) return
  // La scrittura su disco dello store è rimandata di qualche centinaio di
  // millisecondi: qui serve lo stato di ADESSO.
  scriviSuDisco()
  const dati: Parcheggiato = {
    ...(meta.dirty ? { stato: useJarvisStore.getState(), meta } : {}),
    ...(sessione ? { sessione } : {}),
    quando: new Date().toISOString(),
  }
  try { localStorage.setItem(PARCHEGGIO + userId, JSON.stringify(dati)) } catch { /* spazio finito: non c'è dove metterli */ }
}

/** Rimette al loro posto i dati messi da parte per questo account: lo stato,
 *  segnato come ancora da inviare, e l'allenamento a metà. `true` se c'era
 *  qualcosa. Da chiamare PRIMA di caricare dal cloud: sarà il caricamento a
 *  decidere cosa tenere, come dopo una sessione senza rete (vedi
 *  `decideInitialSync`). */
export function riprendi(userId: string): boolean {
  let raw: string | null
  try { raw = localStorage.getItem(PARCHEGGIO + userId) } catch { return false }
  if (!raw) return false
  try {
    const dati = JSON.parse(raw) as Partial<Parcheggiato>
    if (dati.stato && dati.meta) {
      // Prima si riparte da vuoto, poi si applica passando dal filtro delle
      // chiavi e dalle migrazioni: nel frattempo l'app può essere cambiata.
      useJarvisStore.setState({ ...EMPTY_STATE }, true)
      applyRemoteState(dati.stato)
      ripristinaSyncMeta({ ...dati.meta, dirty: true })
    }
    if (typeof dati.sessione === 'string') importaSessione(dati.sessione)
    return !!(dati.stato && dati.meta) || typeof dati.sessione === 'string'
  } catch {
    return false
  } finally {
    try { localStorage.removeItem(PARCHEGGIO + userId) } catch { /* niente da fare */ }
  }
}

/** Butta i parcheggi che nessuno è tornato a prendere da un mese. */
export function pulisciParcheggi(ora = Date.now()): void {
  try {
    const vecchi: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k?.startsWith(PARCHEGGIO)) continue
      let quando = NaN
      try { quando = Date.parse((JSON.parse(localStorage.getItem(k) ?? '{}') as Partial<Parcheggiato>).quando ?? '') } catch { /* illeggibile: si butta */ }
      if (!(ora - quando <= SCADE_DOPO_MS)) vecchi.push(k)
    }
    vecchi.forEach(k => localStorage.removeItem(k))
  } catch { /* storage negato: niente da pulire */ }
}

/** Toglie dal telefono tutto quello che è dell'account: lo stato, le meta di
 *  sincronizzazione, le schede ricevute da un allenatore e l'allenamento
 *  lasciato a metà. È quello che succede all'uscita. */
export function svuotaDatiLocali(): void {
  // `true` = SOSTITUISCE lo stato invece di fonderlo. Fondendo, i campi che
  // EMPTY_STATE non nomina (sesso, peso, altezza, data di nascita, lingua,
  // gruppi creati) restavano in memoria, e chi entrava dopo sullo stesso
  // telefono se li ritrovava — e al primo salvataggio nel proprio cloud.
  useJarvisStore.setState({ ...EMPTY_STATE }, true)
  // Da `persist` e non da localStorage direttamente: la scrittura su disco
  // è rimandata (vedi useJarvisStore), e lo stato vuoto appena impostato è
  // ancora in attesa — va annullata insieme al blob, o lo ricreerebbe.
  useJarvisStore.persist.clearStorage()
  // Anche le meta di sync: sono dell'ACCOUNT, non del dispositivo. Restando,
  // l'utente successivo ereditava `dirty`, `lastSyncedAt` e soprattutto gli id
  // `noti` di quello prima — cioè `syncMerge` avrebbe deciso cosa "è nato qui"
  // guardando gli id di un altro.
  clearSyncMeta()
  dimenticaSchedeRicevute()
  // E l'allenamento a metà: restando, chi entrava dopo si ritrovava "riprendi"
  // sulle serie di un altro.
  scartaSessione()
}

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
import { useJarvisStore, EMPTY_STATE, applyRemoteState, scriviSuDisco, smettiDiScrivere } from '@/store/useJarvisStore'
import type { JarvisState } from '@/store/useJarvisStore'
import { getSyncMeta, clearSyncMeta, ripristinaSyncMeta, type SyncMeta } from './syncMeta'
import { useSyncStatus } from './syncStatus'
import { dimenticaSchedeRicevute } from './coach'
import { dimenticaProfili } from './profili'
import { dimenticaRuolo } from './ruolo'
import { scartaSessione, esportaSessione, importaSessione } from '@/features/gym/sessioneInCorso'
import { dimenticaAllievi } from '@/features/desktop/allieviDesktop'
import { useNavDesktop } from '@/features/desktop/navDesktop'

const CHIAVE = 'jarvis-proprietario-v1'
const PARCHEGGIO = 'jarvis-parcheggio-v1-'

function sulDisco(): string | null {
  try { return localStorage.getItem(CHIAVE) } catch { return null }
}

// ── Di chi sono i dati in QUESTA scheda ────────────────────────
// Il nome sulla porta sta in localStorage, che tutte le schede del browser
// condividono; lo store invece è in memoria, uno per scheda. Una scheda che
// entrava con un altro account toglieva i dati del primo e scriveva sulla porta
// il nome nuovo — e l'altra scheda, rimasta aperta coi dati di prima in
// memoria, alla notizia del nuovo accesso leggeva la porta, la trovava già
// giusta, non toglieva niente e salvava i dati del primo account nel cloud del
// secondo.
//
// Per questo «di chi sono i dati che ho in mano?» si chiede alla memoria della
// scheda. Dal disco si legge una volta, adesso: lo store è appena stato letto
// da lì (vedi `persist` nello store), e i due vanno insieme.
let inMemoria: string | null = sulDisco()

/** L'id dell'account a cui appartengono i dati che QUESTA scheda ha in memoria.
 *  `null` se non lo si sa: telefono vuoto, o dati scritti prima che questo file
 *  esistesse. */
export function proprietario(): string | null {
  return inMemoria
}

export function segnaProprietario(userId: string | null): void {
  inMemoria = userId
  try {
    if (userId) localStorage.setItem(CHIAVE, userId)
    else localStorage.removeItem(CHIAVE)
  } catch { /* storage negato: si perde il nome sulla porta, non i dati */ }
}

/** Un'altra scheda del browser è entrata con un account diverso da quello di
 *  cui questa ha i dati: sulla porta c'è un altro nome. Un'uscita altrove (la
 *  porta vuota) non conta: quella arriva anche qui, come evento di uscita.
 *  Con un evento `storage`, conta solo se è cambiata la porta. */
export function entratoAltrove(e?: Pick<StorageEvent, 'key'>): boolean {
  if (e && e.key !== CHIAVE) return false
  const porta = sulDisco()
  return !!inMemoria && !!porta && porta !== inMemoria
}

/** Da chiamare quando `entratoAltrove()`: questa scheda smette di scrivere e si
 *  ricarica, ripartendo dal disco — che adesso è del nuovo account. Non
 *  parcheggia: l'ha già fatto l'altra scheda entrando, coi dati che erano su
 *  disco, e qui non sarebbe più il caso di toccarlo. Togliere i dati con
 *  `svuotaDatiLocali` vorrebbe dire cancellare dal disco quelli che l'altra
 *  scheda ci ha appena messo. */
export function lasciaAllAltraScheda(): void {
  useSyncStatus.getState().smetti?.()
  // La scrittura dello store ancora in attesa (vedi useJarvisStore) è dei dati
  // di prima, e partirebbe col `pagehide` della ricarica sopra quelli del nuovo
  // account: alla riapertura questa scheda li avrebbe letti come suoi. Si
  // butta lei, e su disco resta quello che c'è; da qui lo store non ci scrive
  // più.
  smettiDiScrivere()
  // Le modifiche di QUESTA scheda non ancora inviate: l'altra, entrando, ha
  // parcheggiato quello che aveva lei in memoria, non questo. Si mettono da
  // parte per chi le ha fatte — senza passare dal disco dello store, che
  // adesso è del nuovo account — e le ritrova rientrando (vedi `riprendi`).
  const meta = getSyncMeta()
  if (inMemoria && meta.dirty) {
    const dati: Parcheggiato = {
      ...giaParcheggiato(inMemoria),
      stato: useJarvisStore.getState(), meta,
      quando: new Date().toISOString(),
    }
    try { localStorage.setItem(PARCHEGGIO + inMemoria, JSON.stringify(dati)) } catch { /* spazio finito */ }
  }
  window.location.reload()
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
  // L'uscita arriva a tutte le schede aperte, e ognuna parcheggia quello che ha
  // in memoria. L'allenamento a metà invece sta su disco: la prima scheda l'ha
  // già messo da parte e tolto, e la seconda — non trovandolo più — scriveva il
  // suo parcheggio sopra e lo perdeva. Quello che c'è già resta, e si
  // sostituisce solo ciò che questa scheda ha di suo.
  const dati: Parcheggiato = {
    ...giaParcheggiato(userId),
    ...(meta.dirty ? { stato: useJarvisStore.getState(), meta } : {}),
    ...(sessione ? { sessione } : {}),
    quando: new Date().toISOString(),
  }
  try { localStorage.setItem(PARCHEGGIO + userId, JSON.stringify(dati)) } catch { /* spazio finito: non c'è dove metterli */ }
}

function giaParcheggiato(userId: string): Partial<Parcheggiato> {
  try { return JSON.parse(localStorage.getItem(PARCHEGGIO + userId) ?? '{}') as Partial<Parcheggiato> } catch { return {} }
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
  // Prima di tutto il bridge del cloud smette di lavorare per chi esce. L'evento
  // di uscita arriva da fuori React, col bridge ancora montato e in ascolto: lo
  // store vuoto qui sotto gli arrivava come una modifica, segnata da inviare e —
  // con la sincronizzazione in errore — spedita subito. Cioè `saveUserData` con
  // lo stato VUOTO per l'account che stava uscendo, fermato solo dalle regole
  // del database su una sessione già chiusa.
  const sync = useSyncStatus.getState()
  sync.smetti?.()
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
  // Le facce di chi seguiva l'altro, idem.
  dimenticaProfili()
  dimenticaRuolo()
  // E l'allenamento a metà: restando, chi entrava dopo si ritrovava "riprendi"
  // sulle serie di un altro.
  scartaSessione()
  // Su desktop, gli allievi di chi allena (nomi e allenamenti) e la sezione
  // aperta — che può essere una scheda dell'altro, o il coaching di un
  // allenatore per chi allenatore non è.
  dimenticaAllievi()
  useNavDesktop.getState().vai('oggi')
  // E lo stato della sincronizzazione: anche entrando con un altro account
  // senza passare dall'uscita, chi arrivava ereditava "non sincronizzato" o
  // "app da aggiornare" — e con quest'ultimo non salvava più niente.
  sync.azzera()
}

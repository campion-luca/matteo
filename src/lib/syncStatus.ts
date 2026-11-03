import { create } from 'zustand'

export type SyncStatus = 'idle' | 'saving' | 'error'

// Store dedicato e leggero per lo stato della sincronizzazione cloud.
// Volutamente SEPARATO da useJarvisStore: se lo stato di sync vivesse nello
// store principale, ogni sua variazione farebbe scattare un nuovo save (loop).
interface SyncStatusStore {
  status: SyncStatus
  retry: (() => void) | null
  // Avviso effimero, non un errore: il dato locale è stato scavalcato da quello
  // di un altro dispositivo. Va detto, mai in silenzio, ma non richiede azione.
  notice: string | null
  /** I dati nel cloud sono stati scritti da un'app più NUOVA di questa. Finché
   *  è così questa non salva: toglierebbe dal cloud quello che non conosce
   *  (vedi `VERSIONE_DATI` nello store). Si spegne solo ricaricando l'app
   *  aggiornata. */
  vecchia: boolean
  /** Spinge subito al cloud quello che c'è da mandare. Lo mette il bridge
   *  quando è montato; serve a chi sta per uscire dall'account. */
  salvaOra: (() => void) | null
  /** Ferma per sempre il bridge in servizio: da lì non segna, non salva e non
   *  rilegge più niente. Lo mette il bridge quando è montato; lo chiama chi sta
   *  per svuotare lo store (vedi `svuotaDatiLocali`), perché lo store vuoto non
   *  è una modifica da mandare al cloud di chi esce. */
  smetti: (() => void) | null
  setVecchia: (vecchia: boolean) => void
  setSalvaOra: (salvaOra: (() => void) | null) => void
  setSmetti: (smetti: (() => void) | null) => void
  setStatus: (status: SyncStatus) => void
  setRetry: (retry: (() => void) | null) => void
  setNotice: (notice: string | null) => void
  /** Tutto come all'avvio: è lo stato della sincronizzazione di un ACCOUNT, e
   *  chi entra dopo non deve trovarsi "non sincronizzato" o "app da
   *  aggiornare" per conto di un altro. */
  azzera: () => void
}

const NOTICE_MS = 4000
let noticeTimer: ReturnType<typeof setTimeout> | undefined

export const useSyncStatus = create<SyncStatusStore>((set) => ({
  status: 'idle',
  retry: null,
  notice: null,
  vecchia: false,
  salvaOra: null,
  smetti: null,
  setVecchia: (vecchia) => set({ vecchia }),
  setSalvaOra: (salvaOra) => set({ salvaOra }),
  setSmetti: (smetti) => set({ smetti }),
  setStatus: (status) => set({ status }),
  setRetry: (retry) => set({ retry }),
  // L'auto-clear sta qui e non nel componente: l'avviso può essere impostato dal
  // bridge (fuori da React) e nessuno lo spegnerebbe.
  setNotice: (notice) => {
    clearTimeout(noticeTimer)
    set({ notice })
    if (notice) noticeTimer = setTimeout(() => set({ notice: null }), NOTICE_MS)
  },
  azzera: () => {
    clearTimeout(noticeTimer)
    set({ status: 'idle', retry: null, notice: null, vecchia: false })
  },
}))

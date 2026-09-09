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
  setStatus: (status: SyncStatus) => void
  setRetry: (retry: (() => void) | null) => void
  setNotice: (notice: string | null) => void
}

const NOTICE_MS = 4000
let noticeTimer: ReturnType<typeof setTimeout> | undefined

export const useSyncStatus = create<SyncStatusStore>((set) => ({
  status: 'idle',
  retry: null,
  notice: null,
  setStatus: (status) => set({ status }),
  setRetry: (retry) => set({ retry }),
  // L'auto-clear sta qui e non nel componente: l'avviso può essere impostato dal
  // bridge (fuori da React) e nessuno lo spegnerebbe.
  setNotice: (notice) => {
    clearTimeout(noticeTimer)
    set({ notice })
    if (notice) noticeTimer = setTimeout(() => set({ notice: null }), NOTICE_MS)
  },
}))

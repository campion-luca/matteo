// Dove si è, su desktop (ott 2026): la barra laterale sceglie una sezione e
// l'area accanto la mostra. Su telefono non si legge: lì si naviga a strati, una
// pagina sopra l'altra (vedi Pila), e la home è il punto da cui si parte.
//
// Sta in uno store e non nello stato di un componente perché la barra vive in
// App e le pagine no: schede, esercizi, calendario e statistiche sono di
// JarvisGym, il coaching di App. Tutti leggono da qui la sezione aperta, e
// chiunque può portare altrove (la ricerca, un tasto della pagina «Oggi»).
import { create } from 'zustand'

export type SezioneDesktop =
  | 'oggi' | 'schede' | 'esercizi' | 'calendario' | 'statistiche'
  | 'allievi' | 'messaggi' | 'coach'

/** Le sezioni del coaching: le apre App, non JarvisGym. */
export const SEZIONI_COACH: readonly SezioneDesktop[] = ['allievi', 'messaggi', 'coach']

export interface Destinazione {
  sezione: SezioneDesktop
  /** Con `schede`: la scheda da aprire sul dettaglio… */
  apri?: string
  /** …e se entrarci dritti nell'allenamento. */
  riprendi?: boolean
  /** Con `schede`: si parte dal modulo di una scheda nuova. */
  nuova?: boolean
  /** Con `calendario`: il giorno da mostrare. */
  giorno?: string
  /** Con `esercizi`: gruppo ed esercizio li ha appena scelti chi porta qui (la
   *  ricerca), e non vanno richiusi. Senza, si arriva in cima alla sezione. */
  tieni?: boolean
}

interface NavDesktop {
  dove: Destinazione
  /** Cresce a ogni spostamento. Le pagine che leggono `apri` o `giorno` solo
   *  quando nascono ce l'hanno come `key`, e ripartono da capo. */
  giro: number
  vai: (d: SezioneDesktop | Destinazione) => void
}

export const useNavDesktop = create<NavDesktop>(set => ({
  dove: { sezione: 'oggi' },
  giro: 0,
  vai: d => set(s => ({ dove: typeof d === 'string' ? { sezione: d } : d, giro: s.giro + 1 })),
}))

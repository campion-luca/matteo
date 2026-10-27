// Gli allievi di chi allena, per il desktop: il numero accanto ad «Allievi»
// nella barra e, nella pagina «Oggi», gli allenamenti di ciascuno.
//
// Uno store e non lo stato di una pagina: li leggono in due, e scaricarli costa
// una chiamata per l'elenco e una per allievo. Li carica la barra, che c'è
// sempre; se la rete non risponde restano quelli dell'ultima volta.
import { create } from 'zustand'
import { athleteData, myAthletes, type AthleteData, type CoachLink } from '@/lib/coach'

export interface Allievo {
  link: CoachLink
  /** I suoi dati d'allenamento. Null se non si sono potuti leggere. */
  dati: AthleteData | null
}

export const useAllievi = create<{ allievi: Allievo[] }>(() => ({ allievi: [] }))

export async function caricaAllievi(userId: string): Promise<void> {
  try {
    const links = await myAthletes(userId)
    const dati = await Promise.all(links.map(l => athleteData(l.athlete_id).catch(() => null)))
    useAllievi.setState({ allievi: links.map((link, i) => ({ link, dati: dati[i] })) })
  } catch {
    // Senza rete restano quelli di prima: la barra non è il posto per dirlo.
  }
}

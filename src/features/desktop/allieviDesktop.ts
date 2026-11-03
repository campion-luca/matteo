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

// Di chi sono gli allievi in memoria. «Restano quelli dell'ultima volta» vale per
// lo STESSO allenatore: i nomi e gli allenamenti dei suoi allievi sopravvivevano
// all'uscita, e chi entrava dopo sullo stesso computer se li trovava nella barra
// e in «Oggi» — senza rete, finché non tornava.
let caricatiPer: string | null = null

/** Al logout e al cambio d'account: sono dell'account, non del computer. */
export function dimenticaAllievi(): void {
  caricatiPer = null
  useAllievi.setState({ allievi: [] })
}

export async function caricaAllievi(userId: string): Promise<void> {
  if (caricatiPer !== userId) dimenticaAllievi()
  caricatiPer = userId
  try {
    const links = await myAthletes(userId)
    const dati = await Promise.all(links.map(l => athleteData(l.athlete_id).catch(() => null)))
    // Nel frattempo l'account è uscito, o ne è entrato un altro: la risposta è
    // arrivata tardi, e questi allievi non sono più di chi c'è adesso.
    if (caricatiPer !== userId) return
    useAllievi.setState({ allievi: links.map((link, i) => ({ link, dati: dati[i] })) })
  } catch {
    // Senza rete restano quelli di prima: la barra non è il posto per dirlo.
  }
}

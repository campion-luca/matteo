// Gli allenamenti fatti, giorno per giorno, e la serie di settimane di fila.
//
// Puro e senza React: lo usano la striscia della settimana in home e il
// calendario che si apre toccandola, e la serie è il genere di conto che un
// "caso ragionevole" rompe in silenzio (la settimana in corso, il cambio d'anno).
import type { HyroxExercise, PalestraExercise } from '@/store/useJarvisStore'
import { localISO } from '@/lib/isoDate'

export interface VoceAllenamento {
  id: string
  nome: string
  tipo: 'pesi' | 'hyrox'
  /** Indice della voce nello storico del suo esercizio: identifica la sessione. */
  indice: number
  /** La scheda eseguita, se l'alzata viene da una scheda. */
  scheda?: { id: string; nome: string }
}

/** Ogni giorno con almeno un'alzata o una sessione hyrox, con cosa si è fatto. */
export function giorniAllenati(palestra: PalestraExercise[], hyrox: HyroxExercise[]): Map<string, VoceAllenamento[]> {
  const out = new Map<string, VoceAllenamento[]>()
  const aggiungi = (date: string | undefined, voce: VoceAllenamento) => {
    if (!date) return
    const lista = out.get(date)
    if (lista) lista.push(voce)
    else out.set(date, [voce])
  }
  palestra.forEach(ex => ex.history.forEach((h, i) => aggiungi(h.date, { id: ex.id, nome: ex.n, tipo: 'pesi', indice: i, ...(h.scheda ? { scheda: h.scheda } : {}) })))
  hyrox.forEach(ex => ex.history.forEach((h, i) => aggiungi(h.date, { id: ex.id, nome: ex.n, tipo: 'hyrox', indice: i })))
  return out
}

export interface GiornoRaggruppato {
  /** Le schede eseguite quel giorno, ciascuna con i suoi esercizi. */
  schede: Array<{ id: string; nome: string; voci: VoceAllenamento[] }>
  /** Tutto quello registrato fuori da una scheda: alzate singole e hyrox. */
  alzate: VoceAllenamento[]
}

/** Divide le voci di un giorno fra schede eseguite e alzate registrate a parte.
 *  La stessa scheda eseguita due volte nello stesso giorno resta una riga sola. */
export function raggruppaGiorno(voci: VoceAllenamento[]): GiornoRaggruppato {
  const schede: GiornoRaggruppato['schede'] = []
  const alzate: VoceAllenamento[] = []
  for (const v of voci) {
    if (!v.scheda) { alzate.push(v); continue }
    const gia = schede.find(s => s.id === v.scheda?.id)
    if (gia) gia.voci.push(v)
    else schede.push({ id: v.scheda.id, nome: v.scheda.nome, voci: [v] })
  }
  return { schede, alzate }
}

/** Il lunedì della settimana di una data ISO, anch'esso in ISO. */
export function lunediDi(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const data = new Date(y, m - 1, d)
  data.setDate(data.getDate() - ((data.getDay() + 6) % 7))
  return localISO(data)
}

/** Quante settimane (da lunedì a domenica) di fila contengono almeno un
 *  allenamento, contando all'indietro da quella di `oggi`.
 *
 *  La settimana in corso non spezza la serie finché non è finita: il lunedì
 *  mattina chi si è allenato ogni settimana da due mesi ha ancora la sua serie,
 *  non uno zero. Conta se c'è già un allenamento, altrimenti si parte dalla
 *  precedente. */
export function settimaneDiFila(date: Iterable<string>, oggi: string): number {
  const settimane = new Set<string>()
  for (const d of date) settimane.add(lunediDi(d))

  const [y, m, d] = lunediDi(oggi).split('-').map(Number)
  const cursore = new Date(y, m - 1, d)
  if (!settimane.has(localISO(cursore))) cursore.setDate(cursore.getDate() - 7)

  let serie = 0
  while (settimane.has(localISO(cursore))) {
    serie++
    cursore.setDate(cursore.getDate() - 7)
  }
  return serie
}

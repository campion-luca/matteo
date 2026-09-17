// Le giornate di allenamento di un allievo, lette con gli occhi di chi l'allena.
//
// Lo storico è per esercizio; un allenatore ragiona per giornate e per schede:
// "giovedì doveva fare la scheda A — l'ha fatta tutta? ha tirato meno?". Qui si
// ricostruisce ogni giornata e, dove l'alzata viene da una scheda, la si confronta
// con quello che la scheda chiedeva:
//
//   - un esercizio della scheda senza nessuna alzata quel giorno è SALTATO;
//   - meno serie di quelle previste sono serie MANCANTI;
//   - una serie sotto i colpi previsti è una serie CORTA (con "8-10" conta il
//     minimo: fare 8 è rispettare la scheda);
//   - il carico si confronta con l'ultima volta che ha fatto quell'esercizio,
//     scheda o no: sale, scende o resta.
//
// Logica pura, senza JSX: la schermata la disegna CoachSessioni, e i conti si
// testano qui.
import type { GymScheda, GymSchedaExercise, PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'
import { effectiveLoad, entryVolume, setRepsOf, displayMuscle } from '@/features/gym/gymModel'

export interface EsitoEsercizio {
  nome: string
  muscle?: string
  /** Cosa chiedeva la scheda. Assente per le alzate fuori scheda. */
  previsto?: { serie: number; colpi: string; colpiMin: number | null }
  /** L'alzata registrata. Assente se l'esercizio è stato saltato. */
  fatto?: PalestraHistoryEntry
  saltato: boolean
  serieMancanti: number
  /** Gli indici (da 0) delle serie sotto i colpi previsti. */
  serieCorte: number[]
  /** Il carico più pesante di oggi e dell'ultima volta prima di oggi. */
  carico: { ora: number; prima: number | null; delta: number | null } | null
  /** Fatto in una giornata di scheda, ma non previsto dalla scheda. */
  fuoriScheda: boolean
}

export interface GruppoGiornata {
  /** La scheda da cui vengono le alzate; `null` per quelle registrate a mano. */
  scheda: { id: string; nome: string } | null
  /** false se la scheda non esiste più: si vedono le alzate, non il confronto. */
  confrontabile: boolean
  esercizi: EsitoEsercizio[]
}

export interface Giornata {
  date: string
  volume: number
  gruppi: GruppoGiornata[]
  /** Solo hyrox: nessuna alzata di pesi quel giorno. */
  soloHyrox: boolean
  saltati: number
  serieMancanti: number
  serieCorte: number
  /** Esercizi con carico sceso rispetto all'ultima volta. */
  caloCarico: number
}

const norm = (s: string) => s.trim().toLowerCase()

/** Il primo numero dei colpi previsti: "10" → 10, "8-10" → 8, "max" → null. */
export function colpiMinimi(colpi: string): number | null {
  const m = colpi.match(/\d+/)
  return m ? parseInt(m[0], 10) : null
}

/** Arrotonda al mezzo chilo: una differenza di 0,03 kg nata da una media non è
 *  un cambio di carico. */
const mezzoChilo = (x: number) => Math.round(x * 2) / 2

/** L'esercizio dello storico che corrisponde a una voce di scheda: prima per
 *  collegamento esplicito, poi per nome. Una scheda scritta da un allenatore ha
 *  i nomi, non gli id dell'allievo. */
function esercizioDi(se: GymSchedaExercise, palestra: PalestraExercise[]): PalestraExercise | undefined {
  return (se.linkedExerciseId ? palestra.find(e => e.id === se.linkedExerciseId) : undefined)
    ?? palestra.find(e => norm(e.n) === norm(se.name))
}

export function analizzaGiornate(
  palestra: PalestraExercise[],
  schede: GymScheda[],
  pesoCorporeo: number,
  giorniHyrox: string[] = [],
): Giornata[] {
  // Il carico dell'ultima volta prima di una data, per esercizio.
  const caricoPrima = (ex: PalestraExercise, date: string): number | null => {
    const prima = ex.history.filter(h => h.date && h.date < date)
    if (!prima.length) return null
    const ultima = prima.reduce((a, b) => (b.date! > a.date! ? b : a))
    return effectiveLoad(ultima, pesoCorporeo)
  }

  // Tutte le alzate, raggruppate per giornata.
  const perGiorno = new Map<string, Array<{ ex: PalestraExercise; h: PalestraHistoryEntry }>>()
  for (const ex of palestra) {
    for (const h of ex.history) {
      if (!h.date) continue
      const lista = perGiorno.get(h.date) ?? []
      lista.push({ ex, h })
      perGiorno.set(h.date, lista)
    }
  }
  for (const d of giorniHyrox) if (!perGiorno.has(d)) perGiorno.set(d, [])

  const schedaPerId = new Map(schede.map(s => [s.id, s]))

  const esito = (ex: PalestraExercise, h: PalestraHistoryEntry, date: string, previsto?: GymSchedaExercise): EsitoEsercizio => {
    const colpi = setRepsOf(h)
    const min = previsto ? colpiMinimi(previsto.reps) : null
    const ora = effectiveLoad(h, pesoCorporeo)
    const prima = caricoPrima(ex, date)
    return {
      nome: ex.n,
      muscle: displayMuscle(ex.muscle),
      previsto: previsto ? { serie: previsto.sets, colpi: previsto.reps, colpiMin: min } : undefined,
      fatto: h,
      saltato: false,
      serieMancanti: previsto ? Math.max(0, previsto.sets - h.sets_n) : 0,
      serieCorte: min === null ? [] : colpi.map((c, i) => (c < min ? i : -1)).filter(i => i >= 0),
      carico: { ora, prima, delta: prima === null ? null : mezzoChilo(ora - prima) },
      fuoriScheda: false,
    }
  }

  const giornate: Giornata[] = []
  for (const [date, alzate] of perGiorno) {
    // Un gruppo per scheda, più uno per le alzate registrate a mano.
    const gruppi = new Map<string, GruppoGiornata>()
    const chiave = (h: PalestraHistoryEntry) => h.scheda?.id ?? ''
    for (const { h } of alzate) {
      const k = chiave(h)
      if (!gruppi.has(k)) {
        gruppi.set(k, {
          scheda: h.scheda ?? null,
          confrontabile: !!h.scheda && schedaPerId.has(h.scheda.id),
          esercizi: [],
        })
      }
    }

    for (const [k, g] of gruppi) {
      const qui = alzate.filter(a => chiave(a.h) === k)
      const def = g.scheda ? schedaPerId.get(g.scheda.id) : undefined
      if (!def) {
        g.esercizi = qui.map(a => esito(a.ex, a.h, date))
        continue
      }
      // In ordine di scheda, con i saltati al loro posto: si legge come la
      // scheda stessa, e un buco si vede dove sta.
      const usate = new Set<PalestraHistoryEntry>()
      for (const se of def.exercises) {
        if (!se.name.trim()) continue
        const ex = esercizioDi(se, palestra)
        const trovata = ex ? qui.find(a => a.ex.id === ex.id && !usate.has(a.h)) : undefined
        if (trovata) {
          usate.add(trovata.h)
          g.esercizi.push(esito(trovata.ex, trovata.h, date, se))
        } else {
          g.esercizi.push({
            nome: ex?.n ?? se.name, muscle: ex ? displayMuscle(ex.muscle) : se.muscle,
            previsto: { serie: se.sets, colpi: se.reps, colpiMin: colpiMinimi(se.reps) },
            saltato: true, serieMancanti: se.sets, serieCorte: [], carico: null, fuoriScheda: false,
          })
        }
      }
      for (const a of qui) {
        if (!usate.has(a.h)) g.esercizi.push({ ...esito(a.ex, a.h, date), fuoriScheda: true })
      }
    }

    const tutti = [...gruppi.values()].flatMap(g => g.esercizi)
    giornate.push({
      date,
      volume: alzate.reduce((s, a) => s + entryVolume(a.h, pesoCorporeo), 0),
      // Le schede prima, le alzate a mano in fondo.
      gruppi: [...gruppi.values()].sort((a, b) => Number(!a.scheda) - Number(!b.scheda)),
      soloHyrox: alzate.length === 0,
      saltati: tutti.filter(e => e.saltato).length,
      // Le serie dei saltati non si contano due volte: un esercizio saltato è già
      // un problema suo, non anche "quattro serie mancanti".
      serieMancanti: tutti.filter(e => !e.saltato).reduce((s, e) => s + e.serieMancanti, 0),
      serieCorte: tutti.reduce((s, e) => s + e.serieCorte.length, 0),
      caloCarico: tutti.filter(e => (e.carico?.delta ?? 0) < 0).length,
    })
  }

  return giornate.sort((a, b) => b.date.localeCompare(a.date))
}

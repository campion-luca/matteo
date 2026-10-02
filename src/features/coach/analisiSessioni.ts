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
import { quotaCorpo } from '@/features/gym/catalogo'
import { giorniTra, localISO, todayISO } from '@/lib/isoDate'

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

/** Il carico che si CONFRONTA da una volta all'altra: i chili messi, non il
 *  corpo. A corpo libero è la sola zavorra — il peso di chi si allena non è
 *  una scelta di quel giorno, e contarlo farebbe leggere come "carico salito"
 *  un chilo preso sulla bilancia. */
const caricoMesso = (h: PalestraHistoryEntry) => effectiveLoad(h, 0)

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
    return caricoMesso(ultima)
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
    const ora = caricoMesso(h)
    const prima = caricoPrima(ex, date)
    // A corpo libero e senza zavorra, né ora né prima: non c'è un carico da
    // confrontare, e "= stesso carico" accanto a degli addominali è una riga
    // che non dice niente.
    const senzaCarico = ora === 0 && !prima
    return {
      nome: ex.n,
      muscle: displayMuscle(ex.muscle),
      previsto: previsto ? { serie: previsto.sets, colpi: previsto.reps, colpiMin: min } : undefined,
      fatto: h,
      saltato: false,
      serieMancanti: previsto ? Math.max(0, previsto.sets - h.sets_n) : 0,
      serieCorte: min === null ? [] : colpi.map((c, i) => (c < min ? i : -1)).filter(i => i >= 0),
      carico: { ora, prima, delta: prima === null || senzaCarico ? null : mezzoChilo(ora - prima) },
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
      volume: alzate.reduce((s, a) => s + entryVolume(a.h, pesoCorporeo * quotaCorpo(a.ex)), 0),
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

// ── Le giornate, settimana per settimana ───────────────────────
// Un allenatore non ragiona per date ma per settimane di programma: "alla
// terza settimana ha saltato il giovedì". E le settimane che contano sono le
// SUE — si parte dal giorno in cui ha assegnato la prima scheda, non dal lunedì
// del calendario: assegnata di mercoledì, la settimana 1 va da mercoledì a
// martedì, e ogni settimana contiene un giro completo di schede.
//
// Ci sono anche le settimane VUOTE fra la prima e quella in corso: una
// settimana senza nemmeno una sessione è l'informazione più importante
// dell'elenco, e raggruppando solo le giornate esistenti sparirebbe.
export interface SettimanaSessioni {
  /** 1 = la settimana in cui sono state assegnate le schede. `null` per quello
   *  che è successo prima: non fa parte del programma. */
  n: number | null
  /** Primo e ultimo giorno ("YYYY-MM-DD"). */
  da: string
  a: string
  /** La settimana che contiene oggi. */
  inCorso: boolean
  /** Dalla più recente. Vuoto per una settimana senza sessioni. */
  giornate: Giornata[]
}

/** Una giornata ha qualcosa che non torna rispetto alla scheda. */
export function haProblemi(g: Giornata): boolean {
  return g.saltati + g.serieMancanti + g.serieCorte + g.caloCarico > 0
}

const piuGiorni = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number)
  return localISO(new Date(y, m - 1, d + n))
}

/** Le giornate raggruppate in settimane di sette giorni a partire da `inizio`,
 *  dalla più recente. Senza `inizio` (nessuna scheda assegnata) si parte dalla
 *  prima sessione registrata. */
export function perSettimana(giornate: Giornata[], inizio: string | null, oggi: string = todayISO()): SettimanaSessioni[] {
  if (!giornate.length) return []
  const prima = giornate.reduce((m, g) => (g.date < m ? g.date : m), giornate[0].date)
  const zero = inizio ?? prima
  const numero = (date: string) => Math.floor(giorniTra(zero, date) / 7) + 1

  const perNumero = new Map<number, Giornata[]>()
  const precedenti: Giornata[] = []
  for (const g of giornate) {
    if (g.date < zero) { precedenti.push(g); continue }
    const n = numero(g.date)
    perNumero.set(n, [...(perNumero.get(n) ?? []), g])
  }

  // Fino alla settimana in corso, o all'ultima con una sessione se è più in là
  // (una data sbagliata nel futuro non deve restare fuori dall'elenco).
  const ultima = Math.max(oggi >= zero ? numero(oggi) : 0, ...perNumero.keys())
  const out: SettimanaSessioni[] = []
  for (let n = ultima; n >= 1; n--) {
    const da = piuGiorni(zero, (n - 1) * 7)
    const a = piuGiorni(da, 6)
    out.push({
      n, da, a,
      inCorso: oggi >= da && oggi <= a,
      giornate: (perNumero.get(n) ?? []).sort((x, y) => y.date.localeCompare(x.date)),
    })
  }
  if (precedenti.length) {
    precedenti.sort((x, y) => y.date.localeCompare(x.date))
    out.push({ n: null, da: precedenti[precedenti.length - 1].date, a: precedenti[0].date, inCorso: false, giornate: precedenti })
  }
  return out
}

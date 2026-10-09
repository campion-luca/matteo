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
//     minimo: fare 8 è rispettare la scheda; con "10-8-6" ogni serie ha il suo);
//   - il carico si confronta con l'ultima volta che ha fatto quell'esercizio,
//     scheda o no: sale, scende o resta.
//
// ── La scheda di QUEL giorno, non quella di oggi ───────────────
// Una scheda si modifica: una serie in più, un esercizio aggiunto, uno cambiato
// con un altro. Giudicando ogni giornata con la scheda com'è adesso, il giorno
// dopo una modifica tutte le settimane passate cambiavano colore: l'esercizio
// aggiunto ieri risultava "saltato" in ogni allenamento del mese prima, e quello
// sostituito "fuori scheda". Qui si usa quello che si sa di allora:
//   - ogni alzata fatta da una scheda porta con sé cosa la scheda chiedeva quel
//     giorno e da quale riga viene (`piano`): serie e colpi previsti si leggono
//     da lì, e l'alzata si rimette sulla SUA riga anche se oggi quella riga è
//     un altro esercizio;
//   - una riga scritta DOPO quel giorno (la data sta nel suo id) quel giorno non
//     c'era, e non si può averla saltata;
//   - un'alzata con il suo `piano` che oggi non ha più una riga era in scheda
//     quel giorno: non è "fuori scheda".
// Quello che resta fuori, perché non ha lasciato traccia:
//   - un esercizio saltato quel giorno e POI tolto dalla scheda non compare;
//   - una riga aggiunta lo stesso giorno, dopo l'allenamento, per quel giorno
//     risulta saltata (dell'alzata si sa il giorno, non l'ora);
//   - le alzate salvate prima che esistesse `piano.riga` si abbinano per nome
//     come sempre: una riga cambiata con un altro esercizio, in quei giorni,
//     risulta ancora saltata e l'esercizio di allora fuori scheda.
// Niente di tutto questo si indovina: un tentativo di dedurlo dai numeri
// nascondeva i saltati veri, che sono la cosa che chi allena cerca.
//
// Logica pura, senza JSX: la schermata la disegna CoachSessioni, e i conti si
// testano qui.
import type { GymScheda, GymSchedaExercise, PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'
import { effectiveLoad, entryVolume, setRepsOf, displayMuscle, colpiPrevisti } from '@/features/gym/gymModel'
import { quotaCorpo } from '@/features/gym/catalogo'
import { hyroxVisibili } from '@/features/gym/hyroxAttivo'
import { giorniTra, localISO, todayISO } from '@/lib/isoDate'
import type { AthleteData } from '@/lib/coach'

export interface EsitoEsercizio {
  /** L'id dell'esercizio nello storico dell'allievo. Assente se è stato saltato
   *  e non esiste ancora: serve a chi vuole correggere l'alzata. */
  exId?: string
  nome: string
  muscle?: string
  /** Cosa chiedeva la scheda quel giorno. Assente per le alzate fuori scheda. */
  previsto?: { serie: number; colpi: string }
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
  /** Esercizi con carico salito rispetto all'ultima volta. */
  caricoSalito: number
  /** Quanto è durato l'allenamento, in secondi, se l'app dell'allievo l'ha
   *  misurato. Con due schede nello stesso giorno, la somma delle due. */
  durataSec?: number
}

const norm = (s: string) => s.trim().toLowerCase()

/** Il giorno in cui una riga di scheda è stata scritta ("YYYY-MM-DD"), letto
 *  dal suo id: le righe nascono con `uid('r')`, cioè "r" + l'istante in base 36
 *  + qualche carattere a caso (vedi lib/uid.ts). `null` se l'id non è fatto
 *  così — allora della riga non si sa niente, e si assume che ci sia sempre
 *  stata, com'era prima. */
export function rigaNataIl(id: string): string | null {
  const m = /^r([0-9a-z]{8})[0-9a-z]{0,6}$/.exec(id)
  if (!m) return null
  const ms = parseInt(m[1], 36)
  // Un istante plausibile: né prima che l'app esistesse, né nel futuro.
  if (!(ms > Date.UTC(2024, 0, 1) && ms < Date.now() + 2 * 86_400_000)) return null
  return localISO(new Date(ms))
}

/** Quali delle serie FATTE (indici da 0) sono rimaste sotto il loro bersaglio.
 *
 *  L'alzata salva solo le serie fatte, in ordine, senza dire quali erano. Se ci
 *  sono tutte, la prima fatta è la prima prevista. Se ne manca qualcuna e i
 *  bersagli sono diversi ("10-8-6" con due serie fatte, a 8 e a 6) non si sa a
 *  quali corrispondano: si prende l'abbinamento che ne lascia corte di meno.
 *  Quelle due serie possono essere la seconda e la terza, fatte alla lettera —
 *  e una serie in meno è già detta altrove, non va detta anche come due corte. */
export function serieSottoIlBersaglio(colpi: number[], minimi: number[]): number[] {
  const k = colpi.length, n = minimi.length
  const corta = (j: number, i: number) => colpi[j] < (minimi[Math.min(i, n - 1)] ?? 0)
  if (n === 0) return []
  if (k >= n || new Set(minimi).size === 1) {
    return colpi.map((_, j) => (corta(j, j) ? j : -1)).filter(j => j >= 0)
  }
  // costo[j][i]: il minimo di serie corte mettendo le fatte da j in poi sui
  // bersagli da i in poi (ogni serie fatta su un bersaglio successivo a quello
  // della precedente).
  const costo = Array.from({ length: k + 1 }, () => Array<number>(n + 1).fill(Infinity))
  for (let i = 0; i <= n; i++) costo[k][i] = 0
  for (let j = k - 1; j >= 0; j--) {
    for (let i = n - (k - j); i >= 0; i--) {
      costo[j][i] = Math.min(costo[j][i + 1], (corta(j, i) ? 1 : 0) + costo[j + 1][i + 1])
    }
  }
  const out: number[] = []
  for (let j = 0, i = 0; j < k; i++) {
    const qui = (corta(j, i) ? 1 : 0) + costo[j + 1][i + 1]
    // A parità si resta sul bersaglio più vicino all'inizio: è la lettura di
    // prima, e cambia solo quando un'altra è davvero migliore.
    if (qui <= costo[j][i + 1]) { if (corta(j, i)) out.push(j); j++ }
  }
  return out
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

  const esito = (ex: PalestraExercise, h: PalestraHistoryEntry, date: string, previsto?: { sets: number; reps: string }): EsitoEsercizio => {
    const colpi = setRepsOf(h)
    const minimi = previsto ? colpiPrevisti(previsto.reps, previsto.sets) : []
    const ora = caricoMesso(h)
    const prima = caricoPrima(ex, date)
    // A corpo libero e senza zavorra, né ora né prima: non c'è un carico da
    // confrontare, e "= stesso carico" accanto a degli addominali è una riga
    // che non dice niente.
    const senzaCarico = ora === 0 && !prima
    return {
      exId: ex.id,
      nome: ex.n,
      muscle: displayMuscle(ex.muscle),
      previsto: previsto ? { serie: previsto.sets, colpi: previsto.reps } : undefined,
      fatto: h,
      saltato: false,
      serieMancanti: previsto ? Math.max(0, previsto.sets - h.sets_n) : 0,
      serieCorte: serieSottoIlBersaglio(colpi, minimi),
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
      const righeDiOggi = new Set(def.exercises.map(se => se.id))
      for (const se of def.exercises) {
        if (!se.name.trim()) continue
        const ex = esercizioDi(se, palestra)
        // Prima l'alzata che dice di venire da QUESTA riga, anche se allora la
        // riga era un altro esercizio. Poi, per nome, una che non appartenga
        // già a un'altra riga di oggi.
        const trovata = qui.find(a => !usate.has(a.h) && a.h.piano?.riga === se.id)
          ?? (ex ? qui.find(a => a.ex.id === ex.id && !usate.has(a.h) && !(a.h.piano?.riga && righeDiOggi.has(a.h.piano.riga))) : undefined)
        if (trovata) {
          usate.add(trovata.h)
          // Serie e colpi come li chiedeva la scheda QUEL giorno, se l'alzata
          // se li è portati dietro; altrimenti quelli di oggi.
          g.esercizi.push(esito(trovata.ex, trovata.h, date, trovata.h.piano ?? se))
          continue
        }
        // Scritta dopo quel giorno: non c'era, non si può averla saltata.
        const nata = rigaNataIl(se.id)
        if (nata && nata > date) continue
        g.esercizi.push({
          nome: ex?.n ?? se.name, muscle: ex ? displayMuscle(ex.muscle) : se.muscle,
          previsto: { serie: se.sets, colpi: se.reps },
          saltato: true, serieMancanti: se.sets, serieCorte: [], carico: null, fuoriScheda: false,
        })
      }
      // Le alzate senza una riga, oggi. Con il loro `piano` erano righe della
      // scheda quel giorno, tolte dopo: si vedono con quello che chiedevano
      // allora. Senza, sono di prima che il piano si salvasse, e non c'è modo
      // di dire se erano in scheda: restano "fuori scheda", come sempre.
      for (const a of qui) {
        if (!usate.has(a.h)) g.esercizi.push({ ...esito(a.ex, a.h, date, a.h.piano), fuoriScheda: !a.h.piano })
      }
    }

    const tutti = [...gruppi.values()].flatMap(g => g.esercizi)
    // La durata sta su ogni alzata della sessione, uguale per tutte: se ne
    // prende una per scheda, e si sommano le schede del giorno.
    const durate = new Map<string, number>()
    for (const a of alzate) if (a.h.durataSec) durate.set(a.h.scheda?.id ?? '', a.h.durataSec)
    const durataSec = [...durate.values()].reduce((s, x) => s + x, 0)
    giornate.push({
      date,
      ...(durataSec ? { durataSec } : {}),
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
      caricoSalito: tutti.filter(e => (e.carico?.delta ?? 0) > 0).length,
    })
  }

  return giornate.sort((a, b) => b.date.localeCompare(a.date))
}

/** Le giornate di un allievo, dai dati che arrivano dal server e dalle schede
 *  che gli ho assegnato. Sta qui perché le leggono due pagine — le sessioni e
 *  il confronto — e devono leggere le stesse. */
export function giornateAllievo(data: AthleteData, schedeAssegnate: GymScheda[]): Giornata[] {
  // Le assegnate prima: a parità di id è la versione dell'allenatore a dire
  // cosa andava fatto.
  const schede = [...schedeAssegnate, ...(data.gymSchede ?? []).filter(s => !schedeAssegnate.some(a => a.id === s.id))]
  const giorniHyrox = hyroxVisibili(data.hyroxExercises).flatMap(ex => ex.history.map(h => h.date)).filter((d): d is string => !!d)
  return analizzaGiornate(data.palestraExercises ?? [], schede, data.userWeight ?? 0, giorniHyrox)
}

// ── Com'è andata una giornata sui carichi ──────────────────────
// Il colore del quadratino nella riga della settimana. Una cosa sola, i chili
// rispetto all'ultima volta: saliti, scesi, tutte e due le cose, o come prima.
// Quello che non torna con la scheda (un esercizio saltato, una serie corta) sta
// scritto accanto: qui si guarda da lontano se quella settimana si è spinto.
export type EsitoCarichi = 'su' | 'giu' | 'misto' | 'pari'

export function esitoCarichi(g: Giornata): EsitoCarichi {
  if (g.caricoSalito > 0 && g.caloCarico > 0) return 'misto'
  if (g.caricoSalito > 0) return 'su'
  if (g.caloCarico > 0) return 'giu'
  return 'pari'
}

// ── Due allenamenti a confronto ────────────────────────────────
// Chi allena sceglie due giornate e guarda, esercizio per esercizio, cosa è
// cambiato: i chili e i colpi. Il verso è sempre dal più vecchio al più
// recente, in qualunque ordine si siano scelte.
export interface RigaConfronto {
  nome: string
  muscle?: string
  /** L'alzata nella giornata più vecchia e in quella più recente. Una delle due
   *  manca se l'esercizio è stato fatto solo in una. */
  prima?: PalestraHistoryEntry
  dopo?: PalestraHistoryEntry
  /** Di quanto sono cambiati i chili (il carico più pesante della giornata).
   *  `null` se manca una delle due, o se non c'è un carico da confrontare. */
  kg: number | null
  /** Di quanto sono cambiati i colpi fatti in tutto, sommando le serie. */
  colpi: number | null
}

export interface ConfrontoGiornate {
  prima: Giornata
  dopo: Giornata
  righe: RigaConfronto[]
}

/** I colpi fatti in tutto in un'alzata: tre serie da dieci sono trenta. */
export const colpiTotali = (h: PalestraHistoryEntry) => setRepsOf(h).reduce((s, c) => s + c, 0)

export function confrontaGiornate(a: Giornata, b: Giornata): ConfrontoGiornate {
  const [prima, dopo] = a.date <= b.date ? [a, b] : [b, a]
  // Solo quello che è stato fatto davvero: un esercizio saltato non ha numeri.
  const fatti = (g: Giornata) => g.gruppi.flatMap(gr => gr.esercizi).filter(e => !!e.fatto)
  const chiave = (e: EsitoEsercizio) => e.exId ?? norm(e.nome)
  const diPrima = new Map<string, EsitoEsercizio>()
  for (const e of fatti(prima)) if (!diPrima.has(chiave(e))) diPrima.set(chiave(e), e)

  const righe: RigaConfronto[] = []
  const visti = new Set<string>()
  // Nell'ordine della giornata più recente: è quella che si sta giudicando.
  for (const e of fatti(dopo)) {
    const k = chiave(e)
    if (visti.has(k)) continue
    visti.add(k)
    const p = diPrima.get(k)
    if (!p?.fatto) { righe.push({ nome: e.nome, muscle: e.muscle, dopo: e.fatto, kg: null, colpi: null }); continue }
    const kgPrima = caricoMesso(p.fatto), kgDopo = caricoMesso(e.fatto!)
    righe.push({
      nome: e.nome, muscle: e.muscle, prima: p.fatto, dopo: e.fatto,
      // A corpo libero senza zavorra da tutte e due le parti i chili non sono
      // una scelta: lì parlano solo i colpi.
      kg: kgPrima === 0 && kgDopo === 0 ? null : mezzoChilo(kgDopo - kgPrima),
      colpi: colpiTotali(e.fatto!) - colpiTotali(p.fatto),
    })
  }
  // In fondo quello che c'era solo la volta prima.
  for (const [k, p] of diPrima) {
    if (!visti.has(k)) righe.push({ nome: p.nome, muscle: p.muscle, prima: p.fatto, kg: null, colpi: null })
  }
  return { prima, dopo, righe }
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

/** Un giorno nella riga di una settimana: allenato (con la sua giornata) o no. */
export interface GiornoSettimana {
  date: string
  giornata: Giornata | null
  /** Non è ancora arrivato: non è un giorno saltato. */
  futuro: boolean
}

/** I sette giorni di una settimana, dal primo all'ultimo, ognuno con la sua
 *  giornata se quel giorno ci si è allenati. "Prima delle schede" non è una
 *  settimana — è lunga quanto capita — e lì tornano solo le giornate fatte. */
export function giorniDellaSettimana(s: SettimanaSessioni, oggi: string = todayISO()): GiornoSettimana[] {
  if (s.n === null) return [...s.giornate].reverse().map(g => ({ date: g.date, giornata: g, futuro: false }))
  const perData = new Map(s.giornate.map(g => [g.date, g]))
  return Array.from({ length: 7 }, (_, i) => {
    const date = piuGiorni(s.da, i)
    return { date, giornata: perData.get(date) ?? null, futuro: date > oggi }
  })
}

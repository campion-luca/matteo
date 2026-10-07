// Cosa salvare del locale quando il cloud ha già una versione più nuova.
//
// Il blob utente è un oggetto solo e la politica è "vince l'ultimo che scrive".
// Detta così, però, significa che una scheda creata su questo telefono e non
// ancora arrivata al server sparisce appena si scopre che un altro dispositivo
// ha scritto nel frattempo — ed è esattamente come si perdeva una scheda appena
// salvata: il computer lasciato aperto caricava il suo stato vecchio, e il
// telefono, trovandolo "più recente", buttava il proprio.
//
// Non si fonde tutto (le modifiche a una stessa scheda su due dispositivi
// restano "vince il più recente"): si recupera ciò che è stato CREATO qui —
// schede, esercizi, e le ALZATE registrate su esercizi che esistono anche là.
// Queste ultime sono il caso che fa più male: il telefono rimasto indietro di
// un salvataggio del computer finiva una scheda, scopriva il remoto "più
// recente" e buttava l'allenamento intero, con la sessione in corso già
// scartata. Per
// distinguere "creato qui" da "cancellato altrove" serve sapere cosa c'era
// all'ultimo sync — `NotiAlSync`, salvato insieme alla meta di sincronizzazione.
// Un id che il locale ha, il remoto no e l'ultimo sync nemmeno è nato qui.
// Uno che c'era all'ultimo sync e il remoto non ha più è stato cancellato
// altrove, e non va resuscitato.
import type { GymScheda, HyroxGara, JarvisState, PalestraExercise, PalestraHistoryEntry, WeightLogEntry } from '@/store/useJarvisStore'

export interface NotiAlSync {
  schede: string[]
  esercizi: string[]
  /** Le giornate di alzate presenti all'ultimo sync, una chiave per esercizio e
   *  giorno (vedi `chiaveAlzata`). Assente nelle meta di versioni precedenti. */
  alzate?: string[]
  /** Le gare Hyrox registrate. Assente nelle meta salvate prima che esistessero. */
  gare?: string[]
  /** I giorni delle pesate presenti all'ultimo sync. Assente nelle meta di prima. */
  pesate?: string[]
}

type Recuperabile = Pick<JarvisState, 'gymSchede' | 'palestraExercises' | 'hyroxGare'> & Partial<Pick<JarvisState, 'weightLog'>>

/** Un'alzata si riconosce da esercizio e giorno, non dai suoi numeri: così una
 *  correzione (80 → 85 kg) resta la stessa alzata e non ne nasce una seconda,
 *  e le alzate non hanno bisogno di un id proprio. Le voci senza data, vecchie,
 *  ricadono sull'etichetta della settimana.
 *
 *  Dalla SECONDA alzata dello stesso esercizio nello stesso giorno la chiave
 *  porta anche il suo numero d'ordine. Senza, la seconda aveva la chiave della
 *  prima: bastava che il remoto avesse quella giornata perché la seconda
 *  risultasse "già là", e in un conflitto si perdeva. La prima resta senza
 *  numero, così le chiavi salvate fin qui continuano a valere. */
function chiaviAlzate(exId: string, history: PalestraHistoryEntry[]): string[] {
  const viste = new Map<string, number>()
  return history.map(h => {
    const giorno = h.date ?? h.d
    const n = (viste.get(giorno) ?? 0) + 1
    viste.set(giorno, n)
    return n === 1 ? `${exId}|${giorno}` : `${exId}|${giorno}|${n}`
  })
}

export function idsNoti(s: Recuperabile): NotiAlSync {
  const alzate = new Set<string>()
  for (const ex of s.palestraExercises ?? []) for (const k of chiaviAlzate(ex.id, ex.history ?? [])) alzate.add(k)
  return {
    schede: (s.gymSchede ?? []).map(x => x.id),
    esercizi: (s.palestraExercises ?? []).map(x => x.id),
    alzate: [...alzate],
    gare: (s.hyroxGare ?? []).map(x => x.id),
    pesate: (s.weightLog ?? []).map(x => x.date),
  }
}

function soloQui<T extends { id: string }>(locali: T[], remoti: T[], noti: string[] | undefined): T[] {
  const inRemoto = new Set(remoti.map(x => x.id))
  const giaNoti = new Set(noti ?? [])
  return locali.filter(x => !inRemoto.has(x.id) && !giaNoti.has(x.id))
}

/** Gli esercizi del remoto con dentro le alzate nate qui. Un'alzata è nata qui
 *  se la sua giornata, su quell'esercizio, non c'è nel remoto e non c'era
 *  all'ultimo sync. Se c'era all'ultimo sync e il remoto non l'ha più, è stata
 *  cancellata altrove e resta cancellata; se il remoto ha già quella giornata,
 *  vince la sua versione — due allenamenti dello stesso esercizio nello stesso
 *  giorno su due dispositivi sono la stessa alzata corretta, non due alzate.
 *  `null` se non c'è niente da aggiungere. */
function conAlzateNateQui(
  locali: PalestraExercise[], remoti: PalestraExercise[], noti: string[] | undefined,
): PalestraExercise[] | null {
  const giaNote = new Set(noti ?? [])
  const localePerId = new Map(locali.map(e => [e.id, e]))
  let trovate = false
  const out = remoti.map(rem => {
    const loc = localePerId.get(rem.id)
    if (!loc) return rem
    const nelRemoto = new Set(chiaviAlzate(rem.id, rem.history ?? []))
    const chiaviLocali = chiaviAlzate(rem.id, loc.history ?? [])
    const nuove = (loc.history ?? []).filter((_, i) => {
      const k = chiaviLocali[i]
      return !nelRemoto.has(k) && !giaNote.has(k)
    })
    if (!nuove.length) return rem
    trovate = true
    // Per data, come ovunque: l'alzata di oggi va in fondo e diventa "l'ultima
    // volta", quella con data arretrata no.
    const history = [...(rem.history ?? []), ...nuove].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    const last = history[history.length - 1]
    return { ...rem, history, current: { kg: last.kg, reps: last.reps, sets_n: last.sets_n } }
  })
  return trovate ? out : null
}

/** Le pesate del remoto con dentro quelle nate qui: un giorno che il remoto non
 *  ha e che all'ultimo sync non c'era. Una pesata è una riga per giorno, quindi
 *  il giorno fa da id; lo stesso giorno pesato su due dispositivi resta "vince
 *  il remoto", come due correzioni alla stessa alzata. `null` se non c'è niente
 *  da aggiungere — o se chi chiama non ha passato le pesate. */
function conPesateNateQui(
  locali: WeightLogEntry[] | undefined, remote: WeightLogEntry[] | undefined, noti: string[] | undefined,
): WeightLogEntry[] | null {
  if (!locali?.length) return null
  const nelRemoto = new Set((remote ?? []).map(x => x.date))
  const giaNote = new Set(noti ?? [])
  const nuove = locali.filter(x => !nelRemoto.has(x.date) && !giaNote.has(x.date))
  if (!nuove.length) return null
  return [...(remote ?? []), ...nuove].sort((a, b) => a.date.localeCompare(b.date))
}

/** Le schede, gli esercizi e le alzate nati su questo dispositivo che il remoto
 *  non ha, rimessi dentro lo stato remoto appena applicato. `null` se non c'è
 *  niente da recuperare. Senza `noti` (meta di una versione precedente) tutto
 *  ciò che il remoto non ha si considera nato qui: resuscitare per una volta una
 *  scheda cancellata altrove costa meno che perderne una appena creata. */
//
// Le gare Hyrox registrate valgono come le schede: una gara appena scritta sul
// telefono non deve sparire perché il portatile ha salvato dopo.
export function recuperaCreatiInLocale(
  locale: Recuperabile,
  remoto: Recuperabile,
  noti: NotiAlSync | null,
): { gymSchede: GymScheda[]; palestraExercises: PalestraExercise[]; hyroxGare: HyroxGara[]; weightLog?: WeightLogEntry[] } | null {
  const schede = soloQui(locale.gymSchede ?? [], remoto.gymSchede ?? [], noti?.schede)
  const esercizi = soloQui(locale.palestraExercises ?? [], remoto.palestraExercises ?? [], noti?.esercizi)
  const conAlzate = conAlzateNateQui(locale.palestraExercises ?? [], remoto.palestraExercises ?? [], noti?.alzate)
  const gare = soloQui(locale.hyroxGare ?? [], remoto.hyroxGare ?? [], noti?.gare)
  // Le pesate: anche loro nascono su un telefono solo e per giorno, e una fatta
  // la mattina sul telefono rimasto indietro spariva come spariva una scheda.
  // Senza `noti.pesate` (meta di prima) NON si recupera niente: lì non si sa
  // distinguere una pesata nata qui da una cancellata altrove, e a differenza
  // delle schede le pesate si cancellano di rado ma si accumulano per anni —
  // rimetterle tutte dentro al primo conflitto sarebbe peggio.
  const pesate = noti?.pesate ? conPesateNateQui(locale.weightLog, remoto.weightLog, noti.pesate) : null
  if (schede.length === 0 && esercizi.length === 0 && !conAlzate && gare.length === 0 && !pesate) return null
  return {
    gymSchede: [...(remoto.gymSchede ?? []), ...schede],
    palestraExercises: [...(conAlzate ?? remoto.palestraExercises ?? []), ...esercizi],
    hyroxGare: [...(remoto.hyroxGare ?? []), ...gare],
    ...(pesate ? { weightLog: pesate } : {}),
  }
}

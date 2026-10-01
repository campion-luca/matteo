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
import type { GymScheda, JarvisState, PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'

export interface NotiAlSync {
  schede: string[]
  esercizi: string[]
  /** Le giornate di alzate presenti all'ultimo sync, una chiave per esercizio e
   *  giorno (vedi `chiaveAlzata`). Assente nelle meta di versioni precedenti. */
  alzate?: string[]
}

/** Un'alzata si riconosce da esercizio e giorno, non dai suoi numeri: così una
 *  correzione (80 → 85 kg) resta la stessa alzata e non ne nasce una seconda,
 *  e le alzate non hanno bisogno di un id proprio. Le voci senza data, vecchie,
 *  ricadono sull'etichetta della settimana. */
const chiaveAlzata = (exId: string, h: PalestraHistoryEntry) => `${exId}|${h.date ?? h.d}`

export function idsNoti(s: Pick<JarvisState, 'gymSchede' | 'palestraExercises'>): NotiAlSync {
  const alzate = new Set<string>()
  for (const ex of s.palestraExercises ?? []) for (const h of ex.history ?? []) alzate.add(chiaveAlzata(ex.id, h))
  return {
    schede: (s.gymSchede ?? []).map(x => x.id),
    esercizi: (s.palestraExercises ?? []).map(x => x.id),
    alzate: [...alzate],
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
    const nelRemoto = new Set((rem.history ?? []).map(h => chiaveAlzata(rem.id, h)))
    const nuove = (loc.history ?? []).filter(h => {
      const k = chiaveAlzata(rem.id, h)
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

/** Le schede, gli esercizi e le alzate nati su questo dispositivo che il remoto
 *  non ha, rimessi dentro lo stato remoto appena applicato. `null` se non c'è
 *  niente da recuperare. Senza `noti` (meta di una versione precedente) tutto
 *  ciò che il remoto non ha si considera nato qui: resuscitare per una volta una
 *  scheda cancellata altrove costa meno che perderne una appena creata. */
export function recuperaCreatiInLocale(
  locale: Pick<JarvisState, 'gymSchede' | 'palestraExercises'>,
  remoto: Pick<JarvisState, 'gymSchede' | 'palestraExercises'>,
  noti: NotiAlSync | null,
): { gymSchede: GymScheda[]; palestraExercises: PalestraExercise[] } | null {
  const schede = soloQui(locale.gymSchede ?? [], remoto.gymSchede ?? [], noti?.schede)
  const esercizi = soloQui(locale.palestraExercises ?? [], remoto.palestraExercises ?? [], noti?.esercizi)
  const conAlzate = conAlzateNateQui(locale.palestraExercises ?? [], remoto.palestraExercises ?? [], noti?.alzate)
  if (schede.length === 0 && esercizi.length === 0 && !conAlzate) return null
  return {
    gymSchede: [...(remoto.gymSchede ?? []), ...schede],
    palestraExercises: [...(conAlzate ?? remoto.palestraExercises ?? []), ...esercizi],
  }
}

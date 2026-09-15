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
// restano "vince il più recente"): si recupera ciò che è stato CREATO qui. Per
// distinguere "creato qui" da "cancellato altrove" serve sapere cosa c'era
// all'ultimo sync — `NotiAlSync`, salvato insieme alla meta di sincronizzazione.
// Un id che il locale ha, il remoto no e l'ultimo sync nemmeno è nato qui.
// Uno che c'era all'ultimo sync e il remoto non ha più è stato cancellato
// altrove, e non va resuscitato.
import type { GymScheda, JarvisState, PalestraExercise } from '@/store/useJarvisStore'

export interface NotiAlSync {
  schede: string[]
  esercizi: string[]
}

export function idsNoti(s: Pick<JarvisState, 'gymSchede' | 'palestraExercises'>): NotiAlSync {
  return {
    schede: (s.gymSchede ?? []).map(x => x.id),
    esercizi: (s.palestraExercises ?? []).map(x => x.id),
  }
}

function soloQui<T extends { id: string }>(locali: T[], remoti: T[], noti: string[] | undefined): T[] {
  const inRemoto = new Set(remoti.map(x => x.id))
  const giaNoti = new Set(noti ?? [])
  return locali.filter(x => !inRemoto.has(x.id) && !giaNoti.has(x.id))
}

/** Le schede e gli esercizi nati su questo dispositivo che il remoto non ha,
 *  aggiunti in coda allo stato remoto appena applicato. `null` se non c'è niente
 *  da recuperare. Senza `noti` (meta di una versione precedente) tutto ciò che
 *  il remoto non ha si considera nato qui: resuscitare per una volta una scheda
 *  cancellata altrove costa meno che perderne una appena creata. */
export function recuperaCreatiInLocale(
  locale: Pick<JarvisState, 'gymSchede' | 'palestraExercises'>,
  remoto: Pick<JarvisState, 'gymSchede' | 'palestraExercises'>,
  noti: NotiAlSync | null,
): { gymSchede: GymScheda[]; palestraExercises: PalestraExercise[] } | null {
  const schede = soloQui(locale.gymSchede ?? [], remoto.gymSchede ?? [], noti?.schede)
  const esercizi = soloQui(locale.palestraExercises ?? [], remoto.palestraExercises ?? [], noti?.esercizi)
  if (schede.length === 0 && esercizi.length === 0) return null
  return {
    gymSchede: [...(remoto.gymSchede ?? []), ...schede],
    palestraExercises: [...(remoto.palestraExercises ?? []), ...esercizi],
  }
}

// Il riassunto di un allenamento appena finito, in una riga: è il testo
// dell'avviso che arriva a chi segue l'allievo (vedi `avvisa` in messaggiLive).
//
// Deve dire subito se c'è qualcosa da guardare — esercizi saltati, serie in
// meno, serie chiuse sotto i colpi — o se è andato tutto come da scheda. I
// dettagli stanno nelle sessioni; qui serve solo sapere se vale la pena aprirle.
import type { GymScheda } from '@/store/useJarvisStore'
import type { TFn } from '@/lib/i18n'

export interface EsitoSerie {
  /** L'id della riga di scheda. */
  id: string
  checks: boolean[]
  reps: string[]
}

export interface ContoAllenamento {
  fatti: number
  totali: number
  serieMancanti: number
  serieCorte: number
}

/** I numeri dell'allenamento rispetto alla scheda. */
export function contaAllenamento(scheda: GymScheda, esiti: EsitoSerie[]): ContoAllenamento {
  let fatti = 0, serieMancanti = 0, serieCorte = 0
  for (const se of scheda.exercises) {
    const r = esiti.find(x => x.id === se.id)
    const spuntate = r ? r.checks.map((c, i) => (c ? i : -1)).filter(i => i >= 0) : []
    // Un esercizio saltato è un problema suo: le sue serie non si contano anche
    // come "serie in meno", o lo stesso buco comparirebbe due volte.
    if (!spuntate.length) continue
    fatti++
    serieMancanti += Math.max(0, Math.max(1, se.sets) - spuntate.length)
    // Il minimo dell'intervallo: chiudere un "8-10" a 8 non è una serie corta.
    const minimo = parseInt(se.reps) || 0
    if (minimo > 0) serieCorte += spuntate.filter(i => { const c = parseInt(r!.reps[i]) || minimo; return c < minimo }).length
  }
  return { fatti, totali: scheda.exercises.length, serieMancanti, serieCorte }
}

export function riassuntoAllenamento(scheda: GymScheda, esiti: EsitoSerie[], t: TFn): string {
  const c = contaAllenamento(scheda, esiti)
  const saltati = c.totali - c.fatti
  const parti: string[] = []
  if (saltati > 0) parti.push(saltati === 1 ? t('1 esercizio saltato') : t('{n} esercizi saltati', { n: saltati }))
  if (c.serieMancanti > 0) parti.push(c.serieMancanti === 1 ? t('1 serie in meno') : t('{n} serie in meno', { n: c.serieMancanti }))
  if (c.serieCorte > 0) parti.push(c.serieCorte === 1 ? t('1 serie corta') : t('{n} serie corte', { n: c.serieCorte }))
  const dettaglio = parti.length ? parti.join(' · ') : t('tutto come da scheda')
  return t('Allenamento finito: «{scheda}». {dettaglio}', { scheda: scheda.title, dettaglio })
}

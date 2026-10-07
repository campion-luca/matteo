// Il riassunto di un allenamento appena finito, in una riga: è il testo
// dell'avviso che arriva a chi segue l'allievo (vedi `avvisa` in messaggiLive).
//
// Deve dire subito se c'è qualcosa da guardare — esercizi saltati, serie in
// meno, serie chiuse sotto i colpi — o se è andato tutto come da scheda. I
// dettagli stanno nelle sessioni; qui serve solo sapere se vale la pena aprirle.
import type { GymScheda } from '@/store/useJarvisStore'
import type { TFn } from '@/lib/i18n'
import { parseNum, fmtDurata, colpiPrevisti } from './gymModel'

export interface EsitoSerie {
  /** L'id della riga di scheda. */
  id: string
  checks: boolean[]
  reps: string[]
  /** I chili scritti, serie per serie. Senza, ogni serie spuntata conta. */
  weights?: string[]
  /** A corpo libero: i chili sono la zavorra, e vuoto è un valore legittimo. */
  corpo?: boolean
  /** Il peso dell'attrezzo a vuoto, se l'esercizio ne ha uno dichiarato:
   *  allora "0" scritto nei chili è una serie fatta col solo attrezzo. */
  attrezzo?: number
  /** L'appunto scritto durante la sessione. */
  note?: string
}

export interface ContoAllenamento {
  fatti: number
  totali: number
  serieMancanti: number
  serieCorte: number
}

// ── Quali serie contano ────────────────────────────────────────
// Una serie conta se è spuntata e — con un attrezzo — ha dei chili scritti.
// Una serie spuntata a 0 kg su una panca non è una serie leggera: è una serie
// di cui non si sa niente, e salvarla come "0 kg" voleva dire far credere al
// consiglio sui carichi che si fosse alleggerito, e all'allenatore che la serie
// fosse stata fatta. Vale come NON svolta: se nessuna serie dell'esercizio ha i
// chili, l'esercizio è saltato.
//
// A corpo libero no: lì i chili sono la sola zavorra, e dieci trazioni senza
// niente addosso sono dieci trazioni.
//
// Con un attrezzo dichiarato (vedi `attrezzoKg` nello stato) i chili scritti
// sono i soli dischi, e una serie col bilanciere scarico esiste: pesa quanto
// l'attrezzo. Ma solo se lo zero è stato SCRITTO. Un campo vuoto resta una
// serie di cui non si sa niente — è la dimenticanza che questa regola esiste
// per fermare, e salvarla come "solo attrezzo" la farebbe passare di nuovo.
//
// Sta qui, in un posto solo, perché la stessa regola la devono applicare chi
// salva le alzate, chi le riassume all'allenatore e chi le mostra prima di
// chiudere: tre conti diversi darebbero tre allenamenti diversi.

/** I chili di una serie sono stati scritti? `zeroVale` = l'esercizio ha un
 *  attrezzo dichiarato, e "0" vuol dire "solo quello". */
export function chiliScritti(valore: string | undefined, zeroVale = false): boolean {
  if (parseNum(valore) > 0) return true
  return zeroVale && /^\s*0+([.,]0*)?\s*$/.test(valore ?? '')
}

/** Gli indici delle serie che contano. */
export function serieValide(checks: boolean[], weights: string[] | undefined, corpo: boolean, attrezzo = 0): number[] {
  return checks
    .map((c, i) => (c && (corpo || !weights || chiliScritti(weights[i], attrezzo > 0)) ? i : -1))
    .filter(i => i >= 0)
}

/** I numeri dell'allenamento rispetto alla scheda. */
export function contaAllenamento(scheda: GymScheda, esiti: EsitoSerie[]): ContoAllenamento {
  let fatti = 0, serieMancanti = 0, serieCorte = 0
  for (const se of scheda.exercises) {
    const r = esiti.find(x => x.id === se.id)
    const valide = r ? serieValide(r.checks, r.weights, !!r.corpo, r.attrezzo) : []
    // Un esercizio saltato è un problema suo: le sue serie non si contano anche
    // come "serie in meno", o lo stesso buco comparirebbe due volte.
    if (!valide.length) continue
    fatti++
    serieMancanti += Math.max(0, Math.max(1, se.sets) - valide.length)
    // Serie per serie: chiudere un "8-10" a 8 non è una serie corta, e in un
    // "10-8-6" la terza a 6 nemmeno (vedi `colpiPrevisti`). Un campo lasciato
    // vuoto vale i colpi previsti, come nell'alzata che si salva.
    const minimi = colpiPrevisti(se.reps, se.sets)
    serieCorte += valide.filter(i => { const c = parseInt(r!.reps[i]) || 0; return c > 0 && c < (minimi[i] ?? 0) }).length
  }
  return { fatti, totali: scheda.exercises.length, serieMancanti, serieCorte }
}

export function riassuntoAllenamento(
  scheda: GymScheda, esiti: EsitoSerie[], t: TFn,
  /** Quanto è durato, in secondi. Assente se non lo si sa (vedi `finish` in
   *  GymSchede): allora la frase non ne parla. */
  durataSec?: number,
): string {
  const c = contaAllenamento(scheda, esiti)
  const saltati = c.totali - c.fatti
  const parti: string[] = []
  if (saltati > 0) parti.push(saltati === 1 ? t('1 esercizio saltato') : t('{n} esercizi saltati', { n: saltati }))
  if (c.serieMancanti > 0) parti.push(c.serieMancanti === 1 ? t('1 serie in meno') : t('{n} serie in meno', { n: c.serieMancanti }))
  if (c.serieCorte > 0) parti.push(c.serieCorte === 1 ? t('1 serie corta') : t('{n} serie corte', { n: c.serieCorte }))
  const dettaglio = parti.length ? parti.join(' · ') : t('tutto come da scheda')
  const frase = durataSec
    ? t('Allenamento finito: «{scheda}» in {durata}. {dettaglio}', { scheda: scheda.title, durata: fmtDurata(durataSec), dettaglio })
    : t('Allenamento finito: «{scheda}». {dettaglio}', { scheda: scheda.title, dettaglio })

  // Gli appunti scritti sugli esercizi SALTATI. Un esercizio saltato non lascia
  // un'alzata, e la nota non avrebbe dove stare: ma "macchina rotta" è proprio
  // la cosa che chi segue vuole sapere, più del fatto che l'esercizio manca.
  const appunti = scheda.exercises.flatMap(se => {
    const r = esiti.find(x => x.id === se.id)
    const nota = r?.note?.trim()
    return r && nota && !serieValide(r.checks, r.weights, !!r.corpo, r.attrezzo).length ? [`${se.name}: ${nota}`] : []
  })
  return appunti.length ? `${frase} — ${t('Sui saltati: {note}', { note: appunti.join('; ') })}` : frase
}

// I numeri di un'alzata: quali non si accettano, e quali si chiede di guardare
// due volte.
//
// Per un pezzo ogni campo ha preso qualunque cosa: 600 kg per 60 colpi si
// salvavano come 60 per 6, e da lì in poi massimali, record, grafici e il
// consiglio sui carichi ragionavano su un numero nato da un dito scivolato.
// Le regole sono due, decise con chi usa l'app (7 ott 2026):
//
//  • l'IMPOSSIBILE non si salva — numeri negativi, più di 500 kg, più di 100
//    colpi, più di 20 serie;
//  • l'IMPROBABILE si conferma — un carico più che doppio, o meno della metà,
//    dell'ultima alzata di quell'esercizio. Non si blocca: i salti veri
//    esistono (un infortunio, un massimale), e un'app che li rifiuta
//    insegnerebbe a scrivere numeri falsi per farla contenta.
//
// Stanno qui, in un posto solo, perché le devono applicare la nuova alzata, la
// modifica di un'alzata (anche quella del coach) e il riepilogo di fine
// allenamento: tre soglie diverse sarebbero tre risposte diverse allo stesso
// numero.
import type { PalestraHistoryEntry } from '@/store/useJarvisStore'
import type { TFn } from '@/lib/i18n'
import { setLoads } from './gymModel'

export const KG_MAX = 500
export const COLPI_MAX = 100
export const SERIE_MAX = 20
/** Sotto questa differenza un salto non si chiede di confermarlo: da 4 a 10 kg
 *  di manubri è più del doppio, ed è un martedì qualunque. */
export const SALTO_MIN_KG = 10

export type CampoAlzata = 'kg' | 'colpi' | 'serie' | 'attrezzo'

/** Un numero che non si può salvare: in quale campo, e perché. */
export interface NumeroImpossibile {
  campo: CampoAlzata
  /** `negativo`, oppure `troppo` (oltre `limite`). */
  perche: 'negativo' | 'troppo'
  limite: number
}

/** Il primo numero impossibile fra quelli di un'alzata, o `null` se sono tutti
 *  plausibili. I campi vuoti non li guarda: che manchino lo dice chi chiama. */
export function numeroImpossibile(v: {
  kg?: number[]; colpi?: number[]; serie?: number; attrezzo?: number
}): NumeroImpossibile | null {
  const guarda = (campo: CampoAlzata, valori: Array<number | undefined>, limite: number): NumeroImpossibile | null => {
    for (const x of valori) {
      if (x === undefined || Number.isNaN(x)) continue
      if (x < 0) return { campo, perche: 'negativo', limite }
      if (x > limite) return { campo, perche: 'troppo', limite }
    }
    return null
  }
  return guarda('serie', [v.serie], SERIE_MAX)
    ?? guarda('colpi', v.colpi ?? [], COLPI_MAX)
    ?? guarda('kg', v.kg ?? [], KG_MAX)
    ?? guarda('attrezzo', [v.attrezzo], KG_MAX)
}

/** Come lo si dice a chi ha scritto il numero. */
export function testoImpossibile(t: TFn, i: NumeroImpossibile): string {
  if (i.perche === 'negativo') return t('Un numero negativo non si può registrare.')
  if (i.campo === 'serie') return t('Più di {n} serie non si possono registrare.', { n: i.limite })
  if (i.campo === 'colpi') return t('Più di {n} colpi in una serie non si possono registrare.', { n: i.limite })
  if (i.campo === 'attrezzo') return t('L’attrezzo a vuoto non può pesare più di {n} kg.', { n: i.limite })
  return t('Più di {n} kg non si possono registrare.', { n: i.limite })
}

/** Il carico più alto di un'alzata, senza il corpo: quello che si confronta da
 *  una volta all'altra. Con l'attrezzo dichiarato è il totale. */
export function caricoAlto(h: PalestraHistoryEntry): number {
  return Math.max(...setLoads(h))
}

/** Il carico dell'ultima alzata dell'esercizio con cui confrontare quella che
 *  si sta scrivendo — la più recente per data, esclusa `tranne` (l'alzata che
 *  si sta modificando: confrontarla con sé stessa non direbbe niente). `null`
 *  se non c'è, o se era a corpo libero: lì il carico è il corpo, e la zavorra
 *  raddoppia senza che ci sia niente da chiedere. */
export function caricoDiRiferimento(storico: PalestraHistoryEntry[], tranne?: PalestraHistoryEntry): number | null {
  let ultima: PalestraHistoryEntry | undefined
  for (const h of storico) {
    if (h === tranne) continue
    if (!ultima || (h.date ?? '') >= (ultima.date ?? '')) ultima = h
  }
  if (!ultima || ultima.bodyweight) return null
  const kg = caricoAlto(ultima)
  return kg > 0 ? kg : null
}

/** Il carico scritto è un salto da confermare rispetto all'ultima volta? */
export function saltoDaConfermare(nuovo: number, ultimo: number | null | undefined): boolean {
  if (!ultimo || ultimo <= 0 || !(nuovo > 0)) return false
  if (Math.abs(nuovo - ultimo) < SALTO_MIN_KG) return false
  return nuovo > ultimo * 2 || nuovo < ultimo / 2
}

// Le tecniche allenanti di una riga di scheda: drop set, myo reps, rest-pause,
// eccentrica lenta. Chi scrive la scheda ne sceglie una per esercizio, e dice
// se vale per l'ultima serie o per tutte. In allenamento si legge cosa fare, e
// le serie toccate portano la sigla.
//
// Nei campi va la serie PRINCIPALE: gli scali del drop set, le mini-serie del
// myo reps e i colpi dopo le pause del rest-pause non si scrivono. Sommati alla
// serie, sarebbero colpi fatti con meno peso (o dopo una pausa) contati come se
// fossero al peso pieno: il massimale stimato salirebbe senza motivo, e la
// doppia progressione alzerebbe il carico prima del tempo.
//
// Il TOP SET non la prende mai. Drop set, rest-pause e myo reps portano la
// serie a cedimento, cioè a RIR 0; e sul top set è proprio il RIR a dire se il
// carico sale (vedi progression.ts): a cedimento ogni volta, resterebbe fermo
// per sempre. Su una riga col top set la tecnica va sulle back-off.
//
// Logica pura: il form e la card dell'allenamento la disegnano.
import type { TecnicaRiga, TipoTecnica } from '@/store/useJarvisStore'

export const TIPI_TECNICA: readonly TipoTecnica[] = ['dropSet', 'myoReps', 'restPause', 'eccentrica']

/** La tecnica della riga, se questa versione dell'app la conosce. Le schede
 *  del coach non passano dal controllo di `VERSIONE_DATI`, e una scritta da
 *  un'app più nuova può portare una tecnica che qui non esiste: meglio non
 *  mostrarla che far cadere la pagina. */
export function tecnicaDi(riga: { tecnica?: unknown }): TecnicaRiga | undefined {
  const t = riga.tecnica as Partial<TecnicaRiga> | undefined
  return t && TIPI_TECNICA.includes(t.tipo as TipoTecnica) && (t.serie === 'ultima' || t.serie === 'tutte') ? (t as TecnicaRiga) : undefined
}

/** La tecnica appena scelta, sulle serie dove va di solito: l'eccentrica lenta
 *  è il modo di fare ogni serie; le altre chiudono l'esercizio sull'ultima. Il
 *  myo reps è già da solo una serie d'attivazione e 3-4 mini-serie: su ognuna
 *  di tre serie sarebbe tre volte tanto. Si cambia dal form. */
export function tecnicaNuova(tipo: TipoTecnica): TecnicaRiga {
  return { tipo, serie: tipo === 'eccentrica' ? 'tutte' : 'ultima' }
}

/** Se la tecnica tocca la serie `i` di una riga da `serie` serie. Senza
 *  tecnica, nessuna. `conTop`: la prima serie è un top set, e resta fuori
 *  (vedi in cima). */
export function toccaSerie(tecnica: TecnicaRiga | undefined, i: number, serie: number, conTop = false): boolean {
  const n = Math.max(1, Math.floor(serie) || 1)
  return !!tecnica && !(conTop && i === 0) && (tecnica.serie === 'tutte' || i === n - 1)
}

/** `toccaSerie` per ogni serie della riga. */
export function serieConTecnica(tecnica: TecnicaRiga | undefined, serie: number, conTop = false): boolean[] {
  return Array.from({ length: Math.max(1, Math.floor(serie) || 1) }, (_, i) => toccaSerie(tecnica, i, serie, conTop))
}

/** La sigla accanto al numero della serie, in allenamento. Non si traduce: in
 *  palestra si dicono così in ogni lingua. */
export const SIGLA_TECNICA: Record<TipoTecnica, string> = {
  dropSet: 'DROP', myoReps: 'MYO', restPause: 'R-P', eccentrica: 'ECC',
}

type Traduci = (s: string, v?: Record<string, string | number>) => string

/** Il nome, cosa si fa, e cosa scrivere nei campi (vedi in cima). `t` arriva da
 *  chi chiama: questo file non conosce la lingua. */
export function testiTecnica(tipo: TipoTecnica, t: Traduci): { nome: string; come: string; campi?: string } {
  switch (tipo) {
    case 'dropSet': return {
      nome: t('Drop set'),
      come: t('Arrivi a cedimento, scali subito il carico del 20-30% e riparti senza pausa. Lo fai per 2 scali.'),
      campi: t('Nei campi scrivi la serie prima degli scali.'),
    }
    case 'myoReps': return {
      nome: t('Myo reps'),
      come: t('Una serie d’attivazione da 12-15 reps vicino al cedimento, poi 3-5 respiri profondi (10-15 secondi) e una mini-serie da 3-5 reps. Ripeti la mini-serie per 3-4 volte.'),
      campi: t('Nei campi scrivi la serie d’attivazione.'),
    }
    case 'restPause': return {
      nome: t('Rest-pause'),
      come: t('Arrivi a cedimento, fai 15 secondi di pausa e altre reps, per 2 volte.'),
      campi: t('Nei campi scrivi le reps prima della prima pausa.'),
    }
    case 'eccentrica': return {
      nome: t('Eccentrica lenta'),
      come: t('Scendi piano, in 3-4 secondi, e risali a velocità normale.'),
    }
  }
}

/** "Drop set · ultima serie": la tecnica in una riga, per gli elenchi. Col top
 *  set "tutte" sono le back-off, e lo dice. */
export function sintesiTecnica(tecnica: TecnicaRiga, t: Traduci, conTop = false): string {
  const dove = tecnica.serie === 'ultima' ? t('ultima serie') : conTop ? t('tutte le back-off') : t('tutte le serie')
  return `${testiTecnica(tecnica.tipo, t).nome} · ${dove}`
}

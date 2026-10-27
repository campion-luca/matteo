// La progressione dentro l'app: il ponte fra progression.ts — le regole, funzioni
// pure che non si toccano — e quello che l'app salva e mostra.
//
// Vale solo per le schede nate col form delle progressioni (`conProgressioni`,
// dal 27 ott 2026). Chi scrive la scheda sceglie per ogni riga uno dei tre
// preset, che sono un suggerimento:
//   multiarticolare  → top set + back-off col RIR
//   mono grande      → doppia progressione 8–12
//   mono piccola     → doppia progressione 12–20
// e da «Personalizza» può cambiare modello e numeri. Le schede di prima restano
// col carico consigliato di sempre (caricoConsigliato.ts).
//
// Dove sta cosa:
//  • la config (modello, numeri, carichi disponibili) sulla riga della scheda;
//  • lo stato nell'esercizio di chi si allena, per chiave `schedaId:rigaId`:
//    le schede dell'allenatore stanno nella sua tabella, dove l'allievo non
//    scrive, e l'esercizio è suo;
//  • il RIR di ogni serie sull'alzata (`setRir`).
//
// I pesi della progressione sono TOTALI. Chi ha detto il peso dell'attrezzo a
// vuoto scrive i soli dischi: le conversioni le fa chi riempie i campi.
import {
  TOP_SET_DEFAULT, DOUBLE_PRESETS,
  prescribeTopSet, prescribeDouble, progressTopSet, progressDouble,
  roundLoad, relativeJump, suggestRepRange,
  type LoadSteps, type SetLog, type SetPrescription,
  type TopSetConfig, type TopSetState, type DoubleProgressionConfig, type DoubleProgressionState,
} from './progression'
import { entry1RM, parseNum, setLoads, ultimaDiLavoro } from './gymModel'
import type { GymSchedaExercise, PalestraExercise, PresetProgressione, ProgressioneRiga, StatoProgressione } from '@/store/useJarvisStore'

export type PresetFisso = Exclude<PresetProgressione, 'personalizzata'>
export const PRESET_FISSI: readonly PresetFisso[] = ['multi', 'monoGrande', 'monoPiccola']

/** Di serie: un incremento fisso da 2,5 kg (1,25 per lato). */
export const PASSO_FISSO: LoadSteps = { kind: 'increment', step: 2.5 }
/** Di serie, per chi sceglie la lista: i manubri di una rastrelliera comune. */
export const LISTA_MANUBRI: readonly number[] = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40]

/** La riga di un preset, coi carichi che aveva (o quelli di serie). */
export function conPreset(preset: PresetFisso, steps: LoadSteps = PASSO_FISSO): ProgressioneRiga {
  if (preset === 'multi') return { modello: 'topSet', preset, cfg: { ...TOP_SET_DEFAULT }, steps }
  const cfg = preset === 'monoGrande' ? DOUBLE_PRESETS.isolationLarge : DOUBLE_PRESETS.isolationSmall
  return { modello: 'doppia', preset, cfg: { ...cfg }, steps }
}

/** Passare all'altro modello da «Personalizza»: si parte dai suoi numeri di serie. */
export function conModello(p: ProgressioneRiga, modello: ProgressioneRiga['modello']): ProgressioneRiga {
  if (p.modello === modello) return p
  return modello === 'topSet'
    ? { modello, preset: 'personalizzata', cfg: { ...TOP_SET_DEFAULT }, steps: p.steps }
    : { modello, preset: 'personalizzata', cfg: { ...DOUBLE_PRESETS.isolationLarge }, steps: p.steps }
}

/** I carichi si possono usare: un passo positivo, o una lista con almeno un
 *  carico. Una lista vuota farebbe fallire `roundLoad`. */
export function carichiValidi(steps: LoadSteps): boolean {
  return steps.kind === 'increment'
    ? Number.isFinite(steps.step) && steps.step > 0
    : steps.values.length > 0 && steps.values.every(v => Number.isFinite(v) && v >= 0)
}

/** I colpi di ogni serie scritti come li rilegge `colpiPrevisti`. Due numeri a
 *  salire ("5-8", un top set con una back-off sola) quello li prende per una
 *  forbice e dà 5 a tutte e due le serie: il secondo si ripete ("5-8-8"), e da
 *  tre numeri in su la lettura è serie per serie. */
function colpiPerSerie(colpi: number[]): string {
  if (colpi.length === 2 && colpi[0] < colpi[1]) return `${colpi[0]}-${colpi[1]}-${colpi[1]}`
  return colpi.length === 1 ? String(colpi[0]) : colpi.join('-')
}

/** Serie e colpi che la riga scrive per chi legge la scheda senza conoscere la
 *  progressione: la durata stimata, l'elenco, l'analisi delle sessioni. Il top
 *  set è un colpo per serie ("5-8-8-8"), la doppia il suo range ("8-12"). */
export function serieERipetizioni(p: ProgressioneRiga): { sets: number; reps: string } {
  if (p.modello === 'topSet') {
    const { topReps, backoffSets, backoffReps } = p.cfg
    return { sets: 1 + backoffSets, reps: colpiPerSerie([topReps, ...Array(backoffSets).fill(backoffReps)]) }
  }
  const { repMin, repMax, baseSets } = p.cfg
  return { sets: baseSets, reps: repMin === repMax ? String(repMin) : `${repMin}-${repMax}` }
}

export const chiaveProgressione = (schedaId: string, rigaId: string) => `${schedaId}:${rigaId}`

type Stato = { modello: 'topSet'; stato: TopSetState } | { modello: 'doppia'; stato: DoubleProgressionState }

/** Da dove parte la riga oggi: lo stato salvato dall'ultima seduta; se non
 *  c'è, uno stimato dall'ultima alzata dell'esercizio; se l'esercizio non è mai
 *  stato fatto, nessuno — il peso lo sceglie chi si allena, e lo stato nasce da
 *  quella prima seduta. */
export function statoDiPartenza(
  p: ProgressioneRiga, ex: PalestraExercise | undefined, chiave: string,
): { stato: Stato; da: 'salvato' | 'storico' } | null {
  const salvato = ex?.progressioni?.[chiave]
  // Un modello cambiato (da top set a doppia) non riparte dallo stato dell'altro.
  if (salvato && salvato.modello === p.modello) {
    return { stato: { modello: salvato.modello, stato: salvato.stato } as Stato, da: 'salvato' }
  }
  const ultima = ex ? ultimaDiLavoro(ex.history) : undefined
  if (!ultima) return null
  if (p.modello === 'topSet') {
    // Il peso che il massimale stimato dà per i colpi del top set più il RIR:
    // la stessa Epley di `estimate1RM`, girata.
    const { topReps, targetRir } = p.cfg
    const topWeight = roundLoad(entry1RM(ultima) / (1 + (topReps + targetRir) / 30), p.steps)
    return { stato: { modello: 'topSet', stato: { topWeight, missCount: 0 } }, da: 'storico' }
  }
  const weight = roundLoad(Math.max(...setLoads(ultima)), p.steps)
  return { stato: { modello: 'doppia', stato: { weight, sets: p.cfg.baseSets } }, da: 'storico' }
}

/** Una riga di oggi: la sua prescrizione e da dove viene. */
export interface OggiRiga {
  p: ProgressioneRiga
  chiave: string
  /** Lo stato da cui si parte; `null` alla prima seduta di un esercizio nuovo. */
  stato: Stato | null
  /** `prescribeTopSet` / `prescribeDouble`. Senza stato i pesi non contano
   *  (`conPeso` falso): restano colpi e RIR. */
  prescrizione: SetPrescription[]
  conPeso: boolean
  da: 'salvato' | 'storico' | 'nuovo'
  /** Quello che la progressione aveva detto l'ultima volta. */
  ultimo?: StatoProgressione
}

export function oggiDellaRiga(schedaId: string, e: GymSchedaExercise, ex: PalestraExercise | undefined): OggiRiga | null {
  const p = e.progressione
  if (!p || !carichiValidi(p.steps)) return null
  const chiave = chiaveProgressione(schedaId, e.id)
  const partenza = statoDiPartenza(p, ex, chiave)
  const stato = partenza?.stato ?? null
  const prescrizione = p.modello === 'topSet'
    ? prescribeTopSet(stato?.modello === 'topSet' ? stato.stato : { topWeight: 0, missCount: 0 }, { ...p.cfg, steps: p.steps })
    : prescribeDouble(stato?.modello === 'doppia' ? stato.stato : { weight: 0, sets: p.cfg.baseSets }, { ...p.cfg, steps: p.steps })
  const ultimo = ex?.progressioni?.[chiave]
  return {
    p, chiave, stato, prescrizione, conPeso: !!stato, da: partenza?.da ?? 'nuovo',
    ...(ultimo && ultimo.modello === p.modello ? { ultimo } : {}),
  }
}

/** I colpi bersaglio di una serie: il numero, o il minimo del range. */
export const colpiBersaglio = (s: SetPrescription) => (typeof s.reps === 'number' ? s.reps : s.reps.min)

/** La riga come la si esegue oggi: tante serie quante ne prescrive la
 *  progressione (la doppia ne può aggiungere), ognuna col suo bersaglio. */
export function rigaDiOggi(e: GymSchedaExercise, oggi: OggiRiga): GymSchedaExercise {
  const n = oggi.prescrizione.length
  if (oggi.p.modello === 'doppia') {
    const { repMin, repMax } = oggi.p.cfg
    return { ...e, sets: n, reps: repMin === repMax ? String(repMin) : `${repMin}-${repMax}` }
  }
  return { ...e, sets: n, reps: colpiPerSerie(oggi.prescrizione.map(colpiBersaglio)) }
}

/** L'esercizio chiuso: la progressione guarda le serie fatte (`null` quelle
 *  saltate, nell'ordine della prescrizione) e dice dove si va la prossima volta.
 *  `null` se non c'è niente da giudicare: nessuna serie, o il top set saltato. */
export function esitoEsercizio(oggi: OggiRiga, serie: (SetLog | null)[], il: string): StatoProgressione | null {
  const { p } = oggi
  if (p.modello === 'topSet') {
    const top = serie[0]
    if (!top) return null
    const cfg: TopSetConfig = { ...p.cfg, steps: p.steps }
    // Alla prima seduta lo stato nasce dal top set appena fatto.
    const stato = oggi.stato?.modello === 'topSet' ? oggi.stato.stato : { topWeight: roundLoad(top.weight, p.steps), missCount: 0 }
    const r = progressTopSet(stato, top, cfg)
    return { modello: 'topSet', stato: r.state, evento: r.event, messaggio: r.message, il }
  }
  const fatte = serie.filter((s): s is SetLog => !!s)
  if (fatte.length === 0) return null
  const cfg: DoubleProgressionConfig = { ...p.cfg, steps: p.steps }
  const stato = oggi.stato?.modello === 'doppia' ? oggi.stato.stato : { weight: roundLoad(fatte[0].weight, p.steps), sets: p.cfg.baseSets }
  const r = progressDouble(stato, fatte, cfg)
  return { modello: 'doppia', stato: r.state, evento: r.event, messaggio: r.message, il }
}

/** Il range che il salto al carico successivo consiglia (`suggestRepRange`):
 *  più il salto è grande, più il range dev'essere ampio. Serve un peso da cui
 *  misurarlo: l'ultimo dell'esercizio, o il primo della lista. */
export function rangeConsigliato(steps: LoadSteps, pesoRif?: number): { min: number; max: number; salto: number; peso: number } | null {
  if (!carichiValidi(steps)) return null
  const base = pesoRif && pesoRif > 0 ? pesoRif : steps.kind === 'list' ? Math.min(...steps.values.filter(v => v > 0)) : undefined
  if (!base || !Number.isFinite(base)) return null
  const peso = roundLoad(base, steps)
  if (peso <= 0) return null
  return { ...suggestRepRange(peso, steps), salto: relativeJump(peso, steps), peso }
}

/** Il RIR scritto in un campo: un intero da 0 a 10, o niente. */
export function leggiRir(v: string | undefined): number | null {
  const n = parseInt(String(v ?? '').trim(), 10)
  return Number.isFinite(n) && n >= 0 && n <= 10 ? n : null
}

/** I carichi scritti come elenco: "2, 4, 6". La virgola attaccata è quella dei
 *  decimali ("2,5"), a meno che in un pezzo ce ne sia più d'una ("2,4,6"). */
export function leggiLista(testo: string): number[] {
  const pezzi = testo.split(/[\s;]+|,(?=\s)/).flatMap(x => ((x.match(/,/g) ?? []).length > 1 ? x.split(',') : [x]))
  return [...new Set(pezzi.map(parseNum).filter(n => Number.isFinite(n) && n > 0))].sort((a, b) => a - b)
}

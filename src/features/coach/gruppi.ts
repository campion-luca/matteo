// Gli esercizi di un allievo raggruppati per muscolo, per le pagine
// dell'allenatore che li elencano (note, grafici). Sta in un file senza JSX
// perché lo usano più componenti, e un file di componenti non deve esportare
// altro (vedi gymHooks.ts).
import type { PalestraExercise } from '@/store/useJarvisStore'
import { displayMuscle, MUSCLE_OPTIONS } from '@/features/gym/gymModel'

export interface GruppoMuscolo {
  muscle: string
  esercizi: PalestraExercise[]
}

/** Un gruppo per muscolo, nell'ordine di sempre (Petto, Dorso, Gambe…). I gruppi
 *  che l'allievo si è creato vanno dopo quelli di serie e prima di "Altro".
 *  Dentro al gruppo l'ordine è alfabetico, a meno che `prima` non dica chi deve
 *  stare in cima (le note già scritte, per esempio). */
export function perMuscolo(esercizi: PalestraExercise[], prima?: (ex: PalestraExercise) => boolean): GruppoMuscolo[] {
  const mappa = new Map<string, PalestraExercise[]>()
  for (const ex of esercizi) {
    const m = displayMuscle(ex.muscle) || 'Altro'
    mappa.set(m, [...(mappa.get(m) ?? []), ex])
  }
  const posto = (m: string) => {
    const i = MUSCLE_OPTIONS.indexOf(m)
    return m === 'Altro' ? 999 : i < 0 ? 500 : i
  }
  return [...mappa.entries()]
    .sort(([a], [b]) => posto(a) - posto(b) || a.localeCompare(b))
    .map(([muscle, lista]) => ({
      muscle,
      esercizi: lista.sort((a, b) => (prima ? Number(prima(b)) - Number(prima(a)) : 0) || a.n.localeCompare(b.n)),
    }))
}

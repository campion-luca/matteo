import { useMemo } from 'react'
import { useJarvisStore } from '@/store/useJarvisStore'
import { MUSCLE_COLORS } from './gymModel'

/**
 * Mappa gruppo muscolare → colore, già risolta: default di `MUSCLE_COLORS` sotto,
 * override dell'utente sopra.
 *
 * Prima ogni consumatore rifaceva a mano la catena
 * `muscleColors[m] ?? MUSCLE_COLORS[m] ?? '#8a7440'` (sei copie del literal). Con la
 * mappa risolta a monte i consumatori leggono una chiave e basta.
 * (Nei layout a tema fisso qui i colori si spegnevano in grigio; i layout non ci
 * sono più, e i colori dei gruppi restano quelli scelti.)
 */
export function useMuscleColors(): Record<string, string> {
  const raw = useJarvisStore(st => st.muscleColors)
  return useMemo(() => ({ ...MUSCLE_COLORS, ...(raw ?? {}) }), [raw])
}

import { useMemo } from 'react'
import { useJarvisStore } from '@/store/useJarvisStore'
import { useMono } from '@/hooks/useMono'
import { MUSCLE_COLORS } from './gymModel'

/**
 * Mappa gruppo muscolare → colore, già risolta: default di `MUSCLE_COLORS` sotto,
 * override dell'utente sopra, e tutto desaturato se il layout è "Notte".
 *
 * Prima ogni consumatore rifaceva a mano la catena
 * `muscleColors[m] ?? MUSCLE_COLORS[m] ?? '#8a7440'` (sei copie del literal). Con la
 * mappa risolta a monte i consumatori leggono una chiave e basta, e il tema li
 * raggiunge senza che debbano saperne nulla.
 *
 * Nota: i color picker della palestra vanno alimentati con `st.muscleColors` +
 * `COLOR_PALETTE` raw, non con questa — in scala di grigi sarebbero inutilizzabili.
 */
export function useMuscleColors(): Record<string, string> {
  const raw = useJarvisStore(st => st.muscleColors)
  const { mono, monoize } = useMono()
  return useMemo(() => {
    const merged: Record<string, string> = { ...MUSCLE_COLORS, ...(raw ?? {}) }
    if (!mono) return merged
    return Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, monoize(v)]))
  }, [raw, mono, monoize])
}

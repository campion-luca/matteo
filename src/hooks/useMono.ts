import { useMemo } from 'react'
import { useJarvisStore } from '@/store/useJarvisStore'
import { toMono } from '@/lib/jarvis-tokens'

/**
 * Layout "Premium": spegne il colore anche nei DATI utente.
 *
 * I colori dei gruppi muscolari sono hex salvati nello store
 * e sincronizzati sul cloud, non token CSS: arrivano da JS come `background: cat.color`,
 * quindi nessun blocco di globals.css li raggiunge.
 *
 * Il posto giusto dove desaturarli è la LETTURA dallo store, non i (tanti) punti di
 * consumo: si mappa la lista una volta e ogni consumatore a valle — pallini del
 * calendario, chip, anelli, grafici — eredita il grigio senza saperne nulla.
 *
 * Eccezione: i color picker vanno alimentati con i colori RAW. Un picker in scala di
 * grigi è un picker inutilizzabile (14 preset che diventano 14 quadrati uguali).
 */
export function useMono(): { mono: boolean; monoize: (hex: string) => string } {
  const layout = useJarvisStore(st => st.layout)
  const mono = layout === 'premium'
  // `toMono` sceglie la banda di grigi in base al fondo: in "Premium" è sempre
  // scuro, anche con l'interruttore chiaro/scuro spento.
  return useMemo(
    () => ({ mono, monoize: (hex: string) => (mono ? toMono(hex, true) : hex) }),
    [mono],
  )
}

/** Versione lista per `{ color }`: memoizza la mappatura. */
export function useMonoColors<T extends { color: string }>(items: T[]): T[] {
  const { mono, monoize } = useMono()
  return useMemo(
    () => (mono ? items.map(i => ({ ...i, color: monoize(i.color) })) : items),
    [items, mono, monoize],
  )
}

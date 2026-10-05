import { useMemo } from 'react'
import { useJarvisStore } from '@/store/useJarvisStore'
import { toMono, temaFisso } from '@/lib/jarvis-tokens'

/**
 * I layout a tema fisso (Premium, Neon, Logbook) spengono il colore anche nei
 * DATI utente: lì il colore è uno, o due, e sta solo dove si tocca.
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
  const mono = temaFisso(layout)
  // `toMono` sceglie la banda di grigi in base al fondo: in questi layout è
  // sempre scuro, anche con l'interruttore chiaro/scuro spento.
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

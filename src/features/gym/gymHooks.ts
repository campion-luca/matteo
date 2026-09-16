import { useMemo } from 'react'
import { useJarvisStore } from '@/store/useJarvisStore'
import { gruppiMuscolari } from './gymModel'

// Lettura dallo store che serve a più pezzi della scheda Allenamento. Sta in un
// file senza JSX perché mescolare hook e componenti nello stesso modulo rompe il
// fast refresh di Vite (react-refresh/only-export-components).
// `useIsDark` non è più qui: vive in @/hooks/useIsDark, condiviso con il profilo.

// Peso corporeo dell'utente: serve a valorizzare le serie a corpo libero, dove il
// campo `kg` contiene solo la zavorra. 0 se non è stato inserito nel profilo.
export function useBodyWeight(): number {
  return useJarvisStore(st => st.userWeight ?? 0)
}

// I gruppi muscolari che l'app conosce ADESSO: gli otto di serie più quelli che
// l'utente si è creato. Ogni select di gruppo muscolare passa da qui, o i nuovi
// esisterebbero solo nella griglia che li ha creati.
export function useGruppiMuscolari(): string[] {
  const custom = useJarvisStore(st => st.customMuscles)
  return useMemo(() => gruppiMuscolari(custom), [custom])
}

// Gruppo → quale figura accendere. Contiene SOLO i gruppi creati dall'utente: gli
// otto di serie la loro sagoma ce l'hanno già dal nome (vedi MuscleIcons), e
// ripeterli qui vorrebbe dire due sorgenti per la stessa cosa.
export function useMuscleIcons(): Record<string, string> {
  const custom = useJarvisStore(st => st.customMuscles)
  return useMemo(
    () => Object.fromEntries((custom ?? []).filter(c => c.icon).map(c => [c.name, c.icon])),
    [custom],
  )
}

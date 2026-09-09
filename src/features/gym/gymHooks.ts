import { useJarvisStore } from '@/store/useJarvisStore'

// Lettura dallo store che serve a più pezzi della scheda Allenamento. Sta in un
// file senza JSX perché mescolare hook e componenti nello stesso modulo rompe il
// fast refresh di Vite (react-refresh/only-export-components).
// `useIsDark` non è più qui: vive in @/hooks/useIsDark, condiviso con il profilo.

// Peso corporeo dell'utente: serve a valorizzare le serie a corpo libero, dove il
// campo `kg` contiene solo la zavorra. 0 se non è stato inserito nel profilo.
export function useBodyWeight(): number {
  return useJarvisStore(st => st.userWeight ?? 0)
}

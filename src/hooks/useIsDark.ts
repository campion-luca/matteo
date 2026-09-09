import { useJarvisStore } from '@/store/useJarvisStore'

// "Il fondo sotto di me è scuro?" — non "l'interruttore chiaro/scuro è acceso?".
// Chi chiama vuole sapere da che parte spingere un inchiostro per renderlo
// leggibile (`accentInkFor`), e il layout "nero" è nero pieno anche a interruttore
// spento: leggendo il solo `darkMode` l'inchiostro veniva spinto verso la carta
// chiara mentre stava su nero, e i sottotitoli dei gruppi muscolari scendevano a
// 3.3:1. È la stessa condizione che App.tsx chiama `fondoScuro`.
//
// Vive qui e non in tre copie private (schede, gym): è la stessa riga, e una copia
// che diverge dalle altre è un tema che si applica a metà app.
export function useIsDark(): boolean {
  return useJarvisStore(st => !!st.darkMode || st.layout === 'nero')
}

import { useCallback, useMemo } from 'react'
import { useJarvisStore } from '@/store/useJarvisStore'
import { useConfirmDelete } from '@/hooks/useConfirmDelete'
import { useT } from '@/lib/i18n'
import { gruppiMuscolari } from './gymModel'
import { scartaSessione } from './sessioneInCorso'

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

// Buttare via l'allenamento aperto: si chiede sempre, con le stesse parole, da
// ovunque lo si faccia — l'elenco delle schede, la home, «Chiudi senza salvare»
// a fine allenamento. `dopo` parte a scarto avvenuto: chi chiama ci mette il
// cambio di pagina o il ridisegno. `vuoto` = solo avviato, senza una serie né
// una nota: non c'è niente da perdere, e allora non si chiede.
export function useScartaAllenamento(): (dopo: () => void, vuoto?: boolean) => void {
  const t = useT()
  const { confirmDelete } = useConfirmDelete()
  return useCallback((dopo: () => void, vuoto = false) => {
    if (vuoto) { scartaSessione(); dopo(); return }
    confirmDelete(
      () => { scartaSessione(); dopo() },
      t('Allenamento in corso'),
      {
        eyebrow: t('Allenamento in corso'),
        title: t('Scartare l’allenamento?'),
        body: t('Le serie spuntate finora non vengono salvate. La prossima volta la scheda riparte da zero.'),
        cta: t('Scarta'),
      },
    )
  }, [t, confirmDelete])
}

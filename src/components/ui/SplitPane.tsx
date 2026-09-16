import type { ReactNode } from 'react'
import { useIsDesktop } from '@/hooks/useIsDesktop'

// Due colonne su desktop, una pila su telefono.
//
// Da telefono l'app naviga a strati: si tocca un gruppo muscolare e la sua pagina
// COPRE l'elenco, si tocca un esercizio e la sua pagina copre il gruppo. È l'unica
// cosa sensata su uno schermo largo quattro dita, e resta quella: qui sotto, se
// non siamo su desktop, si mostra semplicemente lo strato più alto.
//
// Da desktop quello stesso gesto sprecava tre quarti dello schermo — si apriva una
// pagina larga come un telefono al centro di un monitor, e per tornare all'elenco
// bisognava chiuderla. Con due colonne l'elenco resta dov'è, a sinistra, e quello
// che si apre compare accanto: si passa da un esercizio all'altro senza mai perdere
// di vista da dove si è partiti.
//
// `master` è la colonna che NON si chiude (l'elenco su cui si sta navigando),
// `detail` la pagina aperta. Quando `detail` è nullo la seconda colonna resta al
// suo posto con `vuoto` dentro: non si allarga e non si restringe: una colonna che
// cambia larghezza a ogni click farebbe ballare tutto l'elenco a sinistra.
export function SplitPane({ master, detail, vuoto }: {
  master: ReactNode
  detail: ReactNode | null
  vuoto?: ReactNode
}) {
  const isDesktop = useIsDesktop()

  if (!isDesktop) return <>{detail ?? master}</>

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{
        // Metà esatta, non una colonna di larghezza fissa. Era `clamp(340px, 34%,
        // 460px)`: su uno schermo grande l'elenco restava una striscia da 460px con
        // accanto un vuoto largo il doppio, e le due colonne non si leggevano più
        // come due metà ma come una barra laterale. A metà precisa il rapporto
        // resta lo stesso a ogni larghezza, e l'elenco cresce insieme alla scheda
        // che apre.
        width: '50%',
        flexShrink: 0,
        height: '100%',
        overflow: 'hidden',
        borderRight: '1px solid var(--hairline)',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
      }}>
        {master}
      </div>
      <div style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', position: 'relative' }}>
        {detail ?? vuoto}
      </div>
    </div>
  )
}

// Il segnaposto della colonna di destra quando non c'è niente di aperto. Dice cosa
// ci finirà dentro e sparisce dietro al primo click: per questo è un filo di testo
// centrato e non una card, che sembrerebbe un contenuto vero rimasto vuoto.
export function SplitVuoto({ children }: { children: ReactNode }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 40, textAlign: 'center',
      fontFamily: 'var(--font-label)', fontSize: 10.5, letterSpacing: '.16em',
      textTransform: 'uppercase', color: 'var(--fg-mute)', opacity: 0.7,
      pointerEvents: 'none',
    }}>
      {children}
    </div>
  )
}

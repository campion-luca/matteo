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
// `radice` è la pagina di partenza, `master` l'elenco aperto sopra di lei (se
// c'è): insieme fanno la colonna che NON si chiude. `detail` è la pagina aperta.
// Quando `detail` è nullo la seconda colonna resta al suo posto con `vuoto`
// dentro: non si allarga e non si restringe: una colonna che cambia larghezza a
// ogni click farebbe ballare tutto l'elenco a sinistra.
//
// Da telefono gli strati sono una PILA, e quelli coperti restano montati, solo
// nascosti. Prima si mostrava lo strato più alto e basta, cioè ogni pagina aperta
// distruggeva quella sotto: tornare indietro voleva dire ricostruire da capo la
// home — testata, settimana, carosello — con lo scorrimento di nuovo in cima.
// Adesso l'indietro toglie lo strato di sopra, e sotto c'è la pagina com'era.
//
// `intero` è per le pagine che non aprono niente accanto (le statistiche): la
// prima colonna prende tutta la larghezza. Sta qui dentro e non in un `return`
// diverso di chi chiama perché cambiare il contenitore fa smontare e rimontare
// tutto quello che c'è sotto — testata, settimana, carosello — a ogni tocco su
// Statistiche, con lo scorrimento che torna in cima.
export function SplitPane({ radice, master = null, detail, vuoto, intero = false }: {
  radice: ReactNode
  master?: ReactNode | null
  detail: ReactNode | null
  vuoto?: ReactNode
  intero?: boolean
}) {
  const isDesktop = useIsDesktop()

  if (!isDesktop) {
    return (
      <>
        <Strato coperto={!!(master || detail)}>{radice}</Strato>
        {master && <Strato coperto={!!detail}>{master}</Strato>}
        {detail && <Strato coperto={false}>{detail}</Strato>}
      </>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{
        // Metà esatta, non una colonna di larghezza fissa. Era `clamp(340px, 34%,
        // 460px)`: su uno schermo grande l'elenco restava una striscia da 460px con
        // accanto un vuoto largo il doppio, e le due colonne non si leggevano più
        // come due metà ma come una barra laterale. A metà precisa il rapporto
        // resta lo stesso a ogni larghezza, e l'elenco cresce insieme alla scheda
        // che apre.
        width: intero ? '100%' : '50%',
        flexShrink: 0,
        height: '100%',
        overflow: 'hidden',
        borderRight: intero ? 'none' : '1px solid var(--hairline)',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
      }}>
        {master ?? radice}
      </div>
      <div style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', position: 'relative', display: intero ? 'none' : undefined }}>
        {detail ?? vuoto}
      </div>
    </div>
  )
}

// Uno strato della pila da telefono. Coperto non si smonta: si nasconde con
// `visibility`, che smette di disegnarlo e di prendere tocchi e fuoco ma tiene
// la posizione di scorrimento — con `display: none` Safari la azzererebbe.
// Scoperto NON scrive `visible`: lo eredita. Gli strati stanno anche uno dentro
// l'altro (la home dentro lo strato coperto dalle schede), e un `visible`
// esplicito su un figlio lo farebbe riapparire attraverso il genitore nascosto.
export function Strato({ coperto, children }: { coperto: boolean; children: ReactNode }) {
  return (
    <div aria-hidden={coperto || undefined} style={{ position: 'absolute', inset: 0, visibility: coperto ? 'hidden' : undefined }}>
      {children}
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

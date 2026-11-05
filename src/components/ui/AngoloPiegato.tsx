// L'angolo in alto a destra piegato, come una pagina: è il segno delle schede.
// Ogni anteprima di una scheda lo porta (l'elenco, la card di oggi in home, i
// fogli del desktop), così una scheda si riconosce come un foglio prima ancora
// di leggerla.
//
// Due triangoli sopra il bordo della card (che è di 2px, da qui il -2): il
// primo copre l'angolo col colore del fondo su cui la card sta, il secondo è
// il retro del foglio ripiegato, col filo d'inchiostro. Va dentro un
// contenitore `position: relative`, e non sposta niente: è sopra, non accanto.
export function AngoloPiegato({ fondo = 'var(--bg)', retro = 'var(--line)', lato = 22 }: {
  /** Il colore di quello che sta dietro la card. */
  fondo?: string
  /** Il retro del foglio. */
  retro?: string
  lato?: number
}) {
  return (
    <svg aria-hidden width={lato} height={lato} viewBox="0 0 22 22" style={{ position: 'absolute', top: -2, right: -2, pointerEvents: 'none' }}>
      <polygon points="0,0 22,0 22,22" fill={fondo}/>
      <polygon points="0,0 22,22 0,22" fill={retro} stroke="var(--ink)" strokeWidth="2" strokeLinejoin="miter"/>
    </svg>
  )
}

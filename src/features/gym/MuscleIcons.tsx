import type { CSSProperties } from 'react'
import { displayMuscle } from './gymModel'
import {
  BOUNDS, figura, SPALLE, PETTO, CORE, DORSO, BACINO, BRACCIA, GAMBE, type Blocco,
} from './bodyBlocks'

// Icone dei gruppi muscolari: una figura in miniatura con il distretto acceso.
//
// Vengono mostrate a ~22px, ed è quella misura a dettare tutto. Le due versioni
// precedenti disegnavano il muscolo in primo piano e astratto — prima a contorno,
// poi con la massa piena — e sono state buttate per lo stesso motivo: a 22px un
// riquadro di 24 unità lascia una quindicina di pixel utili, e in quello spazio
// ogni forma anatomica astratta cade su un oggetto di uso comune. Petto e glutei
// erano due lenti con un ponte in mezzo, cioè un paio di occhiali (due volte); le
// gambe un calice; il bicipite una spirale. Ingrandendole si vedeva il muscolo,
// alla misura d'uso no — ed è la misura d'uso che conta.
//
// Qui la differenza fra un'icona e l'altra non è più la FORMA ma la POSIZIONE del
// pieno sulla stessa figura, e la posizione regge il rimpicciolimento molto meglio
// di una sagoma: anche quando i blocchi diventano tre pixel, "la macchia sta in
// alto" e "la macchia sta in fondo" restano distinguibili.
//
// La figura è la stessa di BodyMap, blocchi geometrici e non silhouette anatomica,
// per la ragione che quel file già argomenta — a questa misura una sagoma
// realistica diventa una macchia — e perché così le icone e la Mappa della forza
// parlano la stessa lingua invece di essere due modi diversi di disegnare un corpo.
//
// Il colore resta uno solo, quello passato da chi la usa: il distretto è pieno, il
// resto del corpo è lo stesso colore appena accennato. È ciò che permette all'icona
// di seguire il colore del gruppo muscolare e di spegnersi nei temi monocromatici
// (Notte, Nero) — cosa che una PNG non potrebbe fare.

interface MuscleIconProps { size?: number; stroke?: number; color?: string; style?: CSSProperties }

interface Gruppo { corpo: Blocco[]; acceso: Blocco[] }

const FRONTE = figura('front')
const RETRO  = figura('back')

const GRUPPI: Record<string, Gruppo> = {
  'Spalle':    { corpo: FRONTE, acceso: SPALLE },
  'Petto':     { corpo: FRONTE, acceso: PETTO },
  'Core':      { corpo: FRONTE, acceso: CORE },
  'Bicipiti':  { corpo: FRONTE, acceso: BRACCIA },
  'Gambe':     { corpo: FRONTE, acceso: GAMBE },
  // Dorso, tricipiti e glutei si vedono solo da dietro: mostrarli sulla faccia
  // anteriore vorrebbe dire accendere un blocco dove quel muscolo non c'è.
  'Dorso':     { corpo: RETRO,  acceso: DORSO },
  'Tricipiti': { corpo: RETRO,  acceso: BRACCIA },
  'Glutei':    { corpo: RETRO,  acceso: BACINO },
}

// Quanto resta visibile il corpo che non è il distretto. Abbastanza da dare la
// posizione, poco da non competere col pieno: alzarlo fa perdere l'icona, che
// diventa "una persona" e basta.
const CORPO_OPACITY = 0.2

// Il riquadro NON è quadrato: una figura umana sta in un rapporto di circa 1:2.3,
// e centrarla in un quadrato le lascia due terzi di larghezza vuota — cioè la
// rimpicciolisce di due terzi. Ritagliata sui suoi bordi reali, lo stesso spazio
// verticale rende blocchi grandi il doppio, che è la differenza fra un'icona
// leggibile e una macchiolina. I posti in cui vive sono righe e card in flexbox:
// una figura stretta ci sta come ci stava un quadrato.
const VIEWBOX = `${BOUNDS.x} ${BOUNDS.y} ${BOUNDS.w} ${BOUNDS.h}`
const RAPPORTO = BOUNDS.w / BOUNDS.h

function rects(bs: Blocco[], key: string) {
  return bs.map(([x, y, w, h, r], i) => <rect key={`${key}${i}`} x={x} y={y} width={w} height={h} rx={r}/>)
}

export function MuscleIcon({ muscle, size = 28, color = 'currentColor', style }: { muscle: string } & MuscleIconProps) {
  const g = GRUPPI[displayMuscle(muscle)]

  // Fallback dei gruppi legacy o sconosciuti: il manubrio. Non è un distretto, e
  // accendere mezzo corpo per dire "altro" direbbe una cosa falsa.
  if (!g) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
        strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M3 9v6M7 5.5v13M7 12h10M17 5.5v13M21 9v6"/>
      </svg>
    )
  }

  return (
    <svg width={Math.round(size * RAPPORTO)} height={size} viewBox={VIEWBOX} fill={color} style={style} aria-hidden>
      <g fillOpacity={CORPO_OPACITY}>{rects(g.corpo, 'c')}</g>
      <g>{rects(g.acceso, 'a')}</g>
    </svg>
  )
}

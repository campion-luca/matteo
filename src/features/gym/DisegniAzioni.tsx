// ── I disegni delle tre card dei comandi in home ───────────────
// Coaching, Schede, Statistiche: ognuna ha la sua figura, al posto dell'icona
// nel riquadro che c'era. A piatti pieni e senza contorni, nello stile della
// sagoma dei gruppi muscolari qui sotto: due toni della tinta della card per le
// masse, un terzo — più vicino al colore del testo — per i dettagli.
//
// I colori non stanno qui: li scrive la card in quattro variabili (`--d1`,
// `--d2`, `--d3` dal più tenue al più deciso, `--df` il fondo della card), così
// il disegno segue il tema e la tinta senza saperne niente.
// `--df` serve a "ritagliare": un contorno del colore del fondo stacca una forma
// da quella che le sta dietro senza disegnare una riga in più.
//
// Sono ferme. Di cose che si muovono da sole sotto le dita l'app ne ha già
// avute, e sono state tolte.
import type { CSSProperties } from 'react'

const D1: CSSProperties = { fill: 'var(--d1)' }
const D2: CSSProperties = { fill: 'var(--d2)' }
const D3: CSSProperties = { fill: 'var(--d3)' }
const RITAGLIO: CSSProperties = { stroke: 'var(--df)', strokeWidth: 2.5 }
const TRATTO: CSSProperties = { fill: 'none', stroke: 'var(--d3)', strokeLinecap: 'round', strokeLinejoin: 'round' }

// Due fumetti: chi scrive (i tre puntini) e chi ha risposto.
function Fumetti() {
  return (
    <>
      <path style={D1} d="M18 10h44a12 12 0 0 1 12 12v18a12 12 0 0 1-12 12H32L20 62l2.5-10H18A12 12 0 0 1 6 40V22a12 12 0 0 1 12-12z"/>
      <circle style={D3} cx="27" cy="31" r="3.6"/>
      <circle style={D3} cx="40" cy="31" r="3.6"/>
      <circle style={D3} cx="53" cy="31" r="3.6"/>
      <path style={{ ...D2, ...RITAGLIO }} d="M46 46h32a11 11 0 0 1 11 11v14a11 11 0 0 1-11 11h-2.5l2.5 9-11.5-9H46a11 11 0 0 1-11-11V57a11 11 0 0 1 11-11z"/>
      <rect style={D3} x="45" y="58" width="30" height="4.4" rx="2.2"/>
      <rect style={D3} x="45" y="67.5" width="19" height="4.4" rx="2.2"/>
    </>
  )
}

// Una scheda sopra un'altra, con le serie: due spuntate, una ancora da fare.
// È la cosa che in questa app si fa su una scheda.
function Fogli() {
  const riga = (y: number, fatta: boolean, lunga: number) => (
    <>
      {fatta ? (
        <>
          <rect style={D3} x="31" y={y} width="12" height="12" rx="4"/>
          <path style={{ fill: 'none', stroke: 'var(--df)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }} d={`M34 ${y + 6.2}l2.5 2.5 4.3-4.9`}/>
        </>
      ) : (
        <rect style={{ ...TRATTO, strokeWidth: 2 }} x="32" y={y + 1} width="10" height="10" rx="3.5"/>
      )}
      <rect style={{ ...D3, opacity: fatta ? 1 : 0.55 }} x="48" y={y + 3.8} width={lunga} height="4.4" rx="2.2"/>
    </>
  )
  return (
    <>
      <rect style={D1} x="24" y="9" width="54" height="72" rx="10" transform="rotate(-10 51 45)"/>
      <g transform="rotate(4 50 50)">
        <rect style={{ ...D2, ...RITAGLIO }} x="22" y="14" width="56" height="74" rx="10"/>
        {riga(28, true, 22)}
        {riga(46, true, 18)}
        {riga(64, false, 14)}
      </g>
    </>
  )
}

// Quattro barre che salgono, e sopra la linea dell'andamento.
function Barre() {
  const punti: Array<[number, number]> = [[16.5, 50], [37.5, 36], [58.5, 22], [79.5, 7]]
  return (
    <>
      <rect style={D1} x="9"  y="62" width="15" height="26" rx="5"/>
      <rect style={D1} x="30" y="48" width="15" height="40" rx="5"/>
      <rect style={D2} x="51" y="34" width="15" height="54" rx="5"/>
      <rect style={D2} x="72" y="18" width="15" height="70" rx="5"/>
      <polyline style={{ ...TRATTO, strokeWidth: 2.6 }} points={punti.map(p => p.join(',')).join(' ')}/>
      {punti.map(([x, y]) => <circle key={x} style={{ ...D3, stroke: 'var(--df)', strokeWidth: 2 }} cx={x} cy={y} r="3.9"/>)}
    </>
  )
}

const FIGURE = { coach: Fumetti, schede: Fogli, stats: Barre }

export function DisegnoAzione({ id, style }: { id: keyof typeof FIGURE; style?: CSSProperties }) {
  const Figura = FIGURE[id]
  return (
    <svg aria-hidden viewBox="0 0 96 96" style={{ display: 'block', ...style }}>
      <Figura/>
    </svg>
  )
}

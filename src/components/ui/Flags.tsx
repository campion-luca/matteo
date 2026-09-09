// Le due bandiere del selettore di lingua.
//
// Stanno fuori da `Icons` perché sono l'unica cosa disegnata nell'app che NON
// segue `currentColor`: un'icona monocroma si adatta al tema, una bandiera no —
// il verde-bianco-rosso è il punto, ed è ciò che la rende riconoscibile prima di
// aver letto la parola sotto.
//
// Sono rettangoli pieni, senza raggio e senza ombra, come tutto il resto
// dell'interfaccia. Il bordo sottile serve al bianco della bandiera italiana e
// all'oro di quella tedesca, che su fondo carta chiaro sparirebbero: senza,
// l'Italia si legge come due bande staccate invece che come una bandiera.
import type { CSSProperties } from 'react'
import type { Lang } from '@/lib/i18n'

interface FlagProps { size?: number; style?: CSSProperties }

// Proporzioni reali: 3:2 per l'Italia, 5:3 per la Germania. Disegnarle entrambe
// nella stessa cornice ne deformerebbe una, e affiancate si nota.
// `size` è la LARGHEZZA: appaiate contano quanto sono larghe, non quanto sono alte.
const BORDER = 'rgba(0,0,0,0.22)'

function Frame({ w, h, size, style, children }: {
  w: number; h: number; size: number; style?: CSSProperties; children: React.ReactNode
}) {
  return (
    <svg
      width={size} height={size * (h / w)} viewBox={`0 0 ${w} ${h}`}
      style={{ display: 'block', ...style }} aria-hidden focusable="false"
      shapeRendering="crispEdges"
    >
      {children}
      {/* Il bordo è disegnato per ultimo, mezzo pixel dentro: sui lati esterni un
          tratto centrato sul bordo verrebbe tagliato a metà dal viewBox. */}
      <rect x={0.5} y={0.5} width={w - 1} height={h - 1} fill="none" stroke={BORDER} strokeWidth={1}/>
    </svg>
  )
}

export function FlagIT({ size = 24, style }: FlagProps) {
  return (
    <Frame w={36} h={24} size={size} style={style}>
      <rect x={0} y={0} width={12} height={24} fill="#008C45"/>
      <rect x={12} y={0} width={12} height={24} fill="#F4F5F0"/>
      <rect x={24} y={0} width={12} height={24} fill="#CD212A"/>
    </Frame>
  )
}

export function FlagDE({ size = 24, style }: FlagProps) {
  return (
    <Frame w={40} h={24} size={size} style={style}>
      <rect x={0} y={0} width={40} height={8} fill="#000000"/>
      <rect x={0} y={8} width={40} height={8} fill="#DD0000"/>
      <rect x={0} y={16} width={40} height={8} fill="#FFCE00"/>
    </Frame>
  )
}

/** La bandiera di una lingua, per chi ha la lingua in mano e non sa quale sia. */
export function Flag({ lang, size, style }: FlagProps & { lang: Lang }) {
  return lang === 'de' ? <FlagDE size={size} style={style}/> : <FlagIT size={size} style={style}/>
}

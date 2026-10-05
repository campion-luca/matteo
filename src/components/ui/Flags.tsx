// Le due bandiere del selettore di lingua.
//
// Stanno fuori da `Icons` perché sono l'unica cosa disegnata nell'app che NON
// segue `currentColor`: un'icona monocroma si adatta al tema, una bandiera no —
// il verde-bianco-rosso è il punto, ed è ciò che la rende riconoscibile prima di
// aver letto la parola sotto.
//
// Sono rettangoli pieni, senza raggio e senza ombra, come tutto il resto
// dell'interfaccia. Il bordo sottile serve al bianco della bandiera italiana e
// alle croci bianche di quella britannica, che su fondo carta chiaro
// sparirebbero: senza, l'Italia si legge come due bande staccate invece che come
// una bandiera.
import { useId, type CSSProperties } from 'react'
import type { Lang } from '@/lib/i18n'

interface FlagProps { size?: number; style?: CSSProperties }

// Proporzioni reali: 3:2 per l'Italia, 2:1 per il Regno Unito. Disegnarle
// entrambe nella stessa cornice ne deformerebbe una, e affiancate si nota.
// `size` è la LARGHEZZA: appaiate contano quanto sono larghe, non quanto sono alte.
const BORDER = 'rgba(0,0,0,0.22)'

function Frame({ w, h, size, style, diagonali = false, children }: {
  w: number; h: number; size: number; style?: CSSProperties
  /** La bandiera ha tratti in diagonale: con `crispEdges`, che tiene netti i
   *  bordi delle bande dritte, verrebbero a scalini. */
  diagonali?: boolean
  children: React.ReactNode
}) {
  return (
    <svg
      width={size} height={size * (h / w)} viewBox={`0 0 ${w} ${h}`}
      style={{ display: 'block', ...style }} aria-hidden focusable="false"
      shapeRendering={diagonali ? 'geometricPrecision' : 'crispEdges'}
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

// L'inglese dell'app è quello britannico (chili, chilometri, giorno davanti al
// mese), quindi la Union Jack. Le croci rosse in diagonale non sono centrate
// sulle bianche ma sfalsate, ruotando: è il ritaglio (`clipPath`) a tenerne solo
// la metà giusta in ogni quarto. L'id del ritaglio è per istanza — due bandiere
// nella stessa pagina con lo stesso id si ruberebbero il ritaglio a vicenda.
export function FlagEN({ size = 24, style }: FlagProps) {
  const clip = useId()
  return (
    <Frame w={60} h={30} size={size} style={style} diagonali>
      <clipPath id={clip}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/>
      </clipPath>
      <rect x={0} y={0} width={60} height={30} fill="#012169"/>
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" strokeWidth={6}/>
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${clip})`} stroke="#C8102E" strokeWidth={4}/>
      <path d="M30,0 v30 M0,15 h60" stroke="#FFFFFF" strokeWidth={10}/>
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth={6}/>
    </Frame>
  )
}

/** La bandiera di una lingua, per chi ha la lingua in mano e non sa quale sia. */
export function Flag({ lang, size, style }: FlagProps & { lang: Lang }) {
  return lang === 'en' ? <FlagEN size={size} style={style}/> : <FlagIT size={size} style={style}/>
}

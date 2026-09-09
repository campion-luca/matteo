import type { CSSProperties } from 'react'

interface IconProps { size?: number; stroke?: number; fill?: string; color?: string; style?: CSSProperties }

function ic(d: React.ReactNode, { size = 20, stroke = 1.6, fill = 'none', color = 'currentColor', style }: IconProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {d}
    </svg>
  )
}

export const Icons = {
  home:     (p: IconProps = {}) => ic(<><path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/></>, p),
  // Ghiere basse ai lati, dischi alti alle estremità, manico in mezzo. Senza il manico
  // e con i tratti più alti al centro (com'era) restano sei barre a collina: un
  // equalizzatore audio, non un manubrio — e la usa anche la tab "Pesi".
  dumbbell: (p: IconProps = {}) => ic(<><path d="M4 9.5v5M8 5.5v13M8 12h8M16 5.5v13M20 9.5v5"/></>, p),
  weight:   (p: IconProps = {}) => ic(<><rect x="2.5" y="9" width="3" height="6" rx="1.5"/><rect x="18.5" y="9" width="3" height="6" rx="1.5"/><rect x="5.5" y="7.5" width="2.5" height="9" rx="1"/><rect x="16" y="7.5" width="2.5" height="9" rx="1"/><path d="M8 12h8"/></>, p),
  info:     (p: IconProps = {}) => ic(<><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6h.01"/></>, p),
  // Freccia che torna al giro: "riparti da zero", non "ricarica la pagina".
  refresh:  (p: IconProps = {}) => ic(<><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4.5h-4.5"/></>, p),
  // Coppa: calice, manici laterali, stelo e base. Serve al momento del record e
  // alla medaglia dei traguardi, dove la sagoma da sola deve dire "premio".
  trophy:   (p: IconProps = {}) => ic(<><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 5.5H4.5V7a3 3 0 0 0 3 3"/><path d="M17 5.5h2.5V7a3 3 0 0 1-3 3"/><path d="M12 14v3"/><path d="M8.5 20h7l-.7-3h-5.6z"/></>, p),
  // Busto e testa: il "menù utente". Era disegnato a mano inline nella home, e
  // spostandolo nella sidebar sarebbe diventato la seconda copia dello stesso SVG.
  user:     (p: IconProps = {}) => ic(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>, p),
  plus:     (p: IconProps = {}) => ic(<><path d="M12 5v14M5 12h14"/></>, p),
  arrow:    (p: IconProps = {}) => ic(<><path d="M5 12h14M13 6l6 6-6 6"/></>, p),
  chev:     (p: IconProps = {}) => ic(<><path d="M9 6l6 6-6 6"/></>, p),
  chevL:    (p: IconProps = {}) => ic(<><path d="M15 6l-6 6 6 6"/></>, p),
  back:     (p: IconProps = {}) => ic(<><path d="M15 6l-6 6 6 6"/></>, p),
  play:     (p: IconProps = {}) => ic(<><path d="M7 5l12 7-12 7V5z" fill="currentColor"/></>, p),
  chart:    (p: IconProps = {}) => ic(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>, p),
  check:    (p: IconProps = {}) => ic(<><path d="M5 12l5 5L20 7"/></>, p),
  run:      (p: IconProps = {}) => ic(<><circle cx="15" cy="5" r="2"/><path d="M10 21l2-5-3-3 2-5 4 1 3 3M5 13l3-1"/></>, p),
  pencil:   (p: IconProps = {}) => ic(<><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></>, p),
  settings: (p: IconProps = {}) => ic(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4 16.9l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7.1 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>, p),
  trash:     (p: IconProps = {}) => ic(<><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>, p),
  // I due modi di guardare una lista. Le righe hanno lunghezze diverse e i
  // quadrati sono quattro: a 13px è quella differenza a distinguerle, non il
  // dettaglio.
  list:      (p: IconProps = {}) => ic(<><path d="M4 6h16M4 12h16M4 18h11"/></>, p),
  grid:      (p: IconProps = {}) => ic(<><rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/></>, p),
  book:      (p: IconProps = {}) => ic(<><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></>, p),
  bookOpen:  (p: IconProps = {}) => ic(<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>, p),
  repeat:    (p: IconProps = {}) => ic(<><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.5 9A9 9 0 0 0 5.6 5.4L1 10m22 4-4.6 4.6A9 9 0 0 1 3.5 15"/></>, p),
  clock:     (p: IconProps = {}) => ic(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></>, p),
  search:    (p: IconProps = {}) => ic(<><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></>, p),
  x:         (p: IconProps = {}) => ic(<><path d="M18 6L6 18M6 6l12 12"/></>, p),
  wallet:    (p: IconProps = {}) => ic(<><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1"/><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="13" r="1.2" fill="currentColor" stroke="none"/></>, p),
}

// La faccia di una persona: la sua foto, o le iniziali quando non ne ha messa
// una. Quadrata, non tonda: nell'app i cerchi sono i pallini di stato. Senza
// foto è un quadrato d'inchiostro con le iniziali in bianco (rebranding, ott
// 2026; prima era un fondo tinto d'accento).
import type { CSSProperties } from 'react'
import { NUC } from '@/lib/jarvis-tokens'

/** "Mario Rossi" → "MR", "Luca" → "L". */
function iniziali(nome: string): string {
  const parole = nome.trim().split(/\s+/).filter(Boolean)
  if (!parole.length) return '?'
  return (parole[0][0] + (parole.length > 1 ? parole[parole.length - 1][0] : '')).toUpperCase()
}

export function Avatar({ foto, nome, size = 40, style }: {
  foto?: string | null
  /** Per le iniziali, se la foto non c'è. */
  nome: string
  size?: number
  style?: CSSProperties
}) {
  const base: CSSProperties = {
    width: size, height: size, flexShrink: 0, boxSizing: 'border-box',
    border: 'var(--bordo)',
    ...style,
  }
  if (foto) {
    // `alt` vuoto: il nome è sempre scritto lì accanto, e un lettore di schermo
    // lo leggerebbe due volte.
    return <img src={foto} alt="" width={size} height={size} draggable={false} style={{ ...base, display: 'block', objectFit: 'cover', background: 'var(--surface-2)' }}/>
  }
  return (
    <div aria-hidden="true" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--ink)',
      color: 'var(--surface)',
      fontFamily: NUC.display, fontSize: Math.round(size * 0.42), fontWeight: 800, letterSpacing: '.02em',
      ...base,
    }}>
      {iniziali(nome)}
    </div>
  )
}

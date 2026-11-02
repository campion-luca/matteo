// Gli stili dei campi che stanno dentro la riga di una scheda — la progressione
// e la tecnica allenante — perché si leggano come parti dello stesso form.
import type { CSSProperties } from 'react'
import { NUC } from '@/lib/jarvis-tokens'

/** L'etichetta sopra il campo. */
export const ETICHETTA: CSSProperties = {
  fontFamily: NUC.display, fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
  textTransform: 'uppercase', color: 'var(--fg-mute)', marginBottom: 6,
}

/** La riga di spiegazione sotto il campo. */
export const SPIEGA: CSSProperties = { fontFamily: NUC.font, fontSize: 12.5, lineHeight: 1.45, color: 'var(--fg-mute)', marginTop: 6 }

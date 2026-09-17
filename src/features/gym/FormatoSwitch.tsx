// L'interruttore intera / mezza distanza di Hyrox.
//
// Sta in un file suo e non dentro GymHyrox perché lo usano sia le pagine Hyrox
// sia il modale di registrazione, e GymHyrox importa già i modali: tenerlo lì
// avrebbe creato un giro di import gymModals → GymHyrox → gymModals.
import type React from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { useT } from '@/lib/i18n'
import type { FormatoHyrox } from './hyroxStima'

// ── Intera / mezza ─────────────────────────────────────────────
// Rettangolare e a tutta larghezza, non una pillola nell'occhiello: non è una
// preferenza di visualizzazione come griglia/elenco, cambia QUALI dati si
// guardano e quale distanza si registra. Deve stare sotto il pollice.
//
// Un'unica scelta per tutta la sezione (la tiene JarvisGym): passare a 500 m
// sull'elenco e aprire una stazione deve mostrare le sue mezze, e registrare da lì
// deve proporre la mezza distanza.
export function FormatoSwitch<T extends string = FormatoHyrox>({ valore, onChange, etichette, valori, etichettaGruppo, style }: {
  valore: T
  onChange: (f: T) => void
  /** [intera, mezza]: "1 km / 500 m" sull'elenco, la distanza della stazione
   *  ("50 m / 25 m", "100 rep / 50 rep") dentro la sua pagina. */
  etichette: [string, string]
  /** I due valori, se non sono intera / mezza: lo stesso interruttore sceglie
   *  anche la categoria di gara (double / singolo). */
  valori?: [T, T]
  etichettaGruppo?: string
  style?: React.CSSProperties
}) {
  const t = useT()
  const [a, b] = valori ?? (['intero', 'mezzo'] as [T, T])
  const opts: Array<[T, string]> = [[a, etichette[0]], [b, etichette[1]]]
  return (
    <div role="group" aria-label={etichettaGruppo ?? t('Distanza')} style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, padding: 3,
      border: '1px solid var(--hairline)', background: 'var(--surface-2)',
      ...style,
    }}>
      {opts.map(([id, label]) => {
        const on = id === valore
        return (
          <button key={id} type="button" onClick={() => onChange(id)} aria-pressed={on} className="j-focus" style={{
            minHeight: 'clamp(34px, 5dvh, 40px)', borderRadius: 0, cursor: 'pointer',
            background: on ? 'var(--surface)' : 'transparent',
            border: `1px solid ${on ? 'var(--j-accent)' : 'transparent'}`,
            color: on ? 'var(--j-accent-ink)' : NUC.faint,
            fontFamily: NUC.label, fontSize: 'clamp(10px, 2.8vw, 11px)', fontWeight: on ? 700 : 500,
            letterSpacing: '.14em', textTransform: 'uppercase',
            transition: 'all 180ms',
          }}>{label}</button>
        )
      })}
    </div>
  )
}

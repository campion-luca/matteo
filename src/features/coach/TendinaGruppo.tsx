// Una tendina per gruppo muscolare: la riga col nome e quanti esercizi contiene,
// e sotto — solo se aperta — il suo contenuto. È la forma di tutti gli elenchi
// lunghi dell'allenatore (note, grafici): chiusi all'ingresso, così la pagina è
// l'indice dei gruppi e si apre solo quello che serve.
import type { ReactNode } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { useTData } from '@/lib/i18n'

export function TendinaGruppo({ muscle, conta, extra, aperta, onToggle, children }: {
  muscle: string
  /** Quanti esercizi ci sono dentro. */
  conta: number
  /** Una nota a destra, prima della freccia ("2 note"). */
  extra?: ReactNode
  aperta: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const tData = useTData()
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={onToggle}
        aria-expanded={aperta}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px 12px 14px', textAlign: 'left',
          background: 'var(--surface-2)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', cursor: 'pointer',
        }}
      >
        <span style={{ flex: 1, minWidth: 0, fontFamily: NUC.label, fontSize: 11.5, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg)' }}>
          {tData(muscle)} <span style={{ fontWeight: 400, color: 'var(--fg-mute)' }}>· {conta}</span>
        </span>
        {extra && (
          <span style={{ flexShrink: 0, fontFamily: NUC.label, fontSize: 10.5, color: 'var(--j-accent-ink)' }}>{extra}</span>
        )}
        <span style={{ color: 'var(--fg-mute)', display: 'flex', flexShrink: 0, transform: aperta ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
          <Icons.chev size={14} stroke={2}/>
        </span>
      </button>
      {aperta && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  )
}

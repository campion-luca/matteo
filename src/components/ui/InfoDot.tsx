import { useState } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { useT } from '@/lib/i18n'
import { METRIC_INFO, type MetricId } from '@/lib/metricInfo'
import { JModal } from './Primitives'
import { Icons } from './Icons'

// ── ⓘ accanto a un numero calcolato ────────────────────────────
// Apre un modale, non un tooltip: l'app è nata sul telefono e lì l'hover non
// esiste. Un popover ancorato costerebbe la logica di flip/clamp sul viewport,
// e JModal ha già portale e focus trap.
//
// Va accanto all'ETICHETTA della sezione, non a ogni singolo numero: in una card
// da quattro tile quattro pallini sono coriandoli, e la domanda che uno si fa è
// "cosa sono questi numeri", non "cos'è il terzo".

export function InfoDot({ id, tight = false }: { id: MetricId; tight?: boolean }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const m = METRIC_INFO[id]
  const rows = typeof m.how === 'string' ? null : m.how

  return (
    <>
      <button
        type="button"
        className="j-hit"
        aria-label={`${t('Cos’è')}: ${t(m.title)}`}
        // Le card che ospitano la ⓘ sono spesso premibili a loro volta, e senza
        // fermare l'evento chiedere "cos'è" aprirebbe anche la card. Non basta
        // fermare `click`: NucCard fa partire `onPress` su `onMouseUp`, che arriva
        // PRIMA. Fermare anche `mousedown` le evita pure l'animazione di pressione.
        onMouseDown={e => e.stopPropagation()}
        onMouseUp={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); setOpen(true) }}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 16, height: 16, padding: 0, marginLeft: tight ? 4 : 6,
          background: 'none', border: 'none', borderRadius: 0,
          color: NUC.faint, cursor: 'pointer', verticalAlign: 'middle', flexShrink: 0,
        }}
      >
        <Icons.info size={13} stroke={1.5}/>
      </button>

      <JModal open={open} onClose={() => setOpen(false)} title={t(m.title)} width={360}>
        <Block label={t('Cos’è')}>
          <p style={S.p}>{t(m.what)}</p>
        </Block>

        <Block label={t('Come si calcola')}>
          {rows
            ? rows.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 10 }}>
                  <span style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--j-accent-ink)' }}>{t(k)}</span>
                  <p style={S.p}>{t(v)}</p>
                </div>
              ))
            : <p style={S.p}>{t(m.how as string)}</p>}
        </Block>

        {m.read && (
          <Block label={t('Da sapere')} last>
            <p style={S.p}>{t(m.read)}</p>
          </Block>
        )}
      </JModal>
    </>
  )
}

const S = {
  p: {
    fontFamily: NUC.font, fontSize: 12.5, lineHeight: 1.6,
    color: 'var(--fg-soft)', margin: 0,
  },
} as const

function Block({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      paddingBottom: last ? 0 : 14, marginBottom: last ? 0 : 14,
      borderBottom: last ? 'none' : `1px solid var(--hairline-soft)`,
    }}>
      <div className="j-eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

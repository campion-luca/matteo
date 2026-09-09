import { useContext, useId, useRef } from 'react'
import { useFocusTrap, useScrollLock, useModalHost } from '@/hooks/useModalA11y'
import { NUC } from '@/lib/jarvis-tokens'
import { ConfirmDeleteContext, type ConfirmCopy } from '@/hooks/useConfirmDelete'
import { useT } from '@/lib/i18n'

export function ConfirmModal() {
  const ctx = useContext(ConfirmDeleteContext)
  if (!ctx?.pending) return null
  // Wrapper interno: gli hook di accessibilità girano solo quando il dialog è
  // effettivamente montato (niente hook condizionati con l'early-return sopra).
  return <ConfirmDialog label={ctx.pending.label} copy={ctx.pending.copy} onCancel={ctx.cancel} onConfirm={ctx.confirm}/>
}

function ConfirmDialog({ label, copy, onCancel, onConfirm }: { label: string; copy?: ConfirmCopy; onCancel: () => void; onConfirm: () => void }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const t = useT()
  // Il tono decide solo il colore del tasto di conferma e dell'occhiello: la
  // struttura, il focus trap e lo scrim sono gli stessi per tutti e due.
  const danger = (copy?.tone ?? 'danger') === 'danger'
  // Non esiste un `--j-accent-rgb`: l'accent è un hex calcolato a runtime dalla
  // palette (vedi App.tsx). Il tono neutro quindi non prova a imitare il rosso
  // trasparente — usa il tasto primario pieno, che è già la forma dell'"ok, fallo"
  // in tutto il resto dell'app.
  const okStyle = danger
    ? { background: 'rgba(var(--danger-rgb),0.1)', border: '1px solid rgba(var(--danger-rgb),0.3)', color: 'var(--danger)' }
    : { background: 'var(--j-accent)', border: '1px solid var(--j-accent)', color: 'var(--j-accent-fg)' }

  // Focus trap + Escape + blocco scroll: stessa logica del JModal (useModalA11y).
  // Qui il dialog è sempre montato quando esiste, quindi `active` è fisso a true.
  useFocusTrap(contentRef, true, onCancel)
  useScrollLock(useModalHost(contentRef, true), true)

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'absolute', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 28px',
      }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 320,
          background: 'var(--surface)',
          borderRadius: 0,
          padding: '24px 20px 20px',
          boxShadow: '0 24px 64px rgba(42,36,24,0.45)',
          border: '1px solid var(--hairline)',
          outline: 'none',
        }}
      >
        <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.18em', color: danger ? 'var(--danger)' : 'var(--j-accent-ink)', textTransform: 'uppercase', marginBottom: 10 }}>
          {copy?.eyebrow ?? t('Eliminazione')}
        </div>
        <div id={titleId} style={{ fontFamily: NUC.serif, fontSize: 16, fontWeight: 500, color: NUC.ink, marginBottom: 8, letterSpacing: 0, lineHeight: 1.3 }}>
          {copy?.title ?? t('Sicuro di voler eliminare?')}
        </div>
        <div style={{ fontFamily: NUC.font, fontSize: 13, color: NUC.faint, marginBottom: 22, lineHeight: 1.55 }}>
          {copy?.body ?? (
            <>
              {t('Stai per eliminare')}{' '}
              <span style={{ color: NUC.ink, fontWeight: 500 }}>“{label}”</span>.
              {' '}{t('L’azione è definitiva.')}
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, height: 44, borderRadius: 0,
              background: 'var(--surface-2)', border: '1px solid var(--hairline)',
              fontFamily: NUC.font, fontSize: 13, color: NUC.dim,
              cursor: 'pointer', transition: 'border-color 160ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--j-accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--hairline)')}
          >
            {t('No')}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, height: 44, borderRadius: 0,
              ...okStyle,
              fontFamily: NUC.font, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', transition: 'opacity 160ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.82')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {copy?.cta ?? t('Sì, elimina')}
          </button>
        </div>
      </div>
    </div>
  )
}

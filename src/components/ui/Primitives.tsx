/* eslint-disable react-refresh/only-export-components -- file di primitives: co-esporta di proposito hook (useGreeting) e componenti condivisi */
import { useState, useEffect, useRef, useId, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NUC } from '@/lib/jarvis-tokens'
import { useT } from '@/lib/i18n'
import { useFocusTrap, useScrollLock, useModalHost } from '@/hooks/useModalA11y'

// ── Dynamic greeting (Italian holidays + time of day) ──────────
function easterDate(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, L = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * L) / 451)
  const month = Math.floor((h + L - 7 * m + 114) / 31)
  const day = ((h + L - 7 * m + 114) % 31) + 1
  return { month, day }
}

export function useGreeting(name = '') {
  const t = useT()
  const compute = useCallback(() => {
    const now = new Date()
    const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate(), h = now.getHours()
    const easter = easterDate(y)
    // Con nome vuoto il saluto va senza virgola ("Buongiorno." invece di "Buongiorno, .").
    const s = name ? `, ${name}.` : '.'
    // Le ricorrenze restano quelle del calendario italiano anche in tedesco: sono
    // i giorni in cui l'app viene aperta, non una scelta di lingua. Tradotta è la
    // formula, non la data — un 25 aprile non diventa un'altra festa perché la
    // schermata è in tedesco.
    if (m === 12 && d === 25) return t('Buon Natale') + s
    if (m === 1  && d === 1)  return t('Buon Anno Nuovo') + s
    if (m === easter.month && (d === easter.day || d === easter.day + 1)) return t('Buona Pasqua') + s
    if (m === 8  && d === 15) return t('Buon Ferragosto') + s
    if (m === 5  && d === 1)  return t('Buon 1° Maggio') + s
    if (m === 4  && d === 25) return t('Buon 25 Aprile') + s
    if (m === 6  && d === 2)  return t('Buona Festa della Repubblica') + s
    if (h >= 5  && h < 12) return t('Buongiorno') + s
    if (h >= 12 && h < 18) return t('Buon pomeriggio') + s
    if (h >= 18 && h < 22) return t('Buonasera') + s
    return t('Buonanotte') + s
  }, [name, t])

  const [greeting, setGreeting] = useState(compute)
  // Due ragioni per ricalcolare: il minuto che scatta (la fascia oraria cambia) e
  // il NOME che cambia. La seconda mancava, e con l'interval agganciato alla prima
  // `compute` il saluto restava sul nome vecchio finché la home non si smontava —
  // cioè, cambiando nome dal profilo, praticamente mai.
  useEffect(() => {
    setGreeting(compute())
    const id = setInterval(() => setGreeting(compute()), 60_000)
    return () => clearInterval(id)
  }, [compute])
  return greeting
}

// ── Modal (paper style) ────────────────────────────────────────
interface JModalProps {
  open: boolean; onClose: () => void; children: ReactNode
  title?: string; leading?: ReactNode; width?: number; maxHeight?: string
  /** Un controllo nella riga del titolo, prima della ×. Per il campo che
   *  appartiene all'intestazione e non al form: la data dell'alzata. */
  headerRight?: ReactNode
}

export function JModal({ open, onClose, children, title, leading, headerRight, width = 320, maxHeight = 'calc(100% - 28px)' }: JModalProps) {
  const t = useT()
  const [mount, setMount] = useState(open)
  const [visible, setVisible] = useState(false)
  const sentinelRef = useRef<HTMLSpanElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  // Il modal si monta nella card dell'app, non nel body: vedi useModalHost.
  const host = useModalHost(sentinelRef, open)
  const titleId = useId()

  // Focus trap + Escape + blocco scroll: logica condivisa con il ConfirmModal.
  useFocusTrap(contentRef, open, onClose)
  useScrollLock(host, open)

  useEffect(() => {
    if (open) {
      setMount(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else if (mount) {
      setVisible(false)
      const timer = setTimeout(() => setMount(false), 180)
      return () => clearTimeout(timer)
    }
    // Reagisce solo all'apertura/chiusura: `mount` è letto ma non deve ritriggerare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!mount) return <span ref={sentinelRef} style={{ display: 'none' }}/>
  if (!host)  return <span ref={sentinelRef} style={{ display: 'none' }}/>

  const modal = (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 90,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: visible ? 'var(--scrim)' : 'transparent',
      backdropFilter: visible ? 'blur(6px)' : 'none',
      WebkitBackdropFilter: visible ? 'blur(6px)' : 'none',
      transition: 'background 180ms ease, backdrop-filter 180ms ease',
      padding: 14,
    }}>
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        // PROTOTIPO ombra hard — vedi .j-hard in globals.css. Sui modali è statica:
        // un modale non si preme.
        className="j-hard-static"
        style={{
        width: '100%', maxWidth: width, maxHeight,
        background: 'var(--surface)',
        backgroundImage: 'var(--paper-grain)',
        border: `1px solid var(--fg)`,
        borderRadius: 0,
        color: 'var(--fg)', fontFamily: NUC.font,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.97) translateY(8px)',
        transition: 'opacity 180ms ease, transform 220ms cubic-bezier(.2,.9,.25,1.1)',
        position: 'relative',
        outline: 'none',
      }}>
        {title && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 10px', gap: 10,
            borderBottom: '1px solid var(--hairline)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              {leading}
              <div id={titleId} style={{ fontFamily: NUC.serif, fontSize: 16, fontWeight: 500, letterSpacing: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--fg)' }}>{title}</div>
            </div>
            {headerRight && <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{headerRight}</div>}
            <button onClick={onClose} aria-label={t('Chiudi')} style={{
              width: 36, height: 36, borderRadius: 0, flexShrink: 0,
              background: 'var(--surface-2)', border: `1px solid var(--hairline)`,
              color: 'var(--fg-mute)', cursor: 'pointer', fontSize: 18, lineHeight: '1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          </div>
        )}
        <div style={{ padding: title ? '12px 16px 16px' : '16px', overflowY: 'auto', minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  )

  return <>
    <span ref={sentinelRef} style={{ display: 'none' }}/>
    {createPortal(modal, host)}
  </>
}

/* eslint-disable react-refresh/only-export-components -- file di primitives: co-esporta di proposito hook (useGreeting) e componenti condivisi */
import { useState, useEffect, useRef, useId, useCallback, type ReactNode } from 'react'
import type React from 'react'
import { createPortal } from 'react-dom'
import { Icons } from './Icons'
import { NUC } from '@/lib/jarvis-tokens'
import { useT } from '@/lib/i18n'
import { useFocusTrap, useScrollLock, useModalHost } from '@/hooks/useModalA11y'
import { useIsDesktop } from '@/hooks/useIsDesktop'

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
    // Le ricorrenze restano quelle del calendario italiano anche in inglese: sono
    // i giorni in cui l'app viene aperta, non una scelta di lingua. Tradotta è la
    // formula, non la data — un 25 aprile non diventa un'altra festa perché la
    // schermata è in inglese.
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
  /** Una riga sotto il titolo: la data dell'alzata, che si legge prima di
   *  toccarla. */
  subtitle?: ReactNode
}

export function JModal({ open, onClose, children, title, leading, headerRight, subtitle, width = 320, maxHeight = 'calc(100% - 28px)' }: JModalProps) {
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
      const timer = setTimeout(() => setMount(false), 150)
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
      // Solo il velo, senza sfocatura: `backdrop-filter` su tutto lo schermo
      // costringeva il telefono a ridipingere la pagina sotto proprio nell'istante
      // in cui il modale si apriva, e il tocco sembrava arrivare in ritardo.
      background: visible ? 'var(--scrim)' : 'transparent',
      transition: 'background 140ms ease',
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
        background: 'var(--surface-pop)',
        backgroundImage: 'var(--paper-grain)',
        border: 'var(--bordo)',
        color: 'var(--fg)', fontFamily: NUC.font,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.97) translateY(8px)',
        transition: 'opacity 140ms ease, transform 160ms cubic-bezier(.2,.9,.25,1.1)',
        position: 'relative',
        outline: 'none',
      }}>
        {title && (
          // La testata di ogni modale: il titolo come quello di una pagina, in
          // Condensed maiuscolo, e la X in un quadrato col bordo (rebranding,
          // ott 2026).
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 16px 6px', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              {leading}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div id={titleId} style={{ fontFamily: NUC.display, fontSize: 24, fontWeight: 800, lineHeight: 1.05, letterSpacing: '.01em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--fg)' }}>{title}</div>
                {subtitle && <div style={{ marginTop: 4 }}>{subtitle}</div>}
              </div>
            </div>
            {headerRight && <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{headerRight}</div>}
            <button onClick={onClose} aria-label={t('Chiudi')} className="j-hard j-focus" style={{
              width: 44, height: 44, flexShrink: 0,
              background: 'var(--surface)', border: 'var(--bordo)',
              color: 'var(--fg)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Icons.x size={18} stroke={2.2}/></button>
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

// ── Il foglio dal basso ────────────────────────────────────────
// I moduli da compilare — una nuova alzata, la sua correzione, un esercizio
// nuovo — salgono dal fondo e prendono quasi tutto lo schermo: in cima la
// maniglia e la testata (occhiello, titolo, la ×), in mezzo i campi che
// scorrono, e in fondo, fermo, il tasto per salvare. Nel modale al centro il
// tasto stava in coda ai campi, e su un telefono basso finiva sotto il bordo.
//
// La maniglia si trascina in giù per chiudere, come i fogli di iOS. Da desktop
// il foglio diventa un riquadro al centro: attaccato al fondo di un monitor
// starebbe lontano da tutto, e il trascinamento col mouse non lo cerca nessuno.
interface JFoglioProps {
  open: boolean; onClose: () => void; children: ReactNode
  titolo: string
  /** Sopra il titolo, piccolo: di cosa si parla ("Petto · Nuova alzata"). */
  occhiello?: ReactNode
  /** Sotto il titolo: la data dell'alzata. */
  sotto?: ReactNode
  /** Fermo in fondo, fuori da ciò che scorre: il tasto, e quello che dice
   *  perché non salva. */
  piede?: ReactNode
}

export function JFoglio({ open, onClose, children, titolo, occhiello, sotto, piede }: JFoglioProps) {
  const t = useT()
  const isDesktop = useIsDesktop()
  const [mount, setMount] = useState(open)
  const [visible, setVisible] = useState(false)
  const sentinelRef = useRef<HTMLSpanElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const host = useModalHost(sentinelRef, open)
  const titleId = useId()
  useFocusTrap(contentRef, open, onClose)
  useScrollLock(host, open)

  // Il trascinamento della maniglia: quanto è sceso il foglio sotto il dito.
  const [tiro, setTiro] = useState(0)
  const inizio = useRef<number | null>(null)

  useEffect(() => {
    if (open) {
      setMount(true)
      setTiro(0)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else if (mount) {
      setVisible(false)
      const timer = setTimeout(() => setMount(false), 240)
      return () => clearTimeout(timer)
    }
    // Reagisce solo all'apertura/chiusura, come JModal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!mount || !host) return <span ref={sentinelRef} style={{ display: 'none' }}/>

  // Si trascina dalla testata, non dai suoi tasti: la × deve restare un tocco.
  const giu = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDesktop || (e.target as HTMLElement).closest('button, input, textarea, select, label')) return
    inizio.current = e.clientY
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const muovi = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inizio.current !== null) setTiro(Math.max(0, e.clientY - inizio.current))
  }
  const lascia = () => {
    if (inizio.current === null) return
    inizio.current = null
    // Oltre un pollice abbondante si chiude; meno, torna su.
    if (tiro > 90) onClose()
    setTiro(0)
  }

  const trascina = tiro > 0 && inizio.current !== null
  const foglio = (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 90,
      display: 'flex', alignItems: isDesktop ? 'center' : 'flex-end', justifyContent: 'center',
      background: visible ? 'var(--scrim)' : 'transparent',
      transition: 'background 180ms ease',
      padding: isDesktop ? 24 : 0,
    }}>
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: isDesktop ? 460 : 560,
          // Sul telefono è alto quasi tutto lo schermo, anche con pochi campi:
          // il tasto sta sempre nello stesso posto, in basso sotto il pollice.
          ...(isDesktop ? { maxHeight: 'calc(100% - 48px)' } : { height: 'calc(100% - 44px)' }),
          background: 'var(--surface-pop)', color: 'var(--fg)', fontFamily: NUC.font,
          border: 'var(--bordo)', ...(isDesktop ? {} : { borderBottom: 'none' }),
          display: 'flex', flexDirection: 'column', overflow: 'hidden', outline: 'none',
          transform: isDesktop
            ? (visible ? 'none' : 'translateY(10px)')
            : (visible ? `translateY(${tiro}px)` : 'translateY(100%)'),
          opacity: isDesktop && !visible ? 0 : 1,
          transition: trascina ? 'none' : 'transform 240ms cubic-bezier(.2,.8,.2,1), opacity 160ms ease',
        }}
      >
        <div onPointerDown={giu} onPointerMove={muovi} onPointerUp={lascia} onPointerCancel={lascia}
          style={{ flexShrink: 0, padding: isDesktop ? '16px 16px 12px' : '0 16px 12px', touchAction: 'none' }}>
          {!isDesktop && (
            <div aria-hidden style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 10px' }}>
              <span style={{ width: 40, height: 4, background: 'var(--muted-dark)' }}/>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {occhiello && (
                <div className="j-eyebrow" style={{ fontSize: 13, letterSpacing: '.1em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{occhiello}</div>
              )}
              <div id={titleId} style={{
                marginTop: occhiello ? 4 : 0,
                fontFamily: NUC.display, fontSize: 28, fontWeight: 800, lineHeight: 1, textTransform: 'uppercase', color: 'var(--fg)',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>{titolo}</div>
            </div>
            <button onClick={onClose} aria-label={t('Chiudi')} className="j-hard j-focus" style={{
              width: 44, height: 44, flexShrink: 0,
              background: 'var(--surface)', border: 'var(--bordo)',
              color: 'var(--fg)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Icons.x size={18} stroke={2.2}/></button>
          </div>
          {sotto && <div style={{ marginTop: 10 }}>{sotto}</div>}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '4px 16px 20px' }}>
          {children}
        </div>
        {piede && (
          <div style={{
            flexShrink: 0, borderTop: 'var(--bordo)', background: 'var(--surface-pop)',
            padding: `12px 16px ${isDesktop ? '16px' : 'calc(env(safe-area-inset-bottom) + 12px)'}`,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {piede}
          </div>
        )}
      </div>
    </div>
  )

  return <>
    <span ref={sentinelRef} style={{ display: 'none' }}/>
    {createPortal(foglio, host)}
  </>
}

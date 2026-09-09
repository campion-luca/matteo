// Accessibilità dei dialog: focus trap, Escape, blocco dello scroll e ricerca
// del contenitore ospite.
//
// Erano quaranta righe copiate identiche in JModal (Primitives.tsx) e nel
// ConfirmModal: due copie della stessa logica delicata, che è esattamente il
// posto dove una correzione ne raggiunge una sola e l'altra resta indietro.
import { useEffect, useRef, useState, type RefObject } from 'react'

// Elementi che possono ricevere il focus con Tab dentro un dialog.
const FOCUSABLE_SEL = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Trova il contenitore su cui montare/bloccare il dialog: il primo antenato con
 * `data-jmodal-root` (la card dell'app), altrimenti `document.body`.
 *
 * Serve perché la shell su mobile è una card più stretta della finestra: un
 * dialog montato sul body si centrerebbe sullo schermo e non sulla card.
 */
export function useModalHost(ref: RefObject<HTMLElement>, active: boolean): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!active || !ref.current) return
    let el: HTMLElement | null = ref.current.parentElement
    while (el && el !== document.body && !el.hasAttribute('data-jmodal-root')) el = el.parentElement
    setHost(el ?? document.body)
  }, [ref, active])
  return host
}

/**
 * Porta il focus dentro il dialog all'apertura, lo restituisce a chi ce l'aveva
 * alla chiusura, cicla il Tab dentro il dialog e chiama `onEscape` su Esc.
 *
 * Il focus iniziale passa da un `requestAnimationFrame` ricorsivo perché il
 * contenuto può montare un frame dopo (transizione d'ingresso): senza attesa il
 * ref è ancora nullo e il focus resterebbe fuori.
 */
export function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean, onEscape: () => void): void {
  const prevFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return
    prevFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    let raf = 0
    const focusFirst = () => {
      const el = ref.current
      if (!el) { raf = requestAnimationFrame(focusFirst); return }
      ;(el.querySelector<HTMLElement>(FOCUSABLE_SEL) ?? el).focus()
    }
    raf = requestAnimationFrame(focusFirst)
    return () => { cancelAnimationFrame(raf); prevFocus.current?.focus?.() }
  }, [ref, active])

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onEscape(); return }
      if (e.key !== 'Tab') return
      const el = ref.current
      if (!el) return
      // `offsetParent` scarta ciò che è nascosto: un campo dentro una sezione
      // chiusa non deve rubare il giro del Tab.
      const focusables = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SEL))
        .filter(x => x.offsetParent !== null || x === document.activeElement)
      if (focusables.length === 0) { e.preventDefault(); el.focus(); return }
      const first = focusables[0], last = focusables[focusables.length - 1]
      const active_ = document.activeElement
      if (!el.contains(active_ as Node)) { e.preventDefault(); first.focus() }
      else if (e.shiftKey && active_ === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active_ === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ref, active, onEscape])
}

/** Congela lo scroll del contenitore ospite finché il dialog è aperto. */
export function useScrollLock(host: HTMLElement | null, active: boolean): void {
  useEffect(() => {
    if (!active || !host) return
    const prev = host.style.overflow
    host.style.overflow = 'hidden'
    return () => { host.style.overflow = prev }
  }, [host, active])
}

// Animazione d'avvio, mostrata una volta per sessione del browser.
//
// Non è decorazione pura: copre il tempo in cui l'app carica il blob utente dal
// cloud, che su rete lenta è visibile. Il flag sta in sessionStorage
// ('jarvis-booted') e non in localStorage, così torna a ogni apertura vera
// dell'app ma non a ogni cambio di tab.
//
// Chiedeva anche nome, sesso, età e peso a chi era nuovo. Non lo fa più: quelle
// domande le fa `FirstSetup`, che ne fa cinque invece di quattro e calcola l'età
// dalla data di nascita. Tenerle in due posti significava, per un account appena
// creato, due questionari di fila che chiedono le stesse cose.
import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/store/useJarvisStore'
import { useT } from '@/lib/i18n'

interface JarvisBootProps { onDone: () => void }

export function JarvisBoot({ onDone }: JarvisBootProps) {
  const t = useT()
  const [s] = useStore()

  // ── Splash animation ───────────────────────────────────────────
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit' | 'done'>('enter')
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const clearAll = () => { timers.current.forEach(clearTimeout); timers.current = [] }

  useEffect(() => {
    clearAll()
    timers.current.push(setTimeout(() => setPhase('hold'), 300))
    timers.current.push(setTimeout(() => setPhase('exit'), 1800))
    timers.current.push(setTimeout(() => { setPhase('done'); onDone?.() }, 2200))
    return clearAll
    // Parte una volta al mount: onDone è stabile e non deve ritriggerare la sequenza.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const skip = () => { clearAll(); setPhase('done'); onDone?.() }

  if (phase === 'done') return null

  // Al primo avvio il nome non c'è ancora: lo chiede `FirstSetup`, che parte
  // dopo. Un "Benvenuto, ." con la virgola sospesa era il modo in cui si vedeva.
  const displayName = s.userName.trim()
  const visible = phase === 'hold' || phase === 'exit'

  // ── Splash ─────────────────────────────────────────────────────
  return (
    <div
      onClick={skip}
      style={{
        position: 'absolute', inset: 0, zIndex: 100, overflow: 'hidden',
        background: 'var(--bg)', backgroundImage: 'var(--paper-grain)',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        opacity: phase === 'exit' ? 0 : 1,
        transition: phase === 'exit' ? 'opacity 380ms ease' : 'none',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--j-accent)', opacity: 0.6 }}/>

      <div style={{
        textAlign: 'center',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 500ms ease, transform 500ms cubic-bezier(.2,.8,.2,1)',
      }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--fg-mute)', marginBottom: 16 }}>
          {t('Fatto in Italia')}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--fg)' }}>
          Matteo
        </div>
        <div style={{ width: 32, height: 1, background: 'var(--j-accent)', margin: '14px auto' }}/>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 400, fontStyle: 'italic', color: 'var(--fg-soft)', letterSpacing: 0 }}>
          {displayName ? `${t('Bentornato')}, ` : t('Benvenuto')}
          {displayName && <em style={{ fontStyle: 'normal', fontWeight: 500, color: 'var(--fg)' }}>{displayName}</em>}.
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 40,
        fontFamily: 'var(--font-body)',
        fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase',
        color: 'var(--fg-mute)', opacity: visible ? 0.6 : 0,
        transition: 'opacity 600ms 400ms ease',
      }}>
        {t('Tocca per saltare')}
      </div>
    </div>
  )
}

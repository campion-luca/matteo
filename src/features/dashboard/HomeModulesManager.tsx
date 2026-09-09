// Il gestore dei widget della home: riordina e accende/spegne.
//
// Stava dentro `JarvisDashboard`, dietro la rotella nell'intestazione dei moduli.
// Adesso è il contenuto della card "Cambio widget" del menù utente, che è dove si
// va a cercare un'impostazione — la home resta la home. Il pannello è qui e non
// nel profilo perché la lista dei moduli e le sue etichette vivono qui accanto
// (vedi homeModules).
import { useState } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import {
  useHomeModules, moduleLabel, moveHomeModule, reorderHomeModules, toggleHomeModule,
} from './homeModules'
import { useT } from '@/lib/i18n'

const arrowBtn = (disabled: boolean) => ({
  width: 24, height: 24, borderRadius: 0,
  background: 'var(--surface)',
  border: '1px solid var(--hairline)',
  color: disabled ? 'var(--fg-mute)' : 'var(--fg-soft)',
  fontSize: 10, cursor: disabled ? 'not-allowed' : 'pointer', padding: 0,
  opacity: disabled ? 0.4 : 1,
} as const)

export function HomeModulesManager() {
  const t = useT()
  const modules = useHomeModules()
  const [dragId, setDragId] = useState<string | null>(null)

  return (
    <>
      <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.14em', color: 'var(--fg-mute)', textTransform: 'uppercase', marginBottom: 12 }}>
        {t('Trascina · attiva / disattiva')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {modules.map((m, i) => {
          const being = dragId === m.id
          return (
            <div key={m.id} draggable
              onDragStart={e => { setDragId(m.id); e.dataTransfer.effectAllowed = 'move' }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (dragId) reorderHomeModules(dragId, m.id); setDragId(null) }}
              onDragEnd={() => setDragId(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 0,
                background: being ? 'var(--surface-2)' : 'var(--surface)',
                border: `1px solid ${being ? 'var(--j-accent)' : 'var(--hairline)'}`,
                opacity: being ? 0.8 : 1, transition: 'all 180ms',
              }}
            >
              <div style={{ cursor: 'grab', color: 'var(--fg-mute)', fontSize: 14, lineHeight: 1 }}>≡</div>
              <div style={{ flex: 1, fontFamily: NUC.font, fontSize: 14, color: m.on ? 'var(--fg)' : 'var(--fg-mute)' }}>{moduleLabel(m.id)}</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => moveHomeModule(m.id, -1)} disabled={i === 0} style={arrowBtn(i === 0)}>▲</button>
                <button onClick={() => moveHomeModule(m.id, +1)} disabled={i === modules.length - 1} style={arrowBtn(i === modules.length - 1)}>▼</button>
              </div>
              {/* Toggle switch — paper style */}
              <button
                onClick={() => toggleHomeModule(m.id)}
                role="switch" aria-checked={m.on}
                aria-label={`${moduleLabel(m.id)} — ${m.on ? t('attivo') : t('spento')}`}
                style={{
                  width: 40, height: 22, borderRadius: 0, padding: 0,
                  background: m.on ? 'var(--j-accent)' : 'var(--surface-2)',
                  border: `1px solid ${m.on ? 'var(--j-accent)' : 'var(--hairline)'}`,
                  cursor: 'pointer', position: 'relative', transition: 'all 220ms',
                }}
              >
                <div style={{
                  position: 'absolute', top: 2, left: m.on ? 20 : 2,
                  width: 16, height: 16, borderRadius: '50%',
                  background: m.on ? 'var(--j-accent-fg)' : 'var(--fg-mute)',
                  transition: 'left 220ms cubic-bezier(.2,.9,.2,1.2)',
                }}/>
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}

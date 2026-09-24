// ── La settimana, sotto il saluto ──────────────────────────────
// Sette giorni da lunedì a domenica: l'iniziale sopra, il numero sotto. Oggi è
// il cerchio pieno d'accent; i giorni in cui ci si è allenati hanno il cerchio
// pieno di superficie e un puntino arancione sotto. Quelli che devono ancora
// venire restano spenti.
//
// La settimana del calendario e non "gli ultimi 7 giorni", come la striscia del
// Riepilogo: "come sta andando la mia settimana" si legge da lunedì.
// Tutta la striscia è un tasto e apre il calendario degli allenamenti.
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { NUC } from '@/lib/jarvis-tokens'
import { useJarvisStore } from '@/store/useJarvisStore'
import { localISO } from '@/lib/isoDate'
import { daysShort } from '@/lib/dateFormat'
import { useT, useLang } from '@/lib/i18n'
import { CalendarioAllenamenti } from './CalendarioAllenamenti'

export function SettimanaStrip() {
  const t = useT()
  const lang = useLang()
  const s = useJarvisStore(useShallow(st => ({ palestra: st.palestraExercises, hyrox: st.hyroxExercises })))
  const [calendario, setCalendario] = useState(false)

  const giorni = useMemo(() => {
    const oggi = new Date()
    const oggiISO = localISO(oggi)
    const DOW = daysShort(lang)
    const lunedi = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - ((oggi.getDay() + 6) % 7))
    const allenati = new Set<string>()
    s.palestra.forEach(ex => ex.history.forEach(h => { if (h.date) allenati.add(h.date) }))
    s.hyrox.forEach(ex => ex.history.forEach(h => { if (h.date) allenati.add(h.date) }))
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunedi.getFullYear(), lunedi.getMonth(), lunedi.getDate() + i)
      const iso = localISO(d)
      return { iso, dow: DOW[i], num: d.getDate(), fatto: allenati.has(iso), oggi: iso === oggiISO, futuro: iso > oggiISO }
    })
  }, [s.palestra, s.hyrox, lang])

  return (
    <>
      <button
        onClick={() => setCalendario(true)}
        aria-label={t('Apri il calendario degli allenamenti')}
        className="j-focus"
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', width: '100%',
          padding: 0, margin: '0 0 clamp(10px, 1.8dvh, 16px)',
          background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit',
        }}
      >
        {giorni.map(g => (
          <div key={g.iso} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <span style={{ fontFamily: NUC.label, fontSize: 10.5, fontWeight: 600, letterSpacing: '.04em', color: 'var(--fg-mute)' }}>
              {/* Una lettera sola (L M M G V S D): la posizione basta a
                  distinguere i due M, e con due lettere la riga si affolla. */}
              {g.dow.charAt(0).toUpperCase()}
            </span>
            <span style={{
              width: 'clamp(32px, 9vw, 38px)', aspectRatio: '1 / 1', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: NUC.font, fontSize: 'clamp(13px, 3.8vw, 15px)', fontWeight: g.oggi || g.fatto ? 700 : 500,
              background: g.oggi ? 'var(--j-accent)' : g.fatto ? 'var(--surface-2)' : 'transparent',
              color: g.oggi ? 'var(--j-accent-fg)' : g.futuro ? 'var(--fg-mute)' : 'var(--fg)',
            }}>
              {g.num}
            </span>
            {/* Il puntino c'è sempre, trasparente se il giorno è vuoto: così i
                numeri restano tutti alla stessa altezza. */}
            <span aria-hidden style={{
              width: 4, height: 4, borderRadius: '50%',
              background: g.fatto ? 'var(--j-accent)' : 'transparent',
            }}/>
          </div>
        ))}
      </button>
      <CalendarioAllenamenti open={calendario} onClose={() => setCalendario(false)}/>
    </>
  )
}

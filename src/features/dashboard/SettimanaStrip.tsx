// ── La settimana, sotto il saluto ──────────────────────────────
// Sette giorni da lunedì a domenica: l'iniziale sopra, il numero sotto. I
// giorni in cui ci si è allenati sono un cerchio pieno, verde (`--fatto-bg`):
// è la cosa che la striscia esiste per dire, e si deve leggere senza cercarla.
// Prima era un cerchio appena più chiaro del fondo con un puntino sotto, e a
// colpo d'occhio la settimana sembrava vuota. Oggi è il cerchio pieno d'accent
// finché non ci si allena; poi diventa verde anche lui, con un anello d'accent
// attorno a dire che è oggi. Quelli che devono ancora venire restano spenti.
//
// La settimana del calendario e non "gli ultimi 7 giorni": "come sta andando la
// mia settimana" si legge da lunedì.
// Tutta la striscia è un tasto e apre il calendario degli allenamenti.
import { memo, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { NUC } from '@/lib/jarvis-tokens'
import { useJarvisStore } from '@/store/useJarvisStore'
import { hyroxVisibili } from '@/features/gym/hyroxAttivo'
import { localISO, giorniTra, todayISO } from '@/lib/isoDate'
import { ultimoAllenamento, quantoFa } from '@/features/gym/gymModel'
import { GIORNI_DI_STOP } from '@/features/gym/caricoConsigliato'
import { daysShort } from '@/lib/dateFormat'
import { useT, useLang } from '@/lib/i18n'
import { CalendarioAllenamenti } from './CalendarioAllenamenti'

// `memo`: non ha props, quindi si ridisegna solo quando cambiano i suoi dati
// (lo storico, la lingua) e non ogni volta che si ridisegna la home intorno.
export const SettimanaStrip = memo(function SettimanaStrip() {
  const t = useT()
  const lang = useLang()
  const s = useJarvisStore(useShallow(st => ({ palestra: st.palestraExercises, hyrox: hyroxVisibili(st.hyroxExercises) })))
  const [calendario, setCalendario] = useState(false)
  // Il calendario si monta alla prima apertura e poi resta, per chiudersi con
  // la sua animazione. Prima era montato da subito: ogni avvio dell'app pagava
  // la costruzione di un mese di celle che quasi mai si guarda.
  const [calendarioVisto, setCalendarioVisto] = useState(false)

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

  // Da quanto non ci si allena. Fino a ieri non si dice niente: lo dicono già
  // i giorni pieni della settimana. Da due giorni in su sì, e oltre i dieci cambia
  // colore — è la soglia da cui le schede avvisano che i carichi peseranno.
  const fermoDa = useMemo(() => {
    const ultimo = ultimoAllenamento(s.palestra, s.hyrox)
    return ultimo ? giorniTra(ultimo, todayISO()) : null
  }, [s.palestra, s.hyrox])

  return (
    <>
      <button
        onClick={() => { setCalendarioVisto(true); setCalendario(true) }}
        aria-label={t('Apri il calendario degli allenamenti')}
        className="j-focus"
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', width: '100%',
          padding: 0, margin: fermoDa !== null && fermoDa >= 2 ? '0 0 9px' : '0 0 clamp(10px, 1.8dvh, 16px)',
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
            <span data-allenato={g.fatto || undefined} style={{
              width: 'clamp(32px, 9vw, 38px)', aspectRatio: '1 / 1', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: NUC.font, fontSize: 'clamp(13px, 3.8vw, 15px)', fontWeight: g.oggi || g.fatto ? 700 : 500,
              background: g.fatto ? 'var(--fatto-bg)' : g.oggi ? 'var(--j-accent)' : 'transparent',
              // Il bordo c'è sempre, trasparente dove non serve: così un giorno
              // che diventa "fatto" non cambia misura di un pixel.
              border: `1px solid ${g.fatto ? 'var(--fatto-bordo)' : 'transparent'}`,
              color: g.fatto ? 'var(--fg)' : g.oggi ? 'var(--j-accent-fg)' : g.futuro ? 'var(--fg-mute)' : 'var(--fg)',
              // Outline e non box-shadow: Premium spegne ogni ombra, e l'anello
              // sparirebbe con loro (come nel calendario).
              outline: g.oggi && g.fatto ? '2px solid var(--j-accent)' : undefined,
              outlineOffset: g.oggi && g.fatto ? 2 : undefined,
            }}>
              {g.num}
            </span>
          </div>
        ))}
      </button>
      {fermoDa !== null && fermoDa >= 2 && (
        <div style={{
          margin: '0 0 clamp(10px, 1.8dvh, 16px)', textAlign: 'center',
          fontFamily: NUC.label, fontSize: 11, letterSpacing: '.02em',
          color: fermoDa > GIORNI_DI_STOP ? 'var(--warn)' : 'var(--fg-mute)',
          fontWeight: fermoDa > GIORNI_DI_STOP ? 600 : 400,
        }}>
          {fermoDa > GIORNI_DI_STOP
            ? t('Non ti alleni da {n} giorni', { n: fermoDa })
            : t('Ultimo allenamento: {quando}', { quando: quantoFa(fermoDa, t) })}
        </div>
      )}
      {calendarioVisto && <CalendarioAllenamenti open={calendario} onClose={() => setCalendario(false)}/>}
    </>
  )
})

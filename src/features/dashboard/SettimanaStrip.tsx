// ── La settimana, sotto il saluto ──────────────────────────────
// Sette giorni da lunedì a domenica, in un riquadro col bordo d'inchiostro:
// il giorno in tre lettere sopra, il numero sotto, un filo fra una cella e
// l'altra (rebranding, ott 2026). Un giorno in cui ci si è allenati ha la barra
// d'accento sul fondo: è la cosa che la striscia esiste per dire, e si deve
// leggere senza cercarla. Oggi è la cella piena d'inchiostro; quelli che devono
// ancora venire restano grigi.
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
import { daysAbbr } from '@/lib/dateFormat'
import { useT, useLang } from '@/lib/i18n'
import { CalendarioAllenamenti } from './CalendarioAllenamenti'

export interface GiornoSettimana {
  iso: string; dow: string; num: number
  fatto: boolean; oggi: boolean; futuro: boolean
}

/** Le sette celle, senza il contenitore (che le mette in griglia, sette
 *  colonne): le usa anche la pagina dell'allievo, dove la striscia non apre
 *  niente. */
export function CelleSettimana({ giorni }: { giorni: GiornoSettimana[] }) {
  return (
    <>
      {giorni.map((g, i) => (
        <span key={g.iso} data-allenato={g.fatto || undefined} data-oggi={g.oggi || undefined} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          padding: '9px 0 6px', minWidth: 0,
          borderLeft: i === 0 ? 'none' : '1px solid var(--line)',
          // La barra c'è sempre, trasparente dove non serve: un giorno che
          // diventa "fatto" non cambia misura di un pixel.
          borderBottom: `5px solid ${g.fatto ? 'var(--j-accent)' : 'transparent'}`,
          background: g.oggi ? 'var(--ink)' : 'transparent',
          color: g.oggi ? 'var(--surface)' : g.futuro ? 'var(--muted-dark)' : 'var(--fg)',
        }}>
          <span style={{
            fontFamily: NUC.label, fontSize: 12, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase',
            color: g.oggi ? 'var(--surface)' : 'var(--fg-mute)',
          }}>
            {g.dow}
          </span>
          <span style={{ fontFamily: NUC.label, fontSize: 22, fontWeight: g.oggi ? 800 : 700, lineHeight: 1 }}>
            {g.num}
          </span>
        </span>
      ))}
    </>
  )
}

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

  const giorni = useMemo<GiornoSettimana[]>(() => {
    const oggi = new Date()
    const oggiISO = localISO(oggi)
    const DOW = daysAbbr(lang)
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
          // Un riquadro solo, bianco, col bordo d'inchiostro; dentro sette celle
          // divise da un filo. Oggi è la cella piena d'inchiostro, un giorno
          // fatto ha la barra d'accento sul fondo della sua cella.
          display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', width: '100%',
          padding: 0, margin: fermoDa !== null && fermoDa >= 2 ? '0 0 9px' : '0 0 clamp(10px, 1.8dvh, 16px)',
          background: 'var(--surface)', border: 'var(--bordo)', cursor: 'pointer', color: 'inherit',
          overflow: 'hidden',
        }}
      >
        <CelleSettimana giorni={giorni}/>
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

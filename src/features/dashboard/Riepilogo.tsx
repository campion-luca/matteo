// Il riepilogo complessivo, in cima alle Statistiche: la settimana, la mappa
// della forza, i massimali. Tre sezioni una sotto l'altra, ognuna col suo
// titolo (rebranding, ott 2026: erano tre righe dentro un riquadro solo).
//
// Era la home dell'app; di quella schermata qui resta il riepilogo. Non è una
// pagina — nessuna intestazione, nessuno scroll proprio: chi lo ospita decide
// dove e quanto spazio gli tocca.
// Qui non si calcola nulla di proprio: volumi e settimane arrivano da gymModel.
import { useState, useMemo } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { NucEyebrow } from '@/components/ui/NucComponents'
import { Icons } from '@/components/ui/Icons'
import { useShallow } from 'zustand/react/shallow'
import { useJarvisStore } from '@/store/useJarvisStore'
import { hyroxVisibili } from '@/features/gym/hyroxAttivo'
import { localISO } from '@/lib/isoDate'
import { useOggi } from '@/hooks/useOggi'
import { districtStrength } from '@/features/gym/gymStrength'
import { maxLifts, maxTotal, SOURCE_LABELS } from '@/features/gym/gymMaxLifts'
import { BodyMapPanel } from '@/features/gym/BodyMap'
import { fmtNum } from '@/features/gym/gymModel'
import { CalendarioAllenamenti } from './CalendarioAllenamenti'
import { settimaneDiFila } from './allenamenti'
import { useT, useTData } from '@/lib/i18n'

interface RiepilogoProps {
  /** Il profilo, dove si inserisce il peso corporeo: senza, mappa della forza e
   *  massimali restano monchi, e da qui ci si arriva in un tocco. */
  onOpenProfile: () => void
}

export function Riepilogo({ onOpenProfile }: RiepilogoProps) {
  const t = useT()
  // I nomi dei massimali arrivano dal catalogo, cioè dai dati: passano da `tData`,
  // che traduce quelli noti e lascia intatto tutto il resto.
  const tData = useTData()
  // Selettori granulari: si ridisegna solo quando cambiano i campi che mostra.
  const s = useJarvisStore(useShallow(st => ({
    userWeight: st.userWeight,
    userSex: st.userSex,
    palestra: st.palestraExercises,
    hyrox: hyroxVisibili(st.hyroxExercises),
  })))
  const [showCalendario, setShowCalendario] = useState(false)
  const [maxAperti, setMaxAperti] = useState(false)

  // ── La settimana corrente, lunedì→domenica ───────────────────
  // NON gli ultimi 7 giorni: "la mia settimana" è quella del calendario.
  // Ricalcolata anche quando cambia il giorno ad app aperta (vedi useOggi).
  const giorno = useOggi()
  const settimana = useMemo(() => {
    const oggi = new Date()
    const oggiISO = localISO(oggi)
    // getDay(): 0 = domenica. Riportato a lunedì = 0, come le settimane ISO.
    const lunedì = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - ((oggi.getDay() + 6) % 7))

    const allenati = new Set<string>()
    s.palestra.forEach(ex => ex.history.forEach(h => { if (h.date) allenati.add(h.date) }))
    s.hyrox.forEach(ex => ex.history.forEach(h => { if (h.date) allenati.add(h.date) }))

    const giorni = Array.from({ length: 7 }, (_, i) => {
      const iso = localISO(new Date(lunedì.getFullYear(), lunedì.getMonth(), lunedì.getDate() + i))
      return { iso, fatto: allenati.has(iso), oggi: iso === oggiISO }
    })
    return {
      serie: settimaneDiFila(allenati, oggiISO),
      fatti: giorni.filter(g => g.fatto).length,
      giorni,
    }
    // `giorno` non si legge: il giorno lo rifà `new Date()` qui dentro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.palestra, s.hyrox, giorno])

  // ── Mappa della forza per distretto ──────────────────────────
  const distretti = useMemo(
    () => districtStrength(s.palestra, s.userWeight ?? 0, s.userSex),
    [s.palestra, s.userWeight, s.userSex],
  )

  // ── I tre massimali ──────────────────────────────────────────
  // Squat, panca e stacco sono tre numeri e un total, cioè il modo in cui la
  // forza si racconta fuori da questa app.
  const massimali = useMemo(
    () => maxLifts(s.palestra, s.userWeight ?? 0, distretti),
    [s.palestra, s.userWeight, distretti],
  )
  const total = maxTotal(massimali)
  const totalRatio = total !== null && s.userWeight ? total / s.userWeight : null
  const qualcosa = massimali.some(l => l.kg !== null)

  const etichetta = { fontFamily: NUC.display, fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' } as const

  return (
    <>
      {/* ── Questa settimana: le settimane di fila, e i giorni fatti su sette ── */}
      <section style={{ marginBottom: 26 }}>
        <NucEyebrow right={
          <button onClick={() => setShowCalendario(true)} aria-label={t('Apri il calendario degli allenamenti')} className="j-focus" style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44, padding: 0,
            background: 'none', border: 'none', cursor: 'pointer',
            font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: 'inherit',
          }}>
            {t('Dettagli')} <Icons.arrow size={16} stroke={2.2}/>
          </button>
        }>{t('Questa settimana')}</NucEyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--surface)', border: 'var(--bordo)' }}>
          <div style={{ padding: 14 }}>
            <div style={{ fontFamily: NUC.display, fontSize: 56, fontWeight: 800, lineHeight: .9, color: settimana.serie > 0 ? 'var(--fg)' : 'var(--fg-mute)' }}>
              {settimana.serie}
            </div>
            <div style={{ ...etichetta, color: 'var(--fg-mute)', marginTop: 6 }}>
              {settimana.serie === 1 ? t('Settimana di fila') : t('Settimane di fila')}
            </div>
          </div>
          <div style={{ padding: 14, borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ ...etichetta, color: 'var(--fg-mute)' }}>{t('Sessioni {n}/7', { n: settimana.fatti })}</div>
            {/* I sette giorni da lunedì: pieno d'accento un giorno fatto, col
                bordo d'inchiostro oggi, grigio il resto. */}
            <div aria-hidden style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
              {settimana.giorni.map(g => (
                <span key={g.iso} style={{
                  height: 22, boxSizing: 'border-box',
                  background: g.fatto ? 'var(--j-accent)' : g.oggi ? 'var(--surface)' : 'var(--line)',
                  border: g.oggi ? '2px solid var(--ink)' : 'none',
                }}/>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── La mappa della forza: titolo, fronte/retro, sagoma e barre ── */}
      <BodyMapPanel districts={distretti} noWeight={!s.userWeight} onOpenProfile={onOpenProfile}/>

      {/* ── I massimali: la card nera. Chiusa dice il total; toccandola si
          aprono le tre alzate che lo compongono. "Ipotetici" perché quasi
          sempre sono stime da serie a ripetizioni, non singole provate. */}
      <section style={{ marginBottom: 26, background: 'var(--ink)', border: 'var(--bordo)', color: 'var(--surface)' }}>
        <button
          onClick={() => qualcosa && setMaxAperti(v => !v)}
          aria-expanded={qualcosa ? maxAperti : undefined}
          className="j-focus"
          style={{
            width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10,
            padding: '16px 16px 18px', background: 'transparent', border: 'none',
            cursor: qualcosa ? 'pointer' : 'default', textAlign: 'left', color: 'inherit',
          }}
        >
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: NUC.display, fontSize: 15, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--j-accent)' }}>
              {t('Massimali ipotetici')}
            </span>
            {qualcosa ? (
              <>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
                  <span style={{ fontFamily: NUC.display, fontSize: 64, fontWeight: 800, lineHeight: .85, color: total !== null ? 'var(--surface)' : 'var(--muted-dark)' }}>
                    {total !== null ? total : '—'}
                  </span>
                  {total !== null && <span style={{ fontFamily: NUC.display, fontSize: 24, fontWeight: 700, color: 'var(--muted-dark)' }}>KG</span>}
                </span>
                {/* Il total esce solo con tutte tre (vedi `maxTotal`): due terzi di
                    un total somigliano troppo a un total per poterli mostrare. */}
                <span style={{ display: 'block', ...etichetta, fontSize: 13, color: 'var(--muted-dark)', marginTop: 8 }}>
                  {total !== null
                    ? `${t('Totale')}${totalRatio ? ` · ${t('{r}× il tuo peso', { r: fmtNum(Number(totalRatio.toFixed(1))) })}` : ''}`
                    : t('Il total compare con tutte e tre le alzate')}
                </span>
              </>
            ) : (
              <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 14, lineHeight: 1.5, color: 'var(--muted-dark)', marginTop: 8 }}>
                {t('Registra un’alzata: qui vedrai squat, panca piana e stacco da terra.')}
              </span>
            )}
          </span>
          {qualcosa && (
            <span style={{ display: 'flex', color: 'var(--surface)', flexShrink: 0, transform: maxAperti ? 'rotate(90deg)' : 'none', transition: 'transform var(--motion-fast) var(--ease)' }}>
              <Icons.chev size={20} stroke={2.2}/>
            </span>
          )}
        </button>

        {qualcosa && maxAperti && (
          <div style={{ padding: '0 16px 12px' }}>
            {massimali.map(l => {
              // Da dove viene il numero sta SEMPRE scritto: "dichiarato" è una
              // singola provata davvero, "stimato" viene da una serie a
              // ripetizioni, e "dal distretto" non è il massimale di quell'alzata
              // — sono i chili che sposti su quei muscoli.
              const provato = l.source === 'dichiarato'
              const daAltro = l.source !== 'distretto' && l.exercise && l.exercise !== l.name
              return (
                <div key={l.id} style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
                  padding: '10px 0', borderTop: '1px solid var(--line-dark)',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: NUC.font, fontSize: 15, color: l.kg === null ? 'var(--muted-dark)' : 'var(--surface)' }}>{tData(l.name)}</div>
                    <div style={{
                      ...etichetta, marginTop: 3,
                      color: provato ? 'var(--j-accent)' : 'var(--muted-dark)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {l.source ? `${t(SOURCE_LABELS[l.source])}${daAltro ? ` · ${tData(l.exercise as string)}` : ''}` : t('Mai allenato')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: NUC.display, fontSize: 24, fontWeight: 800, lineHeight: 1, color: l.kg === null ? 'var(--muted-dark)' : 'var(--surface)' }}>
                      {l.kg !== null ? `${l.kg} kg` : '—'}
                    </div>
                    {l.ratio !== null && (
                      <div style={{ ...etichetta, color: 'var(--muted-dark)', marginTop: 3 }}>
                        {t('{r}× peso', { r: l.ratio.toFixed(2) })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Senza il peso corporeo mancano i rapporti, e a corpo libero manca
                dentro i chili: il numero c'è ma è più basso del vero. */}
            {!s.userWeight && (
              <button onClick={onOpenProfile} className="j-focus" style={{
                marginTop: 6, minHeight: 44, padding: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                ...etichetta, color: 'var(--j-accent)',
              }}>
                {t('Inserisci il peso nel profilo →')}
              </button>
            )}
          </div>
        )}
      </section>

      <CalendarioAllenamenti open={showCalendario} onClose={() => setShowCalendario(false)}/>
    </>
  )
}

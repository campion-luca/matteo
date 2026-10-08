// Il riepilogo complessivo: la settimana, la mappa della forza, i massimali.
//
// Era la home dell'app — data, saluto, "Alleniamoci" e sotto questo riquadro. La
// pagina d'ingresso adesso è l'allenamento (vedi JarvisGym), e di quella schermata
// qui resta solo il riquadro: sta in cima a Stats, aperto. Non è una pagina e non
// è una tendina — nessuna intestazione, nessuna freccia, nessuno scroll proprio:
// è una SEZIONE, e chi la ospita decide dove e quanto spazio le tocca.
// Il saluto e i comandi sono andati in `SalutoHeader`, in cima all'allenamento.
//
// Ogni modulo (settimana, forza, massimali) è una sezione del riepilogo, in un
// ordine fisso. Si potevano spegnere e riordinare da "Cambio widget", nelle
// impostazioni: tolto quel pannello, restano tutti e tre accesi — un modulo
// spento senza più un posto da cui riaccenderlo sarebbe sparito per sempre.
// Qui non si calcola nulla di proprio: volumi e settimane arrivano da gymModel.
// La dashboard è una vista, e deve restare tale.
import { useState, useMemo } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { NucCard, NucEyebrow } from '@/components/ui/NucComponents'
import { Icons } from '@/components/ui/Icons'
import { useShallow } from 'zustand/react/shallow'
import { useJarvisStore } from '@/store/useJarvisStore'
import { hyroxVisibili } from '@/features/gym/hyroxAttivo'
import { localISO } from '@/lib/isoDate'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { districtStrength } from '@/features/gym/gymStrength'
import { maxLifts, maxTotal, SOURCE_LABELS } from '@/features/gym/gymMaxLifts'
import { BodyMapPanel } from '@/features/gym/BodyMap'
import { CalendarioAllenamenti } from './CalendarioAllenamenti'
import { settimaneDiFila } from './allenamenti'
import { useT, useTData } from '@/lib/i18n'

interface RiepilogoProps {
  /** Il profilo, dove si inserisce il peso corporeo: senza, mappa della forza e
   *  massimali restano monchi, e da qui ci si arriva in un tocco. */
  onOpenProfile: () => void
}

// Il respiro sopra e sotto ogni sezione del riepilogo: 12px su un iPhone di
// misura normale, meno su uno schermo basso.
const SEZ = 'clamp(8px, 1.4dvh, 12px)'

export function Riepilogo({ onOpenProfile }: RiepilogoProps) {
  const t = useT()
  // I nomi dei massimali arrivano dal catalogo, cioè dai dati: passano da `tData`,
  // che traduce quelli noti e lascia intatto tutto il resto.
  const tData = useTData()
  // Selettori granulari: la home si ri-renderizza solo quando cambiano i campi
  // che mostra, non a ogni modifica dello store.
  const s = useJarvisStore(useShallow(st => ({
    userWeight: st.userWeight,
    userSex: st.userSex,
    palestra: st.palestraExercises,
    hyrox: hyroxVisibili(st.hyroxExercises),
  })))
  const isDesktop = useIsDesktop()
  const [showCalendario, setShowCalendario] = useState(false)
  const [maxAperti, setMaxAperti] = useState(false)

  // ── La settimana corrente, lunedì→domenica ───────────────────
  // NON gli ultimi 7 giorni: "la mia settimana" è quella del calendario.
  // Qui servono solo due numeri — le settimane di fila e in quanti giorni di
  // questa ci si è allenati: i sette giorni uno per uno li disegna la striscia
  // in testata (vedi SettimanaStrip).
  const settimana = useMemo(() => {
    const oggi = new Date()
    // getDay(): 0 = domenica. Riportato a lunedì = 0, come le settimane ISO.
    const lunedì = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - ((oggi.getDay() + 6) % 7))

    const allenati = new Set<string>()
    s.palestra.forEach(ex => ex.history.forEach(h => { if (h.date) allenati.add(h.date) }))
    s.hyrox.forEach(ex => ex.history.forEach(h => { if (h.date) allenati.add(h.date) }))

    const giorni = Array.from({ length: 7 }, (_, i) => localISO(new Date(lunedì.getFullYear(), lunedì.getMonth(), lunedì.getDate() + i)))
    return {
      serie: settimaneDiFila(allenati, localISO(oggi)),
      fatti: giorni.filter(iso => allenati.has(iso)).length,
    }
  }, [s.palestra, s.hyrox])

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

  // Ogni modulo è una SEZIONE del riepilogo, non più una card sua: stanno tutti
  // nello stesso riquadro, divisi da un filo.
  const renderModule = (id: string) => {
    switch (id) {
      case 'weekDots': return (
        // Una riga sola: le settimane di fila e i giorni fatti su sette. I sette
        // giorni disegnati uno per uno non ci sono più — stanno già nella
        // striscia in testata, a due dita da qui, e ripeterli era dire la stessa
        // cosa due volte nella stessa schermata.
        // Tutta la riga è il tasto che apre il calendario: il bersaglio è la
        // sezione intera, non una scritta "vedi tutto" da cercare.
        <button
          onClick={() => setShowCalendario(true)}
          aria-label={t('Apri il calendario degli allenamenti')}
          className="j-focus j-riga-gruppo"
          style={{
            display: 'block', width: 'calc(100% + 16px)', margin: '0 -8px', padding: `${SEZ} 8px`,
            background: 'transparent', border: 'none',
            borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left', color: 'inherit',
          }}
        >
          <NucEyebrow style={{ marginBottom: 0 }} right={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: settimana.serie > 0 ? 'var(--j-accent-ink)' : 'var(--fg-mute)' }}>
                <Icons.flame size={13} stroke={1.8}/>
                <span style={{ fontWeight: 600 }}>{settimana.serie}</span>
              </span>
              <span>{settimana.fatti}/7</span>
              <Icons.chev size={13} stroke={1.8}/>
            </span>
          }>{t('La tua settimana')}</NucEyebrow>
        </button>
      )

      case 'bodyMap': return (
        <div style={{ padding: `${SEZ} 0` }}>
          <NucEyebrow>{t('Mappa della forza')}</NucEyebrow>
          <BodyMapPanel districts={distretti} noWeight={!s.userWeight} onOpenProfile={onOpenProfile}/>
        </div>
      )

      case 'maxLifts': {
        const qualcosa = massimali.some(l => l.kg !== null)
        return (
          <div style={{ padding: `${SEZ} 0` }}>
            {/* Una tendina: chiusa dice il total, aperta le tre alzate che lo
                compongono. "Ipotetici" perché quasi sempre sono stime da serie a
                ripetizioni, non singole provate. */}
            <button
              onClick={() => qualcosa && setMaxAperti(v => !v)}
              aria-expanded={qualcosa ? maxAperti : undefined}
              className="j-focus"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                padding: 0, background: 'transparent', border: 'none', borderRadius: 'var(--radius)',
                cursor: qualcosa ? 'pointer' : 'default', textAlign: 'left', color: 'inherit',
              }}
            >
              <NucEyebrow style={{ marginBottom: 0 }}>{t('Massimali ipotetici')}</NucEyebrow>
              {qualcosa && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontFamily: NUC.font, fontSize: 17, fontWeight: 600, letterSpacing: -0.3, color: total !== null ? 'var(--fg)' : 'var(--fg-mute)' }}>
                    {total !== null ? `${total} kg` : '—'}
                  </span>
                  <span style={{ display: 'flex', color: 'var(--fg-mute)', transform: maxAperti ? 'rotate(90deg)' : 'none', transition: 'transform var(--motion-fast) var(--ease)' }}>
                    <Icons.chev size={15} stroke={1.8}/>
                  </span>
                </span>
              )}
            </button>

            {!qualcosa ? (
              <div style={{ fontFamily: NUC.font, fontSize: 12.5, color: 'var(--fg-mute)', padding: '10px 0 0', lineHeight: 1.5 }}>
                {t('Registra un’alzata: qui vedrai squat, panca piana e stacco da terra.')}
              </div>
            ) : (
              <>
                {/* Il total esce solo con tutte tre (vedi `maxTotal`): due terzi di un
                    total somigliano troppo a un total per poterli mostrare. */}
                <div style={{ fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg-mute)', marginTop: 4, padding: '0 2px' }}>
                  {total !== null
                    ? `${t('Total')}${totalRatio ? ` · ${t('{r}× il tuo peso', { r: totalRatio.toFixed(1) })}` : ''}`
                    : t('Il total compare con tutte e tre le alzate')}
                </div>

                {maxAperti && (
                  <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
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
                          padding: '9px 0', borderTop: '1px solid var(--hairline-soft)',
                        }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontFamily: NUC.font, fontSize: 13.5, color: l.kg === null ? 'var(--fg-mute)' : 'var(--fg)' }}>{tData(l.name)}</div>
                            <div style={{
                              fontFamily: NUC.label, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
                              color: provato ? 'var(--j-accent-ink)' : 'var(--fg-mute)', marginTop: 3,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {l.source ? `${t(SOURCE_LABELS[l.source])}${daAltro ? ` · ${tData(l.exercise as string)}` : ''}` : t('Mai allenato')}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontFamily: NUC.font, fontSize: 17, fontWeight: 500, letterSpacing: -0.4, lineHeight: 1.1, color: l.kg === null ? 'var(--fg-mute)' : 'var(--fg)' }}>
                              {l.kg !== null ? `${l.kg} kg` : '—'}
                            </div>
                            {l.ratio !== null && (
                              <div style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.08em', color: 'var(--fg-mute)', marginTop: 2 }}>
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
                        marginTop: 10, padding: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                        fontFamily: NUC.label, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase',
                        color: 'var(--j-accent-ink)',
                      }}>
                        {t('Inserisci il peso nel profilo →')}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )
      }

      default: return null
    }
  }

  const MODULI = ['weekDots', 'bodyMap', 'maxLifts']

  return (
    <>
      <NucCard pad={14} style={{ marginBottom: 16, maxWidth: isDesktop ? 720 : undefined }}>
        <div style={{
          fontFamily: NUC.label, fontSize: 12, fontWeight: 700, letterSpacing: '.18em',
          textTransform: 'uppercase', color: 'var(--fg)', paddingBottom: 4,
        }}>{t('Riepilogo complessivo')}</div>

        {MODULI.map((id, i) => (
          <div key={id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--divider)' }}>
            {renderModule(id)}
          </div>
        ))}
      </NucCard>

      <CalendarioAllenamenti open={showCalendario} onClose={() => setShowCalendario(false)}/>
    </>
  )
}

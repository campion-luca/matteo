// Home dell'app: la data, il saluto, il richiamo all'allenamento e sotto il
// riepilogo complessivo.
//
// Il tasto "Alleniamoci" è fisso e non è un modulo: è l'azione per cui l'app
// esiste, e non deve poter essere spenta o spinta in fondo.
// Ogni modulo (settimana, forza, massimali) è invece una sezione del riepilogo, un
// case dello switch dentro `JarvisDashboard`: l'ordine e quali siano accesi arrivano da
// `homeModules` (localStorage, non lo store cloud: è una preferenza del singolo
// dispositivo). A riordinarli è il menù utente — vedi HomeModulesManager.
// Qui non si calcola nulla di proprio: volumi e settimane arrivano da gymModel.
// La dashboard è una vista, e deve restare tale.
import { useState, useMemo } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { NucCard, NucEyebrow } from '@/components/ui/NucComponents'
import { useGreeting } from '@/components/ui/Primitives'
import { Icons } from '@/components/ui/Icons'
import { useShallow } from 'zustand/react/shallow'
import { useJarvisStore } from '@/store/useJarvisStore'
import { localISO } from '@/lib/isoDate'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { GlobalSearch } from '@/features/search/GlobalSearch'
import { districtStrength } from '@/features/gym/gymStrength'
import { maxLifts, maxTotal, SOURCE_LABELS } from '@/features/gym/gymMaxLifts'
import { BodyMapPanel } from '@/features/gym/BodyMap'
import { daysShort, fmtGiornoLungo } from '@/lib/dateFormat'
import { useHomeModules } from './homeModules'
import { CalendarioAllenamenti } from './CalendarioAllenamenti'
import { settimaneDiFila } from './allenamenti'
import { useT, useTData, useLang } from '@/lib/i18n'

interface DashboardProps {
  onOpenGym: () => void
  onOpenProfile: () => void
}

export function JarvisDashboard({ onOpenGym, onOpenProfile }: DashboardProps) {
  const t = useT()
  const lang = useLang()
  // I nomi dei massimali arrivano dal catalogo, cioè dai dati: passano da `tData`,
  // che traduce quelli noti e lascia intatto tutto il resto.
  const tData = useTData()
  // Selettori granulari: la home si ri-renderizza solo quando cambiano i campi
  // che mostra, non a ogni modifica dello store.
  const s = useJarvisStore(useShallow(st => ({
    userName: st.userName,
    userWeight: st.userWeight,
    userSex: st.userSex,
    palestra: st.palestraExercises,
    hyrox: st.hyroxExercises,
  })))
  const isDesktop = useIsDesktop()
  const greeting = useGreeting(s.userName)
  const modules = useHomeModules()
  const [showSearch, setShowSearch] = useState(false)
  const [showCalendario, setShowCalendario] = useState(false)
  const [maxAperti, setMaxAperti] = useState(false)
  const userName = s.userName.trim()

  // ── La settimana corrente, lunedì→domenica ───────────────────
  // NON gli ultimi 7 giorni: "la mia settimana" è quella del calendario, con i
  // giorni che devono ancora arrivare vuoti.
  const settimana = useMemo(() => {
    const oggi = new Date()
    const oggiISO = localISO(oggi)
    // Le iniziali dei giorni seguono la lingua scelta: `lang` è in coda alle
    // dipendenze, quindi al cambio lingua la striscia si ricalcola.
    const DOW = daysShort(lang)
    // getDay(): 0 = domenica. Riportato a lunedì = 0, come le settimane ISO.
    const lunedì = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - ((oggi.getDay() + 6) % 7))

    const allenati = new Set<string>()
    s.palestra.forEach(ex => ex.history.forEach(h => { if (h.date) allenati.add(h.date) }))
    s.hyrox.forEach(ex => ex.history.forEach(h => { if (h.date) allenati.add(h.date) }))

    return {
      serie: settimaneDiFila(allenati, oggiISO),
      giorni: Array.from({ length: 7 }, (_, i) => {
        const d = new Date(lunedì.getFullYear(), lunedì.getMonth(), lunedì.getDate() + i)
        const iso = localISO(d)
        return {
          iso, dow: DOW[i], num: d.getDate(),
          trained: allenati.has(iso),
          oggi: iso === oggiISO,
          futuro: iso > oggiISO,
        }
      }),
    }
  }, [s.palestra, s.hyrox, lang])

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
  // nello stesso riquadro, divisi da un filo. L'ordine e quali siano accesi
  // restano quelli di "Cambio widget".
  const renderModule = (id: string) => {
    switch (id) {
      case 'weekDots': {
        const fatti = settimana.giorni.filter(d => d.trained).length
        return (
          // Tutta la sezione è il tasto che apre il calendario: il bersaglio è la
          // striscia intera, non una scritta "vedi tutto" da cercare.
          <button
            onClick={() => setShowCalendario(true)}
            aria-label={t('Apri il calendario degli allenamenti')}
            className="j-focus j-riga-gruppo"
            style={{
              display: 'block', width: 'calc(100% + 16px)', margin: '0 -8px', padding: '12px 8px',
              background: 'transparent', border: 'none',
              borderRadius: 0, cursor: 'pointer', textAlign: 'left', color: 'inherit',
            }}
          >
            <NucEyebrow right={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: settimana.serie > 0 ? 'var(--j-accent-ink)' : 'var(--fg-mute)' }}>
                  <Icons.flame size={13} stroke={1.8}/>
                  <span style={{ fontWeight: 600 }}>{settimana.serie}</span>
                </span>
                <span>{fatti}/7</span>
                <Icons.chev size={13} stroke={1.8}/>
              </span>
            }>{t('La tua settimana')}</NucEyebrow>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
              {settimana.giorni.map(d => (
                <div key={d.iso} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{
                    fontFamily: NUC.label, fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase',
                    color: d.oggi ? 'var(--j-accent-ink)' : 'var(--fg-mute)',
                    fontWeight: d.oggi ? 600 : 500,
                  }}>{d.dow}</div>
                  {/* Pieno = allenato. I giorni ancora da venire restano
                      tratteggiati: un quadrato vuoto pieno di bordo li avrebbe fatti
                      leggere come "saltato", che non è ancora vero. */}
                  <div style={{
                    width: 30, height: 30, borderRadius: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: d.trained ? 'var(--j-accent)' : 'transparent',
                    border: d.trained
                      ? '1px solid var(--j-accent)'
                      : `1px ${d.futuro ? 'dashed' : 'solid'} var(--hairline)`,
                    color: d.trained ? 'var(--j-accent-fg)' : 'var(--fg-mute)',
                    fontFamily: NUC.label, fontSize: 11.5,
                    fontWeight: d.trained ? 600 : 400,
                    // Il giorno di oggi si riconosce dall'anello attorno, non da un
                    // colore in più: i colori qui dicono già "allenato o no".
                    // Outline e non box-shadow: Premium spegne ogni ombra, e l'anello
                    // sparirebbe con loro.
                    outline: d.oggi ? '1px solid var(--j-accent)' : undefined,
                    outlineOffset: d.oggi ? 2 : undefined,
                    transition: 'background 300ms var(--ease)',
                  }}>{d.num}</div>
                </div>
              ))}
            </div>
          </button>
        )
      }

      case 'bodyMap': return (
        <div style={{ padding: '12px 0' }}>
          <NucEyebrow>{t('Mappa della forza')}</NucEyebrow>
          <BodyMapPanel districts={distretti} noWeight={!s.userWeight} onOpenProfile={onOpenProfile}/>
        </div>
      )

      case 'maxLifts': {
        const qualcosa = massimali.some(l => l.kg !== null)
        return (
          <div style={{ padding: '12px 0' }}>
            {/* Una tendina: chiusa dice il total, aperta le tre alzate che lo
                compongono. "Ipotetici" perché quasi sempre sono stime da serie a
                ripetizioni, non singole provate. */}
            <button
              onClick={() => qualcosa && setMaxAperti(v => !v)}
              aria-expanded={qualcosa ? maxAperti : undefined}
              className="j-focus"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                padding: 0, background: 'transparent', border: 'none', borderRadius: 0,
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
                  <div className="j-rise-in" style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
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

  const activeModules = modules.filter(m => m.on)

  // Split greeting: everything before the name, the name, and after
  const nameStart = userName ? greeting.indexOf(userName) : -1
  const greetBefore = nameStart >= 0 ? greeting.slice(0, nameStart) : greeting
  const greetAfter  = nameStart >= 0 ? greeting.slice(nameStart + userName.length) : ''

  // I due comandi della home: stessa forma, quadrati, sulla riga del saluto.
  const tastoQuadrato = (label: string, onClick: () => void, icona: JSX.Element) => (
    <button onClick={onClick} aria-label={label} title={label} className="j-hard j-hard-sm j-focus" style={{
      width: 38, height: 38, borderRadius: 0, flexShrink: 0,
      background: 'var(--surface)', border: '1px solid var(--hairline)',
      color: 'var(--fg-soft)', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {icona}
    </button>
  )

  return (
    <div style={{
      // Su mobile la tacca/status bar la scansa già l'app shell con
      // `env(safe-area-inset-top)` (App.tsx): questo padding è solo respiro.
      position: 'relative', minHeight: '100%',
      padding: isDesktop ? '24px 28px 48px' : '26px 20px calc(var(--nav-clear) + 24px)',
      fontFamily: NUC.font, color: 'var(--fg)',
    }}>

      {/* Header — la data di oggi, il saluto, e sulla stessa riga i due comandi. */}
      <div className="jarvis-boot" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: isDesktop ? 28 : 22 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: NUC.label, fontSize: 12, fontWeight: 600, letterSpacing: '.04em',
            color: 'var(--tertiary-ink)', marginBottom: 6,
          }}>{fmtGiornoLungo(new Date(), lang)}</div>
          {/* Il saluto è l'unica cosa in Fraunces di tutta l'app (--font-saluto): nome
              enfatizzato con peso + sottolineatura accent */}
          <div style={{
            fontFamily: 'var(--font-saluto)',
            fontSize: 'clamp(30px, 5.2vw, 42px)', fontWeight: 500, letterSpacing: '-0.01em',
            lineHeight: 1.05, color: 'var(--fg)',
          }}>
            {greetBefore}
            {nameStart >= 0 && (
              <em style={{
                fontStyle: 'normal', fontWeight: 600,
                textDecoration: 'underline',
                textDecorationColor: 'var(--j-accent)',
                textDecorationThickness: 1,
                textUnderlineOffset: 3,
              }}>{userName}</em>
            )}
            {greetAfter}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, paddingTop: 2 }}>
          {tastoQuadrato(t('Ricerca globale'), () => setShowSearch(true), <Icons.search size={16} stroke={1.8}/>)}
          {tastoQuadrato(t('Impostazioni'), onOpenProfile, <Icons.settings size={15} stroke={1.6}/>)}
        </div>
      </div>

      {/* Alleniamoci — l'azione per cui l'app esiste, e su telefono l'unica via per
          l'allenamento. Non è un modulo: sta sopra a tutto, non si può spegnere e
          non si può riordinare. */}
      <button
        onClick={onOpenGym}
        // Pressione, ombra e riflesso arrivano da `.j-hard` e `.j-accent-key`: niente
        // boxShadow/transform/transition inline, batterebbero il foglio in silenzio.
        className="j-hard j-accent-key j-focus"
        style={{
          width: '100%', display: 'block',
          marginBottom: isDesktop ? 20 : 18,
          padding: isDesktop ? '13px 18px' : '11px 16px',
          borderRadius: 0, cursor: 'pointer',
          backgroundColor: 'var(--j-accent)', border: '1px solid var(--accent-edge)', color: 'var(--j-accent-fg)',
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{
            fontFamily: 'var(--font-body)', fontWeight: 600,
            fontSize: 'clamp(17px, 4.2vw, 23px)', lineHeight: 1,
            letterSpacing: '-0.01em', textTransform: 'uppercase',
          }}>{t('Alleniamoci')}</span>
          <span aria-hidden style={{ display: 'flex' }}>
            <Icons.weight size={20} stroke={1.7}/>
          </span>
        </span>
      </button>

      {/* Riepilogo complessivo: un riquadro solo, con i moduli come sezioni. */}
      <NucCard pad={16} style={{ maxWidth: isDesktop ? 720 : undefined }}>
        <div style={{
          fontFamily: NUC.label, fontSize: 12, fontWeight: 700, letterSpacing: '.18em',
          textTransform: 'uppercase', color: 'var(--fg)', paddingBottom: 4,
        }}>{t('Riepilogo complessivo')}</div>

        {activeModules.length === 0 ? (
          <div style={{
            marginTop: 10, padding: 18, textAlign: 'center', color: 'var(--fg-mute)',
            fontFamily: NUC.label, fontSize: 10, letterSpacing: '.12em',
            border: `1px dashed var(--hairline)`, borderRadius: 0,
          }}>
            {t('Nessun modulo attivo. Riaccendili da Impostazioni · Cambio widget.')}
          </div>
        ) : activeModules.map((m, i) => (
          <div key={m.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--divider)' }}>
            {renderModule(m.id)}
          </div>
        ))}
      </NucCard>

      <GlobalSearch
        open={showSearch}
        onClose={() => setShowSearch(false)}
        onOpenGym={onOpenGym}
      />
      <CalendarioAllenamenti open={showCalendario} onClose={() => setShowCalendario(false)}/>
    </div>
  )
}

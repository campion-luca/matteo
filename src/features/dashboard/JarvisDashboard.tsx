// Home dell'app: il richiamo all'allenamento, e sotto i moduli riordinabili.
//
// Il tasto "Alleniamoci" è fisso e non è un modulo: è l'azione per cui l'app
// esiste, e non deve poter essere spenta o spinta in fondo.
// Ogni modulo (settimana, forza, ricerca, riepilogo) è invece un case dello switch
// dentro `JarvisDashboard`: l'ordine e quali siano accesi arrivano da
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
import { daysShort } from '@/lib/dateFormat'
import { useHomeModules } from './homeModules'
import { useT, useTData, useLang } from '@/lib/i18n'

interface DashboardProps {
  onOpenGym: () => void
  onOpenProfile: () => void
  onOpenBudget?: () => void
  onOpenCoach?: () => void
}

export function JarvisDashboard({ onOpenGym, onOpenProfile, onOpenBudget, onOpenCoach }: DashboardProps) {
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
  const userName = s.userName.trim()

  // ── La settimana corrente, lunedì→domenica ───────────────────
  // NON gli ultimi 7 giorni come il riepilogo qui sotto: "la mia settimana" è
  // quella del calendario, con i giorni che devono ancora arrivare vuoti.
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

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunedì.getFullYear(), lunedì.getMonth(), lunedì.getDate() + i)
      const iso = localISO(d)
      return {
        iso, dow: DOW[i], num: d.getDate(),
        trained: allenati.has(iso),
        oggi: iso === oggiISO,
        futuro: iso > oggiISO,
      }
    })
  }, [s.palestra, s.hyrox, lang])

  // ── Mappa della forza per distretto ──────────────────────────
  const distretti = useMemo(
    () => districtStrength(s.palestra, s.userWeight ?? 0, s.userSex),
    [s.palestra, s.userWeight, s.userSex],
  )

  // ── I tre massimali ──────────────────────────────────────────
  // Il widget "Forza" mostrava un numero solo — il massimale più alto di qualunque
  // esercizio — che per mesi era sempre lo stesso e non diceva mai cosa fosse
  // rimasto indietro. Squat, panca e stacco sono tre numeri e un total, cioè il
  // modo in cui la forza si racconta fuori da questa app.
  const massimali = useMemo(
    () => maxLifts(s.palestra, s.userWeight ?? 0, distretti),
    [s.palestra, s.userWeight, distretti],
  )
  const total = maxTotal(massimali)
  const totalRatio = total !== null && s.userWeight ? total / s.userWeight : null

  const renderModule = (id: string, desktop?: boolean) => {
    const mb = desktop ? 0 : 12
    switch (id) {
      case 'weekDots': {
        const fatti = settimana.filter(d => d.trained).length
        return (
          <NucCard hard key={id} pad={14} style={{ marginBottom: mb }}>
            <NucEyebrow right={`${fatti}/7`}>{t('La tua settimana')}</NucEyebrow>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
              {settimana.map(d => (
                <div key={d.iso} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{
                    fontFamily: NUC.label, fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase',
                    color: d.oggi ? 'var(--j-accent-ink)' : 'var(--fg-mute)',
                    fontWeight: d.oggi ? 600 : 500,
                  }}>{d.dow}</div>
                  {/* Cerchio pieno = allenato. I giorni ancora da venire restano
                      tratteggiati: un cerchio vuoto pieno di bordo li avrebbe fatti
                      leggere come "saltato", che non è ancora vero. */}
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
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
                    boxShadow: d.oggi ? '0 0 0 2px var(--surface), 0 0 0 3px var(--j-accent)' : undefined,
                    transition: 'background 300ms var(--ease)',
                  }}>{d.num}</div>
                </div>
              ))}
            </div>
          </NucCard>
        )
      }

      case 'bodyMap': return (
        <NucCard hard key={id} pad={14} style={{ marginBottom: mb }}>
          <NucEyebrow info="bodyMap">{t('Mappa della forza')}</NucEyebrow>
          <BodyMapPanel districts={distretti} noWeight={!s.userWeight} onOpenProfile={onOpenProfile}/>
        </NucCard>
      )

      case 'maxLifts': {
        const qualcosa = massimali.some(l => l.kg !== null)
        return (
          <NucCard hard key={id} pad={14} style={{ marginBottom: mb }}>
            <NucEyebrow info="maxLifts">{t('Massimali')}</NucEyebrow>
            {!qualcosa ? (
              <div style={{ fontFamily: NUC.font, fontSize: 12.5, color: 'var(--fg-mute)', padding: '8px 0', lineHeight: 1.5 }}>
                {t('Registra un’alzata: qui vedrai squat, panca piana e stacco da terra.')}
              </div>
            ) : (
              <>
                {/* Il total esce solo con tutte tre (vedi `maxTotal`): due terzi di un
                    total somigliano troppo a un total per poterli mostrare. */}
                {total !== null && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                    <span style={{ fontFamily: NUC.font, fontSize: 30, fontWeight: 500, letterSpacing: -0.8, color: 'var(--fg)', lineHeight: 1 }}>
                      {total} kg
                    </span>
                    <span style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-mute)' }}>
                      {t('Total')}{totalRatio ? ` · ${t('{r}× il tuo peso', { r: totalRatio.toFixed(1) })}` : ''}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {massimali.map((l, i) => {
                    // Da dove viene il numero sta SEMPRE scritto: "dichiarato" è una
                    // singola provata davvero, "stimato" viene da una serie a
                    // ripetizioni, e "dal distretto" non è il massimale di quell'alzata
                    // — sono i chili che sposti su quei muscoli. Senza l'etichetta le
                    // tre cose si leggerebbero come lo stesso numero.
                    const provato = l.source === 'dichiarato'
                    const daAltro = l.source !== 'distretto' && l.exercise && l.exercise !== l.name
                    return (
                      <div key={l.id} style={{
                        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
                        padding: '9px 0',
                        borderTop: i === 0 ? 'none' : '1px solid var(--hairline-soft)',
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
                </div>

                {/* Senza il peso corporeo mancano i rapporti, e a corpo libero manca
                    dentro i chili: il numero c'è ma è più basso del vero. */}
                {!s.userWeight && (
                  <button onClick={onOpenProfile} className="j-focus" style={{
                    marginTop: 10, padding: 0, background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: NUC.label, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase',
                    color: 'var(--j-accent-ink)',
                  }}>
                    {t('Inserisci il peso nel profilo →')}
                  </button>
                )}
              </>
            )}
          </NucCard>
        )
      }

      case 'search': return (
        // `pressable`: il click lo gestisce il bottone interno, ma la card È il bottone.
        <NucCard hard pressable key={id} pad={0} style={{ marginBottom: mb, overflow: 'hidden' }}>
          <button onClick={() => setShowSearch(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '13px 15px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ width: 34, height: 34, borderRadius: 0, background: 'var(--surface-2)', border: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--j-accent-ink)', flexShrink: 0 }}>
              <Icons.search size={16} stroke={1.8}/>
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontFamily: NUC.label, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--fg-mute)' }}>{t('Ricerca globale')}</span>
              <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 13.5, color: 'var(--fg-soft)', marginTop: 2 }}>{t('Trova esercizi e schede…')}</span>
            </span>
            <Icons.chev size={16} color="var(--fg-mute)"/>
          </button>
        </NucCard>
      )

      default: return null
    }
  }

  const activeModules = modules.filter(m => m.on)


  // Split greeting: everything before the name, the name, and after
  const nameStart = userName ? greeting.indexOf(userName) : -1
  const greetBefore = nameStart >= 0 ? greeting.slice(0, nameStart) : greeting
  const greetAfter  = nameStart >= 0 ? greeting.slice(nameStart + userName.length) : ''

  return (
    <div style={{
      // Su mobile la tacca/status bar la scansa già l'app shell con
      // `env(safe-area-inset-top)` (App.tsx): questo padding è solo respiro.
      position: 'relative', minHeight: '100%',
      padding: isDesktop ? '24px 28px 48px' : '30px 20px calc(var(--nav-clear) + 24px)',
      fontFamily: NUC.font, color: 'var(--fg)',
    }}>

      {/* Header — il saluto apre la pagina da solo: l'occhiello "PERSONAL OS" era una
          targhetta che diceva a chi è già dentro dove si trova. Su desktop lo porta
          comunque la sidebar. */}
      <div className="jarvis-boot" style={{ marginBottom: isDesktop ? 32 : 24 }}>
        {/* Greeting — display (Fraunces 500), nome enfatizzato con peso + sottolineatura accent */}
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(32px, 5.2vw, 42px)', fontWeight: 500, letterSpacing: '-0.01em',
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

      {/* Alleniamoci — l'azione per cui l'app esiste. Non è un modulo: sta sopra a
          tutto, non si può spegnere e non si può riordinare.
          Parola e manubrio impilati e centrati: il glifo fa da sottolineatura al
          testo invece di contendergli il fianco, e il blocco resta lo stesso su
          telefono e su desktop. */}
      <button
        onClick={onOpenGym}
        className="j-focus"
        style={{
          width: '100%', display: 'block',
          marginBottom: isDesktop ? 20 : 16,
          padding: isDesktop ? '13px 18px' : '11px 16px',
          borderRadius: 0, cursor: 'pointer',
          background: 'var(--j-accent)', border: 'none', color: 'var(--j-accent-fg)',
          boxShadow: '0 8px 18px -10px rgba(var(--j-rgb),0.55)',
          transition: 'transform 160ms var(--ease)',
        }}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.985)')}
        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 600,
            fontSize: 'clamp(17px, 4.2vw, 23px)', lineHeight: 1,
            letterSpacing: '-0.01em', textTransform: 'uppercase',
          }}>{t('Alleniamoci')}</span>
          <span aria-hidden style={{ display: 'flex' }}>
            <Icons.weight size={20} stroke={1.7}/>
          </span>
        </span>
      </button>

      {/* Intestazione dei moduli. Su DESKTOP porta solo l'etichetta: scorciatoie,
          profilo e impostazioni vivono nella sidebar, che è una colonna sempre
          presente accanto al contenuto — ripeterli qui significava due posti dove
          cercare la stessa cosa. Su telefono la sidebar non esiste e restano qui. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.16em', color: 'var(--fg-mute)', textTransform: 'uppercase' }}>{t('Widget')}</div>
        {!isDesktop && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {/* Personal Coach e Budget non sono moduli riordinabili: sono le due
                scorciatoie fisse a una feature, e si distinguono dai due tondi che
                seguono (che aprono menù) per bordo e inchiostro accent.
                L'etichetta scritta ce l'ha solo Personal Coach: un manubrio da solo si
                indovina, un portafogli no — e due etichette in questa riga troncavano
                la prima su qualsiasi telefono sotto i 430px.
                Dietro Personal Coach non c'è più il calcolo calorico ma il
                collegamento con chi ti allena: il nome resta perché è quello che la
                funzione è diventata, non un residuo. */}
            <button
              onClick={onOpenCoach}
              aria-label={t('Apri Personal Coach')}
              className="j-hard j-hard-sm"
              style={{
                height: 30, padding: '0 9px', borderRadius: 0, minWidth: 0,
                background: 'var(--surface)', border: `1px solid var(--j-accent)`,
                color: 'var(--j-accent-ink)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {/* Manubrio, non il glifo "Bicipiti": quello è disegnato per stare accanto
                  alla sua etichetta e da solo legge come uno scarabocchio. È comunque
                  distinto da Icons.weight, che è già la scheda Allenamento. */}
              <Icons.dumbbell size={15} stroke={1.6}/>
              <span style={{
                fontFamily: NUC.label, fontSize: 9, letterSpacing: '.12em',
                textTransform: 'uppercase', lineHeight: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {t('Personal Coach')}
              </span>
            </button>
            <button onClick={onOpenBudget} aria-label={t('Apri Budget')} title={t('Budget')} className="j-hard j-hard-sm" style={{
              width: 30, height: 30, borderRadius: 0, flexShrink: 0,
              background: 'var(--surface)', border: `1px solid var(--j-accent)`,
              color: 'var(--j-accent-ink)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icons.wallet size={14} stroke={1.6}/>
            </button>
            {/* Un tondo solo, ed è la rotella: dietro non c'è più "il profilo" ma
                tutte le impostazioni — dati, tema, widget della home, account. Il
                busto stilizzato prometteva una scheda utente e ne apriva un'altra,
                e accanto stava un secondo tondo (i moduli) che oggi vive lì dentro. */}
            <button onClick={onOpenProfile} aria-label={t('Impostazioni')} title={t('Impostazioni')} className="j-hard j-hard-sm" style={{
              width: 30, height: 30, borderRadius: 0, flexShrink: 0,
              background: 'var(--surface)', border: `1px solid var(--hairline)`,
              color: 'var(--fg-soft)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icons.settings size={13} stroke={1.6}/>
            </button>
          </div>
        )}
      </div>

      {/* auto-fit, non un numero fisso di colonne: la home occupa tutta la larghezza
          disponibile (App.tsx non la incapsula più a 800px) e su un monitor largo due
          colonne lasciavano metà schermo vuoto. 340px è la soglia sotto cui il
          calendario e le tile del riepilogo iniziano a stringersi. */}
      <div style={{
        display: isDesktop ? 'grid' : 'block',
        gridTemplateColumns: isDesktop ? 'repeat(auto-fit, minmax(340px, 1fr))' : undefined,
        gap: isDesktop ? 16 : 0,
        alignItems: 'start',
      }}>
        {activeModules.map(m => renderModule(m.id, isDesktop))}
      </div>

      {activeModules.length === 0 && (
        <div style={{
          padding: 24, textAlign: 'center', color: 'var(--fg-mute)',
          fontFamily: NUC.label, fontSize: 10, letterSpacing: '.12em',
          border: `1px dashed var(--hairline)`, borderRadius: 0,
        }}>
          {t('Nessun modulo attivo. Riaccendili da Impostazioni · Cambio widget.')}
        </div>
      )}


      <GlobalSearch
        open={showSearch}
        onClose={() => setShowSearch(false)}
        onOpenGym={onOpenGym}
      />
    </div>
  )
}

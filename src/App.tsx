import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import type React from 'react'
import type { Session } from '@supabase/auth-js'

import { NUC, paletteFor, adjustPaletteForDark, accentInkFor, accentFgFor, MONO_LIGHT, MONO_DARK } from '@/lib/jarvis-tokens'
import { NucGrain, NucNav, NucSidebarNav } from '@/components/ui/NucComponents'
import type { TabId } from '@/components/ui/NucComponents'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { UpdateToast } from '@/components/UpdateToast'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'
import { InstallBanner } from '@/components/InstallBanner'
import { useStore, useJarvisStore, EMPTY_STATE, JARVIS_STORE_KEY, applyRemoteState } from '@/store/useJarvisStore'
import { CoachMarkHost, fireCoach } from '@/components/CoachMark'
import { supabase } from '@/lib/supabase'
import { loadUserData, saveUserData, fetchRemoteUpdatedAt } from '@/lib/cloudSync'
import { useSyncStatus } from '@/lib/syncStatus'
import { getSyncMeta, setSynced, markDirty, decideInitialSync } from '@/lib/syncMeta'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { t, useT, LANG_TAGS } from '@/lib/i18n'
import { readStorage, writeStorage, removeStorage } from '@/lib/safeStorage'

// ── Lazy-loaded features ───────────────────────────────────────
const JarvisBoot      = lazy(() => import('@/features/boot/JarvisBoot').then(m => ({ default: m.JarvisBoot })))
const JarvisDashboard = lazy(() => import('@/features/dashboard/JarvisDashboard').then(m => ({ default: m.JarvisDashboard })))
const JarvisGym       = lazy(() => import('@/features/gym/JarvisGym').then(m => ({ default: m.JarvisGym })))
const JarvisProfile   = lazy(() => import('@/features/profile/JarvisProfile').then(m => ({ default: m.JarvisProfile })))
const JarvisLogin     = lazy(() => import('@/features/auth/JarvisLogin').then(m => ({ default: m.JarvisLogin })))
const FirstSetup      = lazy(() => import('@/features/auth/FirstSetup').then(m => ({ default: m.FirstSetup })))
// Strumenti (scorciatoie della sidebar desktop e dell'intestazione moduli su mobile)
const JarvisBudget    = lazy(() => import('@/features/budget/JarvisBudget').then(m => ({ default: m.JarvisBudget })))
const JarvisCoach     = lazy(() => import('@/features/coach/JarvisCoach').then(m => ({ default: m.JarvisCoach })))

// ── Suspense fallback ──────────────────────────────────────────
function TabFallback() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--j-accent)', opacity: 0.5 }}/>
    </div>
  )
}

// ── Tab content ────────────────────────────────────────────────
function TabContent({ tab, onOpenGym, onOpenProfile, onOpenBudget, onOpenCoach }: {
  tab: TabId
  onOpenGym: () => void
  onOpenProfile: () => void
  onOpenBudget: () => void
  onOpenCoach: () => void
}) {
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1, overflowY: 'auto' }}>
      <Suspense fallback={<TabFallback/>}>
        {tab === 'home' && <JarvisDashboard onOpenGym={onOpenGym} onOpenProfile={onOpenProfile} onOpenBudget={onOpenBudget} onOpenCoach={onOpenCoach}/>}
        {tab === 'gym'  && <JarvisGym/>}
      </Suspense>
    </div>
  )
}

// ── Cloud sync bridge ──────────────────────────────────────────
// Salvataggio affidabile del blob utente su Supabase:
//  • nessun save fallisce in silenzio (errore → stato 'error' + retry)
//  • flush immediato alla chiusura dell'app (visibilitychange/pagehide)
//  • con più dispositivi vince il dato più recente (no clobber cieco)
function CloudSyncBridge({ userId, initialUpdatedAt, pushOnMount }: {
  userId: string; initialUpdatedAt: string | null; pushOnMount: boolean
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const retryTimer = useRef<ReturnType<typeof setTimeout>>()
  // Timestamp dell'ultimo dato che conosciamo come "nostro" (dal load o da un save
  // riuscito). Se il remoto è più recente, un altro dispositivo ha scritto.
  const lastKnownUpdatedAt = useRef<string | null>(initialUpdatedAt)
  // Un save alla volta: se parte durante un altro, si rimanda al termine.
  const inFlight = useRef(false)
  const dirty = useRef(false)

  useEffect(() => {
    lastKnownUpdatedAt.current = initialUpdatedAt
  }, [initialUpdatedAt])

  useEffect(() => {
    const { setStatus, setRetry } = useSyncStatus.getState()
    const isNewer = (a: string | null, b: string | null) =>
      !!a && (!b || new Date(a).getTime() > new Date(b).getTime())

    const performSave = async () => {
      if (inFlight.current) { dirty.current = true; return }
      inFlight.current = true
      dirty.current = false
      clearTimeout(retryTimer.current)
      setStatus('saving')
      try {
        // Un altro dispositivo ha salvato dopo di noi? Allora scarica e applica
        // il suo dato invece di sovrascriverlo (politica: vince il più recente).
        const remote = await fetchRemoteUpdatedAt(userId)
        if (isNewer(remote, lastKnownUpdatedAt.current)) {
          const res = await loadUserData(userId)
          if (res) {
            applyRemoteState(res.data)
            lastKnownUpdatedAt.current = res.updatedAt
            // Qui il locale pendente viene scartato: l'utente deve vederlo.
            setSynced(res.updatedAt)
            useSyncStatus.getState().setNotice(t('Aggiornato da un altro dispositivo'))
          }
          setStatus('idle')
          setRetry(null)
          return
        }
        const savedAt = await saveUserData(userId, useJarvisStore.getState())
        lastKnownUpdatedAt.current = savedAt
        setSynced(savedAt)
        setStatus('idle')
        setRetry(null)
      } catch {
        // Rete / sessione scaduta / RLS: segnala l'errore e riprova più tardi.
        setStatus('error')
        setRetry(() => performSave)
        retryTimer.current = setTimeout(() => { void performSave() }, 10_000)
      } finally {
        inFlight.current = false
        // Cambiamenti arrivati durante il save: pianifica un nuovo giro.
        if (dirty.current) {
          clearTimeout(saveTimer.current)
          saveTimer.current = setTimeout(() => { void performSave() }, 1500)
        }
      }
    }

    const scheduleSave = () => {
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => { void performSave() }, 1500)
    }

    // Invio immediato: cancella il debounce e salva subito lo stato corrente.
    const flushNow = () => {
      clearTimeout(saveTimer.current)
      void performSave()
    }

    const unsub = useJarvisStore.subscribe(() => {
      // Prima di tutto il resto: da qui in poi esistono modifiche locali che il
      // server non ha ancora confermato, e deve saperlo anche il prossimo avvio.
      markDirty()
      scheduleSave()
      // Se eravamo in errore, ogni nuovo cambiamento riprova subito.
      if (useSyncStatus.getState().status === 'error') flushNow()
    })

    const onVisibility = () => { if (document.visibilityState === 'hidden') flushNow() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flushNow)

    // Modifiche fatte offline che il load ha deciso di tenere: vanno spinte subito,
    // senza aspettare che l'utente tocchi qualcosa (potrebbe non farlo mai più).
    if (pushOnMount) void performSave()

    return () => {
      unsub()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flushNow)
      clearTimeout(saveTimer.current)
      clearTimeout(retryTimer.current)
      setStatus('idle')
      setRetry(null)
    }
  }, [userId, pushOnMount])

  return null
}

// Pill minimale in stile paper, in cima allo schermo. Stessa forma per tutti e tre
// i messaggi di sync: cambia solo il testo e se è toccabile.
const PILL_STYLE: React.CSSProperties = {
  position: 'fixed', top: 'calc(env(safe-area-inset-top) + 10px)', left: '50%',
  transform: 'translateX(-50%)', zIndex: 200,
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '7px 14px', borderRadius: 999,
  background: 'var(--surface)', border: '1px solid var(--hairline)',
  color: NUC.ink, fontFamily: NUC.font, fontSize: 10.5,
  letterSpacing: '.12em', textTransform: 'uppercase',
  boxShadow: '0 2px 12px rgba(42,36,24,.12)',
}

const PILL_DOT = <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--j-accent)' }}/>

// Una pill alla volta, per priorità: il load fallito è la condizione più grave
// (nessun dato dal cloud), l'errore di save viene dopo, l'avviso è solo cronaca.
// Impilarle significherebbe due messaggi di sync sovrapposti sulla stessa riga.
function SyncPills({ loadFailed, onRetryLoad }: { loadFailed: boolean; onRetryLoad: () => void }) {
  const t = useT()
  const status = useSyncStatus(s => s.status)
  const retry  = useSyncStatus(s => s.retry)
  const notice = useSyncStatus(s => s.notice)

  if (loadFailed) {
    return (
      <button onClick={onRetryLoad} style={{ ...PILL_STYLE, cursor: 'pointer' }}>
        {PILL_DOT}
        {t('Dati cloud non caricati — tocca per riprovare')}
      </button>
    )
  }
  if (status === 'error') {
    return (
      <button onClick={() => retry?.()} style={{ ...PILL_STYLE, cursor: 'pointer' }}>
        {PILL_DOT}
        {t('Non sincronizzato — tocca per riprovare')}
      </button>
    )
  }
  if (notice) {
    return (
      <div role="status" style={PILL_STYLE}>
        {PILL_DOT}
        {notice}
      </div>
    )
  }
  return null
}

// ── App shell ──────────────────────────────────────────────────
export default function App() {
  const [s] = useStore()
  const isDesktop = useIsDesktop()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [recovering, setRecovering] = useState(false)
  const [cloudLoading, setCloudLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  // Incrementato dalla pill "riprova": è la dipendenza che ritriggera il load.
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [initialUpdatedAt, setInitialUpdatedAt] = useState<string | null>(null)
  // true = al mount il bridge deve spingere subito il locale (modifiche offline).
  const [pushOnMount, setPushOnMount] = useState(false)
  const [booted, setBooted] = useState(() => readStorage('session', 'jarvis-booted') === '1')
  const [tab, setTab] = useState<TabId>('home')
  const [showProfile, setShowProfile] = useState(false)
  const [showBudget, setShowBudget] = useState(false)
  const [showCoach, setShowCoach] = useState(false)
  // Le domande del primo accesso sono già state chiuse in questa sessione. Serve
  // perché `profiloVuoto` si aggiorna dallo store un attimo dopo il salvataggio,
  // e in quell'attimo il questionario si rimonterebbe da capo.
  const [setupFatto, setSetupFatto] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', !!s.darkMode)
  }, [s.darkMode])

  // `<html lang>` non è cosmesi: è quello che dice al lettore di schermo con che
  // pronuncia leggere la pagina, e al browser con che regole sillabare e proporre
  // la traduzione. Sbagliato, un testo tedesco viene letto ad alta voce con
  // fonetica italiana.
  useEffect(() => {
    document.documentElement.lang = LANG_TAGS[s.lang ?? 'it']
  }, [s.lang])

  // Layout "Notte": classe gemella di `.dark`, si combinano (`.mono` = b/n su carta,
  // `.mono.dark` = b/n su fondo nero). I token grigi stanno in globals.css.
  const mono = s.layout === 'notte'
  useEffect(() => {
    document.documentElement.classList.toggle('mono', mono)
  }, [mono])

  // Layout "Nero": nero pieno, testo e dettagli bianchi. NON si combina con `.dark` —
  // lo scavalca. In globals.css `.nero` sta dopo `.dark` e a parità di specificità
  // vince l'ultimo, quindi il tema è lo stesso con l'interruttore acceso o spento.
  const nero = s.layout === 'nero'
  useEffect(() => {
    document.documentElement.classList.toggle('nero', nero)
  }, [nero])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        useJarvisStore.setState({ ...EMPTY_STATE })
        removeStorage('local', JARVIS_STORE_KEY)
      }
      // link "password dimenticata": mostra la schermata per impostare la nuova password
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) return
    setCloudLoading(true)
    setLoadFailed(false)
    loadUserData(session.user.id)
      .then(res => {
        // solo se ci sono dati nel cloud li carico; se null (nessuna riga) tengo lo stato locale.
        // MAI azzerare a EMPTY: eviterebbe la sovrascrittura del vuoto sul cloud.
        const meta = getSyncMeta()
        if (res) {
          // `decideInitialSync` è ciò che impedisce al remoto stale di cancellare
          // le modifiche fatte offline: vedi src/lib/syncMeta.ts.
          const decision = decideInitialSync(res.updatedAt, meta)
          setInitialUpdatedAt(res.updatedAt)
          if (decision === 'keepLocalAndPush') {
            setPushOnMount(true)
          } else {
            if (decision === 'applyRemoteConflict') {
              useSyncStatus.getState().setNotice('Aggiornato da un altro dispositivo')
            }
            applyRemoteState(res.data)
            setSynced(res.updatedAt)
            setPushOnMount(false)
          }
        } else {
          // Utente nuovo: nessuna riga remota. Se ho roba locale mai inviata, la spingo.
          setInitialUpdatedAt(null)
          setPushOnMount(meta.dirty)
        }
        setCloudLoading(false)
      })
      .catch(() => {
        // Load fallito (rete/server): non tocco i dati, ma il bridge lo monto lo stesso —
        // senza, un allenamento registrato offline non verrebbe MAI inviato. Parte da
        // `lastSyncedAt` persistito e non da null, così il pre-check di `performSave`
        // riconosce un remoto davvero più recente invece di trattarlo sempre per tale.
        setInitialUpdatedAt(getSyncMeta().lastSyncedAt)
        setPushOnMount(false)
        setLoadFailed(true)
        setCloudLoading(false)
      })
    // Deve rieseguire solo al cambio di utente (e su richiesta di retry): session.user
    // viene letto dentro ma non deve ritriggerare il load a ogni nuovo oggetto session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, loadAttempt])

  // In "Notte" la variante si sceglie qui e `adjustPaletteForDark` va scavalcata: su un
  // accent near-black quella schiarisce fino a un grigio-talpa, cioè esattamente ciò
  // che il layout monocromatico non vuole. `accentColor` resta intatto nello store e
  // torna in vigore appena si rimette il layout standard.
  const basePalette = paletteFor(s.accentColor, s.customAccentHex)
  const palette = nero
    ? MONO_DARK                                        // accent bianco, sempre
    : mono
      ? (s.darkMode ? MONO_DARK : MONO_LIGHT)
      : (s.darkMode ? adjustPaletteForDark(basePalette) : basePalette)

  const handleBoot = () => {
    writeStorage('session', 'jarvis-booted', '1')
    setBooted(true)
  }

  const handleNavChange = (t: TabId) => {
    setTab(t)
    if (t === 'gym') fireCoach('gym')
    // Close any open overlay so navigation actually switches the visible screen
    setShowBudget(false)
    setShowCoach(false)
    setShowProfile(false)
  }

  // "Nero" ha il fondo scuro anche con l'interruttore chiaro/scuro spento: chi
  // calcola la leggibilità deve saperlo, o spingerebbe l'accent verso la carta
  // chiara mentre sta su nero pieno.
  const fondoScuro = nero || !!s.darkMode

  // Account appena creato: nessun dato anagrafico, da nessuna parte. Non basta
  // che manchi UN campo — chi ha già usato l'app e non ha mai messo l'altezza non
  // va rimandato a un questionario d'ingresso. Deve essere vuoto tutto.
  //
  // `loadFailed` esclude il caso peggiore: cloud irraggiungibile e stato locale
  // vuoto sembrano un utente nuovo, e le risposte verrebbero poi sovrascritte dal
  // dato remoto appena la rete torna.
  const profiloVuoto =
    !s.userName.trim() && !s.userSex && !s.userWeight && !s.userHeight && !s.userDob

  const cssVars = {
    '--j-accent': palette.accent,
    // Accent come TESTO: spinto lontano dalla superficie corrente fino ad AA (≥4.5:1).
    '--j-accent-ink': accentInkFor(palette.accent, fondoScuro),
    // Inchiostro SOPRA l'accent: crema sugli accent scuri, scuro su quelli chiari.
    // Nei layout monocromatici va forzato neutro: `accentFgFor` sceglie fra una crema
    // calda e un inchiostro caldo, e su un accent bianco/near-black restituiva tinte
    // appena verdi o brune — poco, ma non è bianco/nero.
    '--j-accent-fg': (mono || nero) ? (fondoScuro ? '#0a0a0a' : '#fafafa') : accentFgFor(palette.accent),
    '--j-accent-soft': palette.accentSoft,
    '--j-accent-deep': palette.accentDeep,
    '--j-rgb': palette.rgb,
    '--j-deep-rgb': palette.deepRgb,
    // Quanto spazio deve lasciare libero una pagina in fondo perché la nav non le
    // finisca sopra. Le pagine ci sommano il proprio respiro di fine lista.
    // Su desktop è zero: lì la navigazione è la colonna a sinistra.
    '--nav-clear': isDesktop ? '0px' : 'calc(96px + env(safe-area-inset-bottom))',
  } as React.CSSProperties

  if (session === undefined) return null

  // Shared content that lives inside the content area (both layouts)
  const innerContent = (
    <>
      <NucGrain/>

      {(!session || recovering) && (
        <Suspense fallback={null}>
          <JarvisLogin onAuth={() => {}} recovery={recovering} onRecoveryDone={() => setRecovering(false)}/>
        </Suspense>
      )}

      {session && !recovering && (
        <>
          {!cloudLoading && <CloudSyncBridge userId={session.user.id} initialUpdatedAt={initialUpdatedAt} pushOnMount={pushOnMount}/>}
          <SyncPills loadFailed={loadFailed} onRetryLoad={() => setLoadAttempt(n => n + 1)}/>

          {cloudLoading && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 50,
              background: 'var(--bg)', backgroundImage: 'var(--paper-grain)',
              display: 'flex', flexDirection: 'column',
              padding: '28px 20px',
              gap: 18, overflow: 'hidden',
            }}>
              <div style={{ width: '100%', maxWidth: isDesktop ? 640 : '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Header */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="j-skeleton" style={{ height: 30, width: '62%' }}/>
                  <div className="j-skeleton" style={{ height: 14, width: '40%', opacity: 0.7 }}/>
                </div>
                {/* Stat tiles */}
                <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: 12 }}>
                  {Array.from({ length: isDesktop ? 3 : 2 }).map((_, i) => (
                    <div key={i} className="j-skeleton" style={{ height: 88 }}/>
                  ))}
                </div>
                {/* Card rows */}
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="j-skeleton" style={{ height: 64, opacity: 1 - i * 0.12 }}/>
                ))}
              </div>
              {/* Pulse loader */}
              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
                <div className="j-loader-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--j-accent)' }}/>
              </div>
            </div>
          )}

          {!cloudLoading && booted && (
            <TabContent
              tab={tab}
              onOpenGym={() => { setTab('gym'); fireCoach('gym') }}
              onOpenProfile={() => { setShowProfile(true); fireCoach('profile') }}
              onOpenBudget={() => { setShowProfile(false); setShowBudget(true); fireCoach('budget') }}
              onOpenCoach={() => { setShowProfile(false); setShowCoach(true); fireCoach('coach') }}
            />
          )}


          {/* Nav — mobile only: un tasto solo, che porta all'altra schermata.
              Con due sole destinazioni non c'era niente da scegliere, e le vecchie
              varianti "riga"/"laterale" erano tre modi di disegnare lo stesso
              singolo bottone. */}
          {!isDesktop && !cloudLoading && booted && (
            <NucNav active={tab} onChange={handleNavChange} pos={s.navPos ?? 'centro'}/>
          )}

          {!cloudLoading && booted && !loadFailed && profiloVuoto && !setupFatto && (
            <Suspense fallback={null}>
              <FirstSetup onDone={() => setSetupFatto(true)}/>
            </Suspense>
          )}

          {!cloudLoading && !booted && (
            <Suspense fallback={null}>
              <JarvisBoot onDone={handleBoot}/>
            </Suspense>
          )}

          <Suspense fallback={null}>
            <JarvisProfile open={showProfile} onClose={() => setShowProfile(false)}/>
          </Suspense>
          {/* Ultimo fra i pannelli: il suggerimento deve poter cadere SOPRA la
              schermata che ha appena spiegato, profilo e strumenti compresi. */}
          {booted && <CoachMarkHost/>}
          <InstallBanner/>

          {/* Strumenti / extra — overlay disponibili su mobile e desktop (aperti dal
              menù Strumenti, dai widget di home o dalla sidebar desktop) */}
          <Suspense fallback={null}>
            {showBudget && <JarvisBudget onBack={() => setShowBudget(false)}/>}
            {showCoach  && <JarvisCoach  userId={session.user.id} onBack={() => setShowCoach(false)}/>}
          </Suspense>
        </>
      )}
      <ConfirmModal/>
      <UpdateToast/>
    </>
  )

  return (
    <ErrorBoundary>
    <ConfirmDeleteProvider>
      <div className="app-shell" style={{
        background: 'var(--bg)',
        display: 'flex',
        alignItems: isDesktop ? 'stretch' : 'center',
        justifyContent: isDesktop ? 'stretch' : 'center',
        paddingTop: isDesktop ? 0 : 'env(safe-area-inset-top)',
      }}>
        {isDesktop ? (
          // ── Desktop: full-width sidebar + content ──────────────
          <div style={{
            flex: 1,
            display: 'flex',
            height: '100%',
            background: NUC.bg,
            backgroundImage: 'var(--paper-grain)',
            fontFamily: NUC.font,
            color: NUC.ink,
            overflow: 'hidden',
            ...cssVars,
          }}>
            {session && !cloudLoading && booted && (
              <NucSidebarNav
                active={tab}
                onChange={handleNavChange}
                onOpenBudget={() => { setShowProfile(false); setShowBudget(true); fireCoach('budget') }}
                onOpenProfile={() => { setShowProfile(true); fireCoach('profile') }}
                onOpenCoach={() => { setShowProfile(false); setShowCoach(true); fireCoach('coach') }}
                userName={s.userName}
              />
            )}
            {/* Centering wrapper — caps width and shows background on sides */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
              <div
                ref={containerRef}
                data-jmodal-root
                style={{
                  width: '100%',
                  // Full-width when a tool overlay is open (so its top bar spans the whole
                  // content area beside the sidebar), otherwise capped reading width.
                  // La home è a piena larghezza: i suoi moduli sono card indipendenti che
                  // si distribuiscono in colonne, non un testo da leggere in una riga.
                  maxWidth: (tab === 'home' || showBudget || showCoach) ? 'none' : 800,
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {innerContent}
              </div>
            </div>
          </div>
        ) : (
          // ── Mobile: centered 420px card ────────────────────────
          <div
            ref={containerRef}
            data-jmodal-root
            style={{
              position: 'relative',
              width: '100%', maxWidth: 420,
              height: '100%',
              background: NUC.bg,
              backgroundImage: 'var(--paper-grain)',
              overflow: 'hidden',
              fontFamily: NUC.font,
              color: NUC.ink,
              ...cssVars,
            }}
          >
            {innerContent}
          </div>
        )}
      </div>
    </ConfirmDeleteProvider>
    </ErrorBoundary>
  )
}

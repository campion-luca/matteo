import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import type React from 'react'
import type { Session } from '@supabase/auth-js'

import { NUC, paletteFor, adjustPaletteForDark, accentInkFor, accentFgFor, PREMIUM_ACCENT } from '@/lib/jarvis-tokens'
import { NucGrain } from '@/components/ui/NucComponents'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { UpdateToast } from '@/components/UpdateToast'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'
import { InstallBanner } from '@/components/InstallBanner'
import { useStore, useJarvisStore, EMPTY_STATE, JARVIS_STORE_KEY, applyRemoteState } from '@/store/useJarvisStore'
import { serveAzzerare, azzeramento, salvaScorta } from '@/features/gym/resetCatalogo'
import { supabase } from '@/lib/supabase'
import { loadUserData, saveUserData, fetchRemoteUpdatedAt, senzaRete } from '@/lib/cloudSync'
import { useSyncStatus } from '@/lib/syncStatus'
import { getSyncMeta, setSynced, markDirty, clearSyncMeta, decideInitialSync, remotoCambiato } from '@/lib/syncMeta'
import { idsNoti, recuperaCreatiInLocale } from '@/lib/syncMerge'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { t, useT, LANG_TAGS } from '@/lib/i18n'
import { readStorage, writeStorage, removeStorage } from '@/lib/safeStorage'
import { avviaMessaggi, fermaMessaggi } from '@/lib/messaggiLive'

// ── Lazy-loaded features ───────────────────────────────────────
const JarvisBoot      = lazy(() => import('@/features/boot/JarvisBoot').then(m => ({ default: m.JarvisBoot })))
const JarvisGym       = lazy(() => import('@/features/gym/JarvisGym').then(m => ({ default: m.JarvisGym })))
const JarvisProfile   = lazy(() => import('@/features/profile/JarvisProfile').then(m => ({ default: m.JarvisProfile })))
const JarvisLogin     = lazy(() => import('@/features/auth/JarvisLogin').then(m => ({ default: m.JarvisLogin })))
const FirstSetup      = lazy(() => import('@/features/auth/FirstSetup').then(m => ({ default: m.FirstSetup })))
// Personal Coach: overlay aperto dalla card nell'allenamento
const JarvisCoach     = lazy(() => import('@/features/coach/JarvisCoach').then(m => ({ default: m.JarvisCoach })))

// ── Suspense fallback ──────────────────────────────────────────
function TabFallback() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--j-accent)', opacity: 0.5 }}/>
    </div>
  )
}

// ── Il contenuto dell'app ──────────────────────────────────────
// Una schermata sola. C'erano due tab — "Home" e "Allenamento" — e la home era una
// pagina di passaggio: un saluto, un tasto grande per entrare nell'allenamento e
// un riquadro di riepilogo. Adesso l'allenamento È la pagina d'ingresso, il saluto
// gli sta in cima (SalutoHeader) e il riepilogo si apre da Stats. Senza un secondo
// posto dove andare, la navigazione a tab non ha più niente da commutare.
function Contenuto({ onOpenProfile, onOpenUser, onOpenCoach }: {
  onOpenProfile: () => void
  onOpenUser: () => void
  onOpenCoach: () => void
}) {
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1, overflowY: 'auto' }}>
      <Suspense fallback={<TabFallback/>}>
        <JarvisGym onOpenCoach={onOpenCoach} onOpenProfile={onOpenProfile} onOpenUser={onOpenUser}/>
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
  // Contatore delle modifiche locali. Serve a sapere se ne è arrivata una MENTRE
  // un salvataggio era in viaggio: lo stato inviato è quello di prima, e segnare
  // il locale come "sincronizzato" la farebbe dimenticare.
  const modifiche = useRef(0)

  useEffect(() => {
    lastKnownUpdatedAt.current = initialUpdatedAt
  }, [initialUpdatedAt])

  useEffect(() => {
    const { setStatus, setRetry } = useSyncStatus.getState()
    const performSave = async () => {
      if (inFlight.current) { dirty.current = true; return }
      // Niente da mandare, niente da salvare. Prima si salvava a ogni uscita
      // dall'app anche senza modifiche, con un orario nuovo: un dispositivo con i
      // dati vecchi diventava così "il più recente", e l'altro — trovandolo tale —
      // buttava le proprie modifiche. È così che spariva una scheda appena creata.
      if (!getSyncMeta().dirty) return
      inFlight.current = true
      dirty.current = false
      clearTimeout(retryTimer.current)
      setStatus('saving')
      try {
        // Un altro dispositivo ha salvato dopo di noi? Allora scarica e applica
        // il suo dato invece di sovrascriverlo (politica: vince il più recente).
        const remote = await fetchRemoteUpdatedAt(userId)
        if (remotoCambiato(remote, lastKnownUpdatedAt.current)) {
          const res = await loadUserData(userId)
          if (res) {
            const locale = useJarvisStore.getState()
            const base = getSyncMeta().noti
            applyRemoteState(res.data)
            lastKnownUpdatedAt.current = res.updatedAt
            setSynced(res.updatedAt, idsNoti(useJarvisStore.getState()))
            useSyncStatus.getState().setNotice(t('Aggiornato da un altro dispositivo'))
            // Le modifiche fatte qui su una scheda che esiste anche là cedono al
            // remoto; quello che è stato CREATO qui no (vedi syncMerge). Rimetterlo
            // nello store lo segna come modifica e lo fa ripartire verso il cloud.
            const recupero = recuperaCreatiInLocale(locale, useJarvisStore.getState(), base)
            if (recupero) useJarvisStore.setState(recupero)
          }
          setStatus('idle')
          setRetry(null)
          return
        }
        const inviate = modifiche.current
        const savedAt = await saveUserData(userId, useJarvisStore.getState())
        lastKnownUpdatedAt.current = savedAt
        setSynced(savedAt, idsNoti(useJarvisStore.getState()))
        // Una modifica arrivata durante il viaggio non era nello stato inviato:
        // resta da mandare, e il prossimo giro deve trovarla segnata.
        if (modifiche.current !== inviate) markDirty()
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
      modifiche.current++
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
  padding: '7px 14px', borderRadius: 'var(--radius)',
  background: 'var(--surface-pop)', border: '1px solid var(--hairline)',
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
  // Quale delle due porte è aperta: le impostazioni dell'app o il profilo (nome,
  // dati, peso). Una sola alla volta, e `null` quando non c'è niente aperto.
  const [profilo, setProfilo] = useState<null | 'impostazioni' | 'utente'>(null)
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

  // Layout "Premium": nero pieno, vetro, dettagli bianchi. NON si combina con `.dark` —
  // lo scavalca. In globals.css `.premium` sta dopo `.dark` e a parità di specificità
  // vince l'ultimo, quindi il tema è lo stesso con l'interruttore acceso o spento.
  const premium = s.layout === 'premium'
  useEffect(() => {
    document.documentElement.classList.toggle('premium', premium)
  }, [premium])

  // Le due prove sul fondo (vedi "Sfondo fuso" e "Sfondo in movimento" in
  // globals.css). Assenti dallo stato = accese: sono il fondo con cui l'app si
  // presenta ora, e chi non le vuole le spegne da Impostazioni · Aspetto.
  const bgFuso  = s.bgFuso  ?? true
  const bgAnim  = s.bgAnim  ?? true
  useEffect(() => {
    document.documentElement.classList.toggle('bg-fusione', bgFuso)
  }, [bgFuso])
  useEffect(() => {
    document.documentElement.classList.toggle('bg-anim', bgAnim)
  }, [bgAnim])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        useJarvisStore.setState({ ...EMPTY_STATE })
        removeStorage('local', JARVIS_STORE_KEY)
        // Anche le meta di sync: sono dell'ACCOUNT, non del dispositivo. Restando,
        // l'utente successivo ereditava `dirty`, `lastSyncedAt` e soprattutto gli id
        // `noti` di quello prima — cioè `syncMerge` avrebbe deciso cosa "è nato qui"
        // guardando gli id di un altro.
        clearSyncMeta()
      }
      // link "password dimenticata": mostra la schermata per impostare la nuova password
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // L'azzeramento del catalogo, una volta per account (vedi resetCatalogo.ts).
  //
  // Va chiamato DOPO che il cloud ha parlato, mai prima: il blob remoto è un
  // unico oggetto e vince il più recente, quindi azzerare sullo stato locale e
  // poi ricevere il remoto significherebbe vedere tornare dentro tutto quello
  // che si è appena tolto — e, peggio, ripetere l'azzeramento a ogni avvio.
  //
  // Restituisce `true` se ha fatto qualcosa, e allora chi chiama deve spingere:
  // un azzeramento che resta sul telefono e non sale è un account che si azzera
  // di nuovo domani, sull'altro dispositivo.
  const azzeraSeServe = (): boolean => {
    const st = useJarvisStore.getState()
    if (!serveAzzerare(st)) return false
    const scorta = salvaScorta(st)
    useJarvisStore.setState(azzeramento())
    // Detto, non fatto di nascosto: chi apre l'app e non trova più le sue schede
    // ha diritto di sapere che è successo adesso e non per un guasto.
    useSyncStatus.getState().setNotice(
      scorta ? t('Catalogo esercizi rinnovato') : t('Catalogo esercizi rinnovato (senza copia di scorta)')
    )
    return true
  }

  // Le richieste sulle schede condivise girano per conto loro, fuori dal blob:
  // vedi lib/messaggiLive. Si accendono con la sessione perché il badge rosso in
  // home deve esserci anche senza aver aperto il Personal Coach, e si spengono al
  // logout — i messaggi sono dell'ACCOUNT, non del dispositivo, e lasciarli in
  // memoria li mostrerebbe a chi entra dopo.
  useEffect(() => {
    const id = session?.user?.id
    if (!id) { fermaMessaggi(); return }
    avviaMessaggi(id)
    return () => fermaMessaggi()
  }, [session?.user?.id])

  useEffect(() => {
    if (!session?.user) return

    // Senza rete non si aspetta niente: si va dritti al dato locale.
    // È lo stesso identico percorso del load fallito (vedi il .catch qui sotto),
    // solo istantaneo invece che dopo il timeout. Serve al caso più frequente di
    // tutti per un'app da palestra — il seminterrato che non prende — dove prima
    // si restavano a guardare lo scheletro per sette secondi e mezzo prima di
    // vedere i propri esercizi, che erano lì sul telefono dall'inizio.
    if (senzaRete()) {
      setInitialUpdatedAt(getSyncMeta().lastSyncedAt)
      setPushOnMount(false)
      setLoadFailed(true)
      setCloudLoading(false)
      return
    }

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
            if (azzeraSeServe()) markDirty()
            setPushOnMount(true)
          } else {
            if (decision === 'applyRemoteConflict') {
              useSyncStatus.getState().setNotice('Aggiornato da un altro dispositivo')
            }
            const locale = useJarvisStore.getState()
            applyRemoteState(res.data)
            setSynced(res.updatedAt, idsNoti(useJarvisStore.getState()))
            // Anche all'avvio: schede ed esercizi creati qui e mai arrivati al
            // cloud non si perdono perché un altro dispositivo ha scritto dopo.
            const recupero = decision === 'applyRemoteConflict'
              ? recuperaCreatiInLocale(locale, useJarvisStore.getState(), meta.noti)
              : null
            if (recupero) useJarvisStore.setState(recupero)
            // Il bridge non è ancora montato e non ascolta lo store: quello che va
            // spinto va segnato qui, o il suo primo giro lo troverebbe "pulito".
            const daSpingere = azzeraSeServe() || !!recupero
            if (daSpingere) markDirty()
            setPushOnMount(daSpingere)
          }
        } else {
          // Utente nuovo: nessuna riga remota. Se ho roba locale mai inviata, la spingo.
          setInitialUpdatedAt(null)
          const azzerato = azzeraSeServe()
          if (azzerato) markDirty()
          setPushOnMount(azzerato || meta.dirty)
        }
        setCloudLoading(false)
      })
      .catch(() => {
        // Load fallito (rete/server): non tocco i dati, ma il bridge lo monto lo stesso —
        // senza, un allenamento registrato offline non verrebbe MAI inviato. Parte da
        // `lastSyncedAt` persistito e non da null, così il pre-check di `performSave`
        // riconosce un remoto davvero più recente invece di trattarlo sempre per tale.
        //
        // Qui NON si azzera, ed è la decisione più importante del blocco: il
        // load è fallito, quindi non sappiamo cosa c'è davvero nel cloud.
        // Azzerare sullo stato locale e poi spingerlo cancellerebbe dati remoti
        // che nessuno ha mai letto. Si riprova al prossimo avvio con rete: un
        // azzeramento rimandato non costa niente, uno fatto al buio è definitivo.
        setInitialUpdatedAt(getSyncMeta().lastSyncedAt)
        setPushOnMount(false)
        setLoadFailed(true)
        setCloudLoading(false)
      })
    // Deve rieseguire solo al cambio di utente (e su richiesta di retry): session.user
    // viene letto dentro ma non deve ritriggerare il load a ogni nuovo oggetto session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, loadAttempt])

  // In "Premium" la variante si sceglie qui e `adjustPaletteForDark` va scavalcata.
  // `accentColor` resta intatto nello store e torna in vigore con il layout standard.
  const basePalette = paletteFor(s.accentColor, s.customAccentHex)
  const palette = premium
    ? PREMIUM_ACCENT                                   // terracotta, sempre
    : (s.darkMode ? adjustPaletteForDark(basePalette) : basePalette)

  const handleBoot = () => {
    writeStorage('session', 'jarvis-booted', '1')
    setBooted(true)
  }

  // "Premium" ha il fondo scuro anche con l'interruttore chiaro/scuro spento: chi
  // calcola la leggibilità deve saperlo, o spingerebbe l'accent verso la carta
  // chiara mentre sta su nero pieno.
  const fondoScuro = premium || !!s.darkMode

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
    // Premium non è più un caso a parte: qui c'era un `#0a0a0a` forzato perché
    // l'accent era BIANCO, e su un fondo bianco `accentFgFor` restituiva un
    // inchiostro appena bruno invece che nero. Con la terracotta la funzione fa
    // il suo mestiere e sceglie la crema, che è quello che serve.
    '--j-accent-fg': accentFgFor(palette.accent),
    '--j-accent-soft': palette.accentSoft,
    '--j-accent-deep': palette.accentDeep,
    '--j-rgb': palette.rgb,
    '--j-deep-rgb': palette.deepRgb,
    // Quanto spazio deve lasciare libero una pagina in fondo. Il tasto di
    // navigazione in basso non c'è più: resta solo la barra di sistema del telefono.
    // Le pagine ci sommano il proprio respiro di fine lista.
    '--nav-clear': isDesktop ? '0px' : 'env(safe-area-inset-bottom)',
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
            <Contenuto
              onOpenProfile={() => setProfilo('impostazioni')}
              onOpenUser={() => setProfilo('utente')}
              onOpenCoach={() => { setProfilo(null); setShowCoach(true) }}
            />
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
            <JarvisProfile open={!!profilo} sezione={profilo ?? 'impostazioni'} onClose={() => setProfilo(null)}/>
          </Suspense>
          <InstallBanner/>

          {/* Personal Coach — overlay su mobile e desktop, aperto dall'allenamento */}
          <Suspense fallback={null}>
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
        // Lo stesso fondo del contenitore anche qui: se un giorno qualcosa lascia
        // scoperto un bordo, sotto non c'è un nero diverso dal resto.
        backgroundImage: 'var(--paper-grain)',
        display: 'flex',
        alignItems: isDesktop ? 'stretch' : 'center',
        justifyContent: isDesktop ? 'stretch' : 'center',
        paddingTop: isDesktop ? 0 : 'env(safe-area-inset-top)',
      }}>
        {isDesktop ? (
          // ── Desktop: full-width sidebar + content ──────────────
          <div className="j-bg-fondo" style={{
            flex: 1,
            display: 'flex',
            height: '100%',
            background: NUC.bg,
            fontFamily: NUC.font,
            color: NUC.ink,
            overflow: 'hidden',
            position: 'relative',
            ...cssVars,
          }}>
            {/* Area di contenuto. Non è più una colonna di 800px centrata: da
                desktop le pagine si aprono ACCANTO all'elenco che le ha aperte
                (vedi SplitPane), e la seconda colonna ha bisogno dello spazio
                che il cappello si teneva come margine. La larghezza di lettura la
                decide adesso ogni pannello per conto suo. */}
            <div
              ref={containerRef}
              data-jmodal-root
              style={{
                flex: 1,
                minWidth: 0,
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {innerContent}
            </div>
          </div>
        ) : (
          // ── Mobile: a tutta larghezza ──────────────────────────
          // Era una colonna di 420px centrata: sui telefoni più larghi (iPhone
          // Plus e Pro Max sono 428-430) ai lati restavano due bande di nero
          // pieno, fuori dal contenitore che porta gli aloni del fondo.
          <div
            ref={containerRef}
            data-jmodal-root
            className="j-bg-fondo"
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              background: NUC.bg,
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

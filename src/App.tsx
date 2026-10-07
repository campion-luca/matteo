import { useState, useEffect, useRef, useCallback, memo, lazy, Suspense } from 'react'
import type React from 'react'
import type { Session } from '@supabase/auth-js'

import { NUC, paletteFor, adjustPaletteForDark, accentInkFor, accentFgFor, ACCENT_FISSI, temaFisso } from '@/lib/jarvis-tokens'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { UpdateToast } from '@/components/UpdateToast'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'
import { InstallBanner } from '@/components/InstallBanner'
import { useShallow } from 'zustand/react/shallow'
import { useJarvisStore, applyRemoteState, VERSIONE_DATI } from '@/store/useJarvisStore'
import { serveAzzerare, azzeramento, salvaScorta } from '@/features/gym/resetCatalogo'
import { supabase, sessioneSuDisco, erroreDiRete } from '@/lib/supabase'
import { loadUserData, saveUserData, fetchRemoto, senzaRete } from '@/lib/cloudSync'
import { useSyncStatus } from '@/lib/syncStatus'
import { getSyncMeta, setSynced, markDirty, decideInitialSync, remotoCambiato, segnaInViaggio, confermaRemoto, stessoIstante, dimenticaUltimoSync } from '@/lib/syncMeta'
import { myCoaches } from '@/lib/coach'
import { correzioniPer, eliminaCorrezioni, applicaCorrezioni } from '@/lib/correzioni'
import { proprietario, segnaProprietario, parcheggia, riprendi, svuotaDatiLocali, pulisciParcheggi } from '@/lib/proprietario'
import { cercaAggiornamento } from '@/lib/aggiornamento'
import { riallineaPush } from '@/lib/push'
import { idsNoti, recuperaCreatiInLocale } from '@/lib/syncMerge'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { t, useT, LANG_TAGS } from '@/lib/i18n'
import { readStorage, writeStorage } from '@/lib/safeStorage'
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
//
// `memo`, con comandi stabili da App: aprire le impostazioni o il profilo cambia
// lo stato di App, e senza ridisegnava tutto l'allenamento proprio nel momento
// del tocco. Non scorre lei: scorrono le pagine dentro (`.j-scroll-area`), e un
// secondo contenitore scorrevole intorno raccoglieva i trascinamenti arrivati in
// fondo e faceva rimbalzare tutta la schermata.
const Contenuto = memo(function Contenuto({ onOpenProfile, onOpenUser, onOpenCoach }: {
  onOpenProfile: () => void
  onOpenUser: () => void
  onOpenCoach: () => void
}) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <Suspense fallback={<TabFallback/>}>
        <JarvisGym onOpenCoach={onOpenCoach} onOpenProfile={onOpenProfile} onOpenUser={onOpenUser}/>
      </Suspense>
    </div>
  )
})

// ── Cloud sync bridge ──────────────────────────────────────────
// Salvataggio affidabile del blob utente su Supabase:
//  • nessun save fallisce in silenzio (errore → stato 'error' + retry)
//  • flush immediato alla chiusura dell'app (visibilitychange/pagehide)
//  • con più dispositivi vince il dato più recente (no clobber cieco)
function CloudSyncBridge({ userId, initialUpdatedAt, pushOnMount, onAllineato }: {
  userId: string; initialUpdatedAt: string | null; pushOnMount: boolean
  /** Il locale e il cloud coincidono: un salvataggio riuscito, una rilettura
   *  riuscita, o la conferma che non era cambiato niente. Serve a chi era
   *  partito senza rete per sapere che adesso il cloud ha risposto. */
  onAllineato?: () => void
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
  // Sempre l'ultima versione, senza far ripartire l'effetto qui sotto.
  const allineato = useRef(onAllineato)
  allineato.current = onAllineato

  useEffect(() => {
    lastKnownUpdatedAt.current = initialUpdatedAt
  }, [initialUpdatedAt])

  useEffect(() => {
    const { setStatus, setRetry } = useSyncStatus.getState()
    // Questo bridge è ancora quello in servizio? Un salvataggio partito non si
    // può richiamare, e quando torna può trovare un'altra sessione: l'account è
    // uscito, o ne è entrato un altro. Da smontato non deve più toccare lo
    // store, le meta o lo stato della sincronizzazione — applicava il remoto
    // di prima sopra i dati di chi era appena rientrato.
    let vivo = true
    // Finché il cloud non ha risposto una prima volta (vedi il giro in fondo).
    let maiAllineato = true
    const dettoAllineato = () => { maiAllineato = false; allineato.current?.() }

    // Il cloud è stato scritto da un'app più NUOVA di questa? Allora questa non
    // deve salvare: manderebbe su lo stato come lo conosce lei, cioè senza le
    // cose aggiunte dopo, e le toglierebbe a tutti i dispositivi. Si ferma, lo
    // dice (vedi SyncPills) e cerca l'aggiornamento. E dimentica a che punto
    // era il cloud: lo stato che ha in mano ha già perso quello che non
    // conosce, e dopo l'aggiornamento non deve risalire tale e quale.
    const troppoNuovo = (versione: number): boolean => {
      if (versione <= VERSIONE_DATI) return false
      useSyncStatus.getState().setVecchia(true)
      dimenticaUltimoSync()
      cercaAggiornamento()
      return true
    }

    const performSave = async () => {
      if (inFlight.current) { dirty.current = true; return }
      // Niente da mandare, niente da salvare. Prima si salvava a ogni uscita
      // dall'app anche senza modifiche, con un orario nuovo: un dispositivo con i
      // dati vecchi diventava così "il più recente", e l'altro — trovandolo tale —
      // buttava le proprie modifiche. È così che spariva una scheda appena creata.
      if (!getSyncMeta().dirty) return
      // App vecchia: le modifiche restano qui, segnate, e partono dopo
      // l'aggiornamento.
      if (useSyncStatus.getState().vecchia) return
      inFlight.current = true
      dirty.current = false
      clearTimeout(retryTimer.current)
      setStatus('saving')
      try {
        // Un altro dispositivo ha salvato dopo di noi? Allora scarica e applica
        // il suo dato invece di sovrascriverlo (politica: vince il più recente).
        const remoto = await fetchRemoto(userId)
        if (!vivo) return
        if (troppoNuovo(remoto.versione)) { setStatus('idle'); setRetry(null); return }

        // Prima di gridare al conflitto: quell'orario "nuovo" è il NOSTRO? Un
        // salvataggio può arrivare al server senza che ne torni la risposta —
        // poco segnale, l'app sospesa un attimo dopo — e al giro dopo il remoto
        // risulta cambiato. Trattarlo da conflitto voleva dire ricaricare la
        // propria copia di qualche secondo prima sopra il lavoro fatto dopo, e
        // leggere "Aggiornato da un altro dispositivo" senza altri dispositivi.
        if (remotoCambiato(remoto.updatedAt, lastKnownUpdatedAt.current) && stessoIstante(remoto.updatedAt, getSyncMeta().inViaggio)) {
          confermaRemoto(remoto.updatedAt!)
          lastKnownUpdatedAt.current = remoto.updatedAt
        }

        if (remotoCambiato(remoto.updatedAt, lastKnownUpdatedAt.current)) {
          const res = await loadUserData(userId)
          if (!vivo) return
          if (res) {
            if (troppoNuovo(Number(res.data.versioneDati) || 0)) { setStatus('idle'); setRetry(null); return }
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
            else dettoAllineato()
          }
          setStatus('idle')
          setRetry(null)
          return
        }
        const inviate = modifiche.current
        // L'orario si sceglie e si SCRIVE prima di partire: se la risposta non
        // torna, è da lui che al giro dopo si riconosce la propria scrittura.
        const marca = new Date().toISOString()
        segnaInViaggio(marca)
        // Lo stato che parte, e cosa contiene: gli id "noti al cloud" sono
        // QUESTI, non quelli dello stato al ritorno. Presi dopo, una scheda
        // creata durante un salvataggio lento risultava già nota senza essere
        // mai salita, e al conflitto successivo non veniva recuperata.
        const inviato = useJarvisStore.getState()
        const notiInviati = idsNoti(inviato)
        const savedAt = await saveUserData(userId, inviato, marca)
        if (!vivo) return
        lastKnownUpdatedAt.current = savedAt
        setSynced(savedAt, notiInviati)
        // Una modifica arrivata durante il viaggio non era nello stato inviato:
        // resta da mandare, e il prossimo giro deve trovarla segnata.
        if (modifiche.current !== inviate) markDirty()
        else dettoAllineato()
        setStatus('idle')
        setRetry(null)
      } catch {
        if (!vivo) return
        // Rete / sessione scaduta / RLS: segnala l'errore e riprova più tardi.
        setStatus('error')
        setRetry(() => performSave)
        retryTimer.current = setTimeout(() => { void performSave() }, 10_000)
      } finally {
        inFlight.current = false
        // Cambiamenti arrivati durante il save: pianifica un nuovo giro.
        if (vivo && dirty.current) {
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

    // ── Rileggere il cloud tornando sull'app ─────────────────────
    // Il cloud si leggeva solo all'avvio. Ma una PWA sul telefono non si
    // "avvia": resta aperta per giorni e torna in primo piano. Così il telefono
    // lavorava su dati di ieri mentre il computer ne aveva scritti di nuovi, e il
    // conflitto si scopriva solo al primo salvataggio — cioè a fine allenamento.
    // Rileggendo al ritorno, quasi sempre non c'è nessun conflitto da risolvere.
    //
    // Solo se qui non c'è niente da mandare: con modifiche locali pendenti si
    // passa da `performSave`, che il conflitto lo sa gestire (e recupera ciò
    // che è nato qui). Non scrive mai: leggere non deve far diventare questo
    // dispositivo "il più recente".
    const rileggi = async () => {
      if (inFlight.current || senzaRete()) return
      if (getSyncMeta().dirty) { void performSave(); return }
      inFlight.current = true
      try {
        const remoto = await fetchRemoto(userId)
        if (!vivo) return
        if (troppoNuovo(remoto.versione)) return
        if (!remotoCambiato(remoto.updatedAt, lastKnownUpdatedAt.current)) { dettoAllineato(); return }
        const res = await loadUserData(userId)
        // Nel frattempo si è toccato qualcosa: non si applica sopra, ci pensa
        // il salvataggio che quella modifica ha già pianificato.
        if (!vivo || !res || getSyncMeta().dirty) return
        if (troppoNuovo(Number(res.data.versioneDati) || 0)) return
        applyRemoteState(res.data)
        lastKnownUpdatedAt.current = res.updatedAt
        setSynced(res.updatedAt, idsNoti(useJarvisStore.getState()))
        useSyncStatus.getState().setNotice(t('Aggiornato da un altro dispositivo'))
        dettoAllineato()
      } catch {
        // Rete assente o lenta: si resta sul dato locale, senza allarmi. Non è
        // un salvataggio fallito, e il prossimo ritorno ci riprova.
      } finally {
        inFlight.current = false
        if (dirty.current) scheduleSave()
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow()
      else void rileggi()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flushNow)
    // Tornata la rete si rilegge (o si spinge) subito, senza aspettare che l'app
    // esca e rientri: chi è partito nel seminterrato e risale al piano di sopra
    // resta sulla stessa schermata.
    const tornataLaRete = () => { void rileggi() }
    window.addEventListener('online', tornataLaRete)
    // E finché il cloud non ha risposto una prima volta si riprova ogni venti
    // secondi: il telefono non sempre dice di essere stato senza rete (un
    // segnale debole non è "offline"), e chi tiene l'app aperta sulla scheda
    // senza toccare niente restava con l'avviso "dati cloud non caricati"
    // finché non la toccava. Dopo la prima risposta il giro non fa più niente.
    const giroFinoAlPrimoSi = setInterval(() => { if (maiAllineato && !senzaRete()) void rileggi() }, 20_000)
    // Per chi sta uscendo dall'account: vedi lib/uscita.
    useSyncStatus.getState().setSalvaOra(flushNow)

    // Modifiche fatte offline che il load ha deciso di tenere: vanno spinte subito,
    // senza aspettare che l'utente tocchi qualcosa (potrebbe non farlo mai più).
    if (pushOnMount) void performSave()

    return () => {
      vivo = false
      unsub()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flushNow)
      window.removeEventListener('online', tornataLaRete)
      clearInterval(giroFinoAlPrimoSi)
      useSyncStatus.getState().setSalvaOra(null)
      clearTimeout(saveTimer.current)
      clearTimeout(retryTimer.current)
      setStatus('idle')
      setRetry(null)
    }
  }, [userId, pushOnMount])

  return null
}

// ── Le correzioni dell'allenatore ──────────────────────────────
// Chi mi segue può correggere un'alzata che ho scritto male, ma non scrive nei
// miei dati: lascia la correzione in una tabella a parte (vedi lib/correzioni),
// e ad applicarla sono io, qui — all'apertura dell'app e ogni volta che torna
// in primo piano.
//
// Montato solo a caricamento dal cloud RIUSCITO (`cloudPronto`), e non prima.
// Un istante prima lo store contiene quello che c'era sul telefono, o niente: la
// correzione non troverebbe la sua alzata, verrebbe presa per "senza più un
// bersaglio" e cancellata — con il lavoro dell'allenatore perso prima ancora che
// i dati arrivino. È successo davvero, alla prima prova.
function CorrezioniBridge({ userId }: { userId: string }) {
  useEffect(() => {
    let inCorso = false
    const applica = async () => {
      if (inCorso || senzaRete()) return
      inCorso = true
      try {
        const tutte = await correzioniPer(userId)
        if (!tutte.length) return
        // Solo quelle di chi mi segue ANCORA. Una correzione lasciata in sospeso
        // da un allenatore che poi ho scollegato non si applica: prima restava
        // in tabella e riscriveva la mia alzata alla prima apertura, a rapporto
        // chiuso. Si toglie e basta.
        const legati = new Set((await myCoaches(userId)).map(l => l.coach_id))
        const correzioni = tutte.filter(c => legati.has(c.coach_id))
        const orfane = tutte.filter(c => !legati.has(c.coach_id)).map(c => c.id)
        // Si tolgono quelle senza più un bersaglio e quelle già fatte — ma solo
        // se quello che c'è su QUESTO telefono è lo stato vero: niente modifiche
        // in sospeso, e il cloud fermo a dove lo si conosce. Altrimenti il
        // giudizio "non ha più un bersaglio" è dato su dati di ieri: un secondo
        // telefono rimasto indietro, a cui l'alzata corretta non era ancora
        // arrivata, la cancellava come persa — e con lei il lavoro
        // dell'allenatore. Finché non si è allineati la correzione resta lì.
        //
        // La domanda al cloud viene PRIMA, e da qui in giù non si aspetta più
        // niente: lo store su cui si giudica e le meta che dicono se è
        // allineato vanno letti nello stesso istante. Con un'attesa in mezzo,
        // la rilettura del cloud (che parte sullo stesso ritorno in primo
        // piano) poteva arrivare fra le due letture: il giudizio dato sui dati
        // vecchi veniva creduto perché le meta, lette dopo, erano già nuove.
        const remoto = await fetchRemoto(userId)
        const meta = getSyncMeta()
        const alPasso = !meta.dirty && !remotoCambiato(remoto.updatedAt, meta.lastSyncedAt)
        const esito = applicaCorrezioni(useJarvisStore.getState().palestraExercises, correzioni)
        if (esito.applicate.length) {
          // Segna lo stato come modificato: il bridge del cloud lo salva.
          useJarvisStore.setState({ palestraExercises: esito.esercizi })
          useSyncStatus.getState().setNotice(esito.applicate.length === 1
            ? t('Il tuo allenatore ha corretto un’alzata')
            : t('Il tuo allenatore ha corretto {n} alzate', { n: esito.applicate.length }))
        }
        await eliminaCorrezioni([...orfane, ...(alPasso ? [...esito.perse, ...esito.giaFatte] : [])])
      } catch {
        // Tabella non ancora creata, o rete: non è un errore da mostrare. Si
        // riprova al prossimo ritorno sull'app.
      } finally {
        inCorso = false
      }
    }
    void applica()
    const alRitorno = () => { if (document.visibilityState === 'visible') void applica() }
    document.addEventListener('visibilitychange', alRitorno)
    return () => document.removeEventListener('visibilitychange', alRitorno)
  }, [userId])
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
  const vecchia = useSyncStatus(s => s.vecchia)

  // Prima di tutto: finché l'app è indietro non salva niente, e chi la usa deve
  // saperlo — le serie che registra restano sul telefono fino all'aggiornamento.
  if (vecchia) {
    return (
      // Toccarla cerca la versione nuova; a ricaricare è il tasto "Aggiorna" che
      // compare in basso quando c'è (vedi UpdateToast): una ricarica alla cieca
      // riaprirebbe la stessa versione vecchia.
      <button onClick={cercaAggiornamento} style={{ ...PILL_STYLE, cursor: 'pointer' }}>
        {PILL_DOT}
        {t('App da aggiornare — per ora non salvo nel cloud')}
      </button>
    )
  }
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

/** Quanto si aspetta `getSession()` prima di partire dalla sessione salvata sul
 *  telefono (vedi l'effetto d'avvio in App). */
const ATTESA_SESSIONE_MS = 2500

// ── App shell ──────────────────────────────────────────────────
export default function App() {
  // Solo i campi che l'involucro legge davvero. Con lo store intero ogni
  // scrittura — una serie registrata, una scheda spostata — ridisegnava l'app
  // da cima a fondo, compresa la pagina che si stava toccando.
  const s = useJarvisStore(useShallow(st => ({
    darkMode: st.darkMode, lang: st.lang, layout: st.layout, bgFuso: st.bgFuso,
    accentColor: st.accentColor, customAccentHex: st.customAccentHex,
    userName: st.userName, userSex: st.userSex, userWeight: st.userWeight,
    userHeight: st.userHeight, userDob: st.userDob,
  })))
  const isDesktop = useIsDesktop()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [recovering, setRecovering] = useState(false)
  const [cloudLoading, setCloudLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  // Il caricamento dal cloud è RIUSCITO, per questo utente, in questa sessione.
  // Non è `!cloudLoading`: quello è vero anche nell'istante prima che il
  // caricamento parta, quando lo store contiene ancora solo quello che c'era sul
  // telefono — o niente. Chi deve ragionare sui dati veri (le correzioni
  // dell'allenatore) aspetta questo.
  const [cloudPronto, setCloudPronto] = useState(false)
  // Per CHI è stato deciso cosa c'è nello store: l'id dell'utente il cui
  // caricamento è arrivato in fondo (riuscito, fallito o saltato perché senza
  // rete). `!cloudLoading` non basta: resta `false` da una sessione all'altra,
  // e rientrando dopo un'uscita il bridge del cloud si montava per un giro con
  // lo stato della sessione di PRIMA, mentre il caricamento rimetteva nello
  // store i dati messi da parte — e li salvava contro un orario vecchio,
  // sovrascrivendoli col remoto. Finché questo non è l'utente di adesso, non si
  // monta niente che legga o scriva i suoi dati.
  const [caricatoPer, setCaricatoPer] = useState<string | null>(null)
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
  // Si apre sui messaggi quando si arriva toccando una notifica: nell'indirizzo
  // (`?apri=messaggi`, app chiusa) o detto dal service worker (app già aperta).
  const [coachSuMessaggi, setCoachSuMessaggi] = useState(false)
  useEffect(() => {
    const apri = () => { setCoachSuMessaggi(true); setShowCoach(true) }
    if (new URLSearchParams(window.location.search).get('apri') === 'messaggi') {
      apri()
      // L'indirizzo si ripulisce: ricaricando la pagina non deve riaprirsi il
      // Coaching ogni volta.
      window.history.replaceState(null, '', window.location.pathname)
    }
    if (!('serviceWorker' in navigator)) return
    const daSW = (e: MessageEvent) => { if (e.data?.tipo === 'apri') apri() }
    navigator.serviceWorker.addEventListener('message', daSW)
    return () => navigator.serviceWorker.removeEventListener('message', daSW)
  }, [])
  // Le domande del primo accesso sono già state chiuse in questa sessione. Serve
  // perché `profiloVuoto` si aggiorna dallo store un attimo dopo il salvataggio,
  // e in quell'attimo il questionario si rimonterebbe da capo.
  const [setupFatto, setSetupFatto] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const apriImpostazioni = useCallback(() => setProfilo('impostazioni'), [])
  const apriProfilo = useCallback(() => setProfilo('utente'), [])
  const apriCoach = useCallback(() => { setProfilo(null); setShowCoach(true) }, [])

  // Neon e Logbook sono temi scuri fatti SOPRA `.dark`: ne prendono superfici
  // piene, tasti a pressione e campi, e ci cambiano sopra i colori (vedi i blocchi
  // `:root.neon` / `:root.logbook` in globals.css). Perciò accendono `.dark` anche
  // con l'interruttore spento. Premium no: ha le sue regole e lo scavalca.
  const neon = s.layout === 'neon'
  const logbook = s.layout === 'logbook'
  useEffect(() => {
    document.documentElement.classList.toggle('dark', !!s.darkMode || neon || logbook)
  }, [s.darkMode, neon, logbook])
  useEffect(() => {
    document.documentElement.classList.toggle('neon', neon)
    document.documentElement.classList.toggle('logbook', logbook)
  }, [neon, logbook])

  // `<html lang>` non è cosmesi: è quello che dice al lettore di schermo con che
  // pronuncia leggere la pagina, e al browser con che regole sillabare e proporre
  // la traduzione. Sbagliato, un testo inglese viene letto ad alta voce con
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

  // Lo "Sfondo fuso" (vedi globals.css). Assente dallo stato = acceso: è il fondo
  // con cui l'app si presenta ora, e chi non lo vuole lo spegne da Impostazioni.
  // Lo "Sfondo in movimento" che gli stava accanto non c'è più: due livelli
  // grandi una volta e mezza lo schermo, ruotati di continuo, costringevano il
  // telefono a ricomporre tutta la pagina a ogni fotogramma — ed è lì che i tocchi
  // arrivavano in ritardo.
  const bgFuso  = s.bgFuso  ?? true
  useEffect(() => {
    document.documentElement.classList.toggle('bg-fusione', bgFuso)
  }, [bgFuso])

  useEffect(() => {
    // ── Chi è entrato su questo telefono ─────────────────────────
    // `getSession()` non è una lettura: con l'accesso scaduto (dura un'ora)
    // prova a rinnovarlo, e senza rete — o con la rete che pende — ci mette fino
    // a un minuto prima di rispondere "nessuna sessione". In quel minuto lo
    // schermo restava nero, e poi compariva il login: nel seminterrato della
    // palestra l'app non si apriva, con tutti i dati lì sul telefono.
    //
    // La sessione salvata dice già chi è entrato, e basta per mostrargli i suoi
    // dati locali (a ogni richiesta il token lo giudica comunque il server):
    //  • senza rete si parte subito da lei;
    //  • con la rete si aspetta la risposta vera, ma non più di qualche secondo;
    //  • se la risposta è "non sono riuscito a rinnovare per colpa della rete"
    //    si resta dentro. Fuori si va solo se l'accesso non c'è davvero più.
    const suDisco = sessioneSuDisco()
    let risposto = false
    if (suDisco && senzaRete()) setSession(suDisco)
    const attesa = suDisco
      ? setTimeout(() => { if (!risposto) setSession(s => (s === undefined ? suDisco : s)) }, ATTESA_SESSIONE_MS)
      : undefined
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      risposto = true
      clearTimeout(attesa)
      if (!session && suDisco && error && erroreDiRete(error)) setSession(s => s ?? suDisco)
      else setSession(session)
    }).catch(() => {
      risposto = true
      clearTimeout(attesa)
      setSession(s => s ?? suDisco)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Quello che non era ancora arrivato al cloud si mette da parte per chi
        // sta uscendo, prima di svuotare: lo ritrova rientrando su questo
        // telefono (vedi lib/proprietario). Prima si cancellava e basta.
        const chi = proprietario()
        if (chi) parcheggia(chi)
        svuotaDatiLocali()
        segnaProprietario(null)
        // Tutto quello che valeva per la sessione appena finita torna a zero:
        // restando, il prossimo ingresso — anche dello stesso utente — partiva
        // con l'orario del cloud, lo stato "non sincronizzato" e il "già
        // caricato" di prima.
        setCaricatoPer(null)
        setCloudPronto(false)
        setLoadFailed(false)
        setInitialUpdatedAt(null)
        setPushOnMount(false)
        setSetupFatto(false)
        const stato = useSyncStatus.getState()
        stato.setStatus('idle'); stato.setRetry(null); stato.setVecchia(false)
      }
      // link "password dimenticata": mostra la schermata per impostare la nuova password
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(session)
    })
    return () => { clearTimeout(attesa); subscription.unsubscribe() }
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
    // Se questo dispositivo ha già le notifiche attive, l'iscrizione dev'essere
    // a nome di chi è entrato adesso (vedi lib/push).
    void riallineaPush(id).catch(() => { /* tabella assente o rete: si riprova al prossimo avvio */ })
    return () => fermaMessaggi()
  }, [session?.user?.id])

  useEffect(() => {
    if (!session?.user) return

    // Di chi sono i dati che stanno sul telefono? Se sono di un ALTRO account —
    // una sessione cambiata senza passare dall'uscita, come un link di conferma
    // aperto nello stesso browser — si tolgono prima di tutto, mettendo da
    // parte quello che il loro proprietario non aveva ancora inviato. Senza,
    // restavano nello store e al primo salvataggio salivano nel cloud di chi è
    // entrato adesso. E se chi entra aveva lasciato qui qualcosa di non
    // inviato, lo ritrova: da lì in poi vale come una modifica fatta senza rete.
    const io = session.user.id
    // Un caricamento partito non si può richiamare: se quando torna l'utente è
    // cambiato (o è stato chiesto di riprovare) non deve più decidere niente.
    let vivo = true
    const prima = proprietario()
    if (prima && prima !== io) {
      parcheggia(prima)
      svuotaDatiLocali()
    }
    segnaProprietario(io)
    riprendi(io)
    pulisciParcheggi()

    // Senza rete non si aspetta niente: si va dritti al dato locale.
    // È lo stesso identico percorso del load fallito (vedi il .catch qui sotto),
    // solo istantaneo invece che dopo il timeout. Serve al caso più frequente di
    // tutti per un'app da palestra — il seminterrato che non prende — dove prima
    // si restavano a guardare lo scheletro per sette secondi e mezzo prima di
    // vedere i propri esercizi, che erano lì sul telefono dall'inizio.
    setCloudPronto(false)
    if (senzaRete()) {
      setInitialUpdatedAt(getSyncMeta().lastSyncedAt)
      setPushOnMount(false)
      setLoadFailed(true)
      setCloudLoading(false)
      setCaricatoPer(io)
      return
    }

    setCloudLoading(true)
    setLoadFailed(false)
    loadUserData(session.user.id)
      .then(res => {
        if (!vivo) return
        // solo se ci sono dati nel cloud li carico; se null (nessuna riga) tengo lo stato locale.
        // MAI azzerare a EMPTY: eviterebbe la sovrascrittura del vuoto sul cloud.
        const meta = getSyncMeta()
        // Il cloud è stato scritto da un'app più nuova di questa: applicarlo
        // qui vorrebbe dire passarlo dal filtro delle chiavi che questa
        // versione conosce, e poi risalvarlo senza le altre. Non si applica e
        // non si salva: si resta su quello che c'è sul telefono, e si chiede
        // l'aggiornamento (vedi `troppoNuovo` nel bridge).
        if (res && (Number(res.data.versioneDati) || 0) > VERSIONE_DATI) {
          useSyncStatus.getState().setVecchia(true)
          dimenticaUltimoSync()
          cercaAggiornamento()
          setInitialUpdatedAt(null)
          setPushOnMount(false)
          setCloudLoading(false)
          setCaricatoPer(io)
          return
        }
        if (res) {
          // `decideInitialSync` è ciò che impedisce al remoto stale di cancellare
          // le modifiche fatte offline: vedi src/lib/syncMeta.ts.
          const decision = decideInitialSync(res.updatedAt, meta)
          setInitialUpdatedAt(res.updatedAt)
          if (decision === 'keepLocalAndPush') {
            // Il remoto è la nostra scrittura rimasta senza risposta: lo si
            // scrive, o al prossimo avvio — se nel frattempo il nuovo invio
            // fallisce — tornerebbe a sembrare quella di un altro dispositivo.
            if (stessoIstante(res.updatedAt, meta.inViaggio)) confermaRemoto(res.updatedAt!)
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
        setCloudPronto(true)
        setCaricatoPer(io)
      })
      .catch(() => {
        if (!vivo) return
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
        setCaricatoPer(io)
      })
    return () => { vivo = false }
    // Deve rieseguire solo al cambio di utente (e su richiesta di retry): session.user
    // viene letto dentro ma non deve ritriggerare il load a ogni nuovo oggetto session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, loadAttempt])

  // Nei layout a tema fisso l'accent è il loro (terracotta in Premium, lime in
  // Neon, verde in Logbook) e `adjustPaletteForDark` va scavalcata.
  // `accentColor` resta intatto nello store e torna in vigore con il layout standard.
  const basePalette = paletteFor(s.accentColor, s.customAccentHex)
  const palette = temaFisso(s.layout)
    ? ACCENT_FISSI[s.layout]
    : (s.darkMode ? adjustPaletteForDark(basePalette) : basePalette)

  const handleBoot = () => {
    writeStorage('session', 'jarvis-booted', '1')
    setBooted(true)
  }

  const alAllineamento = useCallback(() => {
    setLoadFailed(false)
    setCloudPronto(true)
  }, [])

  // I layout a tema fisso hanno il fondo scuro anche con l'interruttore
  // chiaro/scuro spento: chi calcola la leggibilità deve saperlo, o spingerebbe
  // l'accent verso la carta chiara mentre sta su nero pieno.
  const fondoScuro = temaFisso(s.layout) || !!s.darkMode

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

  // Lo store contiene i dati di chi è entrato ADESSO, e il caricamento ha finito
  // di decidere cosa tenere (vedi `caricatoPer`). Prima di questo non si monta
  // niente che li legga o li scriva: né il bridge, né le pagine.
  const pronto = !!session && !cloudLoading && caricatoPer === session.user.id

  // Shared content that lives inside the content area (both layouts)
  const innerContent = (
    <>
      {(!session || recovering) && (
        <Suspense fallback={null}>
          <JarvisLogin onAuth={() => {}} recovery={recovering} onRecoveryDone={() => setRecovering(false)}/>
        </Suspense>
      )}

      {session && !recovering && (
        <>
          {pronto && (
            <CloudSyncBridge
              userId={session.user.id} initialUpdatedAt={initialUpdatedAt} pushOnMount={pushOnMount}
              // Chi era partito senza rete: adesso il cloud ha risposto e i dati
              // sono allineati. Si spegne l'avviso "Dati cloud non caricati", che
              // prima restava acceso per tutta la sessione anche a sincronizzazione
              // ripresa, e partono le correzioni dell'allenatore.
              onAllineato={alAllineamento}
            />
          )}
          {cloudPronto && pronto && <CorrezioniBridge userId={session.user.id}/>}
          <SyncPills loadFailed={loadFailed} onRetryLoad={() => setLoadAttempt(n => n + 1)}/>

          {!pronto && (
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

          {/* Sotto lo splash e non dopo: lo splash la copre (zIndex 100), e
              intanto l'allenamento scarica il suo codice e si disegna. Prima
              partiva solo a splash finito, e i due tempi si sommavano. */}
          {pronto && (
            <Contenuto onOpenProfile={apriImpostazioni} onOpenUser={apriProfilo} onOpenCoach={apriCoach}/>
          )}

          {pronto && booted && !loadFailed && profiloVuoto && !setupFatto && (
            <Suspense fallback={null}>
              <FirstSetup onDone={() => setSetupFatto(true)}/>
            </Suspense>
          )}

          {pronto && !booted && (
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
            {showCoach  && <JarvisCoach  userId={session.user.id} iniziale={coachSuMessaggi ? 'messaggi' : 'seguito'} onBack={() => { setShowCoach(false); setCoachSuMessaggi(false) }}/>}
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
            // `backgroundColor`, non `background`: lo shorthand scritto inline
            // azzera anche `background-image`, e batte la classe `.j-bg-fondo`
            // che il fondo lo porta. Per qualche versione è andata così — la
            // pagina principale era una tinta piatta, e aloni e "sfondo fuso" si
            // vedevano solo nelle impostazioni e all'accesso.
            backgroundColor: NUC.bg,
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
              // `backgroundColor` e non `background`: vedi il ramo desktop qui sopra.
              backgroundColor: NUC.bg,
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

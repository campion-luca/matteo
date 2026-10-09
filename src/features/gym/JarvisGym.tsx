// Sezione Allenamento: schermata principale e tutte le sue sotto-pagine.
//
// Un solo componente esportato (`JarvisGym`) con tre tab — Pesi, Hyrox, Stats —
// e una navigazione interna a stati, non a router: `selectedExercise`,
// `selectedMuscle`, `selectedHyrox`, `showSchede` sono i "livelli", e i rami di
// return in fondo al file scelgono la pagina da mostrare. Nessuna URL da
// sincronizzare, e il back è sempre "azzera questo stato".
// Le pagine di dettaglio stanno qui sopra come componenti privati; i modali di
// log/modifica vivono in gymModals.tsx e il calcolo (EVL, volume, PR) in
// gymModel.ts, che è puro e testato.
import { useState, useMemo, useEffect, useCallback } from 'react'
import type React from 'react'
import { NUC, accentInkFor, cursore } from '@/lib/jarvis-tokens'
import { NucCard, NucSubTabs, NucEyebrow } from '@/components/ui/NucComponents'
import { SalutoHeader } from '@/components/ui/SalutoHeader'
import { SplitPane, SplitVuoto, Strato } from '@/components/ui/SplitPane'
import { Cronologia } from '@/components/ui/Cronologia'
import { Icons } from '@/components/ui/Icons'
import { useShallow } from 'zustand/react/shallow'
import { useJarvisStore } from '@/store/useJarvisStore'
import type { HyroxExercise, HyroxGara, HyroxHistoryEntry, PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'
import { useConfirmDelete } from '@/hooks/useConfirmDelete'
import {
  displayMuscle, exColor, MUSCLE_COLORS, MUSCLE_OPTIONS, fmtKg, fmtKgVerso, fmtNum, fmtReps, fmtTime, fmtVol, entry1RM, recordFor,
  effectiveLoad, entryVolume, sortedHistory, colpiMigliori, ultimaVoce, andamentoStorico,
  RACE_STATIONS, RUNNING_STATION, RACE_IDS,
} from './gymModel'
import { useMuscleColors } from './useMuscleColors'
import { achievements } from './gymStrength'
import { GymSchede } from './GymSchede'
import { InCorsoInHome } from './InCorso'
import { DisegnoAzione } from './DisegniAzioni'
import { Riepilogo } from '@/features/dashboard/Riepilogo'
import { SettimanaStrip } from '@/features/dashboard/SettimanaStrip'
import { MuscleIcon } from './MuscleIcons'
import { readStorage, writeStorage } from '@/lib/safeStorage'
import { esercizidaCatalogo, quotaCorpo, aColpi, corpoLibero } from './catalogo'
import { fotoEsercizio, precaricaFoto } from './eserciziFoto'
import { vistaIniziale, vistaGruppiIniziale, VISTA_KEY, VISTA_GRUPPI_KEY, type VistaEsercizi, type VistaGruppi } from './vistaEsercizi'
import { CaroselloGruppi } from './CaroselloGruppi'
import { supabase } from '@/lib/supabase'
import { noteRicevute, type NotaCoach } from '@/lib/coach'
import { useNonLetti } from '@/lib/messaggiLive'
import { BadgeNonLetti } from '@/features/coach/messaggiUI'
import { TendinaGruppo } from '@/features/coach/TendinaGruppo'
import { LineChart, FacciaEsercizio, DataPunto, SegnaleCarico, MenuAzioni } from './gymShared'
import { useBodyWeight, useGruppiMuscolari, useMuscleIcons } from './gymHooks'
import { caricoDiRiferimento } from './limitiAlzata'
import { useIsDark } from '@/hooks/useIsDark'
import { useT, useTData } from '@/lib/i18n'
import { fmtShortDate, fmtDayMonth } from '@/lib/dateFormat'
import { AddExModal, EditExModal, EditHistoryModal, ExStatsModal, HyroxStatsModal, LogHyroxModal, LogPalestraModal, NuovoGruppoModal, RecordModal, RegistraGaraModal, type OpzioniModificaEsercizio } from './gymModals'
import type { RecordItem } from './gymModals'
import { HyroxCard, HyroxDetail, RaceSummary, StazioniInGara } from './GymHyrox'
import { HYROX_ATTIVO } from './hyroxAttivo'
import { FormatoSwitch } from './FormatoSwitch'
import { type FormatoHyrox, sessioniDel, formatoSessione, aDistanzaIntera, categoriaStima } from './hyroxStima'
import { todayISO } from '@/lib/isoDate'
import { GlobalSearch, type Trovato } from '@/features/search/GlobalSearch'

type MuscleView = 'vol' | 'sessioni'
/** Cosa mostra l'elenco degli esercizi Hyrox: le sessioni di allenamento, o i
 *  tempi fatti nelle gare e nelle simulazioni registrate. */
type VistaHyrox = 'sessioni' | 'gare'

// Lo switch della tabella per muscolo: chili spostati o volte che l'hai allenato.
// Vive nell'etichetta di sezione, che cambia titolo con lui — è quello a dire cosa
// si sta guardando; queste due celle dicono solo cosa si può guardare.
function MetricSwitch({ value, onChange }: { value: MuscleView; onChange: (v: MuscleView) => void }) {
  const t = useT()
  const opts: Array<[MuscleView, string]> = [['vol', t('Kg')], ['sessioni', t('Volte')]]
  return (
    <div className="j-switch" style={cursore(opts.findIndex(([id]) => id === value), opts.length)}>
      {opts.map(([id, label]) => {
        const on = id === value
        return (
          <button key={id} type="button" onClick={() => onChange(id)} aria-pressed={on}
            className="j-switch-cell" style={{
              padding: '4px 10px',
              fontFamily: NUC.label, fontSize: 9.5, fontWeight: on ? 600 : 500,
              letterSpacing: '.12em', textTransform: 'uppercase',
            }}>{label}</button>
        )
      })}
    </div>
  )
}

// I due modi di allenarsi. Non sono tre: "Stats" non è un allenamento ma ciò che
// se ne ricava, e stava qui dentro solo perché era un'altra schermata da
// raggiungere. Adesso è una delle tre card sotto, insieme a Schede e Cerca, che
// sono anche loro cose che si FANNO sui pesi — non modi di allenarsi.
function GymModeTabs({ value, onChange }: { value: 'palestra' | 'hyrox'; onChange: (m: 'palestra' | 'hyrox') => void }) {
  const t = useT()
  // Quello scelto è PIENO d'accent, non una cella con un contorno colorato.
  // Su due sole voci il contorno non bastava a dire qual era quella attiva — a
  // colpo d'occhio si leggevano come due tasti uguali — e il colore dell'azione
  // in tutta l'app è uno solo: dove si è adesso è un'informazione, non una
  // rifinitura.
  //
  // Stesso `.j-switch` degli altri interruttori, con il cursore pieno d'accent:
  // così anche qui il colore SCIVOLA da una voce all'altra. Era la sola cosa che
  // faceva di questo un pezzo a sé — stessa forma, codice diverso — e adesso non
  // lo è più.
  const cell = (id: 'palestra' | 'hyrox', label: string, icon: JSX.Element) => {
    const on = id === value
    return (
      <button key={id} onClick={() => onChange(id)} aria-pressed={on} aria-current={on ? 'page' : undefined}
        className="j-switch-cell" style={{
          height: 38,
          fontFamily: NUC.label, fontSize: 12, fontWeight: on ? 600 : 500,
          letterSpacing: '.02em', gap: 7,
        }}>
        {icon}{label}
      </button>
    )
  }
  return (
    <div className="j-switch j-switch-accent" style={{
      ...cursore(value === 'palestra' ? 0 : 1, 2),
      gap: 4, padding: 4,
    }}>
      {cell('palestra', t('Pesi'),  <Icons.dumbbell size={15} stroke={1.9}/>)}
      {cell('hyrox',    t('Hyrox'), <Icons.run size={15} stroke={1.9}/>)}
    </div>
  )
}

// Le tre cose che si fanno sull'allenamento, affiancate sotto i tab: figura
// sopra, nome sotto, stessa forma e stessa larghezza per tutte e tre, perché sono
// destinazioni di pari peso.
// "Cerca" non c'è: la lente in testata cerca già ovunque, e due ricerche una
// sopra l'altra sono un doppione — chi non trova nella prima non prova la
// seconda, prova un'altra parola.
// Personal Coach è la prima: stava in home fra le scorciatoie, ma è una cosa
// che riguarda l'allenamento, e qui sta accanto alle schede che un allenatore ti
// assegna. Si chiama "Coaching" e non "Personal Coach" perché le tre etichette
// stanno su una riga sola e la più lunga decide il corpo del carattere di tutte
// e tre — "Coaching" è lunga quanto "Statistiche", quindi non la allarga. È
// l'attività e non la persona: da qui si segue qualcuno e si è seguiti, e
// "Coach" faceva pensare solo alla seconda. "Statistiche" al posto di "Stats" per il motivo opposto — lì lo spazio
// c'è, e una parola intera si legge invece di doverla decifrare.
// L'icona è una nuvoletta e non più un manubrio: il manubrio è già la tab Pesi
// qui sopra, identico, e diceva comunque la cosa sbagliata — il Personal Coach è
// il posto dove si parla con una persona.
function AzioniGym({ onCoach, onSchede, onStats }: {
  onCoach: () => void
  onSchede: () => void
  onStats: () => void
}) {
  const t = useT()
  // Le richieste non lette. Sta qui e non dentro il Personal Coach perché il
  // punto del badge è farsi vedere da chi il Personal Coach NON lo sta aprendo:
  // se per accorgersi di un messaggio bisognasse entrare, il badge non servirebbe.
  const daLeggere = useNonLetti()
  const card = (id: 'coach' | 'schede' | 'stats', label: string, onClick: () => void) => {
    const badge = id === 'coach' ? daLeggere : 0
    // Ogni card ha la sua tinta (`--azione-…` in globals.css, una terna per
    // tema), mescolata alla superficie: fondo, bordo e disegno sono dosi dello
    // stesso colore. Nessuna resta "accesa": tutte e tre aprono una pagina, e
    // da quando lo fa anche Statistiche non c'è più uno stato da mostrare qui.
    const tinta = `var(--azione-${id})`
    const fondo = `color-mix(in srgb, ${tinta} 26%, var(--surface))`
    // I quattro colori del disegno (vedi DisegniAzioni): due toni per le masse,
    // uno per i dettagli — la tinta spinta verso il colore del testo, chiara sui
    // temi scuri e scura sulla carta — e il fondo, per i ritagli.
    const colori = {
      '--d1': `color-mix(in srgb, ${tinta} 40%, transparent)`,
      '--d2': `color-mix(in srgb, ${tinta} 78%, transparent)`,
      '--d3': `color-mix(in srgb, ${tinta} 38%, var(--fg))`,
      '--df': fondo,
    } as React.CSSProperties
    return (
      <button
        onClick={onClick}
        aria-label={badge > 0 ? `${label} — ${t('{n} da leggere', { n: badge })}` : undefined}
        className="j-hard"
        style={{
          position: 'relative',
          // Un'altezza e non `aspectRatio`: con tre card, quadrate non riempivano
          // la riga e lasciavano un buco a destra. In `dvh` con un tetto, perché
          // su un telefono basso l'altezza è la risorsa scarsa e queste card
          // vengono prima dei gruppi muscolari.
          // Una volta e mezza quelle di partenza (78–112px): alte il doppio
          // erano troppo, e per metà vuote. Non sono un tasto con l'icona sopra
          // la scritta ma una tessera: il disegno in alto, il nome in basso a
          // sinistra, come nelle card dei gruppi muscolari qui sotto.
          height: ALTEZZA_AZIONE,
          minWidth: 0, borderRadius: 'var(--radius-lg)', cursor: 'pointer',
          backgroundColor: fondo,
          border: `1px solid color-mix(in srgb, ${tinta} 42%, transparent)`,
          color: 'var(--fg)',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-end',
          padding: 'clamp(11px, 3.2vw, 15px)',
          textAlign: 'left',
          ...colori,
        }}
      >
        <DisegnoAzione id={id} style={DISEGNO_AZIONE}/>
        {/* Non più in maiuscoletto spaziato: sono nomi di posti dove si va, e
            in maiuscolo a 9px "STATISTICHE" si decifra invece di leggersi. */}
        <span style={{
          position: 'relative',
          // Peso 500 e non 600: in grassetto, accanto ai disegni, le tre
          // scritte pesavano più dei disegni stessi.
          fontFamily: NUC.label, fontSize: 'clamp(13px, 3.7vw, 16px)', fontWeight: 500,
          letterSpacing: '.005em', lineHeight: 1.2,
        }}>{label}</span>
        {/* A cavallo dell'angolo, non dentro: la card è alta poco più di
            cinquanta pixel su un telefono basso, e un badge messo dentro il
            bordo mangerebbe lo spazio dell'icona. */}
        <BadgeNonLetti n={badge} style={{ position: 'absolute', top: -7, right: -7 }}/>
      </button>
    )
  }
  return (
    // Il margine sopra non è solo respiro: il badge dei messaggi sporge di 7px
    // dall'angolo della prima card, e l'area che scorre lo taglierebbe.
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'clamp(8px, 2.4vw, 12px)', marginTop: 8, marginBottom: 'clamp(12px, 2.2dvh, 18px)', maxWidth: 640 }}>
      {card('coach',  t('Coaching'),    onCoach)}
      {card('schede', t('Schede'),      onSchede)}
      {card('stats',  t('Statistiche'), onStats)}
    </div>
  )
}

// Il menù di Hyrox: una voce sola, Statistiche, sotto Esercizi e Gara.
// Coach e Schede sono cose dei pesi — le schede sono elenchi di esercizi con
// serie e chili, l'allenatore commenta quelle — e dentro Hyrox erano due porte
// verso l'altro mondo. Stessa forma delle card dei pesi, stesa su una riga, e
// come quella dei pesi apre la pagina delle statistiche.
function TastoStatistiche({ onClick }: { onClick: () => void }) {
  const t = useT()
  return (
    <button
      onClick={onClick}
      className="j-hard j-focus"
      style={{
        width: '100%', height: 44, marginBottom: 16, borderRadius: 'var(--radius)', cursor: 'pointer',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--hairline)',
        color: 'var(--fg-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontFamily: NUC.label, fontSize: 12.5, fontWeight: 500, letterSpacing: '.01em',
      }}
    >
      <Icons.chart size={18} stroke={1.7}/>
      {t('Statistiche')}
    </button>
  )
}

function GymStats({ exercises, hyroxExercises, statsTab, formatoHyrox, onFormatoHyrox }: {
  exercises: PalestraExercise[]
  hyroxExercises: HyroxExercise[]
  /** Pesi o Hyrox: le statistiche del mondo in cui si è (vedi JarvisGym). */
  statsTab: 'pesi' | 'hyrox'
  /** Le statistiche Hyrox guardano una distanza sola: miglior tempo e media fra
   *  un 500 m e un 1000 m non vogliono dire niente. */
  formatoHyrox: FormatoHyrox
  onFormatoHyrox: (f: FormatoHyrox) => void
}) {
  const t = useT()
  const tData = useTData()
  const [selectedEx, setSelectedEx] = useState<PalestraExercise | null>(null)
  const [hyroxAperto, setHyroxAperto] = useState<string | null>(null)
  const [muscleView, setMuscleView] = useState<MuscleView>('vol')
  const [prOpen, setPrOpen] = useState(false)
  const [volumeOpen, setVolumeOpen] = useState(false)
  const bodyWeight = useBodyWeight()

  const totalPalestra = exercises.reduce((sum, ex) => sum + ex.history.length, 0)
  const totalHyrox    = hyroxExercises.reduce((sum, ex) => sum + ex.history.length, 0)

  const { prs, muscleEntries } = useMemo(() => {
    // Solo gli esercizi fatti almeno una volta: di uno mai eseguito non c'è un
    // record, e in elenco era una riga «0 kg · 0 sess.» fra quelle vere.
    const prs = exercises.filter(ex => ex.history.length > 0).map(ex => {
      const corpo = bodyWeight * quotaCorpo(ex)
      const bestKg  = ex.history.length ? Math.max(...ex.history.map(h => effectiveLoad(h, corpo))) : ex.current.kg
      // I record si ordinano per massimale stimato: il solo carico massimo metteva
      // davanti una singola pesante fatta una volta rispetto a una serie lunga e piena.
      const best1RM = ex.history.length ? Math.max(...ex.history.map(h => entry1RM(h, corpo))) : 0
      // Gli esercizi che non vanno a chili (addominali, polpacci a corpo libero)
      // hanno per record i colpi: scrivere "0 kg" direbbe che non si è fatto niente.
      const bestColpi = aColpi(ex) && bestKg === 0 && ex.history.length ? Math.max(...ex.history.map(colpiMigliori)) : 0
      return { ex, name: ex.n, muscle: displayMuscle(ex.muscle), bestKg, best1RM, bestColpi, sessions: ex.history.length }
    }).sort((a, b) => b.best1RM - a.best1RM)

    // Due numeri per muscolo, non uno: i chili spostati e i GIORNI in cui l'hai
    // allenato. Il volume dice quanto hai lavorato, i giorni quanto spesso — e
    // sono domande diverse: un gruppo può avere volume alto perché ci si mettono
    // carichi grossi, non perché lo si alleni più degli altri.
    // I giorni si contano distinti: tre esercizi di dorso lo stesso giovedì sono
    // un allenamento di dorso. Le voci legacy senza `date` ricadono sull'etichetta
    // settimana `d`, che è il massimo di precisione che hanno.
    const map = new Map<string, { vol: number; days: Set<string> }>()
    exercises.forEach(ex => {
      if (!ex.history.length) return
      const m = displayMuscle(ex.muscle)
      const cur = map.get(m) ?? { vol: 0, days: new Set<string>() }
      const corpo = bodyWeight * quotaCorpo(ex)
      ex.history.forEach(h => { cur.vol += entryVolume(h, corpo); cur.days.add(h.date ?? h.d) })
      map.set(m, cur)
    })
    const muscleEntries = [...map.entries()].map(([muscle, v]) => ({ muscle, vol: v.vol, days: v.days.size }))

    return { prs, muscleEntries }
  }, [exercises, bodyWeight])

  // I record divisi per distretto, nell'ordine di sempre (Petto, Dorso, Gambe…),
  // coi gruppi creati dall'utente prima di "Altro". Dentro al gruppo resta
  // l'ordine di `prs`: dal massimale più alto.
  const prPerMuscolo = useMemo(() => {
    const mappa = new Map<string, typeof prs>()
    for (const pr of prs) {
      const m = pr.muscle || 'Altro'
      mappa.set(m, [...(mappa.get(m) ?? []), pr])
    }
    const posto = (m: string) => {
      const i = MUSCLE_OPTIONS.indexOf(m)
      return m === 'Altro' ? 999 : i < 0 ? 500 : i
    }
    return [...mappa.entries()]
      .sort(([a], [b]) => posto(a) - posto(b) || a.localeCompare(b))
      .map(([muscle, lista]) => ({ muscle, lista }))
  }, [prs])
  const [prAperti, setPrAperti] = useState<Set<string>>(() => new Set())
  const apriPr = (m: string) => setPrAperti(prev => {
    const next = new Set(prev)
    if (next.has(m)) next.delete(m); else next.add(m)
    return next
  })
  // Il record com'è scritto: i colpi per chi non va a chili, i chili per gli
  // altri — arrotondati, o un peso corporeo con la virgola dava «46.800000000000004 kg».
  const valorePr = (pr: (typeof prs)[number]) => (pr.bestColpi > 0 ? `${pr.bestColpi} ${t('colpi')}` : `${fmtNum(pr.bestKg)} kg`)

  const hyroxStats = useMemo(() => {
    const allStations = [
      RUNNING_STATION,
      ...RACE_STATIONS,
      ...hyroxExercises.filter(e => !RACE_IDS.has(e.id)),
    ].map(rs => {
      const hist = sessioniDel(hyroxExercises.find(e => e.id === rs.id)?.history ?? [], rs.target, formatoHyrox)
      const bestSec = hist.length ? Math.min(...hist.map(h => h.sec)) : null
      const avgSec  = hist.length ? Math.round(hist.reduce((s, h) => s + h.sec, 0) / hist.length) : null
      return { ...rs, hist, bestSec, avgSec }
    })
    return allStations
  }, [hyroxExercises, formatoHyrox])
  // Per id e non per oggetto: cambiando 1 km / 500 m a modale aperto, le
  // sessioni mostrate seguono la distanza nuova.
  const hyroxSel = hyroxStats.find(s => s.id === hyroxAperto) ?? null

  // Le barre si riordinano insieme alla metrica: un grafico ordinato per volume e
  // letto in allenamenti mostrerebbe la barra più lunga in mezzo alla lista.
  const muscleBars = useMemo(() => {
    const val = (e: typeof muscleEntries[number]) => muscleView === 'vol' ? e.vol : e.days
    return [...muscleEntries]
      .sort((a, b) => val(b) - val(a))
      .map(e => ({
        muscle: e.muscle,
        value: val(e),
        label: muscleView === 'vol'
          ? `${fmtVol(e.vol)} kg`
          : e.days === 1 ? t('1 allenamento') : t('{n} allenamenti', { n: e.days }),
      }))
  }, [muscleEntries, muscleView, t])
  const muscleMax = Math.max(1, ...muscleBars.map(b => b.value))

  return (
    <div>

      {statsTab === 'pesi' && (
        <>
          {/* Le barre sono una riga per gruppo muscolare: con otto gruppi sono otto
              righe in cima a Stats, prima di traguardi e record. Chiuse restano una
              riga sola. L'interruttore vol/volte sta DENTRO la testata ed è escluso
              dal tocco che apre: premerlo per cambiare metrica non deve richiudere
              quello che si sta guardando. */}
          {muscleEntries.length > 0 && (
            <>
              <div className="w-full flex items-center justify-between px-0.5" style={{ marginBottom: volumeOpen ? 10 : 16 }}>
                <button
                  onClick={() => setVolumeOpen(o => !o)}
                  aria-expanded={volumeOpen}
                  className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer p-0"
                >
                  <div className="j-eyebrow">
                    {muscleView === 'vol' ? t('Volume per muscolo') : t('Allenamenti per muscolo')}
                  </div>
                  <div style={{ color: NUC.faint, transform: volumeOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'flex' }}>
                    <Icons.chev size={12} stroke={2}/>
                  </div>
                </button>
                <MetricSwitch value={muscleView} onChange={setMuscleView}/>
              </div>
              {volumeOpen && (
              <NucCard pad={14} style={{ marginBottom: 16 }}>
                <div className="flex flex-col gap-2.5">
                  {muscleBars.map(({ muscle, value, label }) => (
                    <div key={muscle}>
                      <div className="flex justify-between mb-1">
                        <span style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: 1, color: NUC.dim, textTransform: 'uppercase' }}>{tData(muscle)}</span>
                        <span style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint }}>{label}</span>
                      </div>
                      <div className="j-progress-track">
                        <div style={{ height: '100%', width: `${(value / muscleMax) * 100}%`, borderRadius: 'var(--radius)', background: 'var(--j-accent)' }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </NucCard>
              )}
            </>
          )}

          <AchievementsSection exercises={exercises} bodyWeight={bodyWeight}/>

          {/* I record sono una riga per esercizio: con trenta esercizi in lista
              erano trenta card sotto tutto il resto, e la pagina finiva lì. Chiusi
              restano una riga sola, e il numero accanto dice già che ci sono. */}
          {prs.length > 0 && (
            <>
              <button onClick={() => setPrOpen(o => !o)} className="w-full flex items-center justify-between px-0.5 bg-transparent border-none cursor-pointer" style={{ marginBottom: prOpen ? 10 : 16 }}>
                <div className="j-eyebrow">{t('Record personali')}</div>
                <div className="flex items-center gap-1.5">
                  <div className="j-eyebrow">{prs.length}</div>
                  <div style={{ color: NUC.faint, transform: prOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'flex' }}>
                    <Icons.chev size={12} stroke={2}/>
                  </div>
                </div>
              </button>
              {/* Per distretto, come ovunque si elencano esercizi: tutti in fila
                  erano trenta card ordinate per massimale, col curl in mezzo
                  agli squat. Ogni gruppo è una tendina, chiusa all'ingresso, che
                  dice già quanti record ha e qual è il più alto; dentro, una
                  riga per esercizio. */}
              {prOpen && (
                <div style={{ marginBottom: 8 }}>
                  {prPerMuscolo.map(g => (
                    <TendinaGruppo
                      key={g.muscle} muscle={g.muscle} conta={g.lista.length}
                      extra={valorePr(g.lista[0])}
                      aperta={prAperti.has(g.muscle)} onToggle={() => apriPr(g.muscle)}
                    >
                      <NucCard pad={0} style={{ overflow: 'hidden' }}>
                        {g.lista.map((pr, i) => (
                          <button
                            key={pr.ex.id} type="button" onClick={() => setSelectedEx(pr.ex)}
                            className="j-riga-gruppo w-full flex items-center justify-between"
                            style={{
                              gap: 10, padding: '10px 14px', textAlign: 'left', cursor: 'pointer',
                              background: 'transparent', border: 'none',
                              borderTop: i === 0 ? 'none' : '1px solid var(--hairline-soft)',
                            }}
                          >
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: 'block', fontSize: 13.5, color: NUC.ink, letterSpacing: -0.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tData(pr.name)}</span>
                              <span style={{ display: 'block', fontFamily: NUC.label, fontSize: 10, color: NUC.faint, letterSpacing: '.04em', marginTop: 2 }}>{t('{n} sess.', { n: pr.sessions })}</span>
                            </span>
                            <span style={{ flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              <span style={{ display: 'block', fontFamily: NUC.label, fontSize: 14.5, fontWeight: 600, color: 'var(--j-accent-ink)', letterSpacing: -0.3 }}>{valorePr(pr)}</span>
                              {pr.best1RM > 0 && <span style={{ display: 'block', fontFamily: NUC.label, fontSize: 10, color: NUC.faint, marginTop: 1 }}>{t('stima {n} kg', { n: Math.round(pr.best1RM) })}</span>}
                            </span>
                            <span style={{ color: NUC.faint, display: 'flex', flexShrink: 0 }}><Icons.chev size={15} stroke={1.6}/></span>
                          </button>
                        ))}
                      </NucCard>
                    </TendinaGruppo>
                  ))}
                </div>
              )}
            </>
          )}

          {totalPalestra === 0 && <div className="j-empty">{t('Nessuna sessione registrata')}</div>}
        </>
      )}

      {statsTab === 'hyrox' && (
        <>
          {/* 1 km e 500 m separati: la stessa scelta dell'elenco esercizi, così
              passare da una schermata all'altra non cambia i numeri sotto il dito. */}
          <FormatoSwitch valore={formatoHyrox} onChange={onFormatoHyrox} etichette={['1 km', '500 m']} style={{ marginBottom: 14 }}/>

          <NucEyebrow right={formatoHyrox === 'mezzo' ? t('Mezza distanza') : undefined}>{t('Tempi per esercizio')}</NucEyebrow>
          <NucCard pad={16} style={{ marginBottom: 16 }}>
            {/* Ogni riga apre il grafico dell'esercizio, come i record dei pesi. */}
            {hyroxStats.map(({ id, n, hist, bestSec, avgSec }, idx) => (
              <button key={id} type="button" onClick={() => setHyroxAperto(id)}
                className="w-full flex justify-between items-center gap-2.5 py-2.5 bg-transparent border-none cursor-pointer text-left"
                style={{ borderBottom: idx < hyroxStats.length - 1 ? '1px solid var(--hairline-soft)' : 'none', paddingLeft: 0, paddingRight: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: NUC.ink, letterSpacing: -0.2 }}>{tData(n)}</div>
                  <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, marginTop: 2 }}>{t('{n} sess.', { n: hist.length })}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {bestSec !== null ? (
                    <>
                      <div style={{ fontFamily: NUC.label, fontSize: 14, color: NUC.accentSoft, letterSpacing: -0.5 }}>{fmtTime(bestSec)}</div>
                      {avgSec !== null && avgSec !== bestSec && (
                        <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint }}>{t('media {v}', { v: fmtTime(avgSec) })}</div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontFamily: NUC.label, fontSize: 14, color: NUC.faint }}>—</div>
                  )}
                </div>
                <div style={{ color: NUC.faint, display: 'flex', flexShrink: 0 }}><Icons.chev size={16} stroke={1.6}/></div>
              </button>
            ))}
          </NucCard>


          {totalHyrox === 0 && <div className="j-empty">{t('Nessuna sessione hyrox registrata')}</div>}
        </>
      )}

      {selectedEx && <ExStatsModal ex={selectedEx} onClose={() => setSelectedEx(null)}/>}
      {hyroxSel && <HyroxStatsModal ex={hyroxSel} hist={hyroxSel.hist} onClose={() => setHyroxAperto(null)}/>}
    </div>
  )
}

// ── Traguardi ──────────────────────────────────────────────────
// Le medaglie sono DERIVATE dallo storico (vedi gymStrength): niente da salvare,
// niente da sincronizzare, e una medaglia non può mai contraddire i dati che la
// motivano. Quelle chiuse restano visibili in grigio — un traguardo che non si
// vede finché non lo centri non è un traguardo, è una sorpresa.
function AchievementsSection({ exercises, bodyWeight }: { exercises: PalestraExercise[]; bodyWeight: number }) {
  const t = useT()
  const list = useMemo(() => achievements(exercises, bodyWeight), [exercises, bodyWeight])
  const sbloccati = list.filter(a => a.unlockedAt !== null).length

  return (
    <>
      <NucEyebrow right={`${sbloccati}/${list.length}`}>{t('Traguardi')}</NucEyebrow>
      <div className="flex flex-col gap-1.5" style={{ marginBottom: 16 }}>
        {list.map(a => {
          const on = a.unlockedAt !== null
          return (
            <NucCard key={a.id} pad={14}>
              <div className="flex items-center gap-3.5">
                <div style={{
                  width: 52, height: 52, flexShrink: 0, borderRadius: 'var(--radius)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: on ? 'var(--surface-2)' : 'transparent',
                  border: `1px ${on ? 'solid' : 'dashed'} ${on ? 'var(--j-accent)' : 'var(--hairline)'}`,
                  // Chiusa: la coppa è una sagoma grigia, senza l'accent. È la
                  // differenza che si legge da lontano, prima ancora del testo.
                  color: on ? 'var(--j-accent-ink)' : 'var(--fg-mute)',
                }}>
                  <Icons.trophy size={28} stroke={on ? 1.5 : 1.3}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: NUC.font, fontSize: 14, color: on ? NUC.ink : 'var(--fg-mute)' }}>{t(a.title)}</div>
                  <div style={{
                    fontFamily: NUC.label, fontSize: 10.5, letterSpacing: '.03em',
                    color: on ? 'var(--j-accent-ink)' : NUC.faint, marginTop: 4, lineHeight: 1.45,
                  }}>
                    {on ? t(a.phrase) : t(a.goal, a.goalVars)}
                  </div>
                  {on && a.unlockedAt && (
                    <div style={{ fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: NUC.faint, marginTop: 4 }}>
                      {fmtShortDate(a.unlockedAt)}
                    </div>
                  )}
                </div>
              </div>
            </NucCard>
          )
        })}
      </div>
    </>
  )
}

// ── Pagina grafici di un esercizio ─────────────────────────────
function ExerciseChartsPage({ ex, onBack, muscleColors }: {
  ex: PalestraExercise; onBack: () => void; muscleColors: Record<string, string>
}) {
  const t = useT()
  const tData = useTData()
  // Già ridotto alla parte che questo esercizio fa sollevare (vedi quotaCorpo).
  const bodyWeight = useBodyWeight() * quotaCorpo(ex)
  const dark = useIsDark()
  const hist = useMemo(() => sortedHistory(ex.history), [ex.history])
  const color = exColor(ex, muscleColors)
  // Le ascisse sono il TEMPO: la data dell'alzata. Prima sotto ogni punto stava
  // il valore del punto stesso — il grafico ripeteva i propri numeri e non diceva
  // mai quando fossero stati fatti.
  // Giorno e mese, senza anno: la serie è cronologica, l'anno è ridondante e
  // costava tre caratteri per punto — cioè le date diradate una sì e due no.
  const { kgs, oneRMs, colpi, dates } = useMemo(() => ({
    kgs:    hist.map(h => effectiveLoad(h, bodyWeight)),
    oneRMs: hist.map(h => Math.round(entry1RM(h, bodyWeight))),
    colpi:  hist.map(colpiMigliori),
    dates:  hist.map(h => h.date ? fmtDayMonth(h.date) : h.d),
  }), [hist, bodyWeight])
  // Un esercizio che non va a chili (addominali, polpacci senza zavorra) si
  // legge a colpi: i grafici del carico sarebbero due righe piatte sullo zero.
  const soloColpi = aColpi(ex) && kgs.every(k => k === 0)

  // I due grafici avevano l'accent e la sua variante soffusa: affiancati sulla
  // stessa pagina si leggevano come lo stesso colore. `--chart-2` è un token
  // pensato per restare distinto in tutti e cinque i temi.
  const charts = soloColpi ? [
    {
      show: colpi.length >= 2, label: t('Colpi'),
      sub: t('la serie più lunga, sessione per sessione'),
      data: colpi, c: 'var(--j-accent)',
    },
  ] : [
    {
      show: kgs.length >= 2, label: t('Carico (kg)'),
      sub: t('il peso sul bilanciere, sessione per sessione'),
      data: kgs, c: 'var(--j-accent)',
    },
    {
      show: oneRMs.length >= 2, label: t('Massimale stimato (kg)'),
      sub: t('quanto alzeresti per una singola: tiene conto anche dei colpi'),
      data: oneRMs, c: 'var(--chart-2)',
    },
  ]
  const any = charts.some(c => c.show)

  // Miglior alzata = massimale stimato più alto: kg e colpi finiscono nello stesso
  // numero, così 50×8 e 40×15 sono confrontabili. A parità vince la più recente,
  // perché `hist` è ordinato per data e il `>=` tiene l'ultima.
  const metro = (h: PalestraHistoryEntry) => soloColpi ? colpiMigliori(h) : entry1RM(h, bodyWeight)
  const best = hist.length
    ? hist.reduce((b, h) => metro(h) >= metro(b) ? h : b)
    : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-6 pb-4 flex-shrink-0" style={{ position: 'relative' }}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="j-btn-back"><Icons.chevL size={16} stroke={2}/></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: NUC.font, fontSize: 22, fontWeight: 500, lineHeight: 1.15, color: NUC.ink }}>{tData(ex.n)}</div>
            <div className="j-eyebrow mt-0.5" style={{ color: accentInkFor(color, dark) }}>{t('Andamento')} · {t('{n} sessioni', { n: hist.length })}</div>
          </div>
        </div>
      </div>
      <div className="j-scroll-area">
        {/* La miglior alzata sta qui e non nel dettaglio. Lì occupava la prima
            schermata con un numero che non cambia quasi mai, e spingeva sotto la
            piega lo storico — che è la cosa che si viene a vedere. Qui è in casa
            sua: questa pagina risponde a "come sto andando", e il record è la
            prima riga di quella risposta. */}
        <NucCard pad={14} style={{ marginBottom: 22 }}>
          <NucEyebrow style={{ marginBottom: 7 }}>{t('Miglior alzata')}</NucEyebrow>
          {best ? (
            <>
              <div style={{ fontFamily: NUC.label, fontSize: 22, color: NUC.accentSoft, letterSpacing: -0.5, lineHeight: 1 }}>
                {best.sets_n}×{fmtReps(best)} – {fmtKg(best)}
              </div>
              <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, letterSpacing: 0.4, marginTop: 7 }}>
                {soloColpi
                  ? t('Serie migliore: {n} colpi', { n: colpiMigliori(best) })
                  : `${best.maxLift ? t('Massimale') : t('Massimale stimato')} ${Math.round(entry1RM(best, bodyWeight))} kg`} · {hist.length === 1 ? t('1 sessione') : t('{n} sessioni', { n: hist.length })}
                {best.date ? ` · ${fmtShortDate(best.date)}` : ''}
              </div>
            </>
          ) : (
            <div style={{ fontFamily: NUC.label, fontSize: 16, color: NUC.faint }}>{t('Nessuna alzata registrata')}</div>
          )}
        </NucCard>

        {!any && <div className="j-empty">{t('Servono almeno 2 sessioni per visualizzare i grafici')}</div>}
        {charts.filter(c => c.show).map(c => (
          <div key={c.label} style={{ marginBottom: 22 }}>
            <NucEyebrow>{c.label}</NucEyebrow>
            <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, letterSpacing: 0.3, marginTop: -4, marginBottom: 8, paddingLeft: 2 }}>{c.sub}</div>
            <NucCard pad={14}>
              <LineChart data={c.data} labels={dates} pointLabels={c.data.map(String)} height={180} color={c.c} labelSize={11} yAxis/>
            </NucCard>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Pagina dettaglio esercizio (storico, PR, azioni) ───────────
function ExerciseDetail({ ex, onBack, onLog, onUpdate, onDelete, onOpenCharts, muscleColors, onSaveMuscleColor, noteCoach = [] }: {
  ex: PalestraExercise; onBack: () => void; onLog: () => void
  onUpdate: (changes: Partial<PalestraExercise>, opzioni?: OpzioniModificaEsercizio) => void
  onDelete: () => void
  onOpenCharts: () => void
  /** Le note che gli allenatori hanno scritto su QUESTO esercizio. */
  noteCoach?: NotaCoach[]
  muscleColors: Record<string, string>
  onSaveMuscleColor: (muscle: string, color: string | undefined) => void
}) {
  const t = useT()
  const tData = useTData()
  // Già ridotto alla parte che questo esercizio fa sollevare (vedi quotaCorpo).
  const bodyWeight = useBodyWeight() * quotaCorpo(ex)
  const dark = useIsDark()
  // Ordinato per data: lo storico viene letto E riscritto da questa vista, quindi
  // l'ordinamento si normalizza anche su disco e gli indici restano coerenti.
  const hist = useMemo(() => sortedHistory(ex.history), [ex.history])
  const [histOpen, setHistOpen] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [editHistEntry, setEditHistEntry] = useState<{ entry: PalestraHistoryEntry; idx: number } | null>(null)
  const { confirmDelete } = useConfirmDelete()
  const color = exColor(ex, muscleColors)
  const foto = fotoEsercizio(ex.n)

  // `current` è il prefill dei prossimi log: dopo aver cancellato o modificato
  // l'ultima sessione restava sui valori vecchi (o su quelli appena eliminati).
  const withCurrent = (history: PalestraHistoryEntry[]) => {
    const last = history[history.length - 1]
    return last
      ? { history, current: { kg: last.kg, reps: last.reps, sets_n: last.sets_n } }
      : { history }
  }

  const deleteHistEntry = (idx: number) => {
    onUpdate(withCurrent(hist.filter((_, i) => i !== idx)))
  }

  // Ricominciare da zero senza perdere l'esercizio: dopo uno stop lungo, o un
  // cambio di esecuzione, lo storico vecchio falsa massimale e miglior alzata, ma
  // cancellarlo alzata per alzata voleva dire una conferma per riga e alla fine
  // restava comunque da ricreare l'esercizio. `current` torna vuoto, così il
  // prossimo log non parte pre-compilato sui carichi di prima.
  const clearHistory = () => confirmDelete(
    () => onUpdate({ history: [], current: { kg: 0, reps: 0, sets_n: 0 } }),
    ex.n,
    {
      eyebrow: t('Svuota memoria'),
      title: t('Azzerare lo storico?'),
      body: t('Cancelli tutte le {n} alzate di “{nome}”. L’esercizio resta, con il suo nome, il gruppo muscolare e il colore: riparti da zero. L’azione è definitiva.', { n: hist.length, nome: tData(ex.n) }),
      cta: t('Sì, azzera'),
    },
  )

  // L'avviso generico ("Stai per eliminare X") taceva la parte che fa male: con
  // l'esercizio se ne vanno tutte le sue alzate, e quelle fatte da una scheda
  // spariscono anche dallo storico di quella scheda. Qui si dice quante sono e
  // da quali schede.
  const eliminaEsercizio = () => {
    // Le schede da cui vengono le alzate, lette dalle alzate stesse: così ci
    // sono anche quelle di un allenatore (che nello store non stanno), e non
    // quelle che l'esercizio lo nominano senza averlo mai fatto fare.
    const schede = [...new Set(hist.map(h => h.scheda?.nome).filter((n): n is string => !!n))].map(n => `«${n}»`)
    const corpo = hist.length === 0
      ? t('Cancelli “{nome}”. L’azione è definitiva.', { nome: tData(ex.n) })
      : schede.length
        ? t('Cancelli “{nome}” con le sue {n} alzate: spariscono anche dallo storico di {schede}. L’azione è definitiva.', { nome: tData(ex.n), n: hist.length, schede: schede.join(', ') })
        : t('Cancelli “{nome}” con le sue {n} alzate. L’azione è definitiva.', { nome: tData(ex.n), n: hist.length })
    confirmDelete(onDelete, ex.n, {
      eyebrow: t('Elimina'), title: t('Eliminare l’esercizio?'), body: corpo, cta: t('Elimina'),
    })
  }

  const { kgs, kgLabels } = useMemo(() => ({
    kgs: hist.map(h => effectiveLoad(h, bodyWeight)),
    kgLabels: hist.map(h => h.date ? fmtDayMonth(h.date) : h.d),
  }), [hist, bodyWeight])
  // A colpi e non a chili: vedi ExerciseChartsPage.
  const soloColpi = aColpi(ex) && kgs.every(k => k === 0)
  const colpi = useMemo(() => hist.map(colpiMigliori), [hist])
  // Lo storico si legge dalla più recente; l'indice vero viaggia con l'alzata,
  // perché modifica ed eliminazione lavorano su `hist` in ordine cronologico.
  const dalPiuRecente = useMemo(() => hist.map((h, idx) => ({ h, idx })).reverse(), [hist])
  // Per ogni alzata: quanto è cambiato il carico dalla volta prima, e se quel
  // giorno è stato un record. Stesso indice di `hist`.
  const andamento = useMemo(() => andamentoStorico(hist, bodyWeight, soloColpi), [hist, bodyWeight, soloColpi])

  return (
    <>
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-6 pb-4 flex-shrink-0" style={{ position: 'relative' }}>
        <div className="flex items-center gap-3">
                    <button onClick={onBack} className="j-btn-back">
            <Icons.chevL size={16} stroke={2}/>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: NUC.font, fontSize: 22, fontWeight: 500, lineHeight: 1.15, letterSpacing: 0, color: NUC.ink }}>{tData(ex.n)}</div>
            <div className="j-eyebrow mt-0.5" style={{ color: accentInkFor(color, dark) }}>{ex.muscle2 ? `${tData(displayMuscle(ex.muscle))} · ${tData(displayMuscle(ex.muscle2))}` : tData(displayMuscle(ex.muscle))}</div>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <button onClick={() => setShowEdit(true)} aria-label={t('Modifica esercizio')} style={{
              width: 34, height: 34, borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)', border: '1px solid var(--hairline)',
              color: NUC.faint, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icons.pencil size={14} stroke={1.8}/>
            </button>
            {/* Il reset sta quassù, accanto al cestino, e non più sotto "Nuova
                alzata": a un pollice di distanza dal tasto che si preme a ogni
                serie era troppo facile da prendere per sbaglio. Rosso come il
                cestino, perché come il cestino cancella; chiede comunque conferma. */}
            {hist.length > 0 && (
              <button onClick={clearHistory} title={t('Svuota lo storico, tieni l’esercizio')} aria-label={t('Reset alzate')} style={{
                width: 34, height: 34, borderRadius: 'var(--radius-sm)',
                background: 'rgba(var(--segnale-giu-rgb),0.08)', border: '1px solid rgba(var(--segnale-giu-rgb),0.45)',
                color: 'var(--segnale-giu)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><Icons.refresh size={14} stroke={1.8}/></button>
            )}
            <button onClick={eliminaEsercizio} aria-label={t('Elimina esercizio')} style={{
              width: 34, height: 34, borderRadius: 'var(--radius-sm)',
              background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.18)',
              color: 'var(--danger)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Icons.trash size={14} stroke={1.6}/></button>
          </div>
        </div>
      </div>

      <div className="j-scroll-area">
        {/* I due comandi, uno sopra l'altro e larghi uguale. Il reset era un
            quadrato di fianco al CTA: stessa altezza e stesso rosso di un tasto
            primario per un'azione che si fa una volta l'anno. Sotto e basso un
            terzo pesa quanto deve — si trova quando lo si cerca, non si preme per
            sbaglio al posto di "Nuova alzata". */}
        {/* La miniatura dell'esercizio, sopra il comando che lo registra. È la
            stessa immagine della griglia da cui si è arrivati: serve a confermare
            di essere nel posto giusto — con trenta nomi che si somigliano
            ("Croci ai cavi alti", "Croci ai cavi bassi") la figura lo dice prima
            del titolo. Chi non ha una foto tiene il disegno del gruppo, come nella
            griglia: nessun esercizio resta senza.
            Alta in `dvh` e non in pixel: è decorazione, e su un telefono basso deve
            cedere il posto allo storico, che è il contenuto. */}
        {/* Il riquadro largo quanto la pagina serve solo a dare un posto al
            trend: l'immagine è quadrata e sta al centro, e ai suoi lati resta
            del vuoto. In basso a sinistra, a filo col fondo dell'immagine e
            quindi subito sopra "Nuova alzata", ci sta una freccia — si vede
            arrivando, senza doverla cercare sotto lo storico. */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
        {hist.length > 0 && <TrendAlzate valori={soloColpi ? colpi : hist.map(h => entry1RM(h, bodyWeight))}/>}
        <div style={{
          // Quadrata e centrata, non una fascia a tutta larghezza: stesa su 350px e
          // alta 170 tagliava a metà un'immagine che è quadrata — nel riquadro
          // restava il busto, senza testa né ginocchia. La misura la dà l'altezza
          // dello schermo, con un tetto perché è pur sempre decorazione: sotto c'è
          // lo storico, che è il contenuto.
          // Un po' più piccola di com'era (24dvh, fino a 220px): è una conferma
          // di essere nel posto giusto, e lo storico sotto deve salire.
          width: 'min(100%, clamp(96px, 19dvh, 176px))',
          aspectRatio: '1 / 1',
          margin: '0 auto',
          borderRadius: 'var(--radius)',
          background: 'var(--surface-2)', border: '1px solid var(--hairline)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          // `overflow: hidden` non è solo per la figura troppo grande: è quello
          // che fa seguire alla fotografia gli angoli smussati del riquadro.
          overflow: 'hidden', color,
        }}>
          {foto
            // alt vuoto: il nome dell'esercizio è il titolo qui sopra, e ripeterlo
            // farebbe sentire la stessa cosa due volte a chi usa il lettore di schermo.
            ? <img src={foto} alt="" decoding="async"
                   style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
            : <MuscleIcon muscle={ex.muscle} size={96} style={{ height: '78%', width: 'auto', maxWidth: '60%' }}/>}
        </div>
        </div>

        <button onClick={onLog} className="j-btn-accent" style={{ width: '100%', marginBottom: 16 }}>
          <Icons.plus size={16} stroke={2}/> {t('Nuova alzata')}
        </button>

        <button onClick={() => setHistOpen(o => !o)} className="w-full flex items-center justify-between px-0.5 bg-transparent border-none cursor-pointer" style={{ marginBottom: histOpen ? 10 : 16 }}>
          <div className="j-eyebrow">{t('Sessioni')}</div>
          <div className="flex items-center gap-1.5">
            <div className="j-eyebrow" style={{ fontVariantNumeric: 'tabular-nums' }}>{hist.length}</div>
            <div style={{ color: NUC.faint, transform: histOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              <Icons.chev size={12} stroke={2}/>
            </div>
          </div>
        </button>

        {histOpen && hist.length === 0 && <div className="j-empty">{t('Nessuna sessione registrata')}</div>}

        {/* Per mese, senza la riga dell'anno; aperto solo il mese più recente
            (vedi Cronologia). */}
        {histOpen && hist.length > 0 && (
          <Cronologia
            anni={false}
            voci={dalPiuRecente}
            dataDi={v => v.h.date}
            chiaveDi={v => v.idx}
            conta={n => n === 1 ? t('1 sessione') : t('{n} sessioni', { n })}
            voce={({ h, idx: realIdx }) => (
              // La data è il punto dell'elenco; accanto, i chili — che sono ciò
              // che si viene a leggere, e per questo sono il testo più grande
              // della riga — e sotto di quanto sono cambiati dalla volta prima.
              <div className="flex items-start gap-3" style={{ padding: '11px 0', borderBottom: '1px solid var(--hairline-soft)' }}>
                <DataPunto iso={h.date} ripiego={h.d}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-baseline" style={{ gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: NUC.label, fontSize: 13.5, color: NUC.dim, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {h.sets_n} × {fmtReps(h)}
                    </span>
                    <span aria-hidden="true" style={{ color: NUC.faint }}>·</span>
                    <span style={{ fontFamily: NUC.font, fontSize: 20, fontWeight: 600, lineHeight: 1.1, letterSpacing: -0.3, color: NUC.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {fmtKgVerso(h)}
                    </span>
                  </div>
                  <SegnaleCarico
                    variazione={andamento[realIdx]?.variazione ?? null}
                    record={andamento[realIdx]?.record}
                    primo={realIdx === 0}
                    massimale={!!h.maxLift}
                  />
                  {h.note && <div style={{ fontFamily: NUC.label, fontSize: 11, color: NUC.dim, marginTop: 5, lineHeight: 1.45, fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>{h.note}</div>}
                  {/* I numeri non sono più quelli scritti da me: va detto. */}
                  {h.correttaDa && <div style={{ fontFamily: NUC.label, fontSize: 10, color: 'var(--j-accent-ink)', marginTop: 4 }}>{t('corretta da {chi}', { chi: h.correttaDa })}</div>}
                </div>
                {/* Il massimale (stimato, o dichiarato) di quel giorno: un numero
                    solo, nel colore dell'azione. `--j-accent-ink` e non
                    `NUC.accentSoft`: quest'ultimo è tarato per stare SU una
                    superficie accent, e come testo sulla carta si ferma a 4.0:1. */}
                <div
                  title={soloColpi ? t('Serie migliore') : h.maxLift ? t('Massimale') : t('Massimale stimato')}
                  style={{ flexShrink: 0, alignSelf: 'center', minWidth: 30, textAlign: 'right', fontFamily: NUC.label, fontSize: 16, fontWeight: 600, color: 'var(--j-accent-ink)', letterSpacing: -0.3, fontVariantNumeric: 'tabular-nums' }}
                >
                  {soloColpi ? colpiMigliori(h) : Math.round(entry1RM(h, bodyWeight))}
                </div>
                <div style={{ alignSelf: 'center' }}>
                  <MenuAzioni
                    etichetta={t('Azioni sull’alzata')}
                    azioni={[
                      { nome: t('Modifica'), icona: <Icons.pencil size={14} stroke={1.8}/>, onClick: () => setEditHistEntry({ entry: h, idx: realIdx }) },
                      { nome: t('Elimina'), icona: <Icons.trash size={14} stroke={1.6}/>, pericolo: true, onClick: () => confirmDelete(() => deleteHistEntry(realIdx), t('Alzata')) },
                    ]}
                  />
                </div>
              </div>
            )}
          />
        )}

        {kgs.length >= 2 ? (
          <>
            {/* Niente titolo sopra: che sia il carico lo dice la scala, e il tasto
                sotto dice dove porta. "Scopri di più" era una pillola accanto a
                un titolo — due cose da leggere per un'azione sola. */}
            <div onClick={onOpenCharts} style={{ cursor: 'pointer', marginTop: 16 }}>
              <NucCard pad={12}>
                <LineChart data={soloColpi ? colpi : kgs} labels={kgLabels} height={96} color="var(--j-accent)" yAxis labelSize={9}/>
              </NucCard>
            </div>
            <button onClick={onOpenCharts} className="j-btn-log" style={{ marginTop: 8, marginBottom: 16 }}>
              <Icons.chart size={15} stroke={1.8}/> {t('Visualizza grafico andamento')}
            </button>
          </>
        ) : (
          hist.length > 0 && <div className="j-empty" style={{ marginTop: 4 }}>{t('Registra almeno 2 alzate per vedere i grafici')}</div>
        )}

        <NoteEsercizio
          nota={ex.note ?? ''}
          onSalva={nota => onUpdate({ note: nota || undefined })}
          daCoach={noteCoach}
        />
      </div>
    </div>
    <EditExModal open={showEdit} onClose={() => setShowEdit(false)} ex={ex} onSave={onUpdate} onSaveMuscleColor={onSaveMuscleColor}/>
    {editHistEntry && (
      <EditHistoryModal
        entry={editHistEntry.entry}
        riferimentoKg={caricoDiRiferimento(hist.filter((_, i) => i !== editHistEntry.idx))}
        onClose={() => setEditHistEntry(null)}
        onSave={updated => {
          const newHist = sortedHistory(hist.map((h, i) => i === editHistEntry.idx ? updated : h))
          onUpdate(withCurrent(newHist))
          setEditHistEntry(null)
        }}
      />
    )}
    </>
  )
}

// ── Trend delle alzate ─────────────────────────────────────────
// Una freccia sola accanto all'immagine dell'esercizio, per capire a colpo
// d'occhio se si sta salendo o scendendo senza leggere le righe una per una.
// È un'informazione da un'occhiata: la freccia e la parola, nient'altro — la
// frase che la spiega ("in miglioramento", "in calo") resta per il lettore di
// schermo e al passaggio del mouse.
//
// Si guarda il massimale stimato — l'unico numero che mette sullo stesso piano
// 80 kg × 5 e 70 kg × 10 — e si confronta l'ultima alzata con la media delle tre
// prima. Una sola alzata di confronto farebbe cambiare la freccia a ogni giornata
// storta. Sotto l'1,5% di differenza è "invariato": un chilo in più o in meno su
// un massimale da 100 è rumore, non una tendenza.
const TREND_SOGLIA = 0.015
const TREND_MIN_SESSIONI = 3

function trendAlzate(valori: number[]): 'su' | 'giu' | 'piatto' {
  const v = valori.filter(x => x > 0)
  if (v.length < TREND_MIN_SESSIONI) return 'piatto'
  const ultima = v[v.length - 1]
  const prima = v.slice(-4, -1)
  const media = prima.reduce((s, x) => s + x, 0) / prima.length
  const delta = (ultima - media) / media
  return delta > TREND_SOGLIA ? 'su' : delta < -TREND_SOGLIA ? 'giu' : 'piatto'
}

function TrendAlzate({ valori }: { valori: number[] }) {
  const t = useT()
  // Con meno di tre alzate non c'è una tendenza da dire, e una freccia piatta
  // lì direbbe "invariato" di qualcosa che non è ancora cominciato.
  if (valori.filter(x => x > 0).length < TREND_MIN_SESSIONI) return null
  const verso = trendAlzate(valori)
  const colore = verso === 'su' ? 'var(--segnale-su)' : verso === 'giu' ? 'var(--segnale-giu)' : NUC.faint
  const rotazione = verso === 'su' ? -90 : verso === 'giu' ? 90 : 0
  const descrizione = verso === 'su' ? t('in miglioramento') : verso === 'giu' ? t('in calo') : t('invariato')
  return (
    <div
      className="flex items-center gap-1.5"
      style={{ position: 'absolute', left: 2, bottom: 2 }}
      role="img" aria-label={`${t('Trend')}: ${descrizione}`} title={`${t('Trend')}: ${descrizione}`}
    >
      <span style={{ color: colore, display: 'flex', transform: `rotate(${rotazione}deg)` }}>
        <Icons.arrow size={18} stroke={2.4}/>
      </span>
      <span style={{ fontFamily: NUC.label, fontSize: 9.5, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: colore }}>{t('Trend')}</span>
    </div>
  )
}

// Le note dell'esercizio: l'appunto che si tiene per sé — la posizione del
// sedile, la presa, "scendere lento". Stava nell'intestazione, minuscolo e in
// sola lettura: si vedeva ma non si poteva scrivere se non entrando in modifica
// esercizio, cioè nel posto dove si cambia il nome.
//
// Salva quando il campo perde il fuoco e non a ogni tasto: un appunto si scrive
// tutto d'un fiato, e salvare a ogni lettera vorrebbe dire un giro di sync per
// carattere battuto.
function NoteEsercizio({ nota, onSalva, daCoach = [] }: {
  nota: string
  onSalva: (n: string) => void
  /** Quelle dell'allenatore: si leggono, non si scrivono. */
  daCoach?: NotaCoach[]
}) {
  const t = useT()
  const [testo, setTesto] = useState(nota)
  // Se la nota cambia da fuori (modifica esercizio, sync dal cloud) il campo la
  // segue — ma solo quando non lo si sta scrivendo, altrimenti il salvataggio
  // remoto cancellerebbe la frase a metà.
  const [attivo, setAttivo] = useState(false)
  useEffect(() => { if (!attivo) setTesto(nota) }, [nota, attivo])

  // Due colonne sulla stessa riga quando c'è anche l'allenatore: sono due voci
  // diverse sullo stesso esercizio, e affiancate si legge subito chi ha detto
  // cosa. Da soli, i propri appunti prendono tutta la larghezza — metà riga
  // vuota accanto direbbe che manca qualcosa.
  const conCoach = daCoach.length > 0

  return (
    <div style={{ marginTop: 4 }}>
      {/* L'etichetta e il campo sulla stessa riga: un appunto è una riga o due,
          e un riquadro alto tre righe sotto un titolo occupava mezza schermata
          vuota. Alto fisso e senza maniglia: la dimensione non si tira, il testo
          lungo scorre dentro. */}
      <div style={{ display: 'grid', gridTemplateColumns: conCoach ? 'auto 1fr 1fr' : 'auto 1fr', gap: 10, alignItems: 'start' }}>
        <div className="j-eyebrow" style={{ paddingTop: conCoach ? 24 : 12 }}>{t('Note')}</div>
        <div>
          {conCoach && (
            <div style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: NUC.faint, marginBottom: 5 }}>
              {t('Le tue')}
            </div>
          )}
          <textarea
            value={testo}
            onChange={e => setTesto(e.target.value)}
            onFocus={() => setAttivo(true)}
            onBlur={() => { setAttivo(false); if (testo !== nota) onSalva(testo.trim()) }}
            // Due parole, non una frase: quella lunga andava a capo dentro un
            // campo alto una riga e restava tagliata a metà, storta rispetto al
            // bordo. Piccolo e velato lo fa `.j-nota-campo` (un segnaposto non
            // si può vestire dallo stile in linea).
            placeholder={t('Esecuzione, modalità…')}
            aria-label={t('Note dell’esercizio')}
            rows={1}
            className="j-field j-nota-campo"
            style={{
              // Interlinea in pixel e non in proporzione: il segnaposto è più
              // piccolo del testo, e con un'interlinea relativa la sua riga
              // sarebbe più bassa — cioè lui starebbe più in alto del centro.
              width: '100%', height: 38, minHeight: 38, maxHeight: 38, padding: '8px 12px',
              resize: 'none', overflowY: 'auto', lineHeight: '20px', fontSize: 14,
              fontFamily: NUC.font, display: 'block',
            }}
          />
        </div>

        {daCoach.map(n => (
          <div key={n.coach_id}>
            <div style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--j-accent-ink)', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {n.coach_name?.trim() || t('Allenatore')}
            </div>
            {/* Non è un campo: è la voce di qualcun altro. Il fondo acceso e il
                bordo accent lo dicono senza doverlo scrivere. */}
            <div style={{
              minHeight: 38, padding: '8px 12px', boxSizing: 'border-box', borderRadius: 'var(--radius)',
              background: 'color-mix(in srgb, var(--j-accent) 7%, var(--surface))',
              border: '1px solid var(--j-accent)',
              fontFamily: NUC.font, fontSize: 14, lineHeight: 1.5,
              color: NUC.ink, whiteSpace: 'pre-wrap',
            }}>{n.nota}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// La vista (elenco o griglia) e il suo default vivono in vistaEsercizi.ts: qui
// resta solo il gancio che la tiene in memoria.
//
// In localStorage e non nello store: è una preferenza del dispositivo, come
// l'ordine dei widget della home. Su un telefono si scorre un elenco, su un
// desktop si abbraccia una griglia, e portarsi la scelta dall'uno all'altro
// sarebbe un dispetto invece che una comodità. Il logout non la tocca — porta
// via solo il blob dei dati — quindi la scelta sopravvive al prossimo accesso.
// Intera o mezza distanza, per tutta la sezione Hyrox. Come la vista griglia/
// elenco sta in localStorage: è il modo in cui ti alleni in questo periodo, non
// un dato da portare fra dispositivi. Un valore sconosciuto torna a "intero".
const FORMATO_HYROX_KEY = 'jarvis-formato-hyrox'
function useFormatoHyrox(): [FormatoHyrox, (f: FormatoHyrox) => void] {
  const [formato, setFormato] = useState<FormatoHyrox>(
    () => readStorage('local', FORMATO_HYROX_KEY) === 'mezzo' ? 'mezzo' : 'intero',
  )
  const cambia = (f: FormatoHyrox) => { setFormato(f); writeStorage('local', FORMATO_HYROX_KEY, f) }
  return [formato, cambia]
}

function useVistaEsercizi(chiave: string = VISTA_KEY): [VistaEsercizi, (v: VistaEsercizi) => void] {
  const [vista, setVista] = useState<VistaEsercizi>(() => vistaIniziale(readStorage('local', chiave)))
  const cambia = (v: VistaEsercizi) => { setVista(v); writeStorage('local', chiave, v) }
  return [vista, cambia]
}
// L'interruttore fra le due viste: due icone, non due parole. Sta nell'occhiello
// di sezione, dove ci sono già gli altri interruttori dell'app.
function VistaSwitch({ valore, onChange }: { valore: VistaEsercizi; onChange: (v: VistaEsercizi) => void }) {
  const t = useT()
  const cella = (v: VistaEsercizi, etichetta: string, icona: JSX.Element) => {
    const on = v === valore
    return (
      <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={on} aria-label={etichetta}
        className="j-switch-cell" style={{
          // `minWidth` e non `width`: le celle sono `flex: 1` (tutte larghe
          // uguale, o il cursore non si fermerebbe mai dove deve), e una
          // larghezza fissa verrebbe ignorata senza nemmeno dare la misura.
          minWidth: 'clamp(26px, 7.5vw, 32px)', height: 'clamp(22px, 6.5vw, 27px)', padding: 0,
        }}>{icona}</button>
    )
  }
  return (
    // La griglia sta a SINISTRA perché è la vista di partenza: in un interruttore a
    // due stati il primo posto è di quello predefinito, e leggere da sinistra
    // l'alternativa prima della norma faceva sembrare l'elenco la scelta normale.
    <div className="j-switch" style={cursore(valore === 'griglia' ? 0 : 1, 2)}>
      {cella('griglia', t('Vedi in griglia'), <Icons.grid size={13} stroke={1.9}/>)}
      {cella('elenco',  t('Vedi in elenco'),  <Icons.list size={13} stroke={1.9}/>)}
    </div>
  )
}

// I gruppi hanno tre viste: il carosello (la nuova, di partenza) e le due
// "vecchio stile", griglia ed elenco. Stesso interruttore, una cella in più.
function useVistaGruppi(): [VistaGruppi, (v: VistaGruppi) => void] {
  const [vista, setVista] = useState<VistaGruppi>(() => vistaGruppiIniziale(readStorage('local', VISTA_GRUPPI_KEY)))
  const cambia = (v: VistaGruppi) => { setVista(v); writeStorage('local', VISTA_GRUPPI_KEY, v) }
  return [vista, cambia]
}
function VistaGruppiSwitch({ valore, onChange }: { valore: VistaGruppi; onChange: (v: VistaGruppi) => void }) {
  const t = useT()
  const opts: Array<[VistaGruppi, string, JSX.Element]> = [
    ['carosello', t('Vedi a carosello'), <Icons.carosello key="c" size={13} stroke={1.9}/>],
    ['griglia',   t('Vedi in griglia'),  <Icons.grid key="g" size={13} stroke={1.9}/>],
    ['elenco',    t('Vedi in elenco'),   <Icons.list key="l" size={13} stroke={1.9}/>],
  ]
  return (
    <div className="j-switch" style={cursore(opts.findIndex(([v]) => v === valore), opts.length)}>
      {opts.map(([v, etichetta, icona]) => (
        <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={v === valore} aria-label={etichetta}
          className="j-switch-cell" style={{ minWidth: 'clamp(26px, 7.5vw, 32px)', height: 'clamp(22px, 6.5vw, 27px)', padding: 0 }}>
          {icona}
        </button>
      ))}
    </div>
  )
}

// La griglia delle card, una sola per gruppi ed esercizi: hanno la stessa forma e
// devono avere lo stesso passo. La colonna minima è a sua volta elastica — su un
// telefono stretto scende a 88px e ne entrano tre, su uno schermo grande sale a
// 128 e le card non diventano francobolli allineati a decine.
// Le card sono più STRETTE di prima, e non è un vezzo: è così che la griglia sta
// in una schermata senza scorrere. Le illustrazioni degli esercizi sono tutte
// 512×512, cioè quadrate, e un riquadro quadrato le mostra intere — quindi
// l'altezza di una card È la sua larghezza, e l'unico modo di abbassare le righe
// è restringere le colonne. A parità di spazio quattro colonne da 82px occupano
// tre righe dove tre colonne da 111px ne occupavano quattro.
//
// Il tentativo precedente faceva il contrario: teneva le colonne larghe e
// schiacciava il riquadro con un tetto in altezza. Funzionava per lo scorrimento e
// rompeva le figure — un'immagine quadrata dentro un riquadro 4:3 con `cover`
// viene tagliata sopra e sotto, cioè esattamente dove stanno la testa e i piedi.
const GRIGLIA: React.CSSProperties = {
  display: 'grid',
  // Il tetto è basso apposta. `vw` misura la FINESTRA, non la colonna: da desktop
  // questa griglia vive nella colonna di sinistra dello split, larga 460px, e
  // 18.5vw lì dentro vale mezzo schermo — quindi a decidere è sempre il massimo.
  // A 104px la colonna ne teneva tre da 134, cioè quattro righe; a 92 ne tiene
  // quattro e le righe tornano tre.
  gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(64px, 18.5vw, 92px), 1fr))',
  gap: 'clamp(5px, 1.2dvh, 9px)',
}

// La fascia illustrata in cima a ogni card, gruppi ed esercizi.
//
// Quadrata, e deve restarlo: le foto degli esercizi sono 512×512, e in un riquadro
// quadrato `objectFit: cover` non ritaglia NIENTE — il rapporto coincide. Basta
// che il riquadro si allarghi o si stringa di un filo perché `cover` cominci a
// mangiare i bordi dell'illustrazione, che è dove stanno la testa e i piedi.
// A tenere la griglia dentro una schermata è la larghezza della colonna (vedi
// GRIGLIA), non un tetto in altezza su questo riquadro.
const FASCIA: React.CSSProperties = {
  width: '100%', aspectRatio: '1 / 1', minHeight: 0,
  background: 'var(--surface-2)', borderBottom: '1px solid var(--divider)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
}

// Il blocco di testo sotto la fascia: anche il suo respiro segue l'altezza dello
// schermo, o su un telefono basso si riprenderebbe ciò che la fascia ha ceduto.
const TESTO_CARD: React.CSSProperties = {
  padding: 'clamp(4px, 0.7dvh, 8px) 8px clamp(5px, 0.9dvh, 9px)',
  minWidth: 0, width: '100%',
}

// Le tre card dei comandi in home: l'altezza, e dove sta il disegno. Il disegno
// è in alto a destra e largo quanto la card lascia — ma mai tanto da scendere
// sul nome, che sta in basso: su un telefono largo e basso a comandare è
// l'altezza (58px è il posto del nome col suo respiro).
const ALTEZZA_AZIONE = 'clamp(118px, 18.5dvh, 168px)'
const DISEGNO_AZIONE: React.CSSProperties = {
  position: 'absolute', top: 'clamp(8px, 2.6vw, 12px)', right: 'clamp(7px, 2.2vw, 11px)',
  width: `min(clamp(70px, 23vw, 96px), calc(${ALTEZZA_AZIONE} - 58px))`, height: 'auto',
  pointerEvents: 'none',
}

// ── La card e la riga "+" ──────────────────────────────────────
// Aggiungere un gruppo o un esercizio era un tasto nell'intestazione, lontano
// dalle cose che creava e uguale per tutta la pagina: dalla griglia dei gruppi
// creava un ESERCIZIO, e bisognava saperlo. Adesso l'azione sta dentro l'elenco a
// cui appartiene, in prima posizione, con la stessa forma delle altre — così si
// legge come "e qui ne aggiungi uno", non come un comando a parte.
//
// Prima e non in fondo: in fondo a trentotto esercizi non la trova nessuno.
function CardNuovo({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="j-hard j-focus"
      aria-label={label}
      style={{
        minWidth: 0, borderRadius: 'var(--radius)', cursor: 'pointer', overflow: 'hidden',
        background: 'var(--surface-2)',
        // Tratteggiato: è un posto vuoto da riempire, non una cosa che c'è già.
        border: '1px dashed var(--hairline)',
        padding: 0, display: 'flex', flexDirection: 'column', textAlign: 'left',
        color: 'var(--j-accent-ink)',
      }}
    >
      <div style={{ ...FASCIA, background: 'transparent', borderBottom: 'none' }}>
        <Icons.plus size={34} stroke={1.5} style={{ width: 'clamp(20px, 5dvh, 34px)', height: 'auto' }}/>
      </div>
      <div style={TESTO_CARD}>
        {/* Su due righe e non troncata: i nomi dei gruppi sono parole sole
            ("Petto", "Dorso") e in una riga ci stanno, questa etichetta ne ha due e
            in tre colonne diventava "NUOVO ESERCI…". */}
        <div style={{
          fontFamily: NUC.font, fontSize: 'clamp(10.5px, 2.9vw, 12.5px)', fontWeight: 600, color: NUC.ink,
          textTransform: 'uppercase', letterSpacing: '.02em', lineHeight: 1.15,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{label}</div>
      </div>
    </button>
  )
}

function RigaNuovo({ label, onClick, inFondo = false }: { label: string; onClick: () => void; inFondo?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full j-riga-gruppo j-focus"
      aria-label={label}
      style={{
        padding: '11px 12px', borderRadius: 'var(--radius)', textAlign: 'left', cursor: 'pointer',
        background: 'transparent', border: 'none',
        // Il tratteggio sta fra la riga "+" e l'elenco, quindi cambia lato con lei.
        ...(inFondo
          ? { borderTop: '1px dashed var(--hairline)' }
          : { borderBottom: '1px dashed var(--hairline)' }),
        color: 'var(--j-accent-ink)',
      }}
    >
      <div style={{ display: 'flex', flexShrink: 0, width: 'clamp(22px, 7vw, 28px)', justifyContent: 'center' }}>
        <Icons.plus size={20} stroke={1.8}/>
      </div>
      <div style={{
        flex: 1, minWidth: 0,
        fontFamily: NUC.font, fontSize: 'clamp(13px, 3.6vw, 15px)', fontWeight: 500, color: NUC.ink,
        textTransform: 'uppercase', letterSpacing: '.01em', lineHeight: 1.1,
      }}>{label}</div>
    </button>
  )
}

// Elenco: le righe unite in una scheda sola, come i gruppi muscolari. Erano card
// staccate con un margine fra l'una e l'altra, e sei esercizi occupavano lo
// schermo che ne basta a dodici.
function ElencoEsercizi({ esercizi, color, onApri, onNuovo }: {
  esercizi: PalestraExercise[]; color: string; onApri: (ex: PalestraExercise) => void
  onNuovo: () => void
}) {
  const t = useT()
  const tData = useTData()
  return (
    <div className="j-hard-flat" style={{
      background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', overflow: 'hidden',
    }}>
      <RigaNuovo label={t('Nuovo esercizio')} onClick={onNuovo}/>
      {esercizi.map((ex, i) => {
        const last = ultimaVoce(ex.history)
        return (
          <button
            key={ex.id}
            onClick={() => onApri(ex)}
            className="flex items-center gap-3 w-full j-riga-gruppo"
            style={{
              padding: '11px 12px', borderRadius: 'var(--radius)', textAlign: 'left', cursor: 'pointer',
              background: 'transparent', border: 'none',
              borderTop: i === 0 ? 'none' : '1px solid var(--hairline-soft)',
              borderLeft: `3px solid ${color}`,
            }}
          >
            {/* La figura anche in elenco, a sinistra del nome. In griglia c'era
                già (è la fascia in cima alla card) e qui no: fra le due viste
                cambiava cosa si RICONOSCE — in griglia la foto, in elenco solo
                una fila di nomi — e su trenta esercizi il nome è la cosa più
                lenta da leggere. È la stessa `FacciaEsercizio` della scheda,
                quindi ovunque compaia un esercizio compare la stessa immagine. */}
            <FacciaEsercizio nome={ex.n} muscolo={ex.muscle} lato={40}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: NUC.font, fontSize: 15, fontWeight: 500, color: NUC.ink, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tData(ex.n)}</div>
              <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.04em', color: NUC.faint, marginTop: 2 }}>
                {last ? `${last.sets_n}×${fmtReps(last)} · ${fmtKg(last)}` : t('Nessuna alzata')}
              </div>
            </div>
            <div style={{ color: NUC.faint, display: 'flex', flexShrink: 0 }}><Icons.chev size={16} stroke={1.6}/></div>
          </button>
        )
      })}
    </div>
  )
}

// Griglia: una card per esercizio, con una fascia illustrata in cima e il testo
// sotto sulla carta — la forma della scheda di un catalogo.
//
// Nella fascia va la foto dell'esercizio, quando ce l'ha (vedi eserciziFoto.ts:
// il file si chiama come l'esercizio, la cartella è src/assets/esercizi). Chi non
// ce l'ha tiene il disegno del gruppo muscolare, ed è per questo che il disegno
// non se ne va: è l'unica figura che l'app può garantire per OGNI esercizio,
// compreso quello che uno si inventa stasera e che nessuna fotografia può
// coprire in anticipo.
//
// Il giro precedente di foto era stato tolto proprio qui (la nota è in
// catalogo.ts): venivano da un dataset che copriva trentasette esercizi su una
// lista che cresce, e la griglia restava metà fotografica e metà disegnata senza
// una regola visibile. Foto scattate nella palestra di chi usa l'app cambiano il
// conto: coprono TUTTO il catalogo di partenza, e il disegno resta solo dove
// significa qualcosa — "questo esercizio te lo sei aggiunto tu".
function GrigliaEsercizi({ esercizi, color, onApri, onNuovo }: {
  esercizi: PalestraExercise[]; color: string; onApri: (ex: PalestraExercise) => void
  onNuovo: () => void
}) {
  const t = useT()
  const tData = useTData()
  return (
    <div style={GRIGLIA}>
      <CardNuovo label={t('Nuovo esercizio')} onClick={onNuovo}/>
      {esercizi.map(ex => {
        const last = ultimaVoce(ex.history)
        const foto = fotoEsercizio(ex.n)
        return (
          <button
            key={ex.id}
            onClick={() => onApri(ex)}
            className="j-hard"
            style={{
              minWidth: 0, borderRadius: 'var(--radius)', cursor: 'pointer', overflow: 'hidden',
              background: 'var(--surface)', border: '1px solid var(--hairline)',
              borderLeft: `3px solid ${color}`,
              padding: 0, display: 'flex', flexDirection: 'column', textAlign: 'left',
            }}
          >
            <div style={{ ...FASCIA, color }}>
              {foto
                // alt vuoto di proposito: il nome dell'esercizio è scritto qui
                // sotto: con l'alt pieno chi usa il lettore di schermo se lo
                // sentirebbe due volte di fila.
                ? <img src={foto} alt="" decoding="async"
                       style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
                // Stessa regola della griglia dei gruppi: la figura è una quota del
                // riquadro, non una misura fissa. Qui sta più bassa perché è un
                // ripiego — l'esercizio senza foto — non il soggetto della card.
                : <MuscleIcon muscle={ex.muscle} size={52} style={{ height: '52%', width: 'auto', maxWidth: '64%' }}/>}
            </div>
            <div style={TESTO_CARD}>
              <div style={{
                fontFamily: NUC.font, fontSize: 12.5, fontWeight: 500, color: NUC.ink,
                lineHeight: 1.15,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>{tData(ex.n)}</div>
              <div style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.06em', color: NUC.faint, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {last ? fmtKg(last) : t('Mai allenato')}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Elenco dei gruppi muscolari ─────────────────────────
// Una scheda sola con dentro tutti i gruppi, non otto card staccate.
// Erano due componenti diversi — una griglia di quadrati su desktop, righe
// distanziate su telefono — e in entrambi i casi otto rettangoli separati
// occupavano uno schermo e mezzo per dire una cosa che è un elenco. Uniti in un
// blocco si leggono in un colpo d'occhio, e la distinzione fra i gruppi la fa
// quello che già la faceva: il colore, l'icona, il nome.
//
// L'ombra sta sulla SCHEDA e non sulle righe: dentro un contenitore che è già
// sollevato, otto rilievi in fila si annullerebbero a vicenda. Alla riga il tocco
// lo segnala il fondo, che cambia sotto il dito.
function ElencoGruppi({ gruppi, muscleColors, icone, onApri, onNuovo }: {
  gruppi: Array<{ muscle: string; items: PalestraExercise[] }>
  muscleColors: Record<string, string>
  icone: Record<string, string>
  onApri: (muscle: string) => void
  onNuovo: () => void
}) {
  const t = useT()
  const tData = useTData()
  return (
    <div className="j-hard-flat" style={{
      background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)',
      overflow: 'hidden',
    }}>
      {gruppi.map(({ muscle, items }, i) => {
        const color = muscleColors[muscle] ?? muscleColors.Altro
        return (
          <button
            key={muscle}
            onClick={() => onApri(muscle)}
            className="flex items-center gap-3 w-full j-riga-gruppo"
            style={{
              padding: '11px 12px', borderRadius: 'var(--radius)', textAlign: 'left', cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              borderTop: i === 0 ? 'none' : '1px solid var(--hairline-soft)',
              // Il filetto colorato è ciò che resta della card di prima: è lui a
              // dire di che gruppo si tratta prima ancora che si legga il nome.
              borderLeft: `3px solid ${color}`,
            }}
          >
            <div style={{ color, display: 'flex', flexShrink: 0 }}>
              <MuscleIcon muscle={muscle} icon={icone[muscle]} size={36} stroke={1.5}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: NUC.font, fontSize: 15, fontWeight: 500, color: NUC.ink, textTransform: 'uppercase', letterSpacing: '.01em', lineHeight: 1.1 }}>{tData(muscle)}</div>
              <div style={{ fontFamily: NUC.label, fontSize: 8.5, letterSpacing: '.08em', color: NUC.faint, marginTop: 2, textTransform: 'uppercase' }}>
                {items.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: items.length })}
              </div>
            </div>
            <div style={{ color: NUC.faint, display: 'flex', flexShrink: 0 }}><Icons.chev size={16} stroke={1.6}/></div>
          </button>
        )
      })}
      {/* In fondo, non in cima. Qui non vale la ragione per cui "Nuovo esercizio"
          sta in testa (in fondo a trentotto esercizi non lo trova nessuno): i
          gruppi sono otto o poco più e si vedono tutti senza scorrere, quindi
          messo per primo era solo una riga da scavalcare ogni volta per arrivare
          al gruppo che si cercava davvero. */}
      <RigaNuovo label={t('Nuovo gruppo')} onClick={onNuovo} inFondo={gruppi.length > 0}/>
    </div>
  )
}

// Griglia dei gruppi: la stessa forma della griglia degli esercizi — fascia
// illustrata in cima, testo sotto — con il disegno del gruppo al posto della foto.
function GrigliaGruppi({ gruppi, muscleColors, icone, onApri, onNuovo }: {
  gruppi: Array<{ muscle: string; items: PalestraExercise[] }>
  muscleColors: Record<string, string>
  icone: Record<string, string>
  onApri: (muscle: string) => void
  onNuovo: () => void
}) {
  const t = useT()
  const tData = useTData()
  return (
    <div style={GRIGLIA}>
      {gruppi.map(({ muscle, items }) => {
        const color = muscleColors[muscle] ?? muscleColors.Altro
        return (
          <button
            key={muscle}
            onClick={() => onApri(muscle)}
            className="j-hard"
            style={{
              minWidth: 0, borderRadius: 'var(--radius)', cursor: 'pointer', overflow: 'hidden',
              background: 'var(--surface)', border: '1px solid var(--hairline)',
              borderLeft: `3px solid ${color}`,
              padding: 0, display: 'flex', flexDirection: 'column', textAlign: 'left',
            }}
          >
            <div style={{ ...FASCIA, color }}>
              {/* La figura è alta il 66% del riquadro invece di 84px fissi. Il
                  riquadro è quadrato e largo quanto la colonna: su un telefono a
                  tre colonne fa ~100px, e una figura di 84 lo riempiva da bordo a
                  bordo — era quello a farla sembrare sovradimensionata, non la
                  misura in sé. In percentuale la griglia si legge uguale ovunque:
                  su desktop, dove i riquadri sono più larghi, l'icona cresce con
                  loro invece di restare una macchiolina in mezzo al vuoto.
                  `size` resta come misura di ripiego per il ramo senza CSS (il
                  manubrio dei gruppi sconosciuti ha un viewBox quadrato). */}
              <MuscleIcon muscle={muscle} icon={icone[muscle]} size={84} style={{ height: '66%', width: 'auto', maxWidth: '76%' }}/>
            </div>
            <div style={TESTO_CARD}>
              <div style={{
                fontFamily: NUC.font, fontSize: 12.5, fontWeight: 600, color: NUC.ink,
                textTransform: 'uppercase', letterSpacing: '.02em', lineHeight: 1.15,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{tData(muscle)}</div>
              <div style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.06em', color: NUC.faint, marginTop: 3, textTransform: 'uppercase' }}>
                {items.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: items.length })}
              </div>
            </div>
          </button>
        )
      })}
      {/* Ultima, come nell'elenco: vedi il commento lì sopra. */}
      <CardNuovo label={t('Nuovo gruppo')} onClick={onNuovo}/>
    </div>
  )
}

// I gruppi muscolari della home: l'occhiello con il contatore, la riga del
// catalogo e il carosello (o la griglia, o l'elenco).
//
// A parte perché la card in vista (`cardGruppo`) cambia a ogni scorrimento, e
// finché stava in JarvisGym ogni card agganciata ridisegnava tutta la home —
// testata, settimana, menù, modali, ricerca. Qui cambia solo questa sezione.
function SezioneGruppi({ gruppi, totaleEsercizi, mancanti, onAggiungiCatalogo, coloriPieni, muscleColors, icone, onApri, onNuovo }: {
  gruppi: Array<{ muscle: string; items: PalestraExercise[] }>
  totaleEsercizi: number
  mancanti: number
  onAggiungiCatalogo: () => void
  coloriPieni: Record<string, string>
  muscleColors: Record<string, string>
  icone: Record<string, string>
  onApri: (muscle: string) => void
  onNuovo: () => void
}) {
  const t = useT()
  const [vistaGruppi, setVistaGruppi] = useVistaGruppi()
  // La card del carosello in vista: sta qui perché il "1 / 8" si scrive accanto
  // al titolo della sezione, fuori dal carosello.
  const [cardGruppo, setCardGruppo] = useState(0)
  return (
    <>
      <NucEyebrow right={
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {vistaGruppi === 'carosello' && gruppi.length > 0 && (
            <span aria-live="polite" style={{ letterSpacing: '.08em' }}>
              {Math.min(cardGruppo, gruppi.length - 1) + 1} / {gruppi.length}
            </span>
          )}
          <VistaGruppiSwitch valore={vistaGruppi} onChange={setVistaGruppi}/>
        </span>
      }>
        {vistaGruppi === 'carosello'
          ? t('Gruppi muscolari')
          : <>{t('Gruppi muscolari')} · {t('{n} esercizi', { n: totaleEsercizi })}</>}
      </NucEyebrow>
      {/* Il catalogo entra da solo al primo accesso, ma chi aveva già un
          profilo quel passaggio non lo rivede più: senza questa riga i
          trentasette esercizi — e le loro foto — restavano irraggiungibili
          per tutti gli account già avviati. Compare finché ne manca almeno
          uno e sparisce quando non manca più niente. */}
      {mancanti > 0 && (
        <button onClick={onAggiungiCatalogo} className="j-hard" style={{
          width: '100%', marginBottom: 12, padding: '11px 13px', borderRadius: 'var(--radius)',
          background: 'var(--surface)', border: '1px solid var(--hairline)',
          display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', textAlign: 'left',
        }}>
          <span style={{ color: 'var(--j-accent-ink)', display: 'flex', flexShrink: 0 }}>
            <Icons.plus size={17} stroke={2}/>
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 13.5, color: NUC.ink }}>
              {t('Aggiungi gli esercizi di base')}
            </span>
            <span style={{ display: 'block', fontFamily: NUC.label, fontSize: 10, letterSpacing: '.04em', color: NUC.faint, marginTop: 2 }}>
              {mancanti === 1 ? t('Ne manca 1, con la sua immagine') : t('Ne mancano {n}, con la loro immagine', { n: mancanti })}
            </span>
          </span>
          <Icons.chev size={15} stroke={1.6} color={NUC.faint}/>
        </button>
      )}
      {vistaGruppi === 'carosello' ? (
        <CaroselloGruppi
          gruppi={gruppi}
          colori={coloriPieni}
          icone={icone}
          indice={cardGruppo}
          onIndice={setCardGruppo}
          onApri={onApri}
          onNuovo={onNuovo}
        />
      ) : vistaGruppi === 'elenco' ? (
        <ElencoGruppi
          gruppi={gruppi}
          muscleColors={muscleColors}
          icone={icone}
          onApri={onApri}
          onNuovo={onNuovo}
        />
      ) : (
        <GrigliaGruppi
          gruppi={gruppi}
          muscleColors={muscleColors}
          icone={icone}
          onApri={onApri}
          onNuovo={onNuovo}
        />
      )}
    </>
  )
}

// ── Pagina di un gruppo muscolare (i suoi esercizi) ────────────
function MuscleDetailPage({ muscle, color, icona, exercises, onBack, onSelectExercise, onAddExercise, onElimina }: {
  muscle: string; color: string; icona?: string; exercises: PalestraExercise[]
  onBack: () => void
  onSelectExercise: (ex: PalestraExercise) => void
  onAddExercise: () => void
  /** Eliminare il gruppo. C'è solo per un gruppo creato dall'utente e vuoto:
   *  quelli di serie non si tolgono, e uno con dentro degli esercizi li
   *  lascerebbe senza casa. */
  onElimina?: () => void
}) {
  const t = useT()
  const tData = useTData()
  const dark = useIsDark()
  const { confirmDelete } = useConfirmDelete()
  // Elenco o griglia. La scelta resta in localStorage e non nello store cloud: è
  // il modo in cui si guarda una lista su QUESTO schermo — sul telefono si scorre,
  // sul desktop si abbraccia — non un dato da portarsi dietro fra dispositivi.
  const [vista, setVista] = useVistaEsercizi()
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-6 pb-4 flex-shrink-0" style={{ position: 'relative' }}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="j-btn-back"><Icons.chevL size={16} stroke={2}/></button>
          <div style={{ color, display: 'flex', flexShrink: 0 }}>
            <MuscleIcon muscle={muscle} icon={icona} size={34} stroke={1.6}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: NUC.font, fontSize: 24, fontWeight: 500, color: NUC.ink, textTransform: 'uppercase', letterSpacing: '.02em', lineHeight: 1.1 }}>{tData(muscle)}</div>
            <div className="j-eyebrow mt-0.5" style={{ color: accentInkFor(color, dark) }}>{exercises.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: exercises.length })}</div>
          </div>
          {onElimina && (
            <button onClick={() => confirmDelete(onElimina, tData(muscle))} aria-label={t('Elimina gruppo')} title={t('Elimina gruppo')} className="flex items-center justify-center" style={{
              width: 36, height: 36, flexShrink: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.18)', color: 'var(--danger)',
            }}>
              <Icons.trash size={15} stroke={1.6}/>
            </button>
          )}
        </div>
      </div>
      <div className="j-scroll-area">
        {/* Anche un gruppo vuoto mostra la lista: dentro c'è la card "+", che è
            come si aggiunge il primo esercizio. Prima qui c'era una frase che
            rimandava a un tasto ("aggiungine uno con +") ormai lontano dagli occhi. */}
        <NucEyebrow right={<VistaSwitch valore={vista} onChange={setVista}/>}>
          {exercises.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: exercises.length })}
        </NucEyebrow>
        {vista === 'elenco'
          ? <ElencoEsercizi esercizi={exercises} color={color} onApri={onSelectExercise} onNuovo={onAddExercise}/>
          : <GrigliaEsercizi esercizi={exercises} color={color} onApri={onSelectExercise} onNuovo={onAddExercise}/>}
      </div>
    </div>
  )
}

// L'allenamento è la schermata d'ingresso dell'app: non ha più un "indietro",
// perché sopra di lei non c'è niente. `onOpenUser` apre il profilo (nome, dati,
// peso), `onOpenProfile` le impostazioni: due porte diverse, vedi SalutoHeader.
export function JarvisGym({ onOpenCoach, onOpenProfile, onOpenUser }: {
  onOpenCoach: () => void
  onOpenProfile: () => void
  onOpenUser: () => void
}) {
  // Selettori granulari: ri-render solo al cambio dei campi palestra usati.
  const s = useJarvisStore(useShallow(st => ({
    hyroxExercises: st.hyroxExercises,
    palestraExercises: st.palestraExercises,
    muscleColors: st.muscleColors,
    customMuscles: st.customMuscles,
    hyroxGare: st.hyroxGare,
  })))
  const set = useJarvisStore.setState
  const t = useT()
  const bodyWeight = useBodyWeight()
  // Le foto degli esercizi, chieste in anticipo: vedi `precaricaFoto`.
  useEffect(() => { precaricaFoto() }, [])
  // `tab` è il mondo in cui si sta (pesi o hyrox); `stats` è la pagina delle
  // statistiche aperta sopra la home, come le schede (vedi `paginaStatistiche`).
  // Le statistiche sono sempre quelle del mondo in cui si è: dai pesi i pesi, da
  // Hyrox i tempi. Non c'è più un interruttore Pesi/Hyrox dentro: era lo stesso
  // dello switch in testata, ripetuto un piano più giù.
  const [tab, setTab] = useState<'palestra' | 'hyrox'>('palestra')
  const [stats, setStats] = useState(false)
  // Hyrox si apre sulla gara: il tempo stimato è la domanda con cui ci si entra.
  const [hyroxSubTab, setHyroxSubTab] = useState<'gara' | 'esercizi'>('gara')
  // Dentro Esercizi: le sessioni di allenamento, o i tempi delle gare registrate.
  const [vistaHyrox, setVistaHyrox] = useState<VistaHyrox>('sessioni')
  // La gara registrata aperta nel modale: 'nuova' per una da scrivere.
  const [garaAperta, setGaraAperta] = useState<HyroxGara | 'nuova' | null>(null)
  const { confirmDelete } = useConfirmDelete()
  const [logHyrox, setLogHyrox] = useState<HyroxExercise | null>(null)
  const [logPalestra, setLogPalestra] = useState<PalestraExercise | null>(null)
  const [records, setRecords] = useState<RecordItem[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<PalestraExercise | null>(null)
  const [showExerciseCharts, setShowExerciseCharts] = useState(false)
  // Le note che un allenatore ha scritto sui miei esercizi. Come le schede
  // assegnate: vivono in una tabella a parte, non nel blob, e se la tabella non
  // c'è ancora o la rete non risponde la schermata resta quella di sempre.
  const [noteCoach, setNoteCoach] = useState<NotaCoach[]>([])
  useEffect(() => {
    let vivo = true
    supabase.auth.getSession()
      .then(({ data }) => data.session ? noteRicevute(data.session.user.id) : [])
      .then(n => { if (vivo) setNoteCoach(n) })
      .catch(() => { /* nessuna nota: è il caso normale */ })
    return () => { vivo = false }
  }, [])
  // L'esercizio aperto è quello dello STORE, ritrovato per id: `selectedExercise`
  // ricorda solo quale. Tenendone una copia, su desktop — dove la scheda resta
  // aperta a destra mentre si fa altro — il pannello mostrava lo storico di
  // prima, e alla prima nota o correzione lo riscriveva nello store cancellando
  // l'alzata dell'allenamento fatto nel frattempo.
  const esercizioAperto = selectedExercise
    ? s.palestraExercises.find(e => e.id === selectedExercise.id) ?? null
    : null
  const [selectedHyrox, setSelectedHyrox] = useState<HyroxExercise | null>(null)
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null)
  // La scheda da aprire entrando nelle schede: la sceglie la ricerca, o la
  // barra dell'allenamento in corso — che ci entra dritta nell'allenamento
  // (`riprendi`).
  const [schedaDaAprire, setSchedaDaAprire] = useState<string | null>(null)
  const [riprendi, setRiprendi] = useState(false)
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null)
  const [showSchede, setShowSchede] = useState(false)
  const [showNuovoGruppo, setShowNuovoGruppo] = useState(false)
  const [formatoHyrox, setFormatoHyrox] = useFormatoHyrox()
  const [showRicercaGlobale, setShowRicercaGlobale] = useState(false)
  const apriNuovoGruppo = useCallback(() => setShowNuovoGruppo(true), [])
  const chiudiRicerca = useCallback(() => setShowRicercaGlobale(false), [])

  // Mappa risolta (default + override utente, desaturata in layout "Notte"). Il picker
  // di EditExModal riceve invece `s.muscleColors` raw: vedi sotto.
  const muscleColors = useMuscleColors()
  // Il carosello li vuole pieni anche in Premium: vedi CaroselloGruppi.
  const coloriPieni = useMemo(() => ({ ...MUSCLE_COLORS, ...(s.muscleColors ?? {}) }), [s.muscleColors])
  // Gli otto di serie più quelli creati qui dentro, e la figura che ciascuno dei
  // nuovi ha scelto di accendere.
  const gruppiNoti = useGruppiMuscolari()
  const iconeGruppi = useMuscleIcons()

  // Creare un gruppo è scrivere due cose in due posti diversi: il gruppo (nome +
  // figura) e il suo colore, che vive nella stessa mappa degli override dei gruppi
  // di serie. Un solo `set` per non lasciare mai un gruppo senza colore.
  const creaGruppo = ({ name, icon, color }: { name: string; icon: string; color: string }) => {
    set(st => ({
      customMuscles: [...(st.customMuscles ?? []), { name, icon }],
      muscleColors: { ...(st.muscleColors ?? {}), [name]: color },
    }))
    // Si entra subito nel gruppo appena creato: è vuoto, e lì dentro c'è la card
    // "+" per metterci il primo esercizio.
    setSelectedMuscle(name)
  }

  // Un gruppo creato e rimasto vuoto si può togliere: il gruppo e il suo colore
  // insieme, come sono nati.
  const eliminaGruppo = (name: string) => {
    set(st => {
      const mc = { ...(st.muscleColors ?? {}) }
      delete mc[name]
      return { customMuscles: (st.customMuscles ?? []).filter(c => c.name !== name), muscleColors: mc }
    })
    setSelectedMuscle(null)
  }

  const saveMuscleColor = (muscle: string, color: string | undefined) => {
    set(st => {
      const mc = { ...(st.muscleColors ?? {}) }
      if (color) mc[muscle] = color
      else delete mc[muscle]
      return { muscleColors: mc }
    })
  }

  const saveHyroxEntry = (ex: HyroxExercise, entry: HyroxHistoryEntry) => {
    // Inserimento ordinato: il form consente una data arretrata, che accodata
    // sarebbe letta come la sessione più recente.
    const updated = { ...ex, history: sortedHistory([...ex.history, entry]) }
    set(st => ({
      hyroxExercises: st.hyroxExercises.some(e => e.id === ex.id)
        ? st.hyroxExercises.map(e => e.id === ex.id ? updated : e)
        : [...st.hyroxExercises, updated],
    }))
    if (selectedHyrox?.id === ex.id) setSelectedHyrox(updated)
  }

  const updateHyroxExercise = (ex: HyroxExercise, changes: Partial<HyroxExercise>) => {
    const updated = { ...ex, ...changes }
    set(st => ({
      hyroxExercises: st.hyroxExercises.some(e => e.id === ex.id)
        ? st.hyroxExercises.map(e => e.id === ex.id ? updated : e)
        : [...st.hyroxExercises, updated],
    }))
    if (selectedHyrox?.id === ex.id) setSelectedHyrox(updated)
  }

  const gare = useMemo(() => s.hyroxGare ?? [], [s.hyroxGare])
  const salvaGara = (g: HyroxGara) => set(st => {
    const elenco = st.hyroxGare ?? []
    return { hyroxGare: elenco.some(x => x.id === g.id) ? elenco.map(x => (x.id === g.id ? g : x)) : [...elenco, g] }
  })
  const eliminaGara = (g: HyroxGara) => confirmDelete(
    () => set(st => ({ hyroxGare: (st.hyroxGare ?? []).filter(x => x.id !== g.id) })),
    g.tipo === 'gara' ? t('Gara') : t('Simulazione'),
  )
  // "Erano intere": le sessioni a metà di quel giorno tornano alla distanza di
  // gara. Il tempo non si tocca — era giusto, era la distanza a essere sbagliata.
  const correggiGiornata = (data: string) => set(st => ({
    hyroxExercises: st.hyroxExercises.map(e => ({ ...e, history: aDistanzaIntera(e.history, e.target, data) })),
  }))

  // La pagina di una stazione mostra una distanza alla volta (un 500 m e un
  // 1000 m non stanno sullo stesso grafico). Dall'elenco, che ora le mescola, la
  // si apre sulla distanza dell'ultima sessione: è quella appena vista sulla
  // card, e aprendo si deve ritrovare lei — non un "Nessuna sessione da 1000 m".
  const apriStazione = (ex: HyroxExercise) => {
    const ordinate = sortedHistory(ex.history)
    const ultima = ordinate[ordinate.length - 1]
    if (ultima) setFormatoHyrox(formatoSessione(ultima, ex.target))
    setSelectedHyrox(ex)
  }

  const deleteHyroxExercise = (ex: HyroxExercise) => {
    set(st => ({ hyroxExercises: st.hyroxExercises.filter(e => e.id !== ex.id) }))
    setSelectedHyrox(null)
  }

  const savePalestraEntry = (ex: PalestraExercise, entry: PalestraHistoryEntry) => {
    // Il confronto va fatto PRIMA di scrivere: dopo, l'alzata appena salvata
    // starebbe già nello storico e batterebbe sempre sé stessa.
    const rec = recordFor(ex.history, entry, bodyWeight * quotaCorpo(ex))
    if (rec) setRecords([{ name: ex.n, ...rec }])

    // Storico ordinato per data e `current` preso dalla sessione più RECENTE, non
    // da quella appena inserita: registrando una serie arretrata, il prefill dei
    // prossimi log non deve tornare indietro.
    const merge = (history: PalestraHistoryEntry[]) => {
      const sorted = sortedHistory([...history, entry])
      const last = sorted[sorted.length - 1]
      return { history: sorted, current: { kg: last.kg, reps: last.reps, sets_n: last.sets_n } }
    }
    // L'attrezzo scritto nell'alzata diventa quello dell'esercizio: lo si dice
    // una volta, e le alzate dopo — anche quelle fatte da una scheda — se lo
    // ritrovano. Svuotarlo lo toglie. Un'alzata a corpo libero non dice niente.
    const attrezzo = entry.bodyweight ? {} : { attrezzoKg: entry.attrezzo || undefined }
    set(st => ({ palestraExercises: st.palestraExercises.map(e =>
      e.id === ex.id ? { ...e, ...merge(e.history), ...attrezzo } : e
    )}))
  }

  // Le modifiche si applicano all'esercizio com'è ADESSO nello store, non alla
  // copia che aveva in mano chi ha chiamato.
  //
  // Un nome nuovo arriva anche alle righe delle schede collegate a questo
  // esercizio. Prima restava quello vecchio: la scheda mostrava un nome che
  // nell'elenco degli esercizi non c'era più, e chi lo riscriveva a mano nella
  // scheda scollegava la riga (vedi `cambiaNome` in GymSchede).
  const updatePalestraExercise = (ex: PalestraExercise, changes: Partial<PalestraExercise>, opzioni?: OpzioniModificaEsercizio) => {
    const nome = typeof changes.n === 'string' && changes.n.trim() && changes.n !== ex.n ? changes.n : null
    const applica = (e: PalestraExercise): PalestraExercise => {
      const nuovo = { ...e, ...changes }
      // L'attrezzo anche sulle alzate di prima, se è stato chiesto: sullo
      // storico com'è ADESSO, e non su quelle a corpo libero.
      if (opzioni?.attrezzoAncheAlleVecchie) {
        nuovo.history = nuovo.history.map(h => (h.bodyweight ? h : { ...h, attrezzo: nuovo.attrezzoKg || undefined }))
      }
      return nuovo
    }
    set(st => ({
      palestraExercises: st.palestraExercises.map(e => e.id === ex.id ? applica(e) : e),
      ...(nome ? {
        gymSchede: (st.gymSchede ?? []).map(sc => sc.exercises.some(r => r.linkedExerciseId === ex.id)
          ? { ...sc, exercises: sc.exercises.map(r => r.linkedExerciseId === ex.id ? { ...r, name: nome } : r) }
          : sc),
      } : {}),
    }))
  }

  // Con l'esercizio si scioglie anche il collegamento nelle schede che lo
  // usavano. Prima restava: la riga continuava a dirsi "collegata" a un id che
  // non esisteva più, e al primo allenamento ne nasceva un gemello vuoto senza
  // che il collegamento venisse mai riparato.
  const deletePalestraExercise = (ex: PalestraExercise) => {
    set(st => ({
      palestraExercises: st.palestraExercises.filter(e => e.id !== ex.id),
      gymSchede: (st.gymSchede ?? []).map(sc => sc.exercises.some(e => e.linkedExerciseId === ex.id)
        ? { ...sc, exercises: sc.exercises.map(e => {
            if (e.linkedExerciseId !== ex.id) return e
            // La riga collegata non portava scritto se era a corpo libero: lo
            // sapeva l'esercizio. Andandosene lui, glielo si lascia.
            const riga = { ...e, ...(corpoLibero(ex) ? { bodyweight: true } : {}) }
            delete riga.linkedExerciseId
            return riga
          }) }
        : sc),
    }))
    setSelectedExercise(null)
  }

  const addExercise = (ex: HyroxExercise | PalestraExercise) => {
    if (tab === 'hyrox') {
      set(st => ({ hyroxExercises: [...st.hyroxExercises, ex as HyroxExercise] }))
    } else {
      set(st => ({ palestraExercises: [...st.palestraExercises, ex as PalestraExercise] }))
    }
  }

  const filteredPalestra = useMemo(() => {
    let list = s.palestraExercises
    if (muscleFilter) list = list.filter(e => displayMuscle(e.muscle) === muscleFilter)
    return list
  }, [s.palestraExercises, muscleFilter])

  // Group filtered exercises by muscle for the collapsible accordion view
  const hasAny = s.palestraExercises.length > 0
  const groupedPalestra = useMemo(() => {
    const groups: Record<string, PalestraExercise[]> = {}
    // Seed con tutti i gruppi muscolari standard: così ogni account (anche
    // nuovo, senza esercizi) trova già tutte le card — seppur vuote — e
    // capisce subito a cosa serve la sezione.
    for (const m of gruppiNoti) groups[m] = []
    for (const ex of filteredPalestra) {
      const m = displayMuscle(ex.muscle)
      ;(groups[m] ??= []).push(ex)
    }
    const ordered = Object.keys(groups)
      .sort((a, b) => {
        const ia = gruppiNoti.indexOf(a), ib = gruppiNoti.indexOf(b)
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b)
      })
      .map(m => ({ muscle: m, items: groups[m] }))
    // Un gruppo vuoto ("Altro · 0 esercizi") occupa una riga per dire niente. Le
    // card vuote restano solo all'utente nuovo, dove sono l'onboarding di cui sopra.
    // Tranne quelli creati dall'utente: nascosto, un gruppo appena creato e non
    // ancora riempito spariva — e non si poteva né ritrovare né ricreare
    // ("esiste già").
    const creati = new Set((s.customMuscles ?? []).map(c => c.name))
    return hasAny ? ordered.filter(g => g.items.length > 0 || creati.has(g.muscle)) : ordered
  }, [filteredPalestra, hasAny, gruppiNoti, s.customMuscles])

  const raceStationData = useMemo<HyroxExercise[]>(() =>
    RACE_STATIONS.map(rs => ({
      ...rs,
      history: s.hyroxExercises.find(e => e.id === rs.id)?.history ?? [],
    })),
    [s.hyroxExercises]
  )
  const runStationData = useMemo<HyroxExercise>(() => ({
    ...RUNNING_STATION,
    history: s.hyroxExercises.find(e => e.id === RUNNING_STATION.id)?.history ?? [],
  }), [s.hyroxExercises])

  // Quanti esercizi del catalogo non ci sono ancora. Si ricalcola dallo store, non
  // da un flag "catalogo importato": chi ne cancella uno lo rivede offerto, che è
  // ciò che ci si aspetta da una riga che dice "ne mancano N".
  const mancanti = useMemo(() => esercizidaCatalogo(s.palestraExercises).length, [s.palestraExercises])
  const aggiungiCatalogo = () =>
    set(st => ({ palestraExercises: [...st.palestraExercises, ...esercizidaCatalogo(st.palestraExercises)] }))


  // Modali di log/aggiunta: uno solo per tipo, condiviso da tutti i rami di render
  // sotto. Erano ricopiati in ognuno — quattro punti da tenere allineati a mano per
  // modali che sono comunque chiusi finché il loro stato è null.
  // `presetMuscle` fa partire "Nuovo esercizio" già sul gruppo aperto, se c'è.
  const modals = (
    <>
      <LogHyroxModal
        open={!!logHyrox} onClose={() => setLogHyrox(null)}
        ex={logHyrox}
        formato={formatoHyrox}
        onFormato={setFormatoHyrox}
        onSave={entry => logHyrox && saveHyroxEntry(logHyrox, entry)}
      />
      <LogPalestraModal
        open={!!logPalestra} onClose={() => setLogPalestra(null)}
        ex={logPalestra}
        onSave={entry => logPalestra && savePalestraEntry(logPalestra, entry)}
      />
      <AddExModal
        open={showAdd} onClose={() => setShowAdd(false)}
        mode={tab} onAdd={addExercise}
        presetMuscle={selectedMuscle ?? undefined}
      />
      <RecordModal records={records} onClose={() => setRecords([])}/>
      <RegistraGaraModal
        open={garaAperta !== null} onClose={() => setGaraAperta(null)}
        gara={garaAperta === 'nuova' ? null : garaAperta}
        categoriaPredefinita={categoriaStima(gare) ?? 'double'}
        onSave={salvaGara}
      />
      <NuovoGruppoModal
        open={showNuovoGruppo} onClose={() => setShowNuovoGruppo(false)}
        onCrea={creaGruppo}
        esistenti={gruppiNoti}
      />
    </>
  )

  // ── Le pagine ───────────────────────────────────────────────────
  // Costruite come valori e non più come rami di `return`: su desktop due di
  // loro sono a video INSIEME (vedi SplitPane in fondo), e un `return` anticipato
  // può mostrarne una sola. Su telefono l'ordine di precedenza è lo stesso di
  // prima — la più profonda copre le altre.

  const paginaHyrox = selectedHyrox ? (() => {
    const isRace = RACE_IDS.has(selectedHyrox.id)
    return (
      <HyroxDetail
        ex={selectedHyrox}
        onBack={() => setSelectedHyrox(null)}
        onLog={() => setLogHyrox(selectedHyrox)}
        isRace={isRace}
        onDelete={isRace ? undefined : () => deleteHyroxExercise(selectedHyrox)}
        onUpdate={changes => updateHyroxExercise(selectedHyrox, changes)}
        formato={formatoHyrox}
        onFormato={setFormatoHyrox}
      />
    )
  })() : null

  const paginaEsercizio = esercizioAperto ? (
    showExerciseCharts ? (
      <ExerciseChartsPage
        ex={esercizioAperto}
        onBack={() => setShowExerciseCharts(false)}
        muscleColors={muscleColors}
      />
    ) : (
      <ExerciseDetail
        // Una pagina per esercizio, non una sola che cambia contenuto: aprendone
        // un altro lo storico riparte col solo mese più recente aperto, invece
        // di ereditare le tendine aperte su quello di prima.
        key={esercizioAperto.id}
        ex={esercizioAperto}
        onBack={() => { setSelectedExercise(null); setShowExerciseCharts(false) }}
        onLog={() => setLogPalestra(esercizioAperto)}
        onUpdate={(changes, opzioni) => updatePalestraExercise(esercizioAperto, changes, opzioni)}
        onDelete={() => deletePalestraExercise(esercizioAperto)}
        onOpenCharts={() => setShowExerciseCharts(true)}
        noteCoach={noteCoach.filter(n => n.exercise_id === esercizioAperto.id)}
        muscleColors={muscleColors}
        onSaveMuscleColor={saveMuscleColor}
      />
    )
  ) : null

  const paginaMuscolo = selectedMuscle ? (
    <MuscleDetailPage
      muscle={selectedMuscle}
      color={muscleColors[selectedMuscle] ?? muscleColors.Altro}
      icona={iconeGruppi[selectedMuscle]}
      exercises={s.palestraExercises.filter(e => displayMuscle(e.muscle) === selectedMuscle)}
      onBack={() => setSelectedMuscle(null)}
      onSelectExercise={ex => setSelectedExercise(ex)}
      onAddExercise={() => setShowAdd(true)}
      onElimina={
        (s.customMuscles ?? []).some(c => c.name === selectedMuscle)
        && !s.palestraExercises.some(e => displayMuscle(e.muscle) === selectedMuscle)
          ? () => eliminaGruppo(selectedMuscle)
          : undefined
      }
    />
  ) : null

  const paginaRadice = (
    // Il tetto di larghezza è per quando questa pagina è a TUTTA l'area di
    // contenuto — le statistiche su desktop (vedi sotto). Senza, i tab e le
    // quattro card dei comandi si stiravano per milletrecento pixel, e le barre
    // del volume diventavano righe lunghe un monitor. Dentro la colonna dello
    // split non ha effetto: lì la larghezza è già molto sotto.
    <div className="flex flex-col h-full overflow-hidden" style={{ width: '100%', maxWidth: 860, margin: '0 auto' }}>
      {/* Niente respiro sotto: quello che segue (le tre card dei comandi) porta
          già il suo margine sopra, e i due sommati staccavano la settimana dalle
          card più di quanto le card stiano staccate dal resto. */}
      <div className="j-page-header" style={{ paddingBottom: 0 }}>
        {/* Qui c'era "Allenamento · 38 esercizi in palestra", col tasto indietro
            verso una home che non esiste più: questa È la home. Al suo posto la
            testata dell'app — data, saluto e i tre comandi che valgono ovunque.
            Il "+" se n'è andato con lei: creare un gruppo o un esercizio adesso si
            fa dalla card "+" dentro l'elenco a cui appartiene (vedi CardNuovo), non
            da un tasto che faceva cose diverse a seconda della pagina. */}
        <SalutoHeader
          onSearch={() => setShowRicercaGlobale(true)}
          onUser={onOpenUser}
          onSettings={onOpenProfile}
        />
        <SettimanaStrip/>
        {/* L'allenamento lasciato aperto: resta qui finché non lo si termina,
            così chi è uscito a guardare altro lo ritrova senza cercarlo. Con
            le schede aperte sopra non si rilegge: è coperta. */}
        {!showSchede && !stats && (
          <InCorsoInHome
            onRiprendi={id => { setSchedaDaAprire(id); setRiprendi(true); setShowSchede(true) }}
            style={{ marginTop: 14, marginBottom: 8 }}
          />
        )}
        {/* «Pesi | Hyrox» c'è solo con Hyrox acceso (vedi hyroxAttivo): spento,
            l'app è solo palestra e un interruttore con una voce sola non
            commuta niente. */}
        {HYROX_ATTIVO && (
          <GymModeTabs value={tab} onChange={v => { setTab(v); setSelectedExercise(null); setShowExerciseCharts(false); setSelectedMuscle(null); setSelectedHyrox(null); setMuscleFilter(null) }}/>
        )}
      </div>

      <div className="j-scroll-area">
        {/* Il menù è dei pesi: in Hyrox Coach e Schede non hanno niente da fare, e
            Statistiche scende sotto Esercizi e Gara (vedi TastoStatistiche).
            Tutte e tre aprono una pagina sopra questa.
            Stanno QUI, in cima a ciò che scorre, e non più nella testata fissa:
            da quando sono alte il doppio, ferme lassù lasciavano ai gruppi
            muscolari meno di mezza schermata in cui scorrere. Così a riposo la
            pagina è la stessa, e scorrendo se ne vanno insieme al resto. */}
        {tab === 'palestra' && (
          <AzioniGym
            onCoach={onOpenCoach}
            onSchede={() => setShowSchede(true)}
            onStats={() => setStats(true)}
          />
        )}
        {/* Il menù di Hyrox: Esercizi e Gara, e sotto Statistiche. */}
        {tab === 'hyrox' && (
          <>
            <NucSubTabs
              options={[{ id: 'gara', label: t('Gara') }, { id: 'esercizi', label: t('Esercizi') }]}
              value={hyroxSubTab}
              onChange={id => setHyroxSubTab(id as 'gara' | 'esercizi')}
              style={{ marginBottom: 8 }}
            />
            <TastoStatistiche onClick={() => setStats(true)}/>
          </>
        )}

        {tab === 'hyrox' && (
          <>

            {hyroxSubTab === 'gara' && (
              <RaceSummary
                raceStations={raceStationData} runStation={runStationData}
                gare={gare} oggi={todayISO()}
                onRegistra={() => setGaraAperta('nuova')}
                onModifica={setGaraAperta}
                onElimina={eliminaGara}
                onApri={setSelectedHyrox}
                onCorreggiGiornata={correggiGiornata}
              />
            )}

            {hyroxSubTab === 'esercizi' && (
              <>
                {/* Gli esercizi come in palestra: da una parte quello che si
                    registra allenandosi (le sessioni), dall'altra i tempi fatti
                    nelle gare e nelle simulazioni registrate. Qui c'era
                    "1 km | 500 m": la distanza adesso è scritta su ogni riga, e
                    a sceglierla si è rimasti in due — il modale quando si
                    registra, la pagina della stazione quando si guarda lo storico. */}
                <FormatoSwitch<VistaHyrox>
                  valore={vistaHyrox} onChange={setVistaHyrox}
                  valori={['sessioni', 'gare']} etichette={[t('Sessioni'), t('Gare')]}
                  etichettaGruppo={t('Sessioni o gare')} style={{ marginBottom: 14 }}
                />

                {vistaHyrox === 'gare' ? (
                  <StazioniInGara raceStations={raceStationData} gare={gare} onRegistra={() => setGaraAperta('nuova')}/>
                ) : (
                  <>
                    <NucEyebrow>{t('Corsa')}</NucEyebrow>
                    <div onClick={() => apriStazione(runStationData)} style={{ cursor: 'pointer' }}>
                      <HyroxCard ex={runStationData} onLog={e => { e?.stopPropagation?.(); setLogHyrox(runStationData) }}/>
                    </div>

                    <div style={{ marginTop: 8 }}><NucEyebrow>{t('Stazioni gara')}</NucEyebrow></div>
                    {raceStationData.map(ex => (
                      <div key={ex.id} onClick={() => apriStazione(ex)} style={{ cursor: 'pointer' }}>
                        <HyroxCard ex={ex} onLog={e => { e?.stopPropagation?.(); setLogHyrox(ex) }}/>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
        {/* La riga larga "Schede d'allenamento" non è più qui: era in mezzo
            alla lista degli esercizi, cioè dentro il contenuto invece che
            fra i comandi. Adesso è la prima delle tre card sopra. */}
        {tab === 'palestra' && (
          <SezioneGruppi
            gruppi={groupedPalestra}
            totaleEsercizi={s.palestraExercises.length}
            mancanti={mancanti}
            onAggiungiCatalogo={aggiungiCatalogo}
            coloriPieni={coloriPieni}
            muscleColors={muscleColors}
            icone={iconeGruppi}
            onApri={setSelectedMuscle}
            onNuovo={apriNuovoGruppo}
          />
        )}
      </div>
    </div>
  )

  // Le statistiche: una pagina a sé, con la sua freccia per tornare. Erano un
  // interruttore — si toccava la card e il contenuto della home diventava i
  // grafici, sotto il saluto, la settimana e le tre card: restava mezza
  // schermata per leggerli, e per richiuderle bisognava risalire in cima a
  // ritoccare la card. Qui hanno tutta la pagina.
  // Si monta solo aperta: i grafici non si calcolano finché non li si guarda.
  const paginaStatistiche = stats ? (
    <div className="flex flex-col h-full overflow-hidden" style={{ width: '100%', maxWidth: 860, margin: '0 auto' }}>
      <div className="j-page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => setStats(false)} aria-label={t('Indietro')} className="j-btn-back"><Icons.back size={20} stroke={1.8}/></button>
          <div className="j-page-title" style={{ flex: 1, minWidth: 0 }}>{t('Statistiche')}</div>
        </div>
      </div>
      <div className="j-scroll-area">
        {/* Il riepilogo complessivo per primo: è la cosa che si guarda entrando
            — quanto ti sei allenato, quanto sei forte. Parla solo di pesi
            (settimana, mappa della forza, massimali): sotto Hyrox sarebbe un
            pannello di numeri non suoi. */}
        {tab === 'palestra' && <Riepilogo onOpenProfile={onOpenUser}/>}
        <GymStats
          exercises={s.palestraExercises} hyroxExercises={s.hyroxExercises}
          statsTab={tab === 'hyrox' ? 'hyrox' : 'pesi'} formatoHyrox={formatoHyrox} onFormatoHyrox={setFormatoHyrox}
        />
      </div>
    </div>
  ) : null

  // Un risultato della ricerca porta DOVE sta la cosa cercata: la scheda
  // dell'esercizio dentro il suo gruppo, la stazione hyrox, la scheda
  // d'allenamento. Prima chiudeva la ricerca e basta, lasciando a chi cercava
  // "Panca" il compito di andarsela a trovare.
  const apriDaRicerca = (cosa: Trovato) => {
    setStats(false)
    if (cosa.tipo === 'scheda') {
      setSchedaDaAprire(cosa.id)
      setShowSchede(true)
      return
    }
    if (cosa.tipo === 'esercizio') {
      const ex = s.palestraExercises.find(e => e.id === cosa.id)
      if (!ex) return
      setTab('palestra')
      setSelectedHyrox(null)
      setShowExerciseCharts(false)
      setSelectedMuscle(displayMuscle(ex.muscle))
      setSelectedExercise(ex)
      return
    }
    const stazione = cosa.id === runStationData.id ? runStationData
      : raceStationData.find(e => e.id === cosa.id) ?? s.hyroxExercises.find(e => e.id === cosa.id)
    if (!stazione) return
    setTab('hyrox')
    setSelectedExercise(null)
    setSelectedMuscle(null)
    setSelectedHyrox(stazione)
  }

  // Modali e ricerca globale stanno FUORI dalle pagine: su desktop la radice può
  // non essere a video (a sinistra c'è il gruppo aperto), e un modale montato
  // dentro di lei sparirebbe insieme a lei mentre è aperto.
  const contorno = (
    <>
      {modals}
      <GlobalSearch
        open={showRicercaGlobale}
        onClose={chiudiRicerca}
        onApri={apriDaRicerca}
      />
    </>
  )

  // A sinistra l'elenco su cui si sta navigando — i gruppi muscolari, oppure gli
  // esercizi del gruppo aperto — a destra la scheda di quello che si è scelto.
  // Su telefono SplitPane mostra solo lo strato più alto, che è il comportamento
  // di sempre.
  //
  // Le schede sono un mondo a sé, con la propria navigazione interna (elenco →
  // scheda → allenamento in corso): non si infilano in una delle due colonne, si
  // prendono la pagina. Si posano SOPRA la home invece di sostituirla, così
  // uscendone la home è ancora lì com'era (vedi Strato). Il tetto di larghezza
  // è lo stesso della radice — una scheda è un elenco di righe, e una riga lunga
  // un monitor non si legge.
  //
  // Le statistiche fanno lo stesso: sono grafici, non aprono niente di fianco,
  // e spartire lo schermo con una colonna vuota li stringerebbe a metà per
  // niente.
  return (
    <>
      <Strato coperto={showSchede || stats}>
        <SplitPane
          radice={paginaRadice}
          master={paginaMuscolo}
          detail={paginaEsercizio ?? paginaHyrox}
          vuoto={
            <SplitVuoto>
              {/* Dalla radice un esercizio non è ancora scegliibile: prima si apre un
                  gruppo. Dirlo qui evita l'invito a fare una cosa che non si può fare. */}
              {selectedMuscle
                ? t('Scegli un esercizio per vederne la scheda')
                : t('Apri un gruppo muscolare, poi un esercizio')}
            </SplitVuoto>
          }
        />
      </Strato>
      {paginaStatistiche && <Strato coperto={false}>{paginaStatistiche}</Strato>}
      {showSchede && (
        <Strato coperto={false}>
          <div style={{ width: '100%', maxWidth: 860, height: '100%', margin: '0 auto' }}>
            <GymSchede apri={schedaDaAprire ?? undefined} riprendi={riprendi} onBack={() => { setShowSchede(false); setSchedaDaAprire(null); setRiprendi(false) }}/>
          </div>
        </Strato>
      )}
      {contorno}
    </>
  )
}


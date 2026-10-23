// La scheda di un allievo, vista dall'allenatore.
//
// È una vista di sola lettura su un sottoinsieme dei dati altrui: quello che
// arriva da `athlete_training_data` e nient'altro (vedi supabase/coach_schema.sql
// per cosa il database lascia uscire e perché). Qui non si scrive niente — non
// c'è un solo `set` — e non è una scelta di comodo: un allenatore che modifica lo
// storico di un allievo produce un dato che l'allievo non riconosce più come suo.
//
// I calcoli sono gli STESSI della propria scheda (gymModel, gymStrength): due
// formule diverse per "quanto sei forte" a seconda di chi guarda sarebbero due
// app che non si parlano.
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { NucCard, NucEyebrow } from '@/components/ui/NucComponents'
import { CelleSettimana, type GiornoSettimana } from '@/features/dashboard/SettimanaStrip'
import { Icons } from '@/components/ui/Icons'
import { LineChart } from '@/features/gym/gymShared'
import { entryVolume, fmtVol, fmtKg, fmtReps, displayMuscle } from '@/features/gym/gymModel'
import { GIORNI_DI_STOP } from '@/features/gym/caricoConsigliato'
import { perMuscolo } from './gruppi'
import { TendinaGruppo } from './TendinaGruppo'
import { quotaCorpo, corpoLibero } from '@/features/gym/catalogo'
import { hyroxVisibili } from '@/features/gym/hyroxAttivo'
import { districtStrength } from '@/features/gym/gymStrength'
import { localISO } from '@/lib/isoDate'
import { fmtDayMonth, daysAbbr } from '@/lib/dateFormat'
import { useT, useTData, useLang } from '@/lib/i18n'
import type { AthleteData } from '@/lib/coach'
import type { NotaCoach } from '@/lib/coach'
import type { PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'

interface Sessione {
  date: string
  volume: number
  alzate: Array<{ ex: string; muscle: string; h: PalestraHistoryEntry }>
}

export function CoachAthlete({ data, slotSchede, note = 0, onApriSessioni, onApriGrafici, onApriNote }: {
  data: AthleteData
  /** Le schede assegnate, già montate da chi le sa scrivere. Arrivano come slot e
   *  non come dati perché questa è una vista: legge e disegna, non salva niente.
   *  Qui si decide solo DOVE stanno — subito sotto la settimana, che è la prima
   *  cosa che un allenatore guarda, e prima di tutto il resto, che è storia. */
  slotSchede?: ReactNode
  /** Quante note ho scritto: sta sul bottone, così si sa se dentro c'è qualcosa. */
  note?: number
  /** Apre la pagina delle sessioni, giornata per giornata. */
  onApriSessioni?: () => void
  /** Apre l'elenco degli esercizi, ognuno col suo grafico. */
  onApriGrafici?: () => void
  onApriNote?: () => void
}) {
  const t = useT()
  const lang = useLang()
  const tData = useTData()
  const peso = data.userWeight ?? 0
  const palestra = useMemo(() => data.palestraExercises ?? [], [data.palestraExercises])
  const hyrox = useMemo(() => hyroxVisibili(data.hyroxExercises), [data.hyroxExercises])
  const conStorico = useMemo(() => palestra.filter(ex => ex.history.length > 0).length, [palestra])

  // ── Le sessioni, raggruppate per giornata ────────────────────
  // Lo storico è per esercizio; un allenatore ragiona per allenamenti. Senza
  // questo raggruppamento la domanda "quante volte si è allenato" non ha risposta:
  // si conterebbero le alzate, e chi fa otto esercizi in un giorno risulterebbe
  // otto volte più assiduo di chi ne fa uno.
  const sessioni = useMemo<Sessione[]>(() => {
    const perGiorno = new Map<string, Sessione>()
    for (const ex of palestra) {
      for (const h of ex.history) {
        if (!h.date) continue
        const s = perGiorno.get(h.date) ?? { date: h.date, volume: 0, alzate: [] }
        s.volume += entryVolume(h, peso * quotaCorpo(ex))
        s.alzate.push({ ex: ex.n, muscle: displayMuscle(ex.muscle), h })
        perGiorno.set(h.date, s)
      }
    }
    for (const ex of hyrox) {
      for (const h of ex.history) {
        if (!h.date) continue
        if (!perGiorno.has(h.date)) perGiorno.set(h.date, { date: h.date, volume: 0, alzate: [] })
      }
    }
    return [...perGiorno.values()].sort((a, b) => b.date.localeCompare(a.date))
  }, [palestra, hyrox, peso])

  // ── La settimana di calendario, lunedì→domenica ──────────────
  const settimana = useMemo(() => {
    // Le iniziali dei giorni seguono la lingua scelta: `lang` è in coda alle
    // dipendenze, quindi al cambio lingua la settimana si ricalcola.
    const DOW = daysAbbr(lang)
    const oggi = new Date()
    const oggiISO = localISO(oggi)
    const lunedì = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - ((oggi.getDay() + 6) % 7))
    const fatti = new Set(sessioni.map(s => s.date))
    // Le stesse celle della striscia in home: chi allena legge la settimana
    // dell'allievo come legge la sua.
    const giorni: GiornoSettimana[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunedì.getFullYear(), lunedì.getMonth(), lunedì.getDate() + i)
      const iso = localISO(d)
      return { iso, dow: DOW[i], num: d.getDate(), fatto: fatti.has(iso), oggi: iso === oggiISO, futuro: iso > oggiISO }
    })
    const daLunedì = sessioni.filter(s => s.date >= giorni[0].iso && s.date <= oggiISO)
    return {
      giorni,
      sessioni: daLunedì.length,
      volume: daLunedì.reduce((tot, s) => tot + s.volume, 0),
    }
  }, [sessioni, lang])

  // ── Volume per settimana, ultime otto ────────────────────────
  const volumeSettimane = useMemo(() => {
    const oggi = new Date()
    const lunedìCorrente = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - ((oggi.getDay() + 6) % 7))
    const out: Array<{ label: string; volume: number }> = []
    for (let w = 7; w >= 0; w--) {
      const da = new Date(lunedìCorrente.getFullYear(), lunedìCorrente.getMonth(), lunedìCorrente.getDate() - w * 7)
      const a = new Date(da.getFullYear(), da.getMonth(), da.getDate() + 6)
      const daISO = localISO(da), aISO = localISO(a)
      out.push({
        label: fmtDayMonth(daISO),
        volume: sessioni.filter(s => s.date >= daISO && s.date <= aISO).reduce((t, s) => t + s.volume, 0),
      })
    }
    return out
  }, [sessioni])

  // ── Peso ─────────────────────────────────────────────────────
  const pesate = useMemo(() => (data.weightLog ?? []).slice(-14), [data.weightLog])

  // ── Migliori alzate per distretto ────────────────────────────
  const distretti = useMemo(
    () => districtStrength(palestra, peso, data.userSex).filter(d => d.level > 0).sort((a, b) => b.score - a.score),
    [palestra, peso, data.userSex],
  )
  // Il distretto più indietro, in accento: è quello su cui lavorare. Solo se è
  // davvero indietro — sotto metà scala — o in un allievo equilibrato si
  // accenderebbe un 90 come se fosse un problema.
  const indietro = distretti.length > 1 && distretti[distretti.length - 1].score < 50
    ? distretti[distretti.length - 1].muscle : null

  // ── Le migliori alzate in assoluto ───────────────────────────
  // Senza gli esercizi a corpo libero. Lì il "carico" è il peso di chi li fa:
  // trazioni o sollevamenti delle gambe finivano in cima alla classifica di
  // chiunque fosse pesante, e fra due allievi vinceva la bilancia, non la forza.
  // Restano nelle sessioni e nella forza per distretto; qui si confrontano i
  // chili messi sul bilanciere.
  //
  // La migliore è quella in cui si è spostato di più: chili × colpi × serie,
  // cioè i tre numeri che dell'alzata si leggono. Prima contava il massimale
  // stimato, che è un numero calcolato e che nessuno ha alzato: accanto a ogni
  // riga c'era "72 kg" per una panca fatta a 60. Di ogni esercizio entra una
  // sola alzata, la sua migliore, e si vedono le prime tre: le altre sono nei
  // grafici, dietro "Tutte".
  const migliori = useMemo(() => {
    return palestra
      .filter(ex => ex.history.length > 0 && !corpoLibero(ex))
      .map(ex => {
        const p = peso * quotaCorpo(ex)
        const top = ex.history.reduce((b, h) => entryVolume(h, p) > entryVolume(b, p) ? h : b)
        return { nome: ex.n, muscle: displayMuscle(ex.muscle), h: top, lavoro: entryVolume(top, p) }
      })
      .sort((a, b) => b.lavoro - a.lavoro)
      .slice(0, 3)
  }, [palestra, peso])

  const ultimoAllenamento = sessioni[0]?.date
  const giorniFa = ultimoAllenamento
    ? Math.round((Date.now() - new Date(`${ultimoAllenamento}T12:00:00`).getTime()) / 86_400_000)
    : null

  if (!palestra.length && !hyrox.length) {
    return (
      <div className="j-empty" style={{ marginTop: 20 }}>
        {t('Questa persona non ha ancora registrato allenamenti.')}
      </div>
    )
  }

  const ultimo = giorniFa === null ? '—' : giorniFa === 0 ? t('oggi') : giorniFa === 1 ? t('ieri') : t('{n} gg fa', { n: giorniFa })
  const fermo = giorniFa !== null && giorniFa > GIORNI_DI_STOP
  const porte = [
    onApriSessioni && { icona: <Icons.list size={16} stroke={1.9}/>, n: sessioni.length, label: t('Sessioni'), onClick: onApriSessioni },
    onApriGrafici && { icona: <Icons.chart size={16} stroke={1.9}/>, n: conStorico, label: t('Grafici'), onClick: onApriGrafici },
    onApriNote && { icona: <Icons.pencil size={16} stroke={1.9}/>, n: note, label: t('Note'), onClick: onApriNote },
  ].filter(Boolean) as Array<{ icona: ReactNode; n: number; label: string; onClick: () => void }>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>

      {/* ── Questa settimana: i sette giorni, e sotto quante volte e quando ── */}
      <section>
        <NucEyebrow>{t('Questa settimana')}</NucEyebrow>
        <div style={RIQUADRO}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: 'var(--bordo)' }}>
            <CelleSettimana giorni={settimana.giorni}/>
          </div>
          {/* Il volume settimanale non c'è: "12.400 kg" non dice niente a chi
              guarda un allievo — non ha un metro con cui confrontarlo, e cambia
              coi chili spostati, non con l'impegno. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <Numero v={String(settimana.sessioni)} k={t('Allenamenti')}/>
            <Numero v={ultimo} k={t('Ultimo')} allarme={fermo} style={{ borderLeft: 'var(--bordo)' }}/>
          </div>
        </div>
        {/* Oltre la soglia lo si dice per esteso: è il dato che cambia cosa
            scrivere a questa persona, e un "14 gg fa" fra due numeri si perde. */}
        {fermo && (
          <div role="note" style={{
            marginTop: 10, padding: '10px 12px', background: 'var(--surface)', border: '2px solid var(--j-accent)',
            fontFamily: NUC.font, fontSize: 13, lineHeight: 1.45, color: 'var(--fg)',
          }}>
            {t('Non si allena da {n} giorni: alla ripresa farà più fatica con i carichi di prima.', { n: giorniFa })}
          </div>
        )}
      </section>

      {/* ── Le schede assegnate, e sotto le tre porte ─────────────
          Sessioni, grafici e note: ciascuna col suo numero, e dietro una
          pagina sua. Erano bottoni con una riga di testo ("22 giornate"); il
          numero grande si legge prima. Una a zero resta grigia: lì dentro non
          c'è ancora niente. */}
      {(slotSchede || porte.length > 0) && (
        <section>
          {slotSchede}
          {porte.length > 0 && (
            <div style={{ ...RIQUADRO, display: 'grid', gridTemplateColumns: `repeat(${porte.length}, minmax(0, 1fr))` }}>
              {porte.map((p, i) => (
                <button
                  key={p.label} onClick={p.onClick} aria-label={`${p.label}: ${p.n}`}
                  className="j-riga-gruppo j-focus"
                  style={{
                    minWidth: 0, padding: '12px 12px 13px', textAlign: 'left', cursor: 'pointer',
                    background: 'transparent', border: 'none', borderLeft: i === 0 ? 'none' : '1px solid var(--line)',
                    display: 'flex', flexDirection: 'column', gap: 10, color: NUC.ink,
                  }}
                >
                  <span style={{ display: 'flex' }}>{p.icona}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: NUC.display, fontSize: 30, fontWeight: 800, lineHeight: 1, color: p.n === 0 ? 'var(--muted-dark)' : NUC.ink }}>{p.n}</span>
                    <span style={{ ...ETICHETTA, display: 'block', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Volume nel tempo ───────────────────────────────── */}
      {volumeSettimane.some(w => w.volume > 0) && (
        <section>
          <NucEyebrow right={<span style={UNITA}>{t('kg totali')}</span>}>{t('Volume / settimana')}</NucEyebrow>
          <div style={{ ...RIQUADRO, padding: 12 }}>
            <LineChart
              data={volumeSettimane.map(w => w.volume)}
              labels={volumeSettimane.map(w => w.label)}
              pointLabels={volumeSettimane.map(w => fmtVol(w.volume))}
              height={112} color="var(--ink)" yAxis labelSize={9}
              yFormat={v => fmtVol(v)}
            />
          </div>
        </section>
      )}

      {/* ── Peso ───────────────────────────────────────────── */}
      {pesate.length >= 2 && (
        <section>
          <NucEyebrow right={<span style={UNITA}>{t('{kg} kg oggi', { kg: pesate[pesate.length - 1].kg })}</span>}>{t('Peso')}</NucEyebrow>
          <div style={{ ...RIQUADRO, padding: 12 }}>
            <LineChart
              data={pesate.map(p => p.kg)}
              labels={pesate.map(p => fmtDayMonth(p.date))}
              pointLabels={pesate.map(p => String(p.kg))}
              height={112} color="var(--ink)" yAxis labelSize={9}
              yFormat={v => v.toFixed(1)}
            />
          </div>
        </section>
      )}

      {/* ── Forza per distretto ────────────────────────────── */}
      {distretti.length > 0 && (
        <section>
          <NucEyebrow right={<span style={UNITA}>{t('su 100')}</span>}>{t('Forza per distretto')}</NucEyebrow>
          <div style={{ ...RIQUADRO, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {distretti.map(d => {
              const acceso = d.muscle === indietro
              return (
                <div key={d.muscle} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 'clamp(68px, 22vw, 96px)', flexShrink: 0, fontFamily: NUC.font, fontSize: 13.5, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tData(d.muscle)}</span>
                  {/* La barra è il punteggio 0–100, la stessa scala della mappa
                      del corpo: 100 = "forte" per QUEL distretto, così i numeri
                      di gambe e bicipiti si confrontano davvero. */}
                  <span aria-hidden style={{ flex: 1, minWidth: 0, height: 10, background: 'var(--line)' }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.min(100, Math.max(0, d.score))}%`, background: acceso ? 'var(--j-accent)' : 'var(--ink)' }}/>
                  </span>
                  <span style={{
                    width: 34, textAlign: 'right', flexShrink: 0,
                    fontFamily: NUC.display, fontSize: 19, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                    color: acceso ? 'var(--j-accent-ink)' : NUC.ink,
                  }}>{d.score}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Migliori alzate ────────────────────────────────── */}
      {migliori.length > 0 && (
        <section>
          <NucEyebrow right={onApriGrafici ? (
            <button onClick={onApriGrafici} className="j-focus" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0, minHeight: 32,
              background: 'none', border: 'none', cursor: 'pointer',
              font: 'inherit', fontSize: 14, letterSpacing: 'inherit', textTransform: 'inherit', color: 'inherit',
            }}>
              {t('Tutte')} <Icons.arrow size={15} stroke={2.2}/>
            </button>
          ) : undefined}>{t('Migliori alzate')}</NucEyebrow>
          <div style={RIQUADRO}>
            {migliori.map((m, i) => (
              <div key={m.nome} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                borderTop: i === 0 ? 'none' : '1px solid var(--line)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: NUC.font, fontSize: 14.5, fontWeight: 600, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tData(m.nome)}</div>
                  <div style={{ ...ETICHETTA, marginTop: 3 }}>
                    {tData(m.muscle)}{m.h.date ? ` · ${fmtDayMonth(m.h.date)}` : ''}
                  </div>
                </div>
                {/* Quello che è stato alzato davvero: i chili, e sotto serie × colpi. */}
                <div style={{ flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  <div style={{ fontFamily: NUC.display, fontSize: 24, fontWeight: 800, lineHeight: 1, color: NUC.ink, whiteSpace: 'nowrap' }}>{chiliGrandi(fmtKg(m.h))}</div>
                  <div style={{ fontFamily: NUC.display, fontSize: 13, fontWeight: 700, color: NUC.faint, marginTop: 3, whiteSpace: 'nowrap' }}>{m.h.sets_n} × {fmtReps(m.h)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}

// Il riquadro di ogni sezione: bianco, col bordo d'inchiostro.
const RIQUADRO: CSSProperties = { background: 'var(--surface)', border: 'var(--bordo)' }
// L'etichetta sotto un numero, e la riga piccola sotto un nome.
const ETICHETTA: CSSProperties = { fontFamily: NUC.display, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg-mute)' }
// L'unità di misura in cima a una sezione ("kg totali", "su 100"): sta dove le
// altre sezioni hanno il loro link, ma piccola e grigia, perché non si tocca.
const UNITA: CSSProperties = { fontSize: 12, letterSpacing: '.1em', color: 'var(--fg-mute)' }

/** "75 kg" → il numero grande e l'unità piccola; "BW +25 kg" resta intero. Lo
 *  spazio resta, così il testo della riga è ancora "75 kg". */
function chiliGrandi(testo: string): ReactNode {
  const m = testo.match(/^(.*)\s(kg)$/)
  return m ? <>{m[1]} <span style={{ fontSize: '.46em', fontWeight: 700, color: NUC.faint, textTransform: 'uppercase' }}>{m[2]}</span></> : testo
}

/** Un numero grande con la sua etichetta sotto: "3 / ALLENAMENTI". */
function Numero({ v, k, allarme, style }: { v: string; k: string; allarme?: boolean; style?: CSSProperties }) {
  return (
    <div style={{ minWidth: 0, padding: '12px 14px 13px', ...style }}>
      <div style={{
        fontFamily: NUC.display, fontSize: 30, fontWeight: 800, lineHeight: 1, textTransform: 'uppercase',
        color: allarme ? 'var(--j-accent-ink)' : NUC.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{v}</div>
      <div style={{ ...ETICHETTA, marginTop: 5 }}>{k}</div>
    </div>
  )
}

// Le note che l'allenatore lascia sui singoli esercizi. Compaiono nella schermata
// dell'esercizio dell'allievo, di fianco ai suoi appunti.
//
// Un esercizio per riga, e il campo si apre solo su quello che si sta scrivendo:
// trenta textarea aperte insieme sarebbero uno schermo di rettangoli vuoti, e
// nessun modo di vedere a colpo d'occhio dove una nota c'è già.
export function NoteEsercizi({ esercizi, note, onSalva }: {
  esercizi: PalestraExercise[]
  note: NotaCoach[]
  onSalva: (exerciseId: string, testo: string) => void
}) {
  const t = useT()
  const tData = useTData()
  const [aperto, setAperto] = useState<string | null>(null)
  const [bozza, setBozza] = useState('')
  const testoDi = (id: string) => note.find(n => n.exercise_id === id)?.nota ?? ''

  // Un gruppo per muscolo (vedi `perMuscolo`): con trenta esercizi in fila, per
  // scrivere una nota sullo squat bisognava scorrerli tutti leggendo i nomi.
  // Dentro al gruppo, chi ha già una nota sale in cima: è quello che si torna a
  // rileggere.
  const gruppi = useMemo(
    () => perMuscolo(esercizi, ex => !!testoDi(ex.id)).map(g => ({ ...g, scritte: g.esercizi.filter(ex => testoDi(ex.id)).length })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [esercizi, note],
  )
  // Tutti chiusi all'ingresso: la pagina è l'elenco dei gruppi, con accanto
  // quante note ha ciascuno, e si apre solo quello su cui si vuole scrivere.
  const [aperti, setAperti] = useState<Set<string>>(() => new Set())
  const apriGruppo = (m: string) => setAperti(prev => {
    const next = new Set(prev)
    if (next.has(m)) next.delete(m); else next.add(m)
    return next
  })

  // Si salva con un tasto, e solo con quello.
  //
  // Prima il salvataggio partiva dall'uscita dal campo (onBlur) e dal tocco
  // sulla riga. Sembra comodo e invece le note sparivano: toccando "Chiudi" il
  // blur salva e chiude, poi il click arriva sulla riga ormai chiusa e la
  // RIAPRE — e ci rimette dentro la nota di PRIMA, perché quella appena salvata
  // sta ancora viaggiando verso il server e `note` non si è ancora ricaricato.
  // Alla chiusura seguente quel testo vecchio viene riscritto sopra il nuovo.
  // Il risultato, visto da chi scrive, è che la nota non si salva mai, e niente
  // segnala che sia successo qualcosa.
  //
  // Un tasto esplicito toglie l'ambiguità: finché non lo tocchi non parte
  // niente, e uscire dal campo non è più una decisione presa per conto tuo.
  const salva = (id: string) => {
    onSalva(id, bozza.trim())
    setAperto(null)
  }

  return (
    <div>
      <NucEyebrow right={<span style={{ textTransform: 'none' }}>{note.length === 1 ? t('1 scritta') : t('{n} scritte', { n: note.length })}</span>}>{t('Note sugli esercizi')}</NucEyebrow>
      {gruppi.map(g => (
      <TendinaGruppo
        key={g.muscle} muscle={g.muscle} conta={g.esercizi.length}
        extra={g.scritte > 0 ? (g.scritte === 1 ? t('1 nota') : t('{n} note', { n: g.scritte })) : undefined}
        aperta={aperti.has(g.muscle)} onToggle={() => apriGruppo(g.muscle)}
      >
      <NucCard pad={0}>
        {g.esercizi.map((ex, i) => {
          const nota = testoDi(ex.id)
          const attivo = aperto === ex.id
          return (
            <div key={ex.id} style={{ padding: '10px 14px', borderTop: i === 0 ? 'none' : '1px solid var(--hairline-soft)' }}>
              {/* Da aperta la riga non è più un bottone: i comandi stanno sotto,
                  uno per azione. Prima l'intestazione diceva "Annulla" e sotto
                  c'era un altro "Annulla" — due modi di fare la stessa cosa a tre
                  centimetri di distanza, che è un modo di troppo. */}
              <button
                onClick={() => { if (!attivo) { setBozza(nota); setAperto(ex.id) } }}
                disabled={attivo}
                style={{
                  width: '100%', textAlign: 'left', background: 'none', border: 'none',
                  cursor: attivo ? 'default' : 'pointer', padding: 0,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tData(ex.n)}</span>
                  <span style={{
                    display: 'block', fontFamily: NUC.label, fontSize: 10.5, marginTop: 2,
                    color: nota ? 'var(--j-accent-ink)' : 'var(--fg-mute)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{nota || t('Nessuna nota')}</span>
                </span>
                <span style={{
                  flexShrink: 0, fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.12em',
                  textTransform: 'uppercase', color: 'var(--fg-mute)',
                }}>{attivo ? '' : nota ? t('Modifica') : t('Scrivi')}</span>
              </button>

              {attivo && (() => {
                const pulita = bozza.trim()
                const invariata = pulita === nota
                return (
                  <>
                    <textarea
                      autoFocus
                      value={bozza}
                      onChange={e => setBozza(e.target.value)}
                      placeholder={t('Cosa deve ricordarsi su {esercizio}', { esercizio: tData(ex.n) })}
                      aria-label={t('Nota su {esercizio}', { esercizio: tData(ex.n) })}
                      rows={3}
                      className="j-field"
                      style={{
                        width: '100%', height: 'auto', minHeight: 72, marginTop: 8,
                        padding: '9px 11px', resize: 'vertical', lineHeight: 1.5, fontSize: 14,
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                      <button
                        onClick={() => setAperto(null)}
                        style={{
                          padding: '7px 13px', borderRadius: 'var(--radius)', cursor: 'pointer',
                          background: 'none', border: '1px solid var(--hairline)',
                          fontFamily: NUC.label, fontSize: 10, letterSpacing: '.12em',
                          textTransform: 'uppercase', color: 'var(--fg-mute)',
                        }}
                      >
                        {t('Annulla')}
                      </button>
                      <button
                        onClick={() => salva(ex.id)}
                        disabled={invariata}
                        style={{
                          padding: '7px 15px', borderRadius: 'var(--radius)',
                          cursor: invariata ? 'default' : 'pointer',
                          background: invariata ? 'var(--surface-2)' : 'var(--j-accent)',
                          border: 'none',
                          color: invariata ? 'var(--fg-mute)' : 'var(--j-accent-fg)',
                          fontFamily: NUC.label, fontSize: 10, letterSpacing: '.12em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {/* Svuotare una nota e salvare la cancella: il tasto lo dice,
                            invece di far scoprire dopo che "salva" voleva dire togliere. */}
                        {!pulita && nota ? t('Elimina') : t('Salva')}
                      </button>
                    </div>
                  </>
                )
              })()}
            </div>
          )
        })}
      </NucCard>
      </TendinaGruppo>
      ))}
    </div>
  )
}

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
import { useMemo, useState, type ReactNode } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { NucCard, NucEyebrow } from '@/components/ui/NucComponents'
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
import { fmtDayMonth, fmtShortDate, daysShort } from '@/lib/dateFormat'
import { useT, useTData, useLang } from '@/lib/i18n'
import type { AthleteData } from '@/lib/coach'
import type { NotaCoach } from '@/lib/coach'
import type { PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'

interface Sessione {
  date: string
  volume: number
  alzate: Array<{ ex: string; muscle: string; h: PalestraHistoryEntry }>
}

export function CoachAthlete({ data, slotSchede, slotChat, note = 0, onApriSessioni, onApriGrafici, onApriNote }: {
  data: AthleteData
  /** Le schede assegnate, già montate da chi le sa scrivere. Arrivano come slot e
   *  non come dati perché questa è una vista: legge e disegna, non salva niente.
   *  Qui si decide solo DOVE stanno — subito sotto la settimana, che è la prima
   *  cosa che un allenatore guarda, e prima di tutto il resto, che è storia. */
  slotSchede?: ReactNode
  /** Il tasto che apre la chat con questa persona. Come `slotSchede`: lo monta
   *  chi sa cosa fa; qui si decide solo dove sta — sotto le tre porte. */
  slotChat?: ReactNode
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
    const DOW = daysShort(lang)
    const oggi = new Date()
    const oggiISO = localISO(oggi)
    const lunedì = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - ((oggi.getDay() + 6) % 7))
    const fatti = new Set(sessioni.map(s => s.date))
    const giorni = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunedì.getFullYear(), lunedì.getMonth(), lunedì.getDate() + i)
      const iso = localISO(d)
      return { iso, dow: DOW[i], num: d.getDate(), trained: fatti.has(iso), futuro: iso > oggiISO }
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
    () => districtStrength(palestra, peso, data.userSex).filter(d => d.level > 0),
    [palestra, peso, data.userSex],
  )

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
  // sola alzata, la sua migliore, e si vedono le prime cinque.
  const migliori = useMemo(() => {
    return palestra
      .filter(ex => ex.history.length > 0 && !corpoLibero(ex))
      .map(ex => {
        const p = peso * quotaCorpo(ex)
        const top = ex.history.reduce((b, h) => entryVolume(h, p) > entryVolume(b, p) ? h : b)
        return { nome: ex.n, muscle: displayMuscle(ex.muscle), h: top, lavoro: entryVolume(top, p) }
      })
      .sort((a, b) => b.lavoro - a.lavoro)
      .slice(0, 5)
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Colpo d'occhio ─────────────────────────────────── */}
      <div>
        <NucEyebrow>{t('Questa settimana')}</NucEyebrow>
        <NucCard pad={14}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {settimana.giorni.map(g => (
              <div key={g.iso} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.1em', color: 'var(--fg-mute)', textTransform: 'uppercase' }}>{g.dow}</div>
                <div style={{
                  width: 26, height: 26, borderRadius: 'var(--radius-sm)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: g.trained ? 'var(--j-accent)' : 'transparent',
                  border: `1px solid ${g.trained ? 'var(--j-accent)' : 'var(--hairline)'}`,
                  color: g.trained ? 'var(--j-accent-fg)' : (g.futuro ? 'var(--fg-mute)' : 'var(--fg-soft)'),
                  fontFamily: NUC.label, fontSize: 11,
                  opacity: g.futuro ? 0.45 : 1,
                }}>{g.num}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 18, borderTop: '1px solid var(--divider)', paddingTop: 12 }}>
            {/* Il volume settimanale non c'è più: "20 kg" o "12.400 kg" non dice
                niente a chi guarda un allievo — non ha un metro con cui
                confrontarlo, e cambia coi chili spostati, non con l'impegno. Al
                suo posto, sotto, c'è il confronto col solito di QUESTA persona. */}
            <Tile k={t('Allenamenti')} v={String(settimana.sessioni)}/>
            <Tile
              k={t('Ultimo')}
              v={giorniFa === null ? '—' : giorniFa === 0 ? t('oggi') : giorniFa === 1 ? t('ieri') : t('{n} gg fa', { n: giorniFa })}
              allarme={giorniFa !== null && giorniFa > GIORNI_DI_STOP}
            />
          </div>
          {/* Oltre la soglia lo si dice per esteso: è il dato che cambia cosa
              scrivere a questa persona, e un "14 gg fa" fra due numeri si perde. */}
          {giorniFa !== null && giorniFa > GIORNI_DI_STOP && (
            <div role="note" style={{
              marginTop: 12, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              background: 'rgba(var(--warn-rgb),0.10)', border: '1px solid rgba(var(--warn-rgb),0.35)',
              fontFamily: NUC.label, fontSize: 11, lineHeight: 1.5, color: 'var(--warn)',
            }}>
              {t('Non si allena da {n} giorni: alla ripresa farà più fatica con i carichi di prima.', { n: giorniFa })}
            </div>
          )}
        </NucCard>
      </div>

      {slotSchede}

      {/* Le note dietro un bottone. Erano una sezione lunga in mezzo alla pagina
          — l'elenco di TUTTI gli esercizi — e spingeva sotto la piega i grafici e
          la forza, che sono il colpo d'occhio. Dietro un bottone ci si va quando
          serve, e la pagina resta leggibile.

          Qui accanto c'era anche "Ultimo allenamento", ed è sceso in fondo, di
          fianco a Sessioni: è una lettura del diario, non una scheda a parte, e
          in cima competeva per lo sguardo con le note, che sono una scrittura. */}
      {/* Sessioni e note, due porte affiancate. Le sessioni erano una tendina
          in fondo alla pagina che mostrava una giornata per volta: adesso hanno
          una pagina loro, dove ogni giornata si confronta con la sua scheda. */}
      {/* Tre adesso: in mezzo i grafici, esercizio per esercizio. Le etichette
          sono una parola sola — "Note" e non "Note sugli esercizi" — perché in un
          terzo di schermo la frase intera finiva troncata coi puntini. */}
      {(onApriSessioni || onApriGrafici || onApriNote) && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${[onApriSessioni, onApriGrafici, onApriNote].filter(Boolean).length}, minmax(0, 1fr))`, gap: 8 }}>
          {onApriSessioni && (
            <BottonePagina
              icon={<Icons.list size={20} stroke={1.6}/>}
              label={t('Sessioni')}
              sotto={sessioni.length === 0 ? t('Nessuna sessione') : sessioni.length === 1 ? t('1 giornata') : t('{n} giornate', { n: sessioni.length })}
              onClick={onApriSessioni}
            />
          )}
          {onApriGrafici && (
            <BottonePagina
              icon={<Icons.chart size={20} stroke={1.6}/>}
              label={t('Grafici')}
              sotto={conStorico === 1 ? t('1 esercizio') : t('{n} esercizi', { n: conStorico })}
              onClick={onApriGrafici}
            />
          )}
          {onApriNote && (
            <BottonePagina
              icon={<Icons.pencil size={20} stroke={1.6}/>}
              label={t('Note')}
              sotto={note === 0 ? t('Nessuna scritta') : note === 1 ? t('1 scritta') : t('{n} scritte', { n: note })}
              onClick={onApriNote}
            />
          )}
        </div>
      )}

      {slotChat}

      {/* ── Volume nel tempo ───────────────────────────────── */}
      {volumeSettimane.some(w => w.volume > 0) && (
        <div>
          <NucEyebrow>{t('Volume per settimana')}</NucEyebrow>
          <NucCard pad={12}>
            <LineChart
              data={volumeSettimane.map(w => w.volume)}
              labels={volumeSettimane.map(w => w.label)}
              pointLabels={volumeSettimane.map(w => fmtVol(w.volume))}
              height={112} color="var(--j-accent)" yAxis labelSize={9}
              yFormat={v => fmtVol(v)}
            />
          </NucCard>
        </div>
      )}

      {/* ── Peso ───────────────────────────────────────────── */}
      {pesate.length >= 2 && (
        <div>
          <NucEyebrow right={<span style={{ textTransform: 'none' }}>{t('{kg} kg oggi', { kg: pesate[pesate.length - 1].kg })}</span>}>{t('Peso')}</NucEyebrow>
          <NucCard pad={12}>
            <LineChart
              data={pesate.map(p => p.kg)}
              labels={pesate.map(p => fmtDayMonth(p.date))}
              pointLabels={pesate.map(p => String(p.kg))}
              height={112} color="var(--chart-2)" yAxis labelSize={9}
              yFormat={v => v.toFixed(1)}
            />
          </NucCard>
        </div>
      )}

      {/* ── Forza per distretto ────────────────────────────── */}
      {distretti.length > 0 && (
        <div>
          <NucEyebrow>{t('Forza per distretto')}</NucEyebrow>
          <NucCard pad={14}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {distretti.map(d => (
                <div key={d.muscle} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: NUC.font, fontSize: 13, color: 'var(--fg)' }}>{tData(d.muscle)}</span>
                  {/* La barra è il punteggio 0–100, la stessa scala della mappa
                      del corpo: 100 = "forte" per QUEL distretto, così i numeri
                      di gambe e bicipiti si confrontano davvero. */}
                  <span style={{ width: 84, height: 6, background: 'var(--surface-2)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', flexShrink: 0 }}>
                    <span style={{ display: 'block', height: '100%', width: `${d.score}%`, background: 'var(--j-accent)', borderRadius: 'var(--radius-pill)' }}/>
                  </span>
                  <span style={{
                    width: 26, textAlign: 'right', flexShrink: 0,
                    fontFamily: NUC.label, fontSize: 13, fontVariantNumeric: 'tabular-nums',
                    color: 'var(--j-accent-ink)',
                  }}>{d.score}</span>
                </div>
              ))}
            </div>
          </NucCard>
        </div>
      )}

      {/* ── Migliori alzate ────────────────────────────────── */}
      {migliori.length > 0 && (
        <div>
          <NucEyebrow right={<span style={{ textTransform: 'none' }}>{t('chili · serie × colpi')}</span>}>{t('Migliori alzate')}</NucEyebrow>
          <NucCard pad={0}>
            {migliori.map((m, i) => (
              <div key={m.nome} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                borderTop: i === 0 ? 'none' : '1px solid var(--hairline-soft)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tData(m.nome)}</div>
                  <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.06em', color: 'var(--fg-mute)', marginTop: 2 }}>
                    {tData(m.muscle)}{m.h.date ? ` · ${fmtShortDate(m.h.date)}` : ''}
                  </div>
                </div>
                {/* Quello che è stato alzato davvero: i chili, e sotto serie × colpi. */}
                <div style={{ flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  <div style={{ fontFamily: NUC.label, fontSize: 14, fontWeight: 600, color: 'var(--j-accent-ink)', whiteSpace: 'nowrap' }}>{fmtKg(m.h)}</div>
                  <div style={{ fontFamily: NUC.label, fontSize: 10.5, color: 'var(--fg-mute)', marginTop: 1, whiteSpace: 'nowrap' }}>{m.h.sets_n} × {fmtReps(m.h)}</div>
                </div>
              </div>
            ))}
          </NucCard>
        </div>
      )}

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

// Un bottone che apre una pagina: icona, nome, e sotto lo stato di ciò che
// contiene. È la stessa forma delle card del menù impostazioni — due controlli
// affiancati che portano altrove — e la freccia in alto è quello che li fa
// leggere come collegamenti invece che come etichette.
function BottonePagina({ icon, label, sotto, onClick }: {
  icon: ReactNode; label: string; sotto: string; onClick: () => void
}) {
  return (
    <button onClick={onClick} className="j-hard" style={{
      padding: '14px 12px', borderRadius: 'var(--radius)', textAlign: 'left',
      background: 'var(--surface)', border: '1px solid var(--hairline)',
      display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, cursor: 'pointer',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ color: 'var(--j-accent-ink)', display: 'flex' }}>{icon}</span>
        <Icons.chev size={14} stroke={2} style={{ color: 'var(--fg-mute)', flexShrink: 0 }}/>
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: 'block', fontFamily: NUC.label, fontSize: 10, fontWeight: 600,
          letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{label}</span>
        <span style={{
          display: 'block', fontFamily: NUC.font, fontSize: 11.5, color: 'var(--fg-mute)',
          marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{sotto}</span>
      </span>
    </button>
  )
}

function Tile({ k, v, allarme }: { k: string; v: string; allarme?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-mute)', marginBottom: 3 }}>{k}</div>
      <div style={{ fontFamily: NUC.font, fontSize: 19, fontWeight: 500, letterSpacing: -0.4, color: allarme ? 'var(--warn)' : 'var(--fg)' }}>{v}</div>
    </div>
  )
}

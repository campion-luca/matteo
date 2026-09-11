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
import { useMemo, useState, useEffect, type ReactNode } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { NucCard, NucEyebrow } from '@/components/ui/NucComponents'
import { Icons } from '@/components/ui/Icons'
import { LineChart } from '@/features/gym/gymShared'
import { entryVolume, entry1RM, fmtVol, fmtKg, fmtNum, fmtReps, setRepsOf, sortedHistory, displayMuscle } from '@/features/gym/gymModel'
import { districtStrength } from '@/features/gym/gymStrength'
import { localISO } from '@/lib/isoDate'
import { fmtDayMonth, fmtShortDate, daysShort } from '@/lib/dateFormat'
import { useT, useTData, useLang } from '@/lib/i18n'
import type { AthleteData } from '@/lib/coach'
import type { NotaCoach } from '@/lib/coach'
import type { PalestraExercise } from '@/store/useJarvisStore'
import type { PalestraHistoryEntry } from '@/store/useJarvisStore'

interface Sessione {
  date: string
  volume: number
  alzate: Array<{ ex: string; muscle: string; h: PalestraHistoryEntry }>
}

export function CoachAthlete({ data, slotSchede, note = 0, onApriUltimo, onApriNote }: {
  data: AthleteData
  /** Le schede assegnate, già montate da chi le sa scrivere. Arrivano come slot e
   *  non come dati perché questa è una vista: legge e disegna, non salva niente.
   *  Qui si decide solo DOVE stanno — subito sotto la settimana, che è la prima
   *  cosa che un allenatore guarda, e prima di tutto il resto, che è storia. */
  slotSchede?: ReactNode
  /** Quante note ho scritto: sta sul bottone, così si sa se dentro c'è qualcosa. */
  note?: number
  onApriUltimo?: () => void
  onApriNote?: () => void
}) {
  const t = useT()
  const lang = useLang()
  const tData = useTData()
  const peso = data.userWeight ?? 0
  const palestra = useMemo(() => data.palestraExercises ?? [], [data.palestraExercises])
  const hyrox = useMemo(() => data.hyroxExercises ?? [], [data.hyroxExercises])

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
        s.volume += entryVolume(h, peso)
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
  const migliori = useMemo(() => {
    return palestra
      .filter(ex => ex.history.length > 0)
      .map(ex => {
        const top = ex.history.reduce((b, h) => entry1RM(h, peso) > entry1RM(b, peso) ? h : b)
        return { nome: ex.n, muscle: displayMuscle(ex.muscle), h: top, rm: Math.round(entry1RM(top, peso)) }
      })
      .sort((a, b) => b.rm - a.rm)
      .slice(0, 5)
  }, [palestra, peso])

  // La sessione aperta nella tendina. Parte dalla più recente, ed è una DATA e
  // non un indice: la lista si ricarica quando arrivano dati nuovi, e un indice
  // punterebbe a un altro giorno senza che nessuno l'abbia chiesto.
  const [giornoScelto, setGiornoScelto] = useState('')
  const sessione = sessioni.find(x => x.date === giornoScelto) ?? sessioni[0]
  useEffect(() => {
    if (sessioni.length && !sessioni.some(x => x.date === giornoScelto)) setGiornoScelto(sessioni[0].date)
  }, [sessioni, giornoScelto])

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
                  width: 26, height: 26, borderRadius: '50%',
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
          <div style={{ display: 'flex', gap: 18, borderTop: '1px solid var(--hairline)', paddingTop: 12 }}>
            {/* Il volume settimanale non c'è più: "20 kg" o "12.400 kg" non dice
                niente a chi guarda un allievo — non ha un metro con cui
                confrontarlo, e cambia coi chili spostati, non con l'impegno. Al
                suo posto, sotto, c'è il confronto col solito di QUESTA persona. */}
            <Tile k={t('Allenamenti')} v={String(settimana.sessioni)}/>
            <Tile
              k={t('Ultimo')}
              v={giorniFa === null ? '—' : giorniFa === 0 ? t('oggi') : giorniFa === 1 ? t('ieri') : t('{n} gg fa', { n: giorniFa })}
            />
          </div>
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
      {onApriNote && (
        <BottonePagina
          icon={<Icons.pencil size={20} stroke={1.6}/>}
          label={t('Note sugli esercizi')}
          sotto={note === 0 ? t('Nessuna scritta') : note === 1 ? t('1 scritta') : t('{n} scritte', { n: note })}
          onClick={onApriNote}
        />
      )}

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
                  <span style={{ width: 84, height: 5, background: 'var(--surface-2)', border: '1px solid var(--hairline)', flexShrink: 0 }}>
                    <span style={{ display: 'block', height: '100%', width: `${d.score}%`, background: 'var(--j-accent)' }}/>
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

      {/* Diario. Una sessione per volta, scelta da una tendina: le ultime otto in
          fila erano già uno schermo pieno con un allievo che si allena tre volte
          a settimana, e a un anno di distanza sarebbero un muro. Si guarda
          sempre UNA giornata — "cosa ha fatto giovedì" — non otto insieme. */}
      {sessioni.length > 0 && (
        <div>
          <NucEyebrow right={
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, textTransform: 'none' }}>
              <span>{t('{n} in tutto', { n: sessioni.length })}</span>
              {onApriUltimo && (
                <button
                  onClick={onApriUltimo}
                  className="j-hard-sm"
                  style={{
                    padding: '4px 9px', borderRadius: 0, cursor: 'pointer',
                    background: 'var(--surface)', border: '1px solid var(--hairline)',
                    fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.12em',
                    textTransform: 'uppercase', color: 'var(--j-accent-ink)',
                  }}
                >
                  {/* Non "Ultimo": quella parola è già sulla tile dei giorni
                      dall'ultima volta, in cima alla stessa schermata. Qui si apre
                      il confronto con le medie, ed è quello il nome della cosa. */}
                  {t('Confronto')}
                </button>
              )}
            </span>
          }>{t('Sessioni')}</NucEyebrow>
          {/* `value` segue la sessione MOSTRATA, non `giornoScelto`.

              Sono due cose diverse finché nessuno ha scelto: `giornoScelto` parte
              vuoto e la card sotto ripiega sulla più recente, quindi il menù non
              corrispondeva a nulla e si disegnava vuoto. Con la lista piena sotto
              e il menù in bianco sopra, la lettura ovvia è che non ci sia niente
              finché non si apre la tendina — che è esattamente quello che
              succedeva. Legandolo a `sessione` i due non possono più discordare. */}
          <select
            value={sessione?.date ?? ''}
            onChange={e => setGiornoScelto(e.target.value)}
            aria-label={t('Scegli la sessione')}
            className="j-field"
            style={{ marginBottom: 10 }}
          >
            {sessioni.map(x => (
              <option key={x.date} value={x.date}>
                {fmtShortDate(x.date)} · {fmtVol(x.volume)} kg
              </option>
            ))}
          </select>
          {sessione && (
            <NucCard pad={14}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {sessione.alzate.map((a, j) => (
                  <div key={j} style={{ display: 'flex', gap: 8, fontFamily: NUC.font, fontSize: 13, color: 'var(--fg-soft)' }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tData(a.ex)}</span>
                    <span style={{ flexShrink: 0, color: 'var(--fg-mute)' }}>{a.h.sets_n} × {fmtReps(a.h)} — {fmtKg(a.h)}</span>
                  </div>
                ))}
                {sessione.alzate.length === 0 && (
                  <span style={{ fontFamily: NUC.label, fontSize: 11, color: 'var(--fg-mute)' }}>{t('Solo hyrox, nessuna alzata di pesi.')}</span>
                )}
              </div>
            </NucCard>
          )}
        </div>
      )}

      {/* ── Migliori alzate ────────────────────────────────── */}
      {migliori.length > 0 && (
        <div>
          <NucEyebrow right={<span style={{ textTransform: 'none' }}>{t('massimale stimato')}</span>}>{t('Migliori alzate')}</NucEyebrow>
          <NucCard pad={0}>
            {migliori.map((m, i) => (
              <div key={m.nome} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                borderTop: i === 0 ? 'none' : '1px solid var(--hairline-soft)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tData(m.nome)}</div>
                  <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.06em', color: 'var(--fg-mute)', marginTop: 2 }}>
                    {tData(m.muscle)} · {m.h.sets_n} × {fmtReps(m.h)} — {fmtKg(m.h)}
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontFamily: NUC.label, fontSize: 14, color: 'var(--j-accent-ink)' }}>{m.rm}</div>
                  <div style={{ fontFamily: NUC.label, fontSize: 9, color: 'var(--fg-mute)', letterSpacing: '.08em' }}>KG</div>
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

  // Chi ha già una nota sale in cima: è quello che si torna a rileggere.
  const ordinati = useMemo(
    () => [...esercizi].sort((a, b) => Number(!!testoDi(b.id)) - Number(!!testoDi(a.id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [esercizi, note],
  )

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
      <NucCard pad={0}>
        {ordinati.map((ex, i) => {
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
                          padding: '7px 13px', borderRadius: 0, cursor: 'pointer',
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
                          padding: '7px 15px', borderRadius: 0,
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
    </div>
  )
}

// Pagina: l'ultimo allenamento contro il solito.
// Era una sezione in mezzo alla scheda dell'allievo. Ha una pagina sua perché è
// una tabella — cresce con gli esercizi, non con lo schermo — e perché è una
// domanda a sé: "come è andata l'ultima volta rispetto al solito".
export function UltimoAllenamento({ palestra }: { palestra: PalestraExercise[] }) {
  const t = useT()
  const tData = useTData()
  // ── L'ultima volta contro il solito, esercizio per esercizio ───────
  // La domanda di un allenatore non è "quanto ha spostato" ma "sta calando?".
  // Serve un metro interno alla persona: il suo solito su QUELL'esercizio. Un
  // numero assoluto non ce l'ha — 60 kg di panca sono tanti o pochi a seconda di
  // chi li fa — mentre "tre serie invece delle solite quattro" si legge da sé.
  const confronto = useMemo(() => {
    return palestra
      .filter(ex => ex.history.length >= 2)
      .map(ex => {
        const hist = sortedHistory(ex.history)
        const ultima = hist[hist.length - 1]
        // Fino a sei precedenti: più indietro si va, più il "solito" descrive un
        // altro periodo di allenamento invece di quello in corso.
        const prima = hist.slice(0, -1).slice(-6)
        // I colpi si confrontano sulla serie PIÙ CORTA: è lì che un allenamento
        // cede, e il valore rappresentativo (i colpi della serie più pesante)
        // nasconderebbe un finale a 6 dietro un inizio a 10.
        const colpiDi = (h: PalestraHistoryEntry) => Math.min(...setRepsOf(h))
        const solito = {
          serie: mediana(prima.map(h => h.sets_n)),
          colpi: mediana(prima.map(colpiDi)),
          kg:    mediana(prima.map(h => h.kg)),
        }
        const ora = { serie: ultima.sets_n, colpi: colpiDi(ultima), kg: ultima.kg }
        const giù = {
          serie: ora.serie < solito.serie,
          colpi: ora.colpi < solito.colpi,
          kg:    ora.kg    < solito.kg,
        }
        return { ex, nome: ex.n, ultima, solito, giù, cala: giù.serie || giù.colpi || giù.kg }
      })
      // I cali per primi: sono il motivo per cui questa tabella esiste. A parità,
      // l'allenamento più recente.
      .sort((a, b) => Number(b.cala) - Number(a.cala) || (b.ultima.date ?? '').localeCompare(a.ultima.date ?? ''))
      .slice(0, 8)
  }, [palestra])

  if (confronto.length === 0) {
    return <div className="j-empty">{t('Servono almeno due allenamenti sullo stesso esercizio per avere un confronto.')}</div>
  }

  return (
    <div>
      <NucEyebrow right={<span style={{ textTransform: 'none' }}>{t('rispetto al solito')}</span>}>{t('Ultimo allenamento')}</NucEyebrow>
      <NucCard pad={0}>
        <div style={{
          display: 'flex', gap: 8, padding: '9px 14px',
          borderBottom: '1px solid var(--hairline)',
          fontFamily: NUC.label, fontSize: 9, letterSpacing: '.12em',
          textTransform: 'uppercase', color: 'var(--fg-mute)',
        }}>
          <span style={{ flex: 1, minWidth: 0 }}>{t('Esercizio')}</span>
          <span style={{ width: 40, textAlign: 'right', flexShrink: 0 }}>{t('Serie')}</span>
          <span style={{ width: 40, textAlign: 'right', flexShrink: 0 }}>{t('Colpi')}</span>
          <span style={{ width: 62, textAlign: 'right', flexShrink: 0 }}>Kg</span>
        </div>
        {confronto.map((c, i) => (
          <div key={c.ex.id} style={{ padding: '10px 14px', borderTop: i === 0 ? 'none' : '1px solid var(--hairline-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tData(c.nome)}</span>
              <Cella giù={c.giù.serie} w={40}>{c.ultima.sets_n}</Cella>
              <Cella giù={c.giù.colpi} w={40}>{fmtReps(c.ultima)}</Cella>
              <Cella giù={c.giù.kg} w={62}>{fmtKg(c.ultima)}</Cella>
            </div>
            {/* Il metro, scritto solo quando serve: su una riga in pari sarebbe
                la ripetizione dei numeri che le stanno sopra. */}
            {c.cala && (
              <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.04em', color: 'var(--danger)', marginTop: 3 }}>
                {t('di solito')} {c.solito.serie} × {c.solito.colpi} — {fmtNum(c.solito.kg)} kg
              </div>
            )}
          </div>
        ))}
      </NucCard>
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
      padding: '14px 12px', borderRadius: 0, textAlign: 'left',
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

// Il "solito" è la MEDIANA delle volte precedenti, non la media: una giornata
// storta o un massimale isolato spostano la media, e con lei il metro con cui si
// giudica tutto il resto. A parità di posizioni centrali si prende la più bassa,
// così il rosso resta un segnale e non un'abitudine.
function mediana(v: number[]): number {
  if (!v.length) return 0
  const s = [...v].sort((a, b) => a - b)
  return s[Math.floor((s.length - 1) / 2)]
}

// Una cella numerica della tabella: rossa quando è sotto il solito.
function Cella({ giù, w, children }: { giù: boolean; w: number; children: ReactNode }) {
  return (
    <span style={{
      width: w, flexShrink: 0, textAlign: 'right',
      fontFamily: NUC.label, fontSize: 12.5, fontVariantNumeric: 'tabular-nums',
      color: giù ? 'var(--danger)' : 'var(--fg)', fontWeight: giù ? 600 : 400,
    }}>{children}</span>
  )
}

function Tile({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-mute)', marginBottom: 3 }}>{k}</div>
      <div style={{ fontFamily: NUC.serif, fontSize: 19, fontWeight: 500, letterSpacing: -0.4, color: 'var(--fg)' }}>{v}</div>
    </div>
  )
}

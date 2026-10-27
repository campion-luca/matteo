// La pagina «Oggi» del desktop (ott 2026): il gestionale. Sul telefono la home
// risponde a una domanda sola — cosa faccio oggi — e sta in uno schermo; qui c'è
// lo spazio per tenere tutto sotto gli occhi insieme.
//
// In cima il saluto e i tre comandi (cerca, nuova scheda, inizia), sotto cinque
// numeri: costanza, sessioni del mese, volume della settimana, massimali, peso.
// Poi due colonne. A sinistra il lavoro: la scheda di oggi riga per riga, le
// schede, gli ultimi allenamenti. A destra il quadro: il mese, la forza per
// gruppo, gli allievi, i record.
//
// Qui si disegna e basta: i conti stanno in numeriOggi.ts e nei moduli che la
// app usava già (settimane di fila, forza su 100, massimali).
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { useT, useTData, useLang } from '@/lib/i18n'
import { useJarvisStore, type GymScheda, type PalestraExercise } from '@/store/useJarvisStore'
import { useOggi } from '@/hooks/useOggi'
import { giorniTra, isoWeek } from '@/lib/isoDate'
import { daysAbbr, daysShort, fmtDayMonth, fmtDayMon, fmtGiornoLungo, fmtMese } from '@/lib/dateFormat'
import { useMessaggi } from '@/lib/messaggiLive'
import { nonLetti } from '@/lib/messaggi'
import { hyroxVisibili } from '@/features/gym/hyroxAttivo'
import { entry1RM, fmtKg, fmtNum, fmtReps, quantoFa, sortedHistory, ultimaVoltaPerScheda, ultimoAllenamento } from '@/features/gym/gymModel'
import { quotaCorpo } from '@/features/gym/catalogo'
import { useSchedaDiOggi, useSchedeVisibili } from '@/features/gym/gymHooks'
import { durataArrotondata, durataPrevista, esercizioDellaRiga, muscoliDellaScheda, muscoloDellaRiga, serieDellaScheda } from '@/features/gym/anteprimaScheda'
import { allenamentoInCorso, sessioneAperta } from '@/features/gym/sessioneInCorso'
import { districtStrength } from '@/features/gym/gymStrength'
import { maxLifts, maxTotal } from '@/features/gym/gymMaxLifts'
import { giorniAllenati, lunediDi, settimaneDiFila } from '@/features/dashboard/allenamenti'
import { useNavDesktop } from './navDesktop'
import { useAllievi } from './allieviDesktop'
import {
  giorniPrima, recordFatti, sessioniFatte, sessioniFra, settimaneDiFilaRecord,
  variazionePeso, volumeSettimana, type SessioneFatta,
} from './numeriOggi'

type Periodo = '7' | '30' | 'tutte'

export function OggiDesktop({ onCerca, onApriEsercizio, onProfilo }: {
  onCerca: () => void
  onApriEsercizio: (ex: PalestraExercise) => void
  /** Il profilo, dove si scrive il peso. */
  onProfilo: () => void
}) {
  const t = useT()
  const lang = useLang()
  const s = useJarvisStore(useShallow(st => ({
    userName: st.userName,
    userWeight: st.userWeight,
    userSex: st.userSex,
    weightLog: st.weightLog,
    palestra: st.palestraExercises,
    hyrox: hyroxVisibili(st.hyroxExercises),
  })))
  const oggi = useOggi()
  const peso = s.userWeight ?? 0

  const record = useMemo(() => recordFatti(s.palestra, peso), [s.palestra, peso])
  const sessioni = useMemo(() => sessioniFatte(s.palestra, peso, record), [s.palestra, peso, record])
  const giorni = useMemo(() => giorniAllenati(s.palestra, s.hyrox), [s.palestra, s.hyrox])
  const distretti = useMemo(() => districtStrength(s.palestra, peso, s.userSex), [s.palestra, peso, s.userSex])
  const total = useMemo(() => maxTotal(maxLifts(s.palestra, peso, distretti)), [s.palestra, peso, distretti])

  const nome = s.userName.trim()
  const [anno] = oggi.split('-').map(Number)
  const ilGiorno = new Date(`${oggi}T12:00:00`)

  return (
    <div className="j-desk">
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div className="j-eyebrow" style={{ fontSize: 13 }}>
            {fmtGiornoLungo(ilGiorno, lang)} {anno} · {t('Settimana {n}', { n: isoWeek(oggi).week })}
          </div>
          <h1 style={{ margin: '4px 0 0', fontFamily: NUC.display, fontSize: 46, fontWeight: 800, lineHeight: .95, textTransform: 'uppercase', color: NUC.ink }}>
            {nome ? t('Ciao, {nome}', { nome }) : t('Ciao')}
          </h1>
        </div>
        <Comandi onCerca={onCerca}/>
      </header>

      <Numeri sessioni={sessioni} giorni={giorni} oggi={oggi} total={total} onProfilo={onProfilo}/>

      <div className="j-desk-colonne">
        <div className="j-desk-pila">
          <SchedaDiOggiDesktop onApriEsercizio={onApriEsercizio}/>
          <ElencoSchede oggi={oggi}/>
          <UltimeSessioni sessioni={sessioni} oggi={oggi}/>
        </div>
        <div className="j-desk-pila">
          <Mese giorni={giorni} oggi={oggi}/>
          <Forza distretti={distretti} total={total} senzaPeso={!peso} onProfilo={onProfilo}/>
          <Allievi oggi={oggi}/>
          <Record record={record} onApri={onApriEsercizio}/>
        </div>
      </div>
      {/* Il respiro in fondo: l'ultima card non tocca il bordo della finestra. */}
      <div aria-hidden style={{ height: 8 }}/>
    </div>
  )
}

// ── I comandi in testata ───────────────────────────────────────

/** ⌘K su Mac, Ctrl K altrove: la scorciatoia della ricerca (vedi JarvisGym). */
const SCORCIATOIA = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'

function Comandi({ onCerca }: { onCerca: () => void }) {
  const t = useT()
  const vai = useNavDesktop(s => s.vai)
  const oggi = useSchedaDiOggi()
  const avvio = statoAvvio(oggi)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <button type="button" onClick={onCerca} className="j-focus" aria-label={t('Cerca')} aria-keyshortcuts="Meta+K Control+K" style={{
        height: 44, width: 290, maxWidth: '100%', padding: '0 8px 0 12px', cursor: 'text',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--surface)', border: 'var(--bordo)', color: NUC.faint,
        fontFamily: NUC.font, fontSize: 14, textAlign: 'left',
      }}>
        <Icons.search size={16} stroke={2}/>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('Cerca esercizi, schede…')}</span>
        <kbd style={{ flexShrink: 0, padding: '2px 5px', border: '1.5px solid var(--hairline-soft)', fontFamily: NUC.display, fontSize: 12, fontWeight: 700, color: NUC.faint }}>{SCORCIATOIA}</kbd>
      </button>
      <button type="button" onClick={() => vai({ sezione: 'schede', nuova: true })} className="j-hard j-focus" style={{
        height: 44, padding: '0 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--surface)', border: 'var(--bordo)', color: NUC.ink,
        fontFamily: NUC.display, fontSize: 16, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
      }}>
        <Icons.plus size={16} stroke={2.4}/> {t('Nuova scheda')}
      </button>
      {avvio && (
        <button type="button" onClick={() => vai({ sezione: 'schede', apri: avvio.id, riprendi: avvio.subito })} className="j-btn-accent-sm j-focus" style={{ width: 'auto', padding: '0 18px', marginTop: 0 }}>
          {t(avvio.etichetta)} <Icons.arrow size={18} stroke={2.4}/>
        </button>
      )}
    </div>
  )
}

/** Il tasto per cominciare, con le stesse regole della card in home (vedi
 *  SezioneSchede): un allenamento di oggi rimasto aperto si riprende; uno di un
 *  ALTRO giorno, o su un'altra scheda, si passa dal dettaglio, che chiede cosa
 *  farne; una scheda già fatta oggi si apre e basta. */
function statoAvvio(oggi: ReturnType<typeof useSchedaDiOggi>) {
  if (!oggi) return null
  const { scheda, fattaOggi } = oggi
  if (fattaOggi) return { id: scheda.id, subito: false, etichetta: 'Fatta oggi · apri la scheda', inCorso: false }
  const aperta = sessioneAperta()
  const altraAperta = !!aperta && aperta.schedaId !== scheda.id && !aperta.vuota
  const inCorso = !!aperta && aperta.schedaId === scheda.id
  return {
    id: scheda.id,
    subito: !altraAperta && !aperta?.vecchia,
    etichetta: inCorso ? 'Riprendi allenamento' : 'Inizia allenamento',
    inCorso,
  }
}

// ── I cinque numeri ────────────────────────────────────────────

function Numeri({ sessioni, giorni, oggi, total, onProfilo }: {
  sessioni: SessioneFatta[]
  giorni: Map<string, unknown>
  oggi: string
  total: number | null
  onProfilo: () => void
}) {
  const t = useT()
  const lang = useLang()
  const { userWeight, weightLog } = useJarvisStore(useShallow(st => ({ userWeight: st.userWeight, weightLog: st.weightLog })))

  const serie = settimaneDiFila(giorni.keys(), oggi)
  const migliore = settimaneDiFilaRecord(giorni.keys())

  const [y, m] = oggi.split('-').map(Number)
  const meseScorso = new Date(y, m - 2, 1)
  const daMese = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}`
  const nelMese = sessioni.filter(x => x.data.startsWith(daMese(y, m))).length
  const nelMesePrima = sessioni.filter(x => x.data.startsWith(daMese(meseScorso.getFullYear(), meseScorso.getMonth() + 1))).length
  const scarto = nelMese - nelMesePrima
  const nomeMesePrima = fmtMese(meseScorso.getMonth(), lang).toLowerCase()

  const volume = volumeSettimana(sessioni, oggi)
  const kgOK = (v: number) => (v >= 1000 ? `${fmtNum(Math.round(v / 100) / 10)}k` : fmtNum(Math.round(v)))
  const pesata = variazionePeso(weightLog)
  const segno = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '')

  return (
    <div className="j-desk-numeri">
      <Numero etichetta={t('Costanza')} valore={String(serie)} unita={t('sett.')}
        sotto={serie === 0 ? t('nessuna settimana di fila') : serie >= migliore ? t('di fila, record personale') : t('di fila · record {n}', { n: migliore })}/>
      <Numero etichetta={`${t('Sessioni')} · ${fmtMese(m - 1, lang)}`} valore={String(nelMese)}
        sotto={nelMese === 0 && nelMesePrima === 0 ? t('nessuna ancora')
          : scarto === 0 ? t('come a {mese}', { mese: nomeMesePrima })
          : t('{d} rispetto a {mese}', { d: `${segno(scarto)}${Math.abs(scarto)}`, mese: nomeMesePrima })}/>
      <Numero etichetta={`${t('Volume')} · ${t('settimana')}`}
        valore={volume.questa >= 1000 ? fmtNum(Math.round(volume.questa / 1000)) : fmtNum(Math.round(volume.questa))}
        unita={volume.questa >= 1000 ? 'k kg' : 'kg'}
        sotto={volume.media === null ? t('la prima settimana')
          : t('{d} sulla media', { d: `${segno(volume.questa - volume.media)}${kgOK(Math.abs(volume.questa - volume.media))}` })}/>
      <Numero etichetta={t('Massimali')} valore={total !== null ? String(total) : '—'} unita={total !== null ? 'kg' : undefined}
        sotto={total === null ? t('servono squat, panca e stacco')
          : userWeight ? t('{r}× il tuo peso', { r: fmtNum(Number((total / userWeight).toFixed(1))) }) : t('squat, panca e stacco')}/>
      <Numero etichetta={t('Peso')} valore={userWeight ? fmtNum(userWeight) : '—'} unita={userWeight ? 'kg' : undefined} onClick={onProfilo}
        sotto={!userWeight ? t('Inserisci il peso nel profilo →')
          : !pesata ? t('serve una seconda pesata')
          : pesata.delta === 0 ? t('uguale al {data}', { data: fmtDayMon(pesata.da) })
          : t('{d} kg dal {data}', { d: `${segno(pesata.delta)}${fmtNum(Math.abs(pesata.delta))}`, data: fmtDayMon(pesata.da) })}/>
    </div>
  )
}

function Numero({ etichetta, valore, unita, sotto, onClick }: {
  etichetta: string; valore: string; unita?: string; sotto: string; onClick?: () => void
}) {
  const corpo = (
    <>
      <span style={{ ...ETICHETTA, display: 'block' }}>{etichetta}</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
        <span style={{ fontFamily: NUC.display, fontSize: 40, fontWeight: 800, lineHeight: .9, color: NUC.ink, fontVariantNumeric: 'tabular-nums' }}>{valore}</span>
        {unita && <span style={{ fontFamily: NUC.display, fontSize: 15, fontWeight: 700, color: NUC.faint, textTransform: 'uppercase' }}>{unita}</span>}
      </span>
      <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 13, color: NUC.faint, marginTop: 6, lineHeight: 1.3 }}>{sotto}</span>
    </>
  )
  const stile: CSSProperties = { padding: '14px 16px', background: 'var(--surface)', minWidth: 0, textAlign: 'left' }
  return onClick
    ? <button type="button" onClick={onClick} className="j-focus" style={{ ...stile, border: 'none', cursor: 'pointer', color: 'inherit' }}>{corpo}</button>
    : <div style={stile}>{corpo}</div>
}

// ── I pezzi comuni ─────────────────────────────────────────────

const ETICHETTA: CSSProperties = {
  fontFamily: NUC.display, fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
  textTransform: 'uppercase', color: NUC.faint,
}

/** Il titolo di un blocco: grande a sinistra (col numero in grigio), a destra
 *  una nota o il collegamento alla sezione intera. */
function Titolo({ testo, numero, destra }: { testo: string; numero?: number; destra?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
      <h2 style={{ margin: 0, fontFamily: NUC.display, fontSize: 26, fontWeight: 800, lineHeight: 1, textTransform: 'uppercase', color: NUC.ink }}>
        {testo}{numero !== undefined && <span style={{ color: NUC.faint }}> · {numero}</span>}
      </h2>
      {destra}
    </div>
  )
}

function Collegamento({ testo, onClick }: { testo: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="j-focus" style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0, flexShrink: 0,
      background: 'none', border: 'none', cursor: 'pointer', color: NUC.ink,
      fontFamily: NUC.display, fontSize: 14, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
    }}>
      {testo} <Icons.arrow size={15} stroke={2.4}/>
    </button>
  )
}

const NOTA: CSSProperties = { ...ETICHETTA, fontSize: 13 }
const RIQUADRO: CSSProperties = { background: 'var(--surface)', border: 'var(--bordo)' }

/** "12.480": i chili di un allenamento, col punto delle migliaia come
 *  `fmtNum` ha la virgola dei decimali. */
function fmtMigliaia(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** "1h05" · "55'": la durata come la si scrive a mano. */
function fmtOre(sec: number): string {
  const min = Math.max(1, Math.round(sec / 60))
  return min < 60 ? `${min}'` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
}

/** "12.480" + "kg" piccolo: i chili grandi, l'unità accanto in grigio. "BW" e
 *  "BW +10 kg" restano interi. */
function chiliEUnita(testo: string, grande = 14): ReactNode {
  const m = testo.match(/^(.*\d)\s?(kg)$/)
  if (!m || m[1].startsWith('BW')) return testo
  return <>{m[1]}<span style={{ fontSize: Math.round(grande * .7), color: NUC.faint, marginLeft: 3 }}>{m[2].toUpperCase()}</span></>
}

// ── La scheda di oggi ──────────────────────────────────────────

function SchedaDiOggiDesktop({ onApriEsercizio }: { onApriEsercizio: (ex: PalestraExercise) => void }) {
  const t = useT()
  const tData = useTData()
  const vai = useNavDesktop(s => s.vai)
  const oggi = useSchedaDiOggi()
  const palestra = useJarvisStore(st => st.palestraExercises)
  const peso = useJarvisStore(st => st.userWeight ?? 0)

  if (!oggi) {
    return (
      <section style={{ background: 'var(--ink)', color: 'var(--surface)', padding: '22px 22px 24px' }}>
        <div style={{ ...ETICHETTA, color: 'var(--accent-su-ink)' }}>{t('Oggi')}</div>
        <div style={{ fontFamily: NUC.display, fontSize: 40, fontWeight: 800, lineHeight: 1, textTransform: 'uppercase', marginTop: 6 }}>{t('Nessuna scheda')}</div>
        <p style={{ fontFamily: NUC.font, fontSize: 15, lineHeight: 1.5, color: 'var(--muted-dark)', margin: '8px 0 16px', maxWidth: 460 }}>
          {t('Nessuna scheda. Scrivine una: da qui ti dirà ogni giorno quale tocca.')}
        </p>
        <button type="button" onClick={() => vai({ sezione: 'schede', nuova: true })} className="j-btn-accent-sm j-focus" style={{ width: 'auto', padding: '0 18px', marginTop: 0 }}>
          {t('Crea una scheda')}
        </button>
      </section>
    )
  }

  const { scheda, fattaOggi } = oggi
  const muscoli = muscoliDellaScheda(scheda, palestra)
  const righe = scheda.exercises.filter(e => e.name.trim())
  const minuti = Math.round(durataArrotondata(durataPrevista(scheda)) / 60)
  const aperta = sessioneAperta()
  const avanzamento = aperta?.schedaId === scheda.id && !fattaOggi ? allenamentoInCorso(id => (id === scheda.id ? scheda : undefined)) : undefined
  const inCorsoOggi = !!avanzamento && !avanzamento.vecchia

  const numero = (v: string, k: string, primo = false) => (
    <div style={{ padding: '8px 12px', borderLeft: primo ? 'none' : '1px solid var(--line-dark)', minWidth: 58 }}>
      <div style={{ fontFamily: NUC.display, fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{v}</div>
      <div style={{ ...ETICHETTA, fontSize: 11.5, color: 'var(--muted-dark)', marginTop: 3 }}>{k}</div>
    </div>
  )

  return (
    <section style={RIQUADRO}>
      <div style={{ background: 'var(--ink)', color: 'var(--surface)', padding: '16px 18px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...ETICHETTA, color: 'var(--accent-su-ink)' }}>
            {fattaOggi ? t('Oggi · {scheda} · fatta', { scheda: scheda.title })
              : inCorsoOggi ? t('In corso · {scheda}', { scheda: scheda.title })
              : t('Oggi · {scheda}', { scheda: scheda.title })}
          </div>
          <div style={{ fontFamily: NUC.display, fontSize: 56, fontWeight: 800, lineHeight: .9, textTransform: 'uppercase', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tData(muscoli[0]?.muscolo ?? scheda.title)}
          </div>
        </div>
        <div style={{ display: 'flex', border: '1px solid var(--line-dark)', flexShrink: 0 }}>
          {numero(String(righe.length), righe.length === 1 ? t('esercizio') : t('esercizi'), true)}
          {numero(avanzamento && inCorsoOggi ? `${avanzamento.fatte}/${avanzamento.totali}` : String(serieDellaScheda(scheda)), t('serie'))}
          {numero(minuti ? `${minuti}'` : '—', t('stima'))}
        </div>
      </div>
      <table className="j-desk-tabella">
        <colgroup>
          <col style={{ width: 40 }}/><col/><col style={{ width: '13%' }}/><col style={{ width: '12%' }}/>
          <col style={{ width: '14%' }}/><col style={{ width: '12%' }}/><col style={{ width: '14%' }}/>
        </colgroup>
        <thead>
          <tr><th>#</th><th>{t('Esercizio')}</th><th>{t('Gruppo')}</th><th>{t('Serie × rip')}</th><th>{t('Ultimo carico')}</th><th>{t('1RM stimato')}</th><th>{t('Ultima volta')}</th></tr>
        </thead>
        <tbody>
          {righe.map((r, i) => {
            const ex = esercizioDellaRiga(r, palestra)
            const ultima = ex ? sortedHistory(ex.history).pop() : undefined
            const massimale = ultima && !(ultima.bodyweight && !peso) ? Math.round(entry1RM(ultima, peso * quotaCorpo(ex))) : 0
            return (
              <tr key={r.id} data-tocca={ex ? '' : undefined} onClick={ex ? () => onApriEsercizio(ex) : undefined}>
                <td className="j-desk-cifra">{i + 1}</td>
                <td>
                  {ex
                    ? <button type="button" className="j-desk-nome j-focus" onClick={e => { e.stopPropagation(); onApriEsercizio(ex) }}>{tData(r.name.trim())}</button>
                    : <span className="j-desk-nome">{tData(r.name.trim())}</span>}
                </td>
                <td className="j-desk-sigla">{tData(muscoloDellaRiga(r, palestra))}</td>
                <td className="j-desk-cifra">{Math.max(1, Math.floor(r.sets) || 1)} × {r.reps || '—'}</td>
                <td className="j-desk-cifra">{ultima ? fmtKg(ultima).replace(/\s?kg$/, '') : '—'}</td>
                <td className="j-desk-cifra">{massimale > 0 ? massimale : '—'}</td>
                <td className="j-desk-tenue">{ultima?.date ? fmtDayMonth(ultima.date) : t('mai registrato')}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

// ── Le schede ──────────────────────────────────────────────────

function ElencoSchede({ oggi }: { oggi: string }) {
  const t = useT()
  const vai = useNavDesktop(s => s.vai)
  const schede = useSchedeVisibili()
  const palestra = useJarvisStore(st => st.palestraExercises)
  const ultime = useMemo(() => ultimaVoltaPerScheda(palestra), [palestra])
  const complete = schede.filter(sc => !sc.draft)
  const bozze = schede.filter(sc => sc.draft)

  return (
    <section>
      <Titolo testo={t('Schede')} numero={complete.length} destra={<Collegamento testo={t('Tutte')} onClick={() => vai('schede')}/>}/>
      <div className="j-desk-schede">
        {[...complete, ...bozze].map((sc, i) => (
          <CartaScheda key={sc.id} scheda={sc} numero={i + 1} ultima={ultime.get(sc.id) ?? null} oggi={oggi}
            onApri={() => vai({ sezione: 'schede', apri: sc.id })}/>
        ))}
        <button type="button" onClick={() => vai({ sezione: 'schede', nuova: true })} className="j-focus" style={{
          minHeight: 132, cursor: 'pointer', background: 'transparent', border: '2px dashed var(--fg-mute)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
          fontFamily: NUC.display, fontSize: 15, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: NUC.ink,
        }}>
          <Icons.plus size={20} stroke={2.2}/> {t('Nuova scheda')}
        </button>
      </div>
    </section>
  )
}

/** Una scheda come un foglio: l'angolo piegato, il margine rosso del quaderno,
 *  e l'ombra d'inchiostro — si prende e si apre. */
function CartaScheda({ scheda, numero, ultima, oggi, onApri }: {
  scheda: GymScheda; numero: number; ultima: string | null; oggi: string; onApri: () => void
}) {
  const t = useT()
  const esercizi = scheda.exercises.filter(e => e.name.trim()).length
  const durata = durataArrotondata(durataPrevista(scheda))
  const giorni = ultima ? Math.max(0, giorniTra(ultima, oggi)) : null
  const riga: CSSProperties = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, fontFamily: NUC.display, fontWeight: 700, textTransform: 'uppercase' }
  return (
    <button type="button" onClick={onApri} className="j-focus j-desk-carta">
      <svg aria-hidden width="22" height="22" viewBox="0 0 22 22" style={{ position: 'absolute', top: -2, right: -2 }}>
        <polygon points="0,0 22,0 22,22" fill="var(--bg)"/>
        <polygon points="0,0 22,22 0,22" fill="var(--line)" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="miter"/>
      </svg>
      <span aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: 10, width: 1, background: 'var(--j-accent)', opacity: .45 }}/>
      <span style={{ ...ETICHETTA, fontSize: 11.5, display: 'block' }}>{scheda.draft ? t('Bozza') : `N° ${String(numero).padStart(2, '0')}`}</span>
      <span style={{ display: 'block', fontFamily: NUC.display, fontSize: 26, fontWeight: 800, lineHeight: 1, textTransform: 'uppercase', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>
        {scheda.title.trim() || t('Senza nome')}
      </span>
      <span style={{ ...riga, fontSize: 15, marginTop: 10 }}>
        <span>{esercizi} <span style={{ marginLeft: 10 }}>{t('es.')}</span></span>
        <span>{durata ? `≈${fmtOre(durata)}` : '—'}</span>
      </span>
      <span aria-hidden style={{ display: 'block', borderTop: '1px dashed var(--fg-mute)', margin: '8px 0' }}/>
      <span style={{ ...riga, fontSize: 15 }}>
        <span style={{ ...ETICHETTA, fontSize: 11.5 }}>{t('Ultima')}</span>
        <span>{giorni === null ? t('mai') : giorni === 0 ? t('oggi') : t('{n} gg', { n: giorni })}</span>
      </span>
    </button>
  )
}

// ── Gli ultimi allenamenti ─────────────────────────────────────

function UltimeSessioni({ sessioni, oggi }: { sessioni: SessioneFatta[]; oggi: string }) {
  const t = useT()
  const tData = useTData()
  const lang = useLang()
  const vai = useNavDesktop(s => s.vai)
  const [periodo, setPeriodo] = useState<Periodo>('30')
  const righe = periodo === 'tutte' ? sessioni : sessioniFra(sessioni, giorniPrima(oggi, Number(periodo) - 1), oggi)
  const giorno = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`)
    return `${daysAbbr(lang)[(d.getDay() + 6) % 7]} ${fmtDayMon(iso)}`
  }
  const periodi: Array<[Periodo, string]> = [['7', t('7 gg')], ['30', t('30 gg')], ['tutte', t('Tutte')]]

  return (
    <section>
      <Titolo testo={t('Ultime sessioni')} destra={
        <div role="group" aria-label={t('Periodo')} style={{ display: 'flex', border: 'var(--bordo)', background: 'var(--surface)' }}>
          {periodi.map(([v, nome], i) => (
            <button key={v} type="button" onClick={() => setPeriodo(v)} aria-pressed={periodo === v} className="j-focus" style={{
              height: 32, padding: '0 12px', cursor: 'pointer', border: 'none', borderLeft: i ? '1px solid var(--line)' : 'none',
              background: periodo === v ? 'var(--ink)' : 'transparent', color: periodo === v ? 'var(--surface)' : NUC.ink,
              fontFamily: NUC.display, fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
            }}>{nome}</button>
          ))}
        </div>
      }/>
      <div style={RIQUADRO}>
        <table className="j-desk-tabella">
          <colgroup>
            <col style={{ width: '16%' }}/><col/><col style={{ width: '11%' }}/><col style={{ width: '9%' }}/>
            <col style={{ width: '16%' }}/><col style={{ width: '11%' }}/><col style={{ width: '11%' }}/>
          </colgroup>
          <thead>
            <tr><th>{t('Data')}</th><th>{t('Scheda')}</th><th>{t('Esercizi')}</th><th>{t('Serie')}</th><th>{t('Volume')}</th><th>{t('Durata')}</th><th>{t('Record')}</th></tr>
          </thead>
          <tbody>
            {righe.length === 0 && (
              <tr><td colSpan={7} className="j-desk-tenue" style={{ padding: '18px 14px' }}>
                {periodo === 'tutte' ? t('Ancora nessun allenamento registrato.') : t('Nessun allenamento negli ultimi {n} giorni.', { n: periodo })}
              </td></tr>
            )}
            {righe.map(x => (
              <tr key={`${x.data}-${x.scheda?.id ?? ''}`} data-tocca="" onClick={() => vai({ sezione: 'calendario', giorno: x.data })}>
                <td className="j-desk-cifra" style={{ textTransform: 'uppercase' }}>{giorno(x.data)}</td>
                <td><span className="j-desk-nome">{x.scheda ? tData(x.scheda.nome) : t('Alzate a parte')}</span></td>
                <td className="j-desk-cifra">{x.esercizi}</td>
                <td className="j-desk-cifra">{x.serie}</td>
                <td className="j-desk-cifra">{x.volume > 0 ? chiliEUnita(`${fmtMigliaia(x.volume)} kg`) : '—'}</td>
                <td className="j-desk-cifra">{x.durataSec ? fmtOre(x.durataSec).toUpperCase() : '—'}</td>
                <td>{x.record > 0 && <span className="j-desk-pr">+{x.record} PR</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ── Il mese ────────────────────────────────────────────────────

function Mese({ giorni, oggi }: { giorni: Map<string, unknown>; oggi: string }) {
  const t = useT()
  const lang = useLang()
  const vai = useNavDesktop(s => s.vai)
  const [y, m] = oggi.split('-').map(Number)
  const quanti = new Date(y, m, 0).getDate()
  const vuote = (new Date(y, m - 1, 1).getDay() + 6) % 7
  const dopo = (7 - ((vuote + quanti) % 7)) % 7
  const celle = [
    ...Array.from({ length: vuote }, () => null),
    ...Array.from({ length: quanti }, (_, i) => `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`),
    ...Array.from({ length: dopo }, () => null),
  ]
  const fatti = celle.filter(c => c && giorni.has(c)).length
  const serie = settimaneDiFila(giorni.keys(), oggi)
  return (
    <section>
      <Titolo testo={fmtMese(m - 1, lang)} destra={
        <span style={NOTA}>{fatti === 1 ? t('1 giorno') : t('{n} giorni', { n: fatti })} · {t('{n} sett. di fila', { n: serie })}</span>
      }/>
      <div style={RIQUADRO}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: 'var(--bordo)' }}>
          {daysShort(lang).map(g => g[0]).map((g, i) => <div key={i} style={{ ...ETICHETTA, fontSize: 11.5, textAlign: 'center', padding: '5px 0', color: NUC.ink }}>{g}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {celle.map((c, i) => {
            const bordi: CSSProperties = { borderTop: i >= 7 ? '1px solid var(--line)' : 'none', borderLeft: i % 7 ? '1px solid var(--line)' : 'none' }
            if (!c) return <div key={i} style={{ ...bordi, background: 'var(--surface-2)', minHeight: 36 }}/>
            const fatto = giorni.has(c), eOggi = c === oggi, futuro = c > oggi
            return (
              <button key={c} type="button" disabled={futuro} onClick={() => vai({ sezione: 'calendario', giorno: c })}
                aria-label={`${fmtDayMon(c)}${fatto ? ` · ${t('allenato')}` : ''}`} aria-current={eOggi ? 'date' : undefined} className="j-focus" style={{
                  ...bordi, borderRight: 'none', borderBottom: 'none',
                  minHeight: 36, padding: '6px 0 8px', position: 'relative', cursor: futuro ? 'default' : 'pointer',
                  background: eOggi ? 'var(--ink)' : 'var(--surface)',
                  color: eOggi ? 'var(--surface)' : futuro ? 'var(--muted-dark)' : NUC.ink,
                  fontFamily: NUC.display, fontSize: 15, fontWeight: fatto || eOggi ? 800 : 500, fontVariantNumeric: 'tabular-nums',
                }}>
                {Number(c.slice(8))}
                {fatto && !eOggi && <span aria-hidden style={{ position: 'absolute', left: 6, right: 6, bottom: 4, height: 3, background: 'var(--j-accent)' }}/>}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── La forza ───────────────────────────────────────────────────

function Forza({ distretti, total, senzaPeso, onProfilo }: {
  distretti: ReturnType<typeof districtStrength>; total: number | null; senzaPeso: boolean; onProfilo: () => void
}) {
  const t = useT()
  const tData = useTData()
  // Dal più forte al più debole: l'ultimo, quello rimasto indietro, è in rosso.
  const allenati = distretti.filter(d => d.best > 0).sort((a, b) => b.score - a.score)
  return (
    <section>
      <Titolo testo={t('Forza')} destra={
        <span style={NOTA}>{t('su 100')}{total !== null ? ` · ${t('massimali {kg} kg', { kg: total })}` : ''}</span>
      }/>
      <div style={{ ...RIQUADRO, padding: '6px 14px' }}>
        {senzaPeso ? (
          <button type="button" onClick={onProfilo} className="j-focus" style={{ ...NOTA, color: 'var(--j-accent-ink)', background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer', textAlign: 'left' }}>
            {t('Inserisci il peso nel profilo →')}
          </button>
        ) : allenati.length === 0 ? (
          <p style={{ fontFamily: NUC.font, fontSize: 14, color: NUC.faint, margin: '10px 0' }}>{t('Registra un’alzata: qui vedrai quanto è forte ogni gruppo.')}</p>
        ) : allenati.map((d, i) => {
          const ultimo = allenati.length > 1 && i === allenati.length - 1
          return (
            <div key={d.muscle} style={{ display: 'grid', gridTemplateColumns: '78px minmax(0, 1fr) 34px', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <span style={{ fontFamily: NUC.font, fontSize: 14, color: NUC.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tData(d.muscle)}</span>
              <span aria-hidden style={{ height: 8, background: 'var(--surface-2)' }}>
                <span style={{ display: 'block', height: '100%', width: `${Math.max(2, Math.min(100, d.score))}%`, background: ultimo ? 'var(--j-accent)' : 'var(--ink)' }}/>
              </span>
              <span style={{ fontFamily: NUC.display, fontSize: 20, fontWeight: 800, textAlign: 'right', color: NUC.ink, fontVariantNumeric: 'tabular-nums' }}>{d.score}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Gli allievi ────────────────────────────────────────────────

function Allievi({ oggi }: { oggi: string }) {
  const t = useT()
  const vai = useNavDesktop(s => s.vai)
  const allievi = useAllievi(s => s.allievi)
  const { messaggi, userId } = useMessaggi()
  if (!allievi.length) return null
  const daLeggere = userId ? nonLetti(messaggi, userId) : []
  const lunedi = lunediDi(oggi)
  return (
    <section>
      <Titolo testo={t('Allievi')} numero={allievi.length} destra={<Collegamento testo={t('Coaching')} onClick={() => vai('allievi')}/>}/>
      <div style={RIQUADRO}>
        {allievi.map(({ link, dati }, i) => {
          const nome = (link.athlete_name ?? dati?.userName ?? '').trim()
          const palestra = dati?.palestraExercises ?? []
          const settimana = sessioniFra(sessioniFatte(palestra, dati?.userWeight ?? 0, []), lunedi, oggi).length
          const ultimo = ultimoAllenamento(palestra)
          const nuovi = daLeggere.filter(m => m.autore === link.athlete_id).length
          const sotto = !dati ? t('dati non disponibili')
            : [
                settimana === 0 ? t('nessun allenamento questa settimana') : settimana === 1 ? t('1 allenamento questa settimana') : t('{n} allenamenti questa settimana', { n: settimana }),
                ultimo ? t('ultimo {quando}', { quando: quantoFa(Math.max(0, giorniTra(ultimo, oggi)), t) }) : null,
              ].filter(Boolean).join(' · ')
          return (
            <button key={link.athlete_id} type="button" onClick={() => vai('allievi')} className="j-focus" style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer',
              background: 'transparent', border: 'none', borderTop: i ? '1px solid var(--line)' : 'none', textAlign: 'left', color: NUC.ink,
            }}>
              <span aria-hidden style={{ width: 34, height: 34, flexShrink: 0, background: 'var(--ink)', color: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: NUC.display, fontSize: 17, fontWeight: 800, textTransform: 'uppercase' }}>
                {nome[0] ?? '?'}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontFamily: NUC.display, fontSize: 18, fontWeight: 800, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome || t('Allievo')}</span>
                <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 13, color: NUC.faint, lineHeight: 1.35 }}>{sotto}</span>
              </span>
              {nuovi > 0 && (
                <span style={{ flexShrink: 0, padding: '3px 7px', border: 'var(--bordo)', fontFamily: NUC.display, fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {nuovi === 1 ? t('1 messaggio') : t('{n} messaggi', { n: nuovi })}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ── I record ───────────────────────────────────────────────────

function Record({ record, onApri }: { record: ReturnType<typeof recordFatti>; onApri: (ex: PalestraExercise) => void }) {
  const t = useT()
  const tData = useTData()
  const vai = useNavDesktop(s => s.vai)
  return (
    <section>
      <Titolo testo={t('Record')} numero={record.length} destra={record.length > 0 ? <Collegamento testo={t('Tutti')} onClick={() => vai('statistiche')}/> : undefined}/>
      <div style={RIQUADRO}>
        {record.length === 0 && <p style={{ fontFamily: NUC.font, fontSize: 14, color: NUC.faint, margin: 0, padding: '12px 14px' }}>{t('Ancora nessun record: arrivano quando superi il massimale di un esercizio.')}</p>}
        {record.slice(0, 3).map(({ esercizio, alzata }, i) => (
          <button key={`${esercizio.id}-${alzata.date}-${i}`} type="button" onClick={() => onApri(esercizio)} className="j-focus" style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', cursor: 'pointer',
            background: 'transparent', border: 'none', borderTop: i ? '1px solid var(--line)' : 'none', textAlign: 'left', color: NUC.ink,
          }}>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tData(esercizio.n)}</span>
              <span style={{ ...ETICHETTA, fontSize: 11.5, display: 'block', marginTop: 2 }}>
                {tData(esercizio.muscle)} · {alzata.date ? fmtDayMonth(alzata.date) : alzata.d} · {alzata.sets_n} × {fmtReps(alzata)}
              </span>
            </span>
            <span style={{ flexShrink: 0, fontFamily: NUC.display, fontSize: 26, fontWeight: 800, color: NUC.ink, whiteSpace: 'nowrap' }}>{chiliEUnita(fmtKg(alzata), 26)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

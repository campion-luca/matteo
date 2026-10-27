// Tutti i modali della sezione Allenamento, in un file solo.
//
// Stanno insieme perché condividono la stessa impalcatura (JModal + campi
// "j-field") e perché nessuno di loro ha senso fuori dalla palestra: registrare
// un'alzata, correggerne una vecchia, creare un esercizio, cambiarne i dati.
// La differenza di fondo fra i due mondi: in palestra si registrano CARICO ×
// ripetizioni × serie, in Hyrox un TEMPO su una distanza — da qui due modali di
// log separati invece di uno generico pieno di if.
import { useState, useMemo, useEffect } from 'react'
import type React from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { selezionaAlFocus, preCompila } from '@/lib/campi'
import { useT, useTData } from '@/lib/i18n'
import { NucEyebrow } from '@/components/ui/NucComponents'
import { JModal, JFoglio } from '@/components/ui/Primitives'
import { Icons } from '@/components/ui/Icons'
import { useJarvisStore } from '@/store/useJarvisStore'
import type { HyroxExercise, HyroxGara, HyroxHistoryEntry, PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'
import {
  MUSCLE_COLORS, COLOR_PALETTE,
  displayMuscle, fmtKgVerso, fmtNum, fmtReps, pace, weekLabel, estimate1RM, entry1RM, normalizzaDecimale, parseNum,
  effectiveLoad, sortedHistory, fmtTime, colpiMigliori, RACE_STATIONS, ultimaDiLavoro,
  } from './gymModel'
import { chiliScritti } from './riassuntoAllenamento'
import { numeroImpossibile, testoImpossibile, saltoDaConfermare, caricoDiRiferimento, SERIE_MAX, type CampoAlzata } from './limitiAlzata'
import { LineChart } from './gymShared'
import { MuscleIcon, FIGURE_DISPONIBILI as FIGURE } from './MuscleIcons'
import { FormatoSwitch } from './FormatoSwitch'
import { type FormatoHyrox, unitaFormato, distanzaLeggibile, registraPasso, unitaDelTempo, tempoConfrontabile, fmtTempoGara, cifreInTempo, cifreInSec, secInCifre } from './hyroxStima'
import { useBodyWeight, useGruppiMuscolari } from './gymHooks'
import { corpoLibero, quotaCorpo, aColpi } from './catalogo'
import { todayISO } from '@/lib/isoDate'
import { uid } from '@/lib/uid'
import { fmtShortDate, fmtDayMonth, fmtDayMon } from '@/lib/dateFormat'

// I modali della scheda Allenamento: registrare una prestazione, aggiungere o
// modificare un esercizio, correggere una riga di storico.
// Sono foglie — non conoscono nessuna delle pagine che li aprono.

// La micro-label sopra un campo. Era ricopiata inline a ogni campo del file, con
// la stessa mezza dozzina di proprietà: un posto solo, così restano allineate.
// Le scritte di queste finestre stanno a 12px, non sotto (rebranding, ott 2026):
// erano rimaste a 9-11, del tema di prima.
const ETICHETTA: React.CSSProperties = {
  fontFamily: NUC.label, fontSize: 12, letterSpacing: '.14em',
  color: NUC.faint, textTransform: 'uppercase', marginTop: 2,
}

export interface LogHyroxModalProps {
  open: boolean; onClose: () => void
  ex: HyroxExercise | null
  onSave: (entry: HyroxHistoryEntry) => void
  /** Intera o mezza: decide la distanza proposta. È la STESSA scelta della
   *  sezione, non una copia locale — cambiarla qui cambia anche la pagina sotto,
   *  così la sessione appena salvata compare dove la si sta guardando invece di
   *  finire nell'altro formato e sembrare persa. */
  formato: FormatoHyrox
  onFormato: (f: FormatoHyrox) => void
}

export function LogHyroxModal({ open, onClose, ex, onSave, formato, onFormato }: LogHyroxModalProps) {
  const t = useT()
  const tData = useTData()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const [min, setMin] = useState('')
  const [sec, setSec] = useState('')
  const [units, setUnits] = useState(String(ex?.target ?? 1))
  const [kg, setKg] = useState('')
  const [sets, setSets] = useState('')

  // Il modale resta montato: pre-compila i campi ad ogni apertura (l'init di
  // useState gira una volta sola, con ex ancora null).
  useEffect(() => {
    if (!open || !ex) return
    setDate(todayISO())
    setMin(''); setSec(''); setKg(''); setSets('')
  }, [open, ex])

  // La distanza segue il formato anche a modale aperto: premere "500 m" deve
  // scrivere 500 nel campo, non lasciarlo a 1000 in attesa che qualcuno se ne
  // accorga dopo aver salvato.
  useEffect(() => {
    if (!open || !ex) return
    setUnits(String(unitaFormato(ex.target ?? 1, formato)))
  }, [open, ex, formato])

  if (!ex) return null

  const totalSec = (parseInt(min) || 0) * 60 + (parseInt(sec) || 0)
  const u = parseFloat(units) || ex.target
  // La corsa fino al km si registra col passo, non col tempo della frazione:
  // il campo lo dice, così su 500 m non si scrive 6:00 per leggersi 12:00/km.
  const passo = registraPasso(ex.id, u)
  const paceStr = totalSec > 0 ? pace(totalSec, unitaDelTempo(ex.id, u), ex.unit) : '—'

  const save = () => {
    if (!totalSec || !u) return
    // Un campo data svuotato si salvava come `date: ''` e `d: 'WNaN'`: una
    // sessione senza giorno, fuori da ogni grafico e settimana. Vuoto vale oggi.
    const giorno = date || todayISO()
    onSave({
      d: weekLabel(giorno), date: giorno,
      sec: totalSec, units: u,
      ...(kg ? { kg: parseNum(kg) } : {}),
      ...(sets ? { sets_n: parseInt(sets) } : {}),
    })
    onClose()
  }

  return (
    <JModal open={open} onClose={onClose} title={`${t('Log')} · ${tData(ex.n)}`} width={340}>
      <div className="flex flex-col gap-2.5">
        <FormatoSwitch
          valore={formato} onChange={onFormato}
          etichette={[distanzaLeggibile(ex.target, ex.unit), distanzaLeggibile(ex.target / 2, ex.unit)]}
        />

        <div className="j-eyebrow mb-0.5 mt-1">{t('Data')}</div>
        <input value={date} onChange={e => setDate(e.target.value)} type="date" className="j-field"/>

        <div className="j-eyebrow mt-1">{passo ? t('Passo medio al km') : t('Tempo')}</div>
        <div className="flex gap-2">
          <input value={min} onChange={e => setMin(e.target.value)} placeholder={t('min')} type="number" inputMode="numeric" onFocus={selezionaAlFocus} className="j-field"/>
          <input value={sec} onChange={e => setSec(e.target.value)} placeholder={t('sec')} type="number" inputMode="numeric" onFocus={selezionaAlFocus} className="j-field"/>
        </div>

        <div className="j-eyebrow mt-1">{t('Distanza / Ripetizioni')} ({ex.unit})</div>
        <input value={units} onChange={e => setUnits(e.target.value)} placeholder={String(ex.target)} type="number" inputMode="decimal" onFocus={selezionaAlFocus} className="j-field"/>

        {ex.unit !== 'rep' && (
          <>
            <div className="j-eyebrow mt-1">{t('Kg (opzionale)')}</div>
            <div className="flex gap-2">
              <input value={kg} onChange={e => setKg(normalizzaDecimale(e.target.value))} placeholder="kg" inputMode="decimal" onFocus={selezionaAlFocus} className="j-field"/>
              <input value={sets} onChange={e => setSets(e.target.value)} placeholder={t('serie')} type="number" inputMode="numeric" onFocus={selezionaAlFocus} className="j-field"/>
            </div>
          </>
        )}

        {totalSec > 0 && (
          <div className="flex justify-between items-center px-3.5 py-2.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)' }}>
            <span className="j-eyebrow">{t('Pace')}</span>
            <span style={{ fontFamily: NUC.label, fontSize: 14, color: NUC.accentInk }}>{paceStr}</span>
          </div>
        )}

        <button onClick={save} className="j-btn-accent">{t('Salva')}</button>
      </div>
    </JModal>
  )
}

// ── Registra una gara Hyrox ────────────────────────────────────
// Una gara o una simulazione intera, in un colpo solo: la corsa, le otto
// stazioni, la Roxzone. Undici tempi da scrivere uno dopo l'altro, quindi il
// campo è fatto per scriverli in fretta: si battono solo le cifre e i due punti
// li mette lui — "425" è 4:25, "4040" è 40:40. Sul tastierino numerico del
// telefono i due punti non ci sono, e due campi minuti/secondi per tempo
// sarebbero ventidue caselle.

function CampoTempo({ cifre, onChange, etichetta }: { cifre: string; onChange: (c: string) => void; etichetta: string }) {
  const sbagliato = cifreInSec(cifre) === null
  return (
    <input
      value={cifreInTempo(cifre)}
      onChange={e => onChange(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 6))}
      inputMode="numeric"
      placeholder="0:00"
      aria-label={etichetta}
      aria-invalid={sbagliato || undefined}
      className="j-field"
      style={{
        width: 104, flexShrink: 0, textAlign: 'right', fontFamily: NUC.tempo,
        ...(sbagliato ? { borderColor: 'var(--danger)' } : {}),
      }}
    />
  )
}

export function RegistraGaraModal({ open, onClose, gara, categoriaPredefinita, onSave }: {
  open: boolean; onClose: () => void
  /** Quella da modificare; `null` per una nuova. */
  gara: HyroxGara | null
  /** La categoria proposta a una gara nuova: quella dell'ultima registrata. */
  categoriaPredefinita: HyroxGara['categoria']
  onSave: (g: HyroxGara) => void
}) {
  const t = useT()
  const tData = useTData()
  const [tipo, setTipo] = useState<HyroxGara['tipo']>('gara')
  const [categoria, setCategoria] = useState<HyroxGara['categoria']>(categoriaPredefinita)
  const [date, setDate] = useState(todayISO())
  const [corsa, setCorsa] = useState('')
  const [stazioni, setStazioni] = useState<Record<string, string>>({})
  const [roxzone, setRoxzone] = useState('')

  // Il modale resta montato: si riempie a ogni apertura, con la gara da
  // modificare o vuoto.
  useEffect(() => {
    if (!open) return
    setTipo(gara?.tipo ?? 'gara')
    setCategoria(gara?.categoria ?? categoriaPredefinita)
    setDate(gara?.date ?? todayISO())
    setCorsa(secInCifre(gara?.corsa ?? 0))
    setStazioni(Object.fromEntries(RACE_STATIONS.map(r => [r.id, secInCifre(gara?.stazioni[r.id] ?? 0)])))
    setRoxzone(secInCifre(gara?.roxzone ?? 0))
    // Si riempie all'apertura, non a ogni cambio della categoria proposta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gara])

  const tempi = [corsa, roxzone, ...RACE_STATIONS.map(r => stazioni[r.id] ?? '')]
  const sbagliati = tempi.some(c => cifreInSec(c) === null)
  const mancanti = tempi.filter(c => !(cifreInSec(c) ?? 0)).length
  const valori = {
    corsa: cifreInSec(corsa) ?? 0,
    roxzone: cifreInSec(roxzone) ?? 0,
    stazioni: Object.fromEntries(RACE_STATIONS.map(r => [r.id, cifreInSec(stazioni[r.id] ?? '') ?? 0]).filter(([, v]) => (v as number) > 0)) as Record<string, number>,
  }
  const totale = valori.corsa + valori.roxzone + Object.values(valori.stazioni).reduce((a, b) => a + b, 0)
  const valida = totale > 0 && !sbagliati && /^\d{4}-\d{2}-\d{2}$/.test(date)

  const save = () => {
    if (!valida) return
    onSave({ id: gara?.id ?? uid(), date, tipo, categoria, ...valori })
    onClose()
  }

  const riga = (nome: string, sotto: string, campo: React.ReactNode) => (
    <div key={nome} className="flex items-center justify-between gap-3" style={{ padding: '5px 0' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: NUC.font, fontSize: 14, color: NUC.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</div>
        <div style={{ fontFamily: NUC.label, fontSize: 12.5, letterSpacing: '.08em', textTransform: 'uppercase', color: NUC.faint }}>{sotto}</div>
      </div>
      {campo}
    </div>
  )

  return (
    <JModal open={open} onClose={onClose} title={gara ? t('Modifica gara') : t('Registra una gara')} width={380}>
      <div className="flex flex-col gap-2.5">
        <FormatoSwitch<HyroxGara['tipo']>
          valore={tipo} onChange={setTipo}
          valori={['gara', 'simulazione']} etichette={[t('Gara'), t('Simulazione')]}
          etichettaGruppo={t('Tipo')}
        />
        <FormatoSwitch<HyroxGara['categoria']>
          valore={categoria} onChange={setCategoria}
          valori={['double', 'singolo']} etichette={[t('Double'), t('Singolo')]}
          etichettaGruppo={t('Categoria')}
        />

        <div className="j-eyebrow mb-0.5 mt-1">{t('Data')}</div>
        <input value={date} onChange={e => setDate(e.target.value)} type="date" className="j-field"/>

        <div className="j-eyebrow mt-2">{t('Tempi')}</div>
        <div style={{ fontFamily: NUC.label, fontSize: 12.5, color: NUC.faint, lineHeight: 1.5, marginTop: -4 }}>
          {t('Solo le cifre: 425 diventa 4:25, 4040 diventa 40:40. Un tempo lasciato vuoto non conta.')}
        </div>
        <div>
          {riga(t('Corsa'), t('8 km, sommati'), <CampoTempo cifre={corsa} onChange={setCorsa} etichetta={t('Corsa')}/>)}
          {RACE_STATIONS.map(r => riga(
            tData(r.n), distanzaLeggibile(r.target, r.unit),
            <CampoTempo cifre={stazioni[r.id] ?? ''} onChange={c => setStazioni(st => ({ ...st, [r.id]: c }))} etichetta={tData(r.n)}/>,
          ))}
          {riga(t('Roxzone'), t('tutti i passaggi, sommati'), <CampoTempo cifre={roxzone} onChange={setRoxzone} etichetta={t('Roxzone')}/>)}
        </div>

        <div className="flex items-baseline justify-between gap-3" style={{
          marginTop: 4, padding: '10px 12px', borderRadius: 'var(--radius)',
          background: 'var(--surface-2)', border: '1px solid var(--hairline)',
        }}>
          <span className="j-eyebrow">{t('Totale')}</span>
          <span style={{ textAlign: 'right' }}>
            <span style={{ display: 'block', fontFamily: NUC.tempo, fontSize: 20, color: totale > 0 ? NUC.ink : NUC.faint }}>
              {totale > 0 ? fmtTempoGara(totale) : '—'}
            </span>
            {totale > 0 && mancanti > 0 && (
              <span style={{ display: 'block', fontFamily: NUC.label, fontSize: 12, color: 'var(--tertiary-ink)', marginTop: 2 }}>
                {mancanti === 1 ? t('1 tempo mancante: totale parziale') : t('{n} tempi mancanti: totale parziale', { n: mancanti })}
              </span>
            )}
          </span>
        </div>

        <button onClick={save} disabled={!valida} className="j-btn-accent" style={{ opacity: valida ? 1 : 0.5 }}>{t('Salva')}</button>
      </div>
    </JModal>
  )
}

// ── Edit Hyrox History Modal ───────────────────────────────────
/** La data scelta nel modale, con la sua etichetta settimana. Un campo svuotato
 *  non cancella la data che c'era: lascia la sessione dov'è. */
function conData(date: string): { date?: string; d?: string } {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? { date, d: weekLabel(date) } : {}
}

export function EditHyroxHistModal({ entry, id, unit, onClose, onSave }: {
  entry: HyroxHistoryEntry
  /** Della stazione: la corsa si corregge col passo, come la si registra. */
  id: string; unit: string
  onClose: () => void; onSave: (h: HyroxHistoryEntry) => void
}) {
  const t = useT()
  const [minV, setMin] = useState(String(Math.floor(entry.sec / 60)))
  const [secV, setSec] = useState(String(entry.sec % 60))
  const [units, setUnits] = useState(String(entry.units))
  const [date, setDate] = useState(entry.date ?? '')

  const save = () => {
    const totalSec = (parseInt(minV) || 0) * 60 + (parseInt(secV) || 0)
    if (!totalSec) return
    onSave({ ...entry, ...conData(date), sec: totalSec, units: parseFloat(units) || entry.units })
    onClose()
  }

  return (
    <JModal open={true} onClose={onClose} title={t('Modifica sessione')} width={300}>
      <div className="flex flex-col gap-2.5">
        {/* La data si corregge come il resto: una sessione registrata la sera
            dopo, o col giorno sbagliato, finiva nel posto sbagliato di grafici e
            trend e l'unico rimedio era cancellarla e riscriverla. */}
        <div className="j-eyebrow">{t('Data')}</div>
        <input value={date} onChange={e => setDate(e.target.value)} type="date" className="j-field"/>
        <div className="j-eyebrow mt-1">{registraPasso(id, parseFloat(units) || entry.units) ? t('Passo medio al km') : t('Tempo')}</div>
        <div className="flex gap-2">
          <input value={minV} onChange={e => setMin(e.target.value)} placeholder={t('min')} type="number" inputMode="numeric" onFocus={selezionaAlFocus} className="j-field"/>
          <input value={secV} onChange={e => setSec(e.target.value)} placeholder={t('sec')} type="number" inputMode="numeric" onFocus={selezionaAlFocus} className="j-field"/>
        </div>
        <div className="j-eyebrow mt-1">{t('Quantità')} ({unit})</div>
        <input value={units} onChange={e => setUnits(e.target.value)} type="number" inputMode="decimal" onFocus={selezionaAlFocus} className="j-field"/>
        <button onClick={save} className="j-btn-accent">{t('Salva')}</button>
      </div>
    </JModal>
  )
}

// Un campo con il suo nome scritto piccolo sopra. È per gli occhi: il lettore di
// schermo ha già l'`aria-label` dell'input. Sta fuori dal campo per restare
// visibile anche quando il campo è pieno.
function CampoEtichettato({ etichetta, children }: { etichetta: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span aria-hidden="true" style={{ fontFamily: NUC.label, fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: NUC.faint }}>
        {etichetta}
      </span>
      {children}
    </div>
  )
}

// ── Quello che «Salva» dice quando non salva ───────────────────
// Per un pezzo il tasto, con un campo vuoto, non faceva niente e non diceva
// perché: si restava a premerlo. Adesso il campo che manca diventa rosso e
// sotto c'è scritto cosa serve. Vale anche per i numeri che non si accettano
// (vedi limitiAlzata).
interface Problema { campo: CampoAlzata; testo: string }

const ROSSO = { borderColor: 'var(--danger)' } as const

/** La riga rossa sopra il tasto, e l'avviso del salto di carico: un numero
 *  improbabile non si rifiuta, si fa guardare una seconda volta. */
function AvvisiSalvataggio({ problema, salto }: {
  problema: Problema | null
  salto: { nuovo: number; ultimo: number } | null
}) {
  const t = useT()
  return (
    <>
      {problema && (
        <div role="alert" style={{ fontFamily: NUC.label, fontSize: 12, lineHeight: 1.5, color: 'var(--danger)' }}>
          {problema.testo}
        </div>
      )}
      {salto && (
        <div role="alert" style={{
          padding: '8px 10px', borderRadius: 'var(--radius-sm)',
          background: 'rgba(var(--warn-rgb),0.10)', border: '1px solid rgba(var(--warn-rgb),0.35)',
          fontFamily: NUC.label, fontSize: 12, lineHeight: 1.5, color: 'var(--warn)',
        }}>
          {t('Hai scritto {nuovo} kg: l’ultima volta erano {ultimo}. Se è giusto, conferma.', { nuovo: fmtNum(salto.nuovo), ultimo: fmtNum(salto.ultimo) })}
        </div>
      )}
    </>
  )
}

// Il peso dell'attrezzo a vuoto: bilanciere, multipower. È facoltativo, e alla
// maggior parte degli esercizi non serve: chiuso è una riga di testo, come la
// data dell'alzata — un campo sempre aperto si leggerebbe come una cosa da
// compilare. Chi lo scrive, nei chili mette i soli dischi.
function CampoAttrezzo({ valore, onChange, errore }: { valore: string; onChange: (v: string) => void; errore?: boolean }) {
  const t = useT()
  const [aperto, setAperto] = useState(!!valore)
  // Un valore che arriva da fuori (l'attrezzo dell'esercizio, a modale già
  // montato) apre il campo; e una volta aperto non si richiude svuotandolo,
  // o sparirebbe da sotto le dita di chi lo sta correggendo.
  useEffect(() => { if (valore) setAperto(true) }, [valore])
  if (!aperto) {
    return (
      <button type="button" onClick={() => setAperto(true)} style={LINK_FOGLIO}>
        {t('+ Peso dell’attrezzo a vuoto')}
      </button>
    )
  }
  const n = parseNum(valore)
  return (
    <>
      <CampoEtichettato etichetta={t('attrezzo a vuoto · facoltativo')}>
        <input
          value={valore} onChange={e => onChange(normalizzaDecimale(e.target.value))}
          placeholder={t('kg di bilanciere o multipower')} aria-label={t('Peso dell’attrezzo a vuoto')}
          inputMode="decimal" onFocus={selezionaAlFocus} className="j-field"
          aria-invalid={errore || undefined} style={errore ? ROSSO : undefined}
        />
      </CampoEtichettato>
      {n > 0 && (
        <div role="note" style={{ fontFamily: NUC.label, fontSize: 12.5, lineHeight: 1.5, color: NUC.faint }}>
          {t('Nei chili scrivi solo i dischi: i {kg} kg dell’attrezzo si sommano da sé.', { kg: fmtNum(n) })}
        </div>
      )}
    </>
  )
}

// ── I pezzi dei fogli dell'alzata ──────────────────────────────
// «Nuova alzata» e «Modifica alzata» sono lo stesso modulo (ott 2026): la data,
// stesso peso o serie per serie, i numeri, il carico e il tipo di alzata, il
// massimale che ne viene. Cambiano la testata e il fondo. I pezzi stanno qui,
// una volta sola, e le due finestre li compongono.

/** L'etichetta sopra un campo dei fogli: Condensed maiuscolo, grigia. */
const ETICHETTA_FOGLIO: React.CSSProperties = {
  fontFamily: NUC.display, fontSize: 13, fontWeight: 700, letterSpacing: '.1em',
  textTransform: 'uppercase', color: NUC.faint,
}

/** La data dell'alzata: un tasto col calendario, sotto il titolo. Si legge
 *  prima di toccarla ("Oggi · 26 ott"), e toccandola si apre il calendario del
 *  telefono: il campo data vero sta sopra il tasto, trasparente. Con `conAnno`
 *  la data intera, per un'alzata già registrata che può essere di mesi fa. */
function ChipData({ valore, onChange, etichetta, conAnno = false }: {
  valore: string
  onChange: (d: string) => void
  etichetta: string
  conAnno?: boolean
}) {
  const t = useT()
  const testo = !valore ? t('Senza data')
    : conAnno ? `${fmtDayMon(valore)} ${valore.slice(0, 4)}`
    : valore === todayISO() ? `${t('Oggi')} · ${fmtDayMon(valore)}`
    : fmtDayMon(valore)
  return (
    <span className="j-casella" style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px',
      border: 'var(--bordo)', background: 'var(--surface)', color: NUC.ink,
    }}>
      <Icons.calendar size={16} stroke={1.8}/>
      <span style={{ fontFamily: NUC.display, fontSize: 15, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{testo}</span>
      <input
        type="date" value={valore} aria-label={etichetta}
        onChange={e => e.target.value && onChange(e.target.value)}
        // Su desktop il campo data si apre solo dalla sua icona: lo si apre a mano.
        onClick={e => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.() } catch { /* già aperto, o non permesso */ } }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 0, padding: 0, margin: 0 }}
      />
    </span>
  )
}

/** Stesso peso su tutte le serie, o serie per serie. Spenta su un massimale,
 *  che di serie ne ha una. */
function SceltaPerSerie({ perSet, onChange, corpo, spenta }: {
  perSet: boolean; onChange: (perSet: boolean) => void; corpo: boolean; spenta?: boolean
}) {
  const t = useT()
  return (
    <div aria-disabled={spenta || undefined} style={{ opacity: spenta ? 0.4 : 1, pointerEvents: spenta ? 'none' : undefined, transition: 'opacity 180ms' }}>
      <FormatoSwitch<'uguale' | 'serie'>
        valore={perSet ? 'serie' : 'uguale'} onChange={v => onChange(v === 'serie')}
        valori={['uguale', 'serie']}
        etichette={[corpo ? t('Stessa zavorra') : t('Stesso kg'), t('Per serie')]}
        etichettaGruppo={t('Peso uguale o per serie')}
      />
    </div>
  )
}

/** Una casella col bordo d'inchiostro e il numero grande dentro. */
function CasellaNumero({ etichetta, errore, children }: { etichetta: string; errore?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...ETICHETTA_FOGLIO, marginBottom: 6 }}>{etichetta}</div>
      <div className="j-casella" data-errore={errore || undefined} style={{ height: 56, border: 'var(--bordo)', background: 'var(--surface)' }}>
        {children}
      </div>
    </div>
  )
}

const PIU_MENO: React.CSSProperties = {
  width: 30, flexShrink: 0, padding: 0, border: 'none', background: 'var(--surface)', color: NUC.ink,
  fontFamily: NUC.display, fontSize: 22, fontWeight: 700, lineHeight: 1, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

/** Serie · Rip · Kg sulla stessa riga, col peso uguale per tutte. Le serie hanno
 *  il − e il + ai lati: si cambiano di una alla volta molto più spesso di
 *  quanto le si scriva. Su un massimale serie e colpi sono 1 × 1, e restano al
 *  loro posto spente invece di sparire, così la riga non balla. */
function NumeriAlzata({ serie, onSerie, colpi, onColpi, kg, onKg, corpo, massimale, segna }: {
  serie: string; onSerie: (v: string) => void
  colpi: string; onColpi: (v: string) => void
  kg: string; onKg: (v: string) => void
  corpo: boolean; massimale: boolean
  segna: (campo: CampoAlzata) => boolean
}) {
  const t = useT()
  const n = parseInt(serie) || 0
  const passo = (d: number) => onSerie(String(Math.min(SERIE_MAX, Math.max(1, n + d))))
  const fisso = (v: string) => (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: NUC.display, fontSize: 26, fontWeight: 800, color: 'var(--muted-dark)', background: 'var(--surface-2)' }}>{v}</div>
  )
  return (
    // La colonna delle serie un po' più larga: dentro ha anche il − e il +, e a
    // 320px di larghezza un "12" fra i due non ci stava.
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
      <CasellaNumero etichetta={t('Serie')} errore={segna('serie')}>
        {massimale ? fisso('1') : (
          <>
            <button type="button" onClick={() => passo(-1)} aria-label={t('Una serie in meno')} style={{ ...PIU_MENO, borderRight: 'var(--bordo)' }}>−</button>
            <input value={serie} onChange={e => onSerie(e.target.value.replace(/[^0-9]/g, ''))} aria-label={t('Serie')} inputMode="numeric"
              onFocus={selezionaAlFocus} className="j-campo-numero" style={{ textAlign: 'center', padding: 0 }} aria-invalid={segna('serie') || undefined}/>
            <button type="button" onClick={() => passo(1)} aria-label={t('Una serie in più')} style={{ ...PIU_MENO, borderLeft: 'var(--bordo)' }}>+</button>
          </>
        )}
      </CasellaNumero>
      <CasellaNumero etichetta={t('Rip')} errore={segna('colpi')}>
        {massimale ? fisso('1') : (
          <input value={colpi} onChange={e => onColpi(e.target.value.replace(/[^0-9]/g, ''))} aria-label={t('Colpi')} inputMode="numeric"
            onFocus={selezionaAlFocus} className="j-campo-numero" style={{ textAlign: 'center' }} aria-invalid={segna('colpi') || undefined}/>
        )}
      </CasellaNumero>
      <CasellaNumero etichetta={corpo ? t('Zavorra') : t('Kg')} errore={segna('kg')}>
        <input value={kg} onChange={e => onKg(normalizzaDecimale(e.target.value))} aria-label={corpo ? t('Zavorra') : t('Kg')} inputMode="decimal"
          placeholder={corpo ? '0' : undefined}
          onFocus={selezionaAlFocus} className="j-campo-numero" style={{ textAlign: 'center' }} aria-invalid={segna('kg') || undefined}/>
      </CasellaNumero>
    </div>
  )
}

/** Serie per serie: una riga ciascuna coi suoi colpi e i suoi chili. Il numero
 *  delle serie lo fanno le righe: «Aggiungi serie» ne aggiunge una uguale
 *  all'ultima, la × sull'ultima la toglie. */
function TabellaSerie({ n, pesi, colpi, onPeso, onColpi, onAggiungi, onTogli, corpo, erroreKg }: {
  n: number
  pesi: string[]; colpi: string[]
  onPeso: (i: number, v: string) => void
  onColpi: (i: number, v: string) => void
  onAggiungi: () => void
  onTogli: () => void
  corpo: boolean
  erroreKg?: boolean
}) {
  const t = useT()
  const griglia: React.CSSProperties = { display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr) minmax(0, 1fr)' }
  const intestazione: React.CSSProperties = { ...ETICHETTA_FOGLIO, fontSize: 12, padding: '5px 12px' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ border: 'var(--bordo)', background: 'var(--surface)' }}>
        <div style={{ ...griglia, background: 'var(--surface-2)' }}>
          <span style={{ ...intestazione, paddingLeft: 10 }}>#</span>
          <span style={{ ...intestazione, borderLeft: '1px solid var(--line)' }}>{t('Rip')}</span>
          <span style={{ ...intestazione, borderLeft: '1px solid var(--line)' }}>{corpo ? t('Zavorra') : t('Kg')}</span>
        </div>
        {Array.from({ length: n }, (_, i) => (
          <div key={i} style={{ ...griglia, height: 50, borderTop: '1px solid var(--line)' }}>
            <span style={{ display: 'flex', alignItems: 'center', paddingLeft: 10, fontFamily: NUC.display, fontSize: 15, fontWeight: 700, color: NUC.faint }}>S{i + 1}</span>
            <div className="j-casella" style={{ borderLeft: '1px solid var(--line)' }}>
              <input value={colpi[i] ?? ''} onChange={e => onColpi(i, e.target.value)} aria-label={t('Serie {n} · colpi', { n: i + 1 })}
                inputMode="numeric" onFocus={selezionaAlFocus} className="j-campo-numero" style={{ fontSize: 24 }}/>
            </div>
            <div className="j-casella" data-errore={erroreKg || undefined} style={{ borderLeft: '1px solid var(--line)' }}>
              <input value={pesi[i] ?? ''} onChange={e => onPeso(i, e.target.value)} aria-label={t('Serie {n} · kg', { n: i + 1 })}
                placeholder={corpo ? '0' : undefined}
                inputMode="decimal" onFocus={selezionaAlFocus} className="j-campo-numero" style={{ fontSize: 24 }}
                aria-invalid={erroreKg || undefined}/>
              {i === n - 1 && n > 1 && (
                <button type="button" onClick={onTogli} aria-label={t('Togli la serie {n}', { n: i + 1 })} style={{
                  width: 44, flexShrink: 0, border: 'none', borderLeft: '1px solid var(--line)', background: 'transparent',
                  color: NUC.faint, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><Icons.x size={15} stroke={2}/></button>
              )}
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={onAggiungi} disabled={n >= SERIE_MAX} className="j-focus" style={{
        height: 46, width: '100%', background: 'transparent', border: '2px dashed var(--muted-dark)', color: NUC.ink,
        cursor: n >= SERIE_MAX ? 'default' : 'pointer', opacity: n >= SERIE_MAX ? 0.4 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontFamily: NUC.display, fontSize: 15, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
      }}>
        <Icons.plus size={16} stroke={2.2}/> {t('Aggiungi serie')}
      </button>
    </div>
  )
}

/** Una colonna di scelta: il titolo e le due alternative, una sopra l'altra in
 *  un riquadro d'inchiostro. Quella scelta è piena, come la cella accesa di un
 *  interruttore. Due colonne affiancate — il carico, il tipo di alzata — invece
 *  di quattro righe piene: si toccano di rado, e così non spingono in giù il
 *  resto. */
function ColonnaScelta({ titolo, opzioni, spenta }: {
  titolo: string
  opzioni: Array<{ label: string; on: boolean; onClick: () => void }>
  spenta?: boolean
}) {
  return (
    <div style={{ minWidth: 0, opacity: spenta ? 0.4 : 1, transition: 'opacity 180ms' }}>
      <div style={{ ...ETICHETTA_FOGLIO, marginBottom: 6 }}>{titolo}</div>
      <div role="group" aria-label={titolo} style={{ border: 'var(--bordo)', display: 'flex', flexDirection: 'column' }}>
        {opzioni.map((o, i) => (
          <button key={o.label} type="button" disabled={spenta} onClick={o.onClick} aria-pressed={o.on} className="j-focus" style={{
            height: 38, minWidth: 0, padding: '0 6px', border: 'none', borderTop: i ? 'var(--bordo)' : 'none',
            background: o.on ? 'var(--ink)' : 'var(--surface)', color: o.on ? 'var(--surface)' : NUC.ink,
            fontFamily: NUC.display, fontSize: 15, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
            cursor: spenta ? 'default' : 'pointer', transition: 'background 160ms, color 160ms',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{o.label}</button>
        ))}
      </div>
    </div>
  )
}

/** Il massimale che l'alzata vale: il numero con cui verrà giudicata, grande a
 *  destra, e da dove viene, piccolo a sinistra. */
function AnteprimaMassimale({ titolo, sotto, kg }: { titolo: string; sotto: string; kg: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '12px 14px', background: 'var(--surface-2)', border: '2px solid var(--hairline-soft)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={ETICHETTA_FOGLIO}>{titolo}</div>
        <div style={{ fontFamily: NUC.display, fontSize: 14, fontWeight: 600, color: NUC.faint, marginTop: 3 }}>{sotto}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexShrink: 0, color: NUC.ink }}>
        <span style={{ fontFamily: NUC.display, fontSize: 38, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{kg}</span>
        <span style={{ fontFamily: NUC.display, fontSize: 14, fontWeight: 700, color: NUC.faint }}>KG</span>
      </div>
    </div>
  )
}

/** La nota dell'alzata, chiusa come l'attrezzo finché non serve: quasi mai, e
 *  un campo sempre aperto si leggerebbe come una cosa da compilare. */
function CampoNota({ valore, onChange }: { valore: string; onChange: (v: string) => void }) {
  const t = useT()
  const [aperta, setAperta] = useState(!!valore)
  if (!aperta) {
    return (
      <button type="button" onClick={() => setAperta(true)} style={LINK_FOGLIO}>{t('+ Nota su questa alzata')}</button>
    )
  }
  return (
    <div>
      <div style={{ ...ETICHETTA_FOGLIO, marginBottom: 6 }}>{t('Nota · facoltativa')}</div>
      <textarea
        value={valore} onChange={e => onChange(e.target.value)} rows={2} autoFocus={!valore}
        placeholder={t('Nota su questa sessione…')} aria-label={t('Nota')} className="j-field"
        style={{ height: 'auto', minHeight: 64, padding: '10px 12px', resize: 'vertical', lineHeight: 1.45 }}
      />
    </div>
  )
}

/** Il collegamento sottolineato che apre un campo facoltativo. */
const LINK_FOGLIO: React.CSSProperties = {
  alignSelf: 'flex-start', background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer',
  fontFamily: NUC.font, fontSize: 14, fontWeight: 500, color: NUC.ink,
  textDecoration: 'underline', textUnderlineOffset: 3,
}

// ── Attrezzo o corpo libero, sull'esercizio ────────────────────
// Si sceglie quando l'esercizio nasce: è ciò che dice all'app qual è il carico
// di riferimento. Con attrezzo sono i chili; a corpo libero è il proprio peso, i
// chili sono solo zavorra, e il consiglio di carico non c'è — lì si progredisce
// con i colpi, non spostando un perno.
function SceltaCarico({ corpo, onChange }: { corpo: boolean; onChange: (corpo: boolean) => void }) {
  const t = useT()
  return (
    <div>
      <div style={{ ...ETICHETTA_FOGLIO, marginBottom: 6 }}>{t('Tipo di carico')}</div>
      <FormatoSwitch<'attrezzo' | 'corpo'>
        valore={corpo ? 'corpo' : 'attrezzo'} onChange={v => onChange(v === 'corpo')}
        valori={['attrezzo', 'corpo']} etichette={[t('Con attrezzo'), t('Corpo libero')]}
        etichettaGruppo={t('Tipo di carico')} style={{ minHeight: 48 }}
      />
    </div>
  )
}

// ── I pezzi dei fogli dell'esercizio ───────────────────────────
// «Nuovo esercizio» e «Modifica esercizio» chiedono le stesse cose (ott 2026):
// il nome, i gruppi, il tipo di carico, le note. La modifica aggiunge
// l'attrezzo e il colore del gruppo.

/** I gruppi da scegliere: quelli che l'app conosce, senza «Altro» — è il
 *  cassetto di chi un gruppo non ce l'ha, non un gruppo da dare a un esercizio —
 *  a meno che l'esercizio non stia già lì. Un gruppo di `tenere` che non è fra
 *  questi (un nome vecchio, uno scritto a mano) compare lo stesso, o chi lo ha
 *  non lo vedrebbe acceso. */
function gruppiDaScegliere(gruppi: string[], tenere: string[]): string[] {
  const scelte = gruppi.filter(m => m !== 'Altro' || tenere.includes('Altro'))
  for (const m of tenere) if (m && !scelte.includes(m)) scelte.push(m)
  return scelte
}

/** I gruppi muscolari a tasselli. Un tocco sceglie il principale, il secondo il
 *  secondario; ritoccarli li toglie. Tolto il principale, il secondario prende
 *  il suo posto: i due non sono mai lo stesso gruppo (col menu a tendina il
 *  secondario promosso restava salvato, e la testata diceva «Petto · Petto»). */
function SceltaGruppi({ scelte, principale, secondario, onChange, errore }: {
  scelte: string[]; principale: string; secondario: string
  onChange: (principale: string, secondario: string) => void
  errore?: boolean
}) {
  const t = useT()
  const tData = useTData()
  const tocca = (m: string) => {
    if (m === principale) onChange(secondario, '')
    else if (m === secondario) onChange(principale, '')
    else if (!principale) onChange(m, '')
    else onChange(principale, m)
  }
  const aiuto = !principale ? t('Tocca il gruppo principale.')
    : secondario ? t('Principale: {a} · secondario: {b}', { a: tData(principale), b: tData(secondario) })
    : t('Principale: {a} · tocca un altro gruppo per il secondario', { a: tData(principale) })
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <span style={ETICHETTA_FOGLIO}>{t('Gruppi muscolari')}</span>
        <span style={{ fontFamily: NUC.font, fontSize: 13, color: NUC.faint }}>{t('principale + uno facoltativo')}</span>
      </div>
      <div role="group" aria-label={t('Gruppo muscolare')} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        {scelte.map(m => {
          const ruolo = m === principale ? 1 : m === secondario ? 2 : 0
          return (
            <button key={m} type="button" onClick={() => tocca(m)} aria-pressed={ruolo > 0}
              aria-label={ruolo === 1 ? `${tData(m)} · ${t('principale')}` : ruolo === 2 ? `${tData(m)} · ${t('secondario')}` : tData(m)}
              className="j-focus" style={{
                position: 'relative', height: 44, minWidth: 0, padding: '0 4px', cursor: 'pointer',
                background: ruolo === 1 ? 'var(--ink)' : 'var(--surface)',
                color: ruolo === 1 ? 'var(--surface)' : NUC.ink,
                border: ruolo ? 'var(--bordo)' : `1.5px solid ${errore ? 'var(--danger)' : 'var(--hairline-soft)'}`,
                fontFamily: NUC.display, fontSize: 14, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
              {tData(m)}
              {ruolo > 0 && (
                <span aria-hidden style={{
                  position: 'absolute', top: -2, right: -2, width: 18, height: 18,
                  background: ruolo === 1 ? 'var(--j-accent)' : 'var(--ink)', color: 'var(--surface)',
                  fontFamily: NUC.display, fontSize: 12, fontWeight: 800, lineHeight: '18px', textAlign: 'center',
                }}>{ruolo}</span>
              )}
            </button>
          )
        })}
      </div>
      <div style={{ fontFamily: NUC.font, fontSize: 13, color: NUC.faint, lineHeight: 1.45, marginTop: 8 }}>{aiuto}</div>
    </div>
  )
}

/** Le note dell'esercizio: come si esegue, come si prepara. */
function CampoNoteEsercizio({ valore, onChange }: { valore: string; onChange: (v: string) => void }) {
  const t = useT()
  return (
    <div>
      <div style={{ ...ETICHETTA_FOGLIO, marginBottom: 6 }}>{t('Note · facoltative')}</div>
      <textarea
        value={valore}
        onChange={e => onChange(e.target.value)}
        placeholder={t('Esecuzione, setup, attrezzatura…')}
        aria-label={t('Note')}
        className="j-field"
        rows={3}
        style={{ height: 'auto', minHeight: 84, padding: '10px 12px', resize: 'none', lineHeight: 1.5 }}
      />
    </div>
  )
}

/** Il colore, nella modifica dell'esercizio. È del gruppo e non dell'esercizio:
 *  la riga lo dice prima di toccarla, e toccata apre i colori. */
function ColoreGruppo({ gruppo, colore, mostrato, onChange }: {
  gruppo: string
  /** Il colore scelto dall'utente; vuoto è quello di serie. */
  colore: string
  /** Quello che si vede: lo scelto, o quello di serie. */
  mostrato: string
  onChange: (c: string) => void
}) {
  const t = useT()
  const tData = useTData()
  const [aperto, setAperto] = useState(false)
  const tassello = (scelto: boolean): React.CSSProperties => ({
    aspectRatio: '1 / 1', width: '100%', padding: 0, cursor: 'pointer',
    border: scelto ? 'var(--bordo)' : '1.5px solid var(--hairline-soft)',
    outline: scelto ? '2px solid var(--surface)' : 'none', outlineOffset: -4,
  })
  return (
    <div style={{ border: '1.5px solid var(--hairline-soft)', background: 'var(--surface-2)' }}>
      <button type="button" onClick={() => setAperto(a => !a)} aria-expanded={aperto} className="j-focus" style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: NUC.ink,
      }}>
        <span aria-hidden style={{ width: 28, height: 28, flexShrink: 0, background: mostrato, border: 'var(--bordo)' }}/>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('Colore di {gruppo}', { gruppo: tData(gruppo) })}
          </span>
          <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 12, color: NUC.faint, marginTop: 2 }}>{t('Vale per tutti gli esercizi del gruppo')}</span>
        </span>
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, fontFamily: NUC.display, fontSize: 14, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
          {t('Gruppo')}
          <span aria-hidden style={{ display: 'inline-block', transform: aperto ? 'rotate(90deg)' : 'none', transition: 'transform 160ms' }}>→</span>
        </span>
      </button>
      {aperto && (
        <div role="group" aria-label={t('Colore')} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(34px, 1fr))', gap: 6, padding: '0 14px 14px' }}>
          <button type="button" onClick={() => onChange('')} aria-label={t('Colore di serie')} aria-pressed={!colore} className="j-focus" style={{
            ...tassello(!colore), background: 'var(--surface)',
            fontFamily: NUC.display, fontSize: 14, fontWeight: 800, color: NUC.faint,
          }}>A</button>
          {COLOR_PALETTE.map(c => (
            <button key={c} type="button" onClick={() => onChange(colore === c ? '' : c)} aria-label={c} aria-pressed={colore === c} className="j-focus" style={{ ...tassello(colore === c), background: c }}/>
          ))}
        </div>
      )}
    </div>
  )
}

/** Il cestino accanto al tasto principale, in fondo ai fogli di modifica. */
function TastoCestino({ etichetta, onClick }: { etichetta: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={etichetta} title={etichetta} className="j-focus" style={{
      width: 60, height: 60, flexShrink: 0, cursor: 'pointer',
      background: 'var(--surface)', border: '2px solid var(--danger)', color: 'var(--danger)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}><Icons.trash size={20} stroke={1.8}/></button>
  )
}

// ── Log Palestra Modal ─────────────────────────────────────────
export interface LogPalestraModalProps {
  open: boolean; onClose: () => void
  ex: PalestraExercise | null
  onSave: (entry: PalestraHistoryEntry) => void
}

export function LogPalestraModal({ open, onClose, ex, onSave }: LogPalestraModalProps) {
  const t = useT()
  const tData = useTData()
  const bodyWeight = useBodyWeight()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const [kg, setKg] = useState(String(ex?.current.kg ?? ''))
  const [reps, setReps] = useState(String(ex?.current.reps ?? ''))
  const [sets, setSets] = useState(String(ex?.current.sets_n ?? ''))
  const [isBodyweight, setIsBodyweight] = useState(false)
  const [zavorra, setZavorra] = useState('')
  const [perSet, setPerSet] = useState(false)          // peso e colpi diversi per ogni serie
  const [setWeightsStr, setSetWeightsStr] = useState<string[]>([])
  const [setRepsStr, setSetRepsStr] = useState<string[]>([])
  const [isMax, setIsMax] = useState(false)            // massimale: una singola al massimo
  // Il peso dell'attrezzo a vuoto: parte da quello dell'esercizio, e quello che
  // si salva qui diventa il suo (vedi `savePalestraEntry`).
  const [attrezzo, setAttrezzo] = useState('')
  // Cosa manca o non va, detto quando si preme «Salva»; e il salto di carico
  // già mostrato, che un secondo tocco conferma.
  const [problema, setProblema] = useState<Problema | null>(null)
  const [saltoVisto, setSaltoVisto] = useState(false)
  // Appena si tocca un numero, quello che era stato detto non vale più.
  useEffect(() => { setProblema(null); setSaltoVisto(false) },
    [open, kg, reps, sets, zavorra, attrezzo, perSet, setWeightsStr, setRepsStr, isBodyweight, isMax])

  // Il modale resta montato: pre-compila kg/reps/sets dall'ultimo valore ad ogni
  // apertura (l'init di useState gira una volta sola, con ex ancora null).
  useEffect(() => {
    if (!open || !ex) return
    setDate(todayISO())
    // Dall'ultima alzata di lavoro, come la scheda (vedi `ultimaDiLavoro`): dopo
    // un massimale dichiarato il modale si apriva su 1 serie da 1 colpo al
    // carico del massimale. I chili sono i soli dischi quando l'esercizio ha
    // l'attrezzo: un'alzata di prima che l'attrezzo ci fosse ha scritto il
    // totale, e riproposta tale e quale si sarebbe salvata col bilanciere in più.
    const ultima = ultimaDiLavoro(ex.history)
    const attrezzoOggi = corpoLibero(ex) ? 0 : (ex.attrezzoKg ?? 0)
    setKg(preCompila(ultima ? Math.max(0, ultima.kg + (ultima.attrezzo ?? 0) - attrezzoOggi) : ex.current.kg))
    setReps(preCompila(ultima?.reps ?? ex.current.reps))
    setSets(preCompila(ultima?.sets_n ?? ex.current.sets_n))
    // Parte da come è fatto l'esercizio: le trazioni si aprono già a corpo libero.
    setIsBodyweight(corpoLibero(ex)); setZavorra('')
    setPerSet(false); setSetWeightsStr([]); setSetRepsStr([]); setIsMax(false)
    setAttrezzo(ex.attrezzoKg ? fmtNum(ex.attrezzoKg) : '')
  }, [open, ex])

  const kgN = parseNum(kg)
  // Un massimale è per definizione 1 × 1: i campi serie/colpi non si mostrano
  // nemmeno, e il salvataggio non si fida di cosa c'era scritto prima.
  const repsN = isMax ? 1 : parseInt(reps)
  const setsN = isMax ? 1 : parseInt(sets)
  const zavorraN = parseNum(zavorra)
  // Mai più righe del massimo di serie: un "2000" battuto per sbaglio, con i
  // pesi per serie aperti, disegnava duemila righe.
  const nSets = Math.min(SERIE_MAX, Math.max(1, setsN || 1))
  // A corpo libero l'attrezzo non c'è: quello che si scrive è la zavorra.
  const attrezzoN = isBodyweight ? 0 : parseNum(attrezzo)

  const updateSetWeight = (i: number, v: string) =>
    setSetWeightsStr(arr => { const next = [...arr]; next[i] = normalizzaDecimale(v); return next })
  const updateSetReps = (i: number, v: string) =>
    setSetRepsStr(arr => { const next = [...arr]; next[i] = v.replace(/[^0-9]/g, ''); return next })

  // "Serie per serie" vale per il peso E per i colpi: sono le due metà della
  // stessa serie, e un'alzata che cala di carico di solito cala anche di colpi.
  // Entrambi partono dal valore uguale per tutte, così chi ne cambia uno solo
  // non deve riscrivere l'altro.
  const enablePerSet = () => {
    const base = isBodyweight ? zavorra : kg
    setSetWeightsStr(Array.from({ length: nSets }, (_, i) => setWeightsStr[i] ?? (base || '')))
    setSetRepsStr(Array.from({ length: nSets }, (_, i) => setRepsStr[i] ?? (reps || '')))
    setPerSet(true)
  }

  // Pesi e colpi per serie (numerici) limitati al numero di serie impostato
  const perSetNums = perSet ? Array.from({ length: nSets }, (_, i) => parseNum(setWeightsStr[i])) : []
  const perSetReps = perSet ? Array.from({ length: nSets }, (_, i) => parseInt(setRepsStr[i]) || repsN || 0) : []
  const perSetAvg = perSetNums.length ? perSetNums.reduce((a, b) => a + b, 0) / perSetNums.length : 0
  // Quali righe hanno i chili scritti. Con un attrezzo dichiarato vale anche lo
  // zero scritto — una serie col bilanciere scarico (vedi `chiliScritti`).
  const scritta = (i: number) => chiliScritti(setWeightsStr[i], attrezzoN > 0)
  const righe = perSet ? Array.from({ length: nSets }, (_, i) => scritta(i)) : []

  const effectiveKg = perSet ? perSetAvg : (isBodyweight ? (zavorraN || 0) : kgN)
  const hasValues = isBodyweight
    ? (repsN > 0 && setsN > 0)
    : (repsN > 0 && setsN > 0 && (perSet ? righe.some(Boolean) : chiliScritti(kg, attrezzoN > 0)))

  // Anteprima: il carico più pesante dell'alzata e il massimale che ne deriva.
  // Prima qui stava il "coefficiente di difficoltà" dell'EVL, cioè una stima di
  // fatica; ora l'unico numero mostrato è quello con cui l'alzata verrà giudicata.
  // Due moltiplicazioni: niente useMemo, che su `perSetNums` (array nuovo a ogni
  // render) non avrebbe comunque mai fatto centro.
  // A corpo libero il carico è anche il corpo — la parte che l'esercizio fa
  // sollevare (vedi `quotaCorpo`) — come per i record: senza, delle trazioni
  // con 10 kg di zavorra davano "massimale 13 kg" e salvate ne valevano 114.
  const caricoCorpo = isBodyweight && ex ? bodyWeight * quotaCorpo(ex) : 0
  const topLoad = Math.round(((perSet ? Math.max(0, ...perSetNums) : effectiveKg) + attrezzoN + caricoCorpo) * 10) / 10
  const preview = (ex && hasValues && topLoad > 0)
    // Su un massimale non c'è niente da stimare: il carico È il massimale.
    ? { top: topLoad, oneRM: Math.round(isMax ? topLoad : estimate1RM(topLoad, repsN)) }
    : null

  if (!ex) return null

  // Quello che impedisce di salvare, nell'ordine in cui lo si incontra.
  const controlla = (): Problema | null => {
    const impossibile = numeroImpossibile({
      serie: setsN,
      colpi: perSet ? [repsN, ...perSetReps] : [repsN],
      kg: isBodyweight ? [zavorraN, ...perSetNums] : (perSet ? perSetNums : [kgN]),
      attrezzo: attrezzoN,
    })
    if (impossibile) return { campo: impossibile.campo, testo: testoImpossibile(t, impossibile) }
    if (!(setsN > 0)) return { campo: 'serie', testo: t('Scrivi quante serie hai fatto.') }
    if (!(repsN > 0)) return { campo: 'colpi', testo: t('Scrivi quanti colpi hai fatto.') }
    if (!hasValues) {
      return { campo: 'kg', testo: attrezzoN > 0 ? t('Scrivi i dischi: 0 se usi solo l’attrezzo.') : t('Scrivi i chili.') }
    }
    return null
  }
  // Più del doppio, o meno della metà, dell'ultima alzata: si chiede conferma.
  // A corpo libero no — il carico è il corpo, e la zavorra raddoppia da sé.
  const ultimoKg = caricoDiRiferimento(ex.history)
  const salto = !isBodyweight && saltoDaConfermare(topLoad, ultimoKg) ? { nuovo: topLoad, ultimo: ultimoKg ?? 0 } : null
  const segna = (campo: CampoAlzata) => problema?.campo === campo

  const save = () => {
    const prob = controlla()
    if (prob) { setProblema(prob); return }
    if (salto && !saltoVisto) { setSaltoVisto(true); return }
    // Con peso variabile: `kg` = serie più pesante (rappresentativa), e i pesi
    // per serie salvati solo se effettivamente diversi tra loro.
    // Con un attrezzo, una riga lasciata senza chili non è una serie fatta
    // (vedi `serieValide` in riassuntoAllenamento): non si salva a 0 kg, si
    // toglie, e le serie contate sono quelle rimaste.
    const tenute = perSet
      ? perSetNums.slice(0, nSets).map((_, i) => (isBodyweight || scritta(i) ? i : -1)).filter(i => i >= 0)
      : []
    const weights = tenute.map(i => perSetNums[i])
    const varies = perSet && weights.length > 1 && new Set(weights).size > 1
    const kgOut = perSet ? (weights.length ? Math.max(...weights) : 0) : (isBodyweight ? (zavorraN || 0) : kgN)
    const repsPerSet = tenute.map(i => perSetReps[i])
    const variesReps = perSet && repsPerSet.length > 1 && new Set(repsPerSet).size > 1
    // Col peso variabile il valore rappresentativo è la serie più pesante: i
    // colpi che l'accompagnano devono essere i SUOI, o `kg × reps` descriverebbe
    // una serie mai avvenuta.
    const topIdx = weights.length ? weights.indexOf(Math.max(...weights)) : -1
    const repsOut = variesReps && topIdx >= 0 ? repsPerSet[topIdx] : repsN
    onSave({
      d: weekLabel(date), date,
      kg: kgOut,
      reps: repsOut, sets_n: perSet ? tenute.length : setsN,
      ...(varies ? { setWeights: weights } : {}),
      ...(variesReps ? { setReps: repsPerSet } : {}),
      ...(isBodyweight ? { bodyweight: true as const } : {}),
      ...(isMax ? { maxLift: true as const } : {}),
      ...(attrezzoN > 0 ? { attrezzo: attrezzoN } : {}),
    })
    setIsBodyweight(false); setZavorra('')
    setPerSet(false); setSetWeightsStr([]); setSetRepsStr([]); setIsMax(false)
    onClose()
  }

  // Serie per serie, le righe sono le serie: se ne aggiunge una uguale
  // all'ultima, o si toglie l'ultima.
  const aggiungiSerie = () => {
    if (nSets >= SERIE_MAX) return
    setSets(String(nSets + 1))
    setSetWeightsStr(a => { const x = [...a]; x[nSets] = x[nSets - 1] ?? ''; return x })
    setSetRepsStr(a => { const x = [...a]; x[nSets] = x[nSets - 1] ?? reps ?? ''; return x })
  }
  const togliSerie = () => {
    if (nSets <= 1) return
    setSets(String(nSets - 1))
    setSetWeightsStr(a => a.slice(0, nSets - 1))
    setSetRepsStr(a => a.slice(0, nSets - 1))
  }

  return (
    <JFoglio
      open={open} onClose={onClose}
      titolo={tData(ex.n)}
      occhiello={`${tData(displayMuscle(ex.muscle))} · ${t('Nuova alzata')}`}
      // La data è quasi sempre oggi e quasi mai si tocca: sta sotto il nome come
      // un'informazione. Toccandola si apre il calendario.
      sotto={<ChipData valore={date} onChange={setDate} etichetta={t('Data dell’alzata')}/>}
      piede={<>
        <AvvisiSalvataggio problema={problema} salto={saltoVisto ? salto : null}/>
        <button onClick={save} className="j-btn-accent" style={{ marginTop: 0 }}>{saltoVisto && salto ? t('Conferma e salva') : t('Salva alzata')}</button>
      </>}
    >
      <div className="flex flex-col" style={{ gap: 12 }}>
        <SceltaPerSerie perSet={perSet && !isMax} onChange={v => (v ? enablePerSet() : setPerSet(false))} corpo={isBodyweight} spenta={isMax}/>

        {perSet && !isMax ? (
          <>
            <TabellaSerie
              n={nSets} pesi={setWeightsStr} colpi={setRepsStr}
              onPeso={updateSetWeight} onColpi={updateSetReps}
              onAggiungi={aggiungiSerie} onTogli={togliSerie}
              corpo={isBodyweight} erroreKg={segna('kg')}
            />
            {/* Con un attrezzo le righe senza chili non si salvano (vedi `save`):
                lo si dice qui, mentre le si può ancora riempire. */}
            {!isBodyweight && righe.some(Boolean) && righe.some(r => !r) && (
              <div role="note" style={{ fontFamily: NUC.label, fontSize: 13, lineHeight: 1.5, color: 'var(--warn)' }}>
                {t('Le serie senza chili non vengono salvate.')}
              </div>
            )}
          </>
        ) : (
          <NumeriAlzata
            serie={sets} onSerie={setSets} colpi={reps} onColpi={setReps}
            kg={isBodyweight ? zavorra : kg} onKg={isBodyweight ? setZavorra : setKg}
            corpo={isBodyweight} massimale={isMax} segna={segna}
          />
        )}
        {isMax && (
          <div style={{ fontFamily: NUC.font, fontSize: 13, color: NUC.faint, lineHeight: 1.5, marginTop: -4 }}>
            {t('Una singola al carico massimo. Serie e colpi valgono 1 × 1.')}
          </div>
        )}

        {/* L'attrezzo a vuoto: dopo i chili, perché è a quelli che si somma; la
            chiave lo richiude a ogni apertura su un esercizio che non ce l'ha. */}
        {!isBodyweight && <CampoAttrezzo key={`${ex.id}-${open}`} valore={attrezzo} onChange={setAttrezzo} errore={segna('attrezzo')}/>}
        {/* La prima volta su un esercizio che ha già uno storico: quelle alzate
            l'attrezzo non ce l'hanno, e questa sembrerà un salto in avanti (e un
            record). Non si può sapere da qui se nei chili di prima c'era già:
            lo si dice, e si dice dove rimediare. */}
        {attrezzoN > 0 && !ex.attrezzoKg && ex.history.some(h => !h.bodyweight) && (
          <div role="note" style={{ fontFamily: NUC.label, fontSize: 13, lineHeight: 1.5, color: 'var(--warn)' }}>
            {t('Le alzate già registrate restano com’erano. Se anche lì scrivevi solo i dischi, sommalo da «Modifica esercizio».')}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <ColonnaScelta titolo={t('Carico')} opzioni={[
            { label: t('Attrezzo'),     on: !isBodyweight, onClick: () => { setIsBodyweight(false); setZavorra('') } },
            { label: t('Corpo libero'), on: isBodyweight,  onClick: () => { setIsBodyweight(true);  setZavorra('') } },
          ]}/>
          {/* Un massimale non è una serie con un colpo solo: è la prova di quanto
              sposti, e l'app lo tratta diversamente — non viene stimato (nessun
              Epley sopra) e alimenta la card dei massimali con un numero certo
              invece che dedotto. */}
          <ColonnaScelta titolo={t('Alzata')} opzioni={[
            { label: t('Allenamento'), on: !isMax, onClick: () => setIsMax(false) },
            { label: t('Massimale'),   on: isMax,  onClick: () => { setIsMax(true); setPerSet(false) } },
          ]}/>
        </div>

        {preview && (
          <AnteprimaMassimale
            titolo={isMax ? t('Massimale') : t('1RM stimato')}
            sotto={isMax ? t('una singola a {kg} kg', { kg: fmtNum(preview.top) }) : t('da {kg} kg × {n} rip', { kg: fmtNum(preview.top), n: repsN })}
            kg={preview.oneRM}
          />
        )}
      </div>
    </JFoglio>
  )
}

// ── Add Exercise Modal ─────────────────────────────────────────
export interface AddExModalProps {
  open: boolean; onClose: () => void; mode: 'hyrox' | 'palestra'
  onAdd: (ex: HyroxExercise | PalestraExercise) => void
  presetMuscle?: string
}

export function AddExModal({ open, onClose, mode, onAdd, presetMuscle }: AddExModalProps) {
  const t = useT()
  const tData = useTData()
  // Non `MUSCLE_OPTIONS`: anche i gruppi che l'utente si è creato devono comparire
  // nel select, o esisterebbero solo nella griglia che li ha generati.
  const gruppi = useGruppiMuscolari()
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<'km' | 'm' | 'rep'>('m')
  const [target, setTarget] = useState('')
  const [muscle, setMuscle] = useState(presetMuscle ?? '')
  const [muscle2, setMuscle2] = useState('')
  const [note, setNote] = useState('')
  const [corpo, setCorpo] = useState(false)
  // Cosa manca, detto quando si preme «Aggiungi».
  const [manca, setManca] = useState<'nome' | 'gruppo' | null>(null)
  useEffect(() => { setManca(null) }, [open, name, muscle])

  // Quando il modale viene aperto da una card di gruppo muscolare, parte già
  // sul muscolo giusto.
  useEffect(() => {
    if (open) { setMuscle(presetMuscle ?? ''); setMuscle2('') }
  }, [open, presetMuscle])

  const save = () => {
    if (!name.trim()) { setManca('nome'); return }
    // Il gruppo è obbligatorio. Senza, l'esercizio finiva in una card senza
    // nome che non si apriva: c'era, ma non lo si raggiungeva più se non dalla
    // ricerca.
    if (mode !== 'hyrox' && !muscle.trim()) { setManca('gruppo'); return }
    if (mode === 'hyrox') {
      onAdd({ id: uid('hx'), n: name, unit, target: parseFloat(target) || 1, history: [] })
    } else {
      onAdd({ id: uid('px'), n: name, muscle: muscle.trim(), ...(muscle2 ? { muscle2 } : {}), ...(note.trim() ? { note: note.trim() } : {}), bodyweight: corpo, current: { kg: 0, reps: 8, sets_n: 3 }, history: [] })
    }
    setName(''); setUnit('m'); setTarget(''); setMuscle(''); setMuscle2(''); setNote(''); setCorpo(false)
    onClose()
  }

  const scelte = gruppiDaScegliere(gruppi, presetMuscle ? [presetMuscle] : [])

  return (
    <JFoglio
      open={open} onClose={onClose}
      titolo={t('Nuovo esercizio')}
      occhiello={mode === 'hyrox' ? t('Hyrox') : presetMuscle ? t('In {gruppo}', { gruppo: tData(presetMuscle) }) : t('Palestra')}
      piede={<>
        {manca && (
          <div role="alert" style={{ fontFamily: NUC.label, fontSize: 13, lineHeight: 1.5, color: 'var(--danger)' }}>
            {manca === 'nome' ? t('Scrivi il nome dell’esercizio.') : t('Scegli il gruppo muscolare.')}
          </div>
        )}
        <button onClick={save} className="j-btn-accent" style={{ marginTop: 0 }}>{t('Aggiungi')}</button>
      </>}
    >
      <div className="flex flex-col" style={{ gap: 16 }}>
        {/* Le etichette sopra ogni campo: il segnaposto da solo sparisce appena
            si scrive, e il campo resta muto. */}
        <div>
          <div style={{ ...ETICHETTA_FOGLIO, marginBottom: 6 }}>{t('Nome')}</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={t('Es. Rematore con bilanciere')} className="j-field"
            aria-label={t('Nome esercizio')} aria-invalid={manca === 'nome' || undefined} style={{ height: 52, ...(manca === 'nome' ? ROSSO : {}) }}/>
        </div>
        {mode === 'hyrox' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <div>
              <div style={{ ...ETICHETTA_FOGLIO, marginBottom: 6 }}>{t('Unità')}</div>
              <select value={unit} onChange={e => setUnit(e.target.value as 'km' | 'm' | 'rep')} className="j-field" aria-label={t('Unità')} style={{ height: 52 }}>
                <option value="km">km</option>
                <option value="m">m</option>
                <option value="rep">rep</option>
              </select>
            </div>
            <div>
              <div style={{ ...ETICHETTA_FOGLIO, marginBottom: 6 }}>{t('Obiettivo')}</div>
              <input value={target} onChange={e => setTarget(e.target.value)} placeholder={t('Target (distanza/reps)')} aria-label={t('Obiettivo')} inputMode="decimal" className="j-field" style={{ height: 52 }}/>
            </div>
          </div>
        ) : (
          <>
            <SceltaGruppi scelte={scelte} principale={muscle} secondario={muscle2} onChange={(p, s2) => { setMuscle(p); setMuscle2(s2) }} errore={manca === 'gruppo'}/>
            <SceltaCarico corpo={corpo} onChange={setCorpo}/>
            <CampoNoteEsercizio valore={note} onChange={setNote}/>
          </>
        )}
      </div>
    </JFoglio>
  )
}

// ── Exercise Stats Modal ───────────────────────────────────────
export function ExStatsModal({ ex, onClose }: { ex: PalestraExercise; onClose: () => void }) {
  const t = useT()
  const tData = useTData()
  const bodyWeight = useBodyWeight() * quotaCorpo(ex)
  const hist = useMemo(() => sortedHistory(ex.history), [ex.history])

  // memoised derived arrays
  const { oneRMs, kgs, colpi, labels } = useMemo(() => ({
    oneRMs: hist.map(h => Math.round(entry1RM(h, bodyWeight))),
    kgs:    hist.map(h => effectiveLoad(h, bodyWeight)),
    colpi:  hist.map(colpiMigliori),
    labels: hist.map(h => h.date ? fmtDayMonth(h.date) : h.d),
  }), [hist, bodyWeight])
  // Un esercizio che non va a chili si legge a colpi: vedi `aColpi`.
  const soloColpi = aColpi(ex) && kgs.every(k => k === 0)

  const bestKg   = kgs.length    ? Math.max(...kgs)    : ex.current.kg
  const best1RM  = oneRMs.length ? Math.max(...oneRMs) : 0
  const last1RM  = oneRMs[oneRMs.length - 1]
  const prev1RM  = oneRMs[oneRMs.length - 2]
  const rmTrend  = last1RM !== undefined && prev1RM !== undefined ? last1RM - prev1RM : 0

  return (
    <JModal open onClose={onClose} title={tData(ex.n)} width={360} maxHeight="calc(100% - 32px)">
      <div className="flex flex-col gap-3.5">

        <div className="grid grid-cols-3 gap-2">
          {(soloColpi ? [
            { label: t('Serie migliore'), value: colpi.length ? `${Math.max(...colpi)} ${t('colpi')}` : '—' },
            { label: t('Ultima'),         value: colpi.length ? `${colpi[colpi.length - 1]} ${t('colpi')}` : '—' },
            { label: t('Sessioni'),       value: String(hist.length) },
          ] : [
            { label: t('Miglior Kg'),    value: `${fmtNum(bestKg)} kg` },
            { label: t('Miglior stima'), value: best1RM > 0 ? `${best1RM} kg` : '—' },
            { label: t('Sessioni'),      value: String(hist.length) },
          ]).map(s => (
            <div key={s.label} className="j-stat-tile">
              <div className="j-eyebrow mb-1.5">{s.label}</div>
              <div style={{ fontFamily: NUC.label, fontSize: 13, color: 'var(--j-accent-ink)', letterSpacing: -0.4 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {kgs.length >= 2 && (
          <div>
            <NucEyebrow>{soloColpi ? t('Colpi') : t('Carico (kg)')}</NucEyebrow>
            <div className="j-chart-box">
              <LineChart data={soloColpi ? colpi : kgs} labels={labels} height={96} color="var(--j-accent)" yAxis labelSize={9}/>
            </div>
          </div>
        )}

        {!soloColpi && oneRMs.length >= 2 && (
          <div>
            <NucEyebrow right={rmTrend !== 0 ? (
              <span style={{ color: rmTrend > 0 ? 'var(--j-accent-ink)' : 'var(--danger)' }}>
                {rmTrend > 0 ? '+' : ''}{rmTrend} kg
              </span>
            ) : undefined}>{t('Massimale stimato (kg)')}</NucEyebrow>
            <div className="j-chart-box">
              <LineChart data={oneRMs} labels={labels} height={96} color="var(--chart-2)" yAxis labelSize={9}/>
            </div>
          </div>
        )}

        {hist.length > 0 && (
          <div>
            <NucEyebrow>{hist.length === 1 ? t('1 sessione') : t('{n} sessioni', { n: hist.length })}</NucEyebrow>
            <div className="flex flex-col">
              {[...hist].reverse().slice(0, 8).map((h, i) => {
                const dateStr = h.date ? fmtShortDate(h.date) : h.d
                return (
                  <div key={i} className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--hairline-soft)' }}>
                    <div>
                      <div style={{ fontSize: 13, color: NUC.ink, letterSpacing: -0.2 }}>
                        {h.sets_n} × {fmtReps(h)}
                      </div>
                      <div style={{ fontFamily: NUC.label, fontSize: 12, color: NUC.faint, letterSpacing: 0.5, marginTop: 2 }}>{dateStr}</div>
                      {h.maxLift && <div style={{ fontFamily: NUC.label, fontSize: 12, color: 'var(--j-accent-ink)', letterSpacing: '.1em', marginTop: 2, textTransform: 'uppercase' }}>{t('Massimale')}</div>}
                    </div>
                    {/* A destra i chili di quel giorno, come nella pagina
                        dell'esercizio: il massimale stimato sta nel grafico qui
                        sopra, e in elenco si leggeva come il peso alzato. */}
                    <div className="text-right flex-shrink-0 ml-3" style={{ fontFamily: NUC.label, fontSize: 13, color: 'var(--j-accent-ink)', letterSpacing: -0.3, whiteSpace: 'nowrap' }}>
                      {fmtKgVerso(h)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {hist.length === 0 && <div className="j-empty">{t('Nessuna sessione registrata')}</div>}
      </div>
    </JModal>
  )
}

// ── Statistiche di un esercizio Hyrox ──────────────────────────
// Si apre toccando una riga di Stats → Hyrox, come i record dei pesi aprono
// `ExStatsModal`. Riceve le sessioni GIÀ filtrate per distanza: un grafico che
// mescola 500 m e 1000 m salterebbe su e giù a ogni cambio di formato.
export function HyroxStatsModal({ ex, hist, onClose }: {
  ex: Pick<HyroxExercise, 'id' | 'n' | 'unit'>
  hist: HyroxHistoryEntry[]
  onClose: () => void
}) {
  const t = useT()
  const tData = useTData()
  const ord = useMemo(() => sortedHistory(hist), [hist])

  const { times, paces, labels } = useMemo(() => ({
    times:  ord.map(h => tempoConfrontabile(ex.id, h)),
    // Lo stesso passo della pagina della stazione: al km, ai 500 m o rep/min.
    paces:  ord.map(h => ex.unit === 'km' ? Math.round(h.sec / unitaDelTempo(ex.id, h.units))
      : ex.unit === 'm' ? Math.round((h.sec / h.units) * 500)
      : Math.round((h.units / h.sec) * 60)),
    labels: ord.map(h => h.date ? fmtDayMonth(h.date) : h.d),
  }), [ord, ex.id, ex.unit])

  const best  = times.length ? Math.min(...times) : 0
  const last  = times[times.length - 1]
  const prev  = times[times.length - 2]
  const trend = last !== undefined && prev !== undefined ? last - prev : 0

  return (
    <JModal open onClose={onClose} title={tData(ex.n)} width={360} maxHeight="calc(100% - 32px)">
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t('Miglior tempo'), value: best > 0 ? fmtTime(best) : '—' },
            { label: t('Ultimo'),        value: last !== undefined ? fmtTime(last) : '—' },
            { label: t('Sessioni'),      value: String(ord.length) },
          ].map(s => (
            <div key={s.label} className="j-stat-tile">
              <div className="j-eyebrow mb-1.5">{s.label}</div>
              <div style={{ fontFamily: NUC.label, fontSize: 13, color: 'var(--j-accent-ink)', letterSpacing: -0.4 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {times.length >= 2 ? (
          <>
            <div>
              {/* Qui il meglio è in basso: un tempo che scende è un miglioramento,
                  e il trend si colora di conseguenza. */}
              <NucEyebrow right={trend !== 0 ? (
                <span style={{ color: trend < 0 ? 'var(--j-accent-ink)' : 'var(--danger)' }}>
                  {trend < 0 ? '▼' : '▲'} {Math.abs(trend)}s
                </span>
              ) : t('più basso = meglio')}>{t('Tempo')}</NucEyebrow>
              <div className="j-chart-box">
                <LineChart data={times} labels={labels} height={96} color="var(--j-accent)" yAxis labelSize={9} yFormat={fmtTime}/>
              </div>
            </div>
            <div>
              <NucEyebrow>
                {ex.unit === 'km' ? t('Pace (sec/km)') : ex.unit === 'm' ? t('Pace (sec/500m)') : t('Cadenza (rep/min)')}
              </NucEyebrow>
              <div className="j-chart-box">
                <LineChart data={paces} labels={labels} height={96} color="var(--chart-2)" yAxis labelSize={9}
                  yFormat={ex.unit === 'rep' ? undefined : fmtTime}/>
              </div>
            </div>
          </>
        ) : (
          <div className="j-empty">{t('Registra almeno 2 sessioni per vedere il grafico')}</div>
        )}

        {ord.length > 0 && (
          <div>
            <NucEyebrow>{ord.length === 1 ? t('1 sessione') : t('{n} sessioni', { n: ord.length })}</NucEyebrow>
            <div className="flex flex-col">
              {[...ord].reverse().slice(0, 8).map((h, i) => (
                <div key={i} className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--hairline-soft)' }}>
                  <div>
                    <div style={{ fontSize: 13, color: NUC.ink, letterSpacing: -0.2 }}>{fmtTime(h.sec)} · {distanzaLeggibile(h.units, ex.unit)}</div>
                    <div style={{ fontFamily: NUC.label, fontSize: 12, color: NUC.faint, letterSpacing: 0.5, marginTop: 2 }}>{h.date ? fmtShortDate(h.date) : h.d}</div>
                  </div>
                  <div style={{ fontFamily: NUC.label, fontSize: 12, color: 'var(--j-accent-ink)', flexShrink: 0 }}>{pace(h.sec, unitaDelTempo(ex.id, h.units), ex.unit)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </JModal>
  )
}

// ── Modifica esercizio (nome, gruppi muscolari, colore) ────────
/** Quello che una modifica all'esercizio chiede oltre ai campi cambiati. */
export interface OpzioniModificaEsercizio {
  /** Il peso dell'attrezzo appena scritto va messo anche sulle alzate che
   *  l'esercizio ha già (quelle non a corpo libero). */
  attrezzoAncheAlleVecchie?: boolean
}

export function EditExModal({ open, onClose, ex, onSave, onSaveMuscleColor, onElimina }: {
  open: boolean; onClose: () => void
  ex: PalestraExercise
  onSave: (changes: Partial<PalestraExercise>, opzioni?: OpzioniModificaEsercizio) => void
  onSaveMuscleColor: (muscle: string, color: string | undefined) => void
  /** Eliminare l'esercizio: il cestino in fondo. La conferma la chiede chi lo passa. */
  onElimina?: () => void
}) {
  const t = useT()
  // Colori RAW dallo store, NON la mappa risolta di `useMuscleColors()`: questo è il
  // picker e `color` finisce dritto in `onSaveMuscleColor`, che deve salvare la
  // scelta dell'utente e non un valore ricavato.
  const muscleColors = useJarvisStore(st => st.muscleColors) ?? {}
  const gruppi = useGruppiMuscolari()
  const [name, setName] = useState(ex.n)
  const [muscle, setMuscle] = useState(displayMuscle(ex.muscle))
  const [muscle2, setMuscle2] = useState(displayMuscle(ex.muscle2 ?? ''))
  const [color, setColor] = useState(muscleColors[displayMuscle(ex.muscle)] ?? '')
  const [note, setNote] = useState(ex.note ?? '')
  const [corpo, setCorpo] = useState(corpoLibero(ex))
  const [attrezzo, setAttrezzo] = useState(ex.attrezzoKg ? fmtNum(ex.attrezzoKg) : '')
  // Mettere l'attrezzo anche sulle alzate già registrate: lo decide chi sa
  // come le aveva scritte (vedi sotto, accanto alla casella).
  const [ancheVecchie, setAncheVecchie] = useState(false)
  // Cosa manca, detto quando si preme «Salva modifiche».
  const [manca, setManca] = useState<'nome' | 'gruppo' | null>(null)
  useEffect(() => { setManca(null) }, [open, name, muscle])

  useEffect(() => {
    setName(ex.n); setMuscle(displayMuscle(ex.muscle)); setMuscle2(displayMuscle(ex.muscle2 ?? ''))
    setColor(muscleColors[displayMuscle(ex.muscle)] ?? ''); setNote(ex.note ?? ''); setCorpo(corpoLibero(ex))
    setAttrezzo(ex.attrezzoKg ? fmtNum(ex.attrezzoKg) : ''); setAncheVecchie(false)
    // Il form riparte dall'esercizio com'è ADESSO a ogni apertura, non solo al
    // cambio di esercizio. Il modale resta montato dietro la pagina: prima
    // teneva i valori di quando la pagina era stata aperta, e salvando
    // rimetteva la nota di prima sopra quella appena scritta dalla pagina —
    // e l'attrezzo appena dichiarato da una nuova alzata qui non compariva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex.id, open])

  // Cambiato il gruppo, il colore mostrato è quello del gruppo nuovo.
  useEffect(() => {
    setColor(muscleColors[muscle] ?? '')
    // Reagisce al solo cambio di gruppo muscolare selezionato nel form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muscle])

  const activeColor = color || MUSCLE_COLORS[muscle] || '#8a7440'
  // I gruppi che l'esercizio ha già restano fra le scelte, anche se non sono
  // più fra quelli dell'app: vedi `gruppiDaScegliere`.
  const scelte = gruppiDaScegliere(gruppi, [displayMuscle(ex.muscle), displayMuscle(ex.muscle2 ?? '')])
  const sessioni = ex.history.length
  const occhiello = `${t('Esercizio')} · ${sessioni === 0 ? t('nessuna sessione') : sessioni === 1 ? t('1 sessione') : t('{n} sessioni', { n: sessioni })}`

  // A corpo libero l'attrezzo non c'è.
  const attrezzoN = corpo ? 0 : parseNum(attrezzo)
  const attrezzoCambiato = attrezzoN !== (ex.attrezzoKg ?? 0)
  const alzateConAttrezzo = ex.history.filter(h => !h.bodyweight).length

  const save = () => {
    if (!name.trim()) { setManca('nome'); return }
    if (!muscle.trim()) { setManca('gruppo'); return }
    onSaveMuscleColor(muscle, color || undefined)
    // Il tipo di carico si scrive sempre, anche se non è stato toccato: chi lo
    // prendeva dal catalogo per nome ("Trazioni") lo perderebbe rinominando
    // l'esercizio, con il selettore ancora acceso su "Corpo libero".
    onSave(
      { n: name.trim(), muscle, muscle2: muscle2 && muscle2 !== muscle ? muscle2 : undefined, note: note.trim() || undefined, bodyweight: corpo, attrezzoKg: attrezzoN > 0 ? attrezzoN : undefined },
      { attrezzoAncheAlleVecchie: attrezzoCambiato && ancheVecchie },
    )
    onClose()
  }

  return (
    <JFoglio
      open={open} onClose={onClose}
      titolo={t('Modifica esercizio')}
      occhiello={occhiello}
      piede={<>
        {manca && (
          <div role="alert" style={{ fontFamily: NUC.label, fontSize: 13, lineHeight: 1.5, color: 'var(--danger)' }}>
            {manca === 'nome' ? t('Scrivi il nome dell’esercizio.') : t('Scegli il gruppo muscolare.')}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          {onElimina && <TastoCestino etichetta={t('Elimina esercizio')} onClick={onElimina}/>}
          <button onClick={save} className="j-btn-accent" style={{ marginTop: 0, flex: 1, width: 'auto' }}>{t('Salva modifiche')}</button>
        </div>
      </>}
    >
      <div className="flex flex-col" style={{ gap: 16 }}>
        <div>
          <div style={{ ...ETICHETTA_FOGLIO, marginBottom: 6 }}>{t('Nome')}</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={t('Nome esercizio')} className="j-field"
            aria-label={t('Nome esercizio')} aria-invalid={manca === 'nome' || undefined} style={{ height: 52, ...(manca === 'nome' ? ROSSO : {}) }}/>
        </div>

        <SceltaGruppi scelte={scelte} principale={muscle} secondario={muscle2} onChange={(p, s2) => { setMuscle(p); setMuscle2(s2) }} errore={manca === 'gruppo'}/>

        <div className="flex flex-col" style={{ gap: 10 }}>
          <SceltaCarico corpo={corpo} onChange={setCorpo}/>
          {!corpo && <CampoAttrezzo key={ex.id} valore={attrezzo} onChange={setAttrezzo}/>}
          {/* Cambiando l'attrezzo, le alzate già scritte restano com'erano: l'app
              non può sapere se in quei chili l'attrezzo c'era già. Lo sa chi le ha
              scritte, e lo dice qui. */}
          {!corpo && attrezzoCambiato && alzateConAttrezzo > 0 && (
            <label className="flex items-start gap-2" style={{ fontFamily: NUC.font, fontSize: 13, lineHeight: 1.5, color: NUC.dim, cursor: 'pointer' }}>
              <input type="checkbox" checked={ancheVecchie} onChange={e => setAncheVecchie(e.target.checked)} style={{ marginTop: 3, accentColor: 'var(--j-accent)' }}/>
              <span>{t('Vale anche per le {n} alzate già registrate. Spuntalo solo se finora scrivevi i soli dischi.', { n: alzateConAttrezzo })}</span>
            </label>
          )}
        </div>

        {muscle && <ColoreGruppo gruppo={muscle} colore={color} mostrato={activeColor} onChange={setColor}/>}

        <CampoNoteEsercizio valore={note} onChange={setNote}/>
      </div>
    </JFoglio>
  )
}

// ── Edit History Entry Modal ───────────────────────────────────
export function EditHistoryModal({ entry, onClose, onSave, riferimentoKg, esercizio, onElimina }: {
  entry: PalestraHistoryEntry
  onClose: () => void
  onSave: (updated: PalestraHistoryEntry) => void
  /** Di che esercizio è l'alzata, per l'occhiello ("Dorso · Rematore"). */
  esercizio?: { nome: string; muscolo?: string }
  /** Toglie l'alzata dallo storico (chiede prima chi la passa). Senza, il
   *  cestino non c'è: l'allenatore che corregge un'alzata non la può togliere. */
  onElimina?: () => void
  /** Il carico dell'ultima ALTRA alzata dell'esercizio (vedi
   *  `caricoDiRiferimento`): serve a chiedere conferma di un numero lontano
   *  da lì. Senza, non si chiede niente. */
  riferimentoKg?: number | null
}) {
  const t = useT()
  const tData = useTData()
  const [problema, setProblema] = useState<Problema | null>(null)
  const [saltoVisto, setSaltoVisto] = useState<{ nuovo: number; ultimo: number } | null>(null)
  const [isBodyweight, setIsBodyweight] = useState(entry.bodyweight === true)
  // L'attrezzo di QUESTA alzata: si corregge qui, una per una, senza toccare
  // le altre né l'esercizio.
  const [attrezzo, setAttrezzo] = useState(entry.attrezzo ? fmtNum(entry.attrezzo) : '')
  const [kg, setKg] = useState(String(entry.bodyweight ? '' : entry.kg))
  const [zavorra, setZavorra] = useState(String(entry.bodyweight && entry.kg > 0 ? entry.kg : ''))
  const [reps, setReps] = useState(String(entry.reps))
  const [sets, setSets] = useState(String(entry.sets_n))
  // Basta UNO dei due array per aprire in modalità per-serie: un'alzata da scheda
  // può avere colpi variabili e peso costante (10, 8, 6 sempre a 40 kg), e
  // guardare solo i pesi l'avrebbe riaperta come uniforme, cancellandole i colpi
  // al primo salvataggio.
  const [perSet, setPerSet] = useState(!!(entry.setWeights?.length || entry.setReps?.length))
  // Con i soli colpi variabili il peso è uno, ma i campi sono per serie: vanno
  // riempiti tutti con quello. Vuoti, "Salva" usciva in silenzio — niente peso,
  // niente salvataggio — e non si riusciva nemmeno ad aggiungere una nota.
  const [setWeightsStr, setSetWeightsStr] = useState<string[]>(
    entry.setWeights?.map(String) ?? (entry.setReps ?? []).map(() => (entry.kg > 0 ? String(entry.kg) : '')),
  )
  const [setRepsStr, setSetRepsStr] = useState<string[]>(entry.setReps?.map(String) ?? [])
  // Anche un'alzata già registrata può essere un massimale: il flag si mette e si
  // toglie da qui, altrimenti l'unico modo sarebbe cancellarla e riscriverla.
  const [isMax, setIsMax] = useState(entry.maxLift === true)
  const [date, setDate] = useState(entry.date ?? '')
  const [nota, setNota] = useState(entry.note ?? '')
  // Appena si tocca un numero, quello che era stato detto non vale più.
  useEffect(() => { setProblema(null); setSaltoVisto(null) },
    [kg, reps, sets, zavorra, attrezzo, perSet, setWeightsStr, setRepsStr, isBodyweight, isMax])

  const nSets = Math.min(SERIE_MAX, Math.max(1, parseInt(sets) || 1))
  const updateSetWeight = (i: number, v: string) =>
    setSetWeightsStr(arr => { const next = [...arr]; next[i] = normalizzaDecimale(v); return next })
  const updateSetReps = (i: number, v: string) =>
    setSetRepsStr(arr => { const next = [...arr]; next[i] = v.replace(/[^0-9]/g, ''); return next })
  const enablePerSet = () => {
    const base = isBodyweight ? zavorra : kg
    setSetWeightsStr(Array.from({ length: nSets }, (_, i) => setWeightsStr[i] ?? (base || '')))
    setSetRepsStr(Array.from({ length: nSets }, (_, i) => setRepsStr[i] ?? (reps || '')))
    setPerSet(true)
  }

  const save = () => {
    const repsN = isMax ? 1 : parseInt(reps)
    const setsN = isMax ? 1 : parseInt(sets)
    const attrezzoN = isBodyweight ? 0 : parseNum(attrezzo)
    const stop = (campo: CampoAlzata, testo: string) => setProblema({ campo, testo })
    // I numeri che non si accettano, prima di tutto il resto.
    const scritti = perSet ? Array.from({ length: Math.min(SERIE_MAX, Math.max(1, setsN || 1)) }, (_, i) => i) : []
    const impossibile = numeroImpossibile({
      serie: setsN,
      colpi: [repsN, ...scritti.map(i => parseInt(setRepsStr[i]))],
      kg: perSet ? scritti.map(i => parseNum(setWeightsStr[i])) : [isBodyweight ? parseNum(zavorra) : parseNum(kg)],
      attrezzo: attrezzoN,
    })
    if (impossibile) return stop(impossibile.campo, testoImpossibile(t, impossibile))
    if (!(setsN > 0)) return stop('serie', t('Scrivi quante serie hai fatto.'))
    if (!(repsN > 0)) return stop('colpi', t('Scrivi quanti colpi hai fatto.'))
    const senzaChili = () => stop('kg', attrezzoN > 0 ? t('Scrivi i dischi: 0 se usi solo l’attrezzo.') : t('Scrivi i chili.'))
    let setWeights: number[] | undefined
    let setReps: number[] | undefined
    let kgN: number
    let repsOut = repsN
    if (perSet) {
      // Qui le righe a 0 kg NON si tolgono, a differenza del log: è un'alzata
      // che esiste già, e aprirla per aggiungere una nota non deve cambiarle
      // il numero di serie in silenzio. Chi vuole toglierne una abbassa "Serie".
      const nums = Array.from({ length: Math.max(1, setsN) }, (_, i) => parseNum(setWeightsStr[i]))
      if (!isBodyweight && !nums.some((_, i) => chiliScritti(setWeightsStr[i], attrezzoN > 0))) return senzaChili()
      const rps = Array.from({ length: Math.max(1, setsN) }, (_, i) => parseInt(setRepsStr[i]) || repsN)
      kgN = nums.length ? Math.max(...nums) : 0
      setWeights = new Set(nums).size > 1 ? nums : undefined
      setReps = new Set(rps).size > 1 ? rps : undefined
      // Come nel log: `kg` e `reps` restano una coppia vera, quella della serie
      // più pesante, non due estremi presi da serie diverse.
      if (setReps) repsOut = rps[nums.indexOf(Math.max(...nums))] || repsN
    } else {
      kgN = isBodyweight ? parseNum(zavorra) : parseNum(kg)
      if (!isBodyweight && !chiliScritti(kg, attrezzoN > 0)) return senzaChili()
      setWeights = undefined
      setReps = undefined
    }
    // Lontano dall'ultima altra alzata dell'esercizio: lo si mostra, e il
    // secondo tocco conferma. A corpo libero no (vedi limitiAlzata).
    const nuovoKg = Math.max(kgN, ...(setWeights ?? [])) + attrezzoN
    if (!isBodyweight && saltoDaConfermare(nuovoKg, riferimentoKg) && !saltoVisto) {
      setSaltoVisto({ nuovo: nuovoKg, ultimo: riferimentoKg ?? 0 })
      return
    }
    onSave({
      ...entry,
      ...conData(date),
      kg: kgN, reps: repsOut, sets_n: setsN,
      setWeights,   // esplicito: azzera eventuali pesi-serie non più validi
      setReps,      // idem per i colpi-serie
      // Il RIR è uno per serie salvata: con un numero di serie diverso non si
      // sa più a quali appartenga, e resta solo dove le serie sono quelle.
      setRir: setsN === entry.sets_n ? entry.setRir : undefined,
      bodyweight: isBodyweight ? true : undefined,
      maxLift: isMax ? true : undefined,
      machineModel: undefined,
      attrezzo: attrezzoN > 0 ? attrezzoN : undefined,
      note: nota.trim() || undefined,
    })
    onClose()
  }

  const aggiungiSerie = () => {
    if (nSets >= SERIE_MAX) return
    setSets(String(nSets + 1))
    setSetWeightsStr(a => { const x = [...a]; x[nSets] = x[nSets - 1] ?? ''; return x })
    setSetRepsStr(a => { const x = [...a]; x[nSets] = x[nSets - 1] ?? reps ?? ''; return x })
  }
  const togliSerie = () => {
    if (nSets <= 1) return
    setSets(String(nSets - 1))
    setSetWeightsStr(a => a.slice(0, nSets - 1))
    setSetRepsStr(a => a.slice(0, nSets - 1))
  }

  // L'anteprima del massimale, come nel log: il numero con cui l'alzata sarà
  // giudicata. A corpo libero conta anche il corpo, che qui non si sa: si
  // mostra quando c'è un carico da cui stimarlo.
  const attrezzoN = isBodyweight ? 0 : parseNum(attrezzo)
  const repsN = isMax ? 1 : parseInt(reps) || 0
  const pesiN = perSet ? Array.from({ length: nSets }, (_, i) => parseNum(setWeightsStr[i])) : []
  const topLoad = Math.round(((perSet ? Math.max(0, ...pesiN) : parseNum(isBodyweight ? zavorra : kg)) + attrezzoN) * 10) / 10
  const anteprima = !isBodyweight && topLoad > 0 && repsN > 0
    ? { top: topLoad, oneRM: Math.round(isMax ? topLoad : estimate1RM(topLoad, repsN)) }
    : null
  const segna = (campo: CampoAlzata) => problema?.campo === campo

  return (
    <JFoglio
      open onClose={onClose}
      titolo={t('Modifica alzata')}
      occhiello={esercizio ? [esercizio.muscolo && tData(displayMuscle(esercizio.muscolo)), tData(esercizio.nome)].filter(Boolean).join(' · ') : undefined}
      // La data si corregge come il resto: una sessione registrata la sera
      // dopo, o col giorno sbagliato, finiva nel posto sbagliato di grafici e
      // trend e l'unico rimedio era cancellarla e riscriverla.
      sotto={<ChipData valore={date} onChange={setDate} etichetta={t('Data dell’alzata')} conAnno/>}
      piede={<>
        <AvvisiSalvataggio problema={problema} salto={saltoVisto}/>
        <div style={{ display: 'flex', gap: 10 }}>
          {onElimina && <TastoCestino etichetta={t('Elimina alzata')} onClick={onElimina}/>}
          <button onClick={save} className="j-btn-accent" style={{ marginTop: 0, flex: 1, width: 'auto' }}>{saltoVisto ? t('Conferma e salva') : t('Salva modifiche')}</button>
        </div>
      </>}
    >
      <div className="flex flex-col" style={{ gap: 12 }}>
        <SceltaPerSerie perSet={perSet && !isMax} onChange={v => (v ? enablePerSet() : setPerSet(false))} corpo={isBodyweight} spenta={isMax}/>

        {perSet && !isMax ? (
          <TabellaSerie
            n={nSets} pesi={setWeightsStr} colpi={setRepsStr}
            onPeso={updateSetWeight} onColpi={updateSetReps}
            onAggiungi={aggiungiSerie} onTogli={togliSerie}
            corpo={isBodyweight} erroreKg={segna('kg')}
          />
        ) : (
          <NumeriAlzata
            serie={sets} onSerie={setSets} colpi={reps} onColpi={setReps}
            kg={isBodyweight ? zavorra : kg} onKg={isBodyweight ? setZavorra : setKg}
            corpo={isBodyweight} massimale={isMax} segna={segna}
          />
        )}
        {isMax && (
          <div style={{ fontFamily: NUC.font, fontSize: 13, color: NUC.faint, lineHeight: 1.5, marginTop: -4 }}>
            {t('Una singola al carico massimo: serie e colpi diventano 1 × 1.')}
          </div>
        )}

        {!isBodyweight && <CampoAttrezzo valore={attrezzo} onChange={setAttrezzo} errore={segna('attrezzo')}/>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <ColonnaScelta titolo={t('Carico')} opzioni={[
            { label: t('Attrezzo'),     on: !isBodyweight, onClick: () => { setIsBodyweight(false); setZavorra(''); setKg('') } },
            { label: t('Corpo libero'), on: isBodyweight,  onClick: () => { setIsBodyweight(true);  setZavorra(''); setKg('') } },
          ]}/>
          <ColonnaScelta titolo={t('Alzata')} opzioni={[
            { label: t('Allenamento'), on: !isMax, onClick: () => setIsMax(false) },
            { label: t('Massimale'),   on: isMax,  onClick: () => { setIsMax(true); setPerSet(false) } },
          ]}/>
        </div>

        {anteprima && (
          <AnteprimaMassimale
            titolo={isMax ? t('Massimale') : t('1RM stimato')}
            sotto={isMax ? t('una singola a {kg} kg', { kg: fmtNum(anteprima.top) }) : t('da {kg} kg × {n} rip', { kg: fmtNum(anteprima.top), n: repsN })}
            kg={anteprima.oneRM}
          />
        )}

        <CampoNota valore={nota} onChange={setNota}/>
      </div>
    </JFoglio>
  )
}

// ── Il momento del record ──────────────────────────────────────
// Compare subito dopo il salvataggio, quando l'alzata appena registrata batte il
// massimale stimato di tutte le precedenti su quell'esercizio. Prima il record si
// scopriva riaprendo la scheda, cioè quasi mai.
//
// Una lista e non un singolo: a fine scheda si salvano più alzate in un colpo e i
// record possono essere due o tre. Mostrarli uno per volta avrebbe voluto dire tre
// modali in fila da chiudere a mano.
export interface RecordItem { name: string; prev: number; next: number }

export function RecordModal({ records, onClose }: { records: RecordItem[]; onClose: () => void }) {
  const t = useT()
  const tData = useTData()
  if (!records.length) return null
  const uno = records.length === 1
  return (
    <JModal open onClose={onClose} title={uno ? t('Nuovo record') : t('{n} nuovi record', { n: records.length })} width={320}>
      <div className="flex flex-col gap-3.5">
        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--j-accent-ink)', paddingTop: 2 }}>
          <Icons.trophy size={44} stroke={1.4}/>
        </div>

        {records.map(r => (
          <div key={r.name} style={{
            background: 'var(--surface-2)', border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius)', padding: '12px 14px',
          }}>
            <div style={{ fontFamily: NUC.font, fontSize: 14, color: NUC.ink, marginBottom: 6 }}>{tData(r.name)}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: NUC.label, fontSize: 24, color: 'var(--j-accent-ink)', letterSpacing: -0.8 }}>{r.next} kg</span>
              <span style={{ fontFamily: NUC.label, fontSize: 12, color: NUC.faint }}>
                {t('era {kg} kg', { kg: r.prev })} · +{r.next - r.prev}
              </span>
            </div>
          </div>
        ))}

        {/* Il numero è una stima, e dirlo qui evita che la medaglia prometta una
            singola che non hai mai provato davvero. */}
        <div style={{ fontFamily: NUC.label, fontSize: 12, letterSpacing: '.04em', color: NUC.faint, lineHeight: 1.5 }}>
          {t('Massimale stimato dai chili e dai colpi della serie.')}
        </div>

        <button onClick={onClose} className="j-btn-accent">{t('Bene così')}</button>
      </div>
    </JModal>
  )
}

// ── Nuovo gruppo muscolare ─────────────────────────────────────
// Prima si potevano creare solo di rimbalzo: nel modale "Nuovo esercizio" il
// campo libero compariva soltanto finché il select era vuoto, e un gruppo nato
// così restava senza colore e senza figura, invisibile nei select degli altri
// esercizi. Qui è un'azione sua, con le tre cose che rendono un gruppo un gruppo:
// come si chiama, di che colore è, che figura accende.
//
// La FIGURA si sceglie fra le otto di serie e non si disegna: le sagome sono
// coordinate di un corpo umano (bodyBlocks), e un gruppo nuovo può solo dire
// "somiglia alle braccia" o "somiglia al dorso".
export function NuovoGruppoModal({ open, onClose, onCrea, esistenti }: {
  open: boolean; onClose: () => void
  onCrea: (g: { name: string; icon: string; color: string }) => void
  /** I gruppi già in casa: un nome ripetuto sarebbe lo stesso gruppo due volte. */
  esistenti: string[]
}) {
  const t = useT()
  const tData = useTData()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(FIGURE[0])
  const [color, setColor] = useState(COLOR_PALETTE[0])

  useEffect(() => {
    if (!open) return
    setName(''); setIcon(FIGURE[0]); setColor(COLOR_PALETTE[0])
  }, [open])

  const pulito = name.trim()
  // Col nome com'è mostrato: «Schiena» è il vecchio nome del Dorso (vedi
  // `displayMuscle`), e un gruppo chiamato così restava sempre vuoto — ogni
  // esercizio messo dentro finiva in Dorso.
  const doppio = esistenti.some(m => m.trim().toLowerCase() === displayMuscle(pulito).toLowerCase())
  const valido = !!pulito && !doppio

  return (
    <JModal open={open} onClose={onClose} title={t('Nuovo gruppo muscolare')} width={340}>
      <div className="flex flex-col gap-2.5">
        <div style={ETICHETTA}>{t('Nome')}</div>
        <input
          value={name} onChange={e => setName(e.target.value)}
          placeholder={t('Es. Avambracci')} className="j-field" autoFocus
        />
        {/* Detto subito e non al salvataggio: il nome è la chiave del gruppo, e
            scoprire che è occupato dopo aver scelto colore e figura è tardi. */}
        {doppio && (
          <div style={{ fontFamily: NUC.label, fontSize: 12, color: 'var(--danger)', letterSpacing: '.04em' }}>
            {t('Esiste già un gruppo con questo nome')}
          </div>
        )}

        <div style={ETICHETTA}>{t('Colore')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(26px, 8vw, 34px), 1fr))', gap: 6 }}>
          {COLOR_PALETTE.map(c => (
            <button key={c} onClick={() => setColor(c)} aria-label={c} aria-pressed={color === c} style={{
              aspectRatio: '1 / 1', width: '100%', borderRadius: 'var(--radius)', background: c, cursor: 'pointer', padding: 0,
              border: `2px solid ${color === c ? 'var(--surface)' : 'transparent'}`,
              outline: color === c ? `2px solid ${c}` : 'none',
              transition: 'outline 120ms',
            }}/>
          ))}
        </div>

        <div style={ETICHETTA}>{t('Figura')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(52px, 16vw, 68px), 1fr))', gap: 6 }}>
          {FIGURE.map(f => {
            const on = icon === f
            return (
              <button key={f} onClick={() => setIcon(f)} aria-label={tData(f)} aria-pressed={on} style={{
                aspectRatio: '3 / 4', width: '100%', minWidth: 0, borderRadius: 'var(--radius)', cursor: 'pointer', padding: 4,
                background: 'var(--surface-2)',
                border: `2px solid ${on ? color : 'transparent'}`,
                outline: on ? 'none' : '1px solid var(--hairline)', outlineOffset: -1,
                color: on ? color : 'var(--fg-mute)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 160ms, color 160ms',
              }}>
                {/* `acceso="currentColor"`: qui si sta scegliendo un colore, e
                    un'anteprima che non lo mostra sul pieno non serve a niente. */}
                <MuscleIcon muscle={f} acceso="currentColor" size={40} style={{ height: '82%', width: 'auto', maxWidth: '100%' }}/>
              </button>
            )
          })}
        </div>

        <button
          onClick={() => { if (valido) { onCrea({ name: pulito, icon, color }); onClose() } }}
          disabled={!valido}
          className="j-btn-accent"
          style={{ opacity: valido ? 1 : 0.5 }}
        >{t('Crea gruppo')}</button>
      </div>
    </JModal>
  )
}

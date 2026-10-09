// Le sessioni di un allievo, giornata per giornata, confrontate con le schede.
//
// Era una tendina in mezzo alla scheda dell'allievo: una giornata per volta, e
// per sapere se giovedì aveva saltato qualcosa bisognava aprirla e ricordarsi la
// scheda a memoria. Qui ogni giornata è una riga con i suoi problemi già contati
// — si vede subito QUALI giornate guardare — e toccandola si apre il dettaglio,
// con in rosso quello che non torna. I conti stanno in analisiSessioni.
import { useMemo, useState, type ReactNode } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { NucCard, NucEyebrow } from '@/components/ui/NucComponents'
import { Icons } from '@/components/ui/Icons'
import { fmtKg, fmtNum, fmtVol, fmtDurata, setRepsOf } from '@/features/gym/gymModel'
import { fmtShortDate, fmtDayMon } from '@/lib/dateFormat'
import { useT, useTData } from '@/lib/i18n'
import type { AthleteData } from '@/lib/coach'
import type { GymScheda, PalestraHistoryEntry } from '@/store/useJarvisStore'
import { giornateAllievo, perSettimana, haProblemi, esitoCarichi, giorniDellaSettimana, type EsitoCarichi, type EsitoEsercizio, type Giornata, type SettimanaSessioni } from './analisiSessioni'

// Rosso e verde veri anche nel tema premium, che --danger e --ok li scolora.
const ROSSO = 'var(--segnale-giu)'
const VERDE = 'var(--segnale-su)'

// I colori dei quadratini, uno per giorno della settimana: del marrone dell'app
// se ci si è allenati, grigio se no; verde se i carichi sono saliti, rosso se
// sono scesi, metà e metà se è successo l'uno e l'altro. Lo stesso colore fa da
// filo alla riga della giornata, così il quadratino e la riga si ritrovano.
//
// Il marrone è `--tertiary-ink` (quello dei titoli di sezione) e NON l'accent:
// l'accent cambia col tema, e nel tema chiaro è verde, in Neon è il lime, in
// Logbook il verde delle serie fatte — cioè proprio il colore di «carico
// salito». Un giorno allenato e un giorno coi carichi saliti sarebbero stati
// lo stesso quadratino. Il terziario è marrone in Standard e in Premium e
// grigio chiaro negli altri due: mai verde, mai rosso.
const GRIGIO = 'color-mix(in srgb, var(--fg-mute) 34%, transparent)'
const FONDO_ESITO: Record<EsitoCarichi, string> = {
  pari: 'var(--tertiary-ink)',
  su: VERDE,
  giu: ROSSO,
  misto: `linear-gradient(90deg, ${VERDE} 50%, ${ROSSO} 50%)`,
}

/** Chiede di correggere un'alzata: l'esercizio dell'allievo e l'alzata com'è. */
export type Correggi = (exerciseId: string, alzata: PalestraHistoryEntry) => void

export function CoachSessioni({ data, schedeAssegnate, inizio, onConfronto, onCorreggi }: {
  data: AthleteData
  /** Le schede scritte dall'allenatore: l'allievo le esegue, ma non stanno nel suo blob. */
  schedeAssegnate: GymScheda[]
  /** Il giorno in cui è stata assegnata la prima scheda ("YYYY-MM-DD"): da lì
   *  si contano le settimane. Senza, si parte dalla prima sessione. */
  inizio?: string | null
  onConfronto?: () => void
  /** Se c'è, ogni alzata ha una matita per correggerla. */
  onCorreggi?: Correggi
}) {
  const t = useT()
  const giornate = useMemo(() => giornateAllievo(data, schedeAssegnate), [data, schedeAssegnate])

  const settimane = useMemo(() => perSettimana(giornate, inizio ?? null), [giornate, inizio])

  // All'ingresso è tutto chiuso, settimane e giornate: la pagina è l'indice
  // delle settimane, una riga ciascuna con i quadratini che dicono com'è andata,
  // e a scegliere cosa aprire è chi guarda. Aprire da sé l'ultima voleva dire
  // trovarsi ogni volta davanti a una giornata che non si era chiesta.
  const [aperta, setAperta] = useState<string | null>(null)
  const chiave = (s: SettimanaSessioni) => String(s.n ?? 'prima')
  const [aperte, setAperte] = useState<Set<string>>(() => new Set())
  const apri = (k: string) => setAperte(prev => {
    const next = new Set(prev)
    if (next.has(k)) next.delete(k); else next.add(k)
    return next
  })

  if (!giornate.length) return <div className="j-empty">{t('Nessuna sessione registrata')}</div>

  return (
    <div>
      <NucEyebrow right={
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, textTransform: 'none' }}>
          <span>{t('{n} in tutto', { n: giornate.length })}</span>
          {onConfronto && (
            <button onClick={onConfronto} className="j-hard-sm" style={{
              padding: '4px 9px', borderRadius: 'var(--radius)', cursor: 'pointer',
              background: 'var(--surface)', border: '1px solid var(--hairline)',
              fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.12em',
              textTransform: 'uppercase', color: 'var(--j-accent-ink)',
            }}>{t('Confronto')}</button>
          )}
        </span>
      }>{t('Settimane')}</NucEyebrow>

      <div style={{ marginBottom: 8, fontFamily: NUC.label, fontSize: 10.5, lineHeight: 1.45, color: 'var(--fg-mute)' }}>
        {inizio
          ? t('Contate dal {giorno}, quando hai assegnato la prima scheda.', { giorno: fmtDayMon(inizio) })
          : t('Contate dalla prima sessione registrata: non ci sono schede assegnate.')}
      </div>

      <Legenda/>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {settimane.map(s => {
          const k = chiave(s)
          const aperto = aperte.has(k)
          const vuota = s.giornate.length === 0
          return (
            <div key={k}>
              <TestataSettimana s={s} aperta={aperto} onToggle={vuota ? undefined : () => apri(k)}/>
              {aperto && !vuota && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {s.giornate.map(g => (
                    <RigaGiornata
                      key={g.date} g={g}
                      aperta={aperta === g.date}
                      onToggle={() => setAperta(a => (a === g.date ? null : g.date))}
                      onCorreggi={onCorreggi}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// La riga di una settimana: numero, giorni, e un quadratino per GIORNO — sette,
// dal primo all'ultimo. Del marrone dell'app se quel giorno ci si è allenati,
// grigio se no; verde o rosso se i carichi sono saliti o scesi, metà e metà se
// tutte e due le cose (vedi `esitoCarichi`). È la riga che si legge senza aprire.
function TestataSettimana({ s, aperta, onToggle }: { s: SettimanaSessioni; aperta: boolean; onToggle?: () => void }) {
  const t = useT()
  const vuota = s.giornate.length === 0
  const daGuardare = s.giornate.filter(haProblemi).length
  return (
    <button
      onClick={onToggle}
      disabled={!onToggle}
      aria-expanded={onToggle ? aperta : undefined}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', textAlign: 'left',
        background: 'var(--surface-2)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)',
        cursor: onToggle ? 'pointer' : 'default', opacity: vuota ? 0.75 : 1,
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: NUC.label, fontSize: 11.5, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg)' }}>
            {s.n === null ? t('Prima delle schede') : t('Settimana {n}', { n: s.n })}
          </span>
          {s.inCorso && (
            <span style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--j-accent-ink)', border: '1px solid var(--j-accent)', padding: '1px 5px', borderRadius: 'var(--radius-pill)' }}>
              {t('in corso')}
            </span>
          )}
        </span>
        <span style={{ display: 'block', marginTop: 2, fontFamily: NUC.label, fontSize: 10.5, color: 'var(--fg-mute)' }}>
          {s.da === s.a ? fmtDayMon(s.da) : `${fmtDayMon(s.da)} – ${fmtDayMon(s.a)}`}
          {' · '}
          {vuota ? t('nessuna sessione')
            : s.giornate.length === 1 ? t('1 sessione') : t('{n} sessioni', { n: s.giornate.length })}
        </span>
        {/* Su una riga sua: in coda alle date, con i sette quadratini accanto,
            andava a capo a metà ("1 da / guardare") solo in certe settimane. */}
        {daGuardare > 0 && (
          <span style={{ display: 'block', marginTop: 2, fontFamily: NUC.label, fontSize: 10.5, color: ROSSO, fontWeight: 600 }}>
            {daGuardare === 1 ? t('1 da guardare') : t('{n} da guardare', { n: daGuardare })}
          </span>
        )}
      </span>
      {/* Dal primo all'ultimo giorno, come si legge una settimana. I giorni
          che devono ancora venire sono più tenui: non sono giorni saltati. */}
      <span aria-hidden style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {giorniDellaSettimana(s).map(d => (
          <span
            key={d.date}
            data-esito={d.giornata ? esitoCarichi(d.giornata) : 'vuoto'}
            title={fmtDayMon(d.date)}
            style={{
              width: 10, height: 10, borderRadius: 3,
              background: d.giornata ? FONDO_ESITO[esitoCarichi(d.giornata)] : GRIGIO,
              opacity: d.futuro ? 0.4 : 1,
            }}
          />
        ))}
      </span>
      {onToggle && (
        <span style={{ color: 'var(--fg-mute)', display: 'flex', flexShrink: 0, transform: aperta ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
          <Icons.chev size={14} stroke={2}/>
        </span>
      )}
    </button>
  )
}

function Legenda() {
  const t = useT()
  const voce = (colore: string, testo: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: colore, display: 'inline-block' }}/>
      {testo}
    </span>
  )
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 14px', marginBottom: 12, fontFamily: NUC.label, fontSize: 10, letterSpacing: '.04em', color: 'var(--fg-mute)' }}>
      {voce(FONDO_ESITO.pari, t('allenato'))}
      {voce(FONDO_ESITO.su, t('carico salito'))}
      {voce(FONDO_ESITO.giu, t('carico sceso'))}
      {voce(FONDO_ESITO.misto, t('salito e sceso'))}
      {voce(GRIGIO, t('nessun allenamento'))}
    </div>
  )
}

/** I problemi di una giornata in poche parole, per la riga chiusa. */
function riassunto(g: Giornata, t: ReturnType<typeof useT>): { testo: string; problemi: boolean } {
  const parti: string[] = []
  if (g.saltati) parti.push(g.saltati === 1 ? t('1 esercizio saltato') : t('{n} esercizi saltati', { n: g.saltati }))
  if (g.serieMancanti) parti.push(g.serieMancanti === 1 ? t('1 serie in meno') : t('{n} serie in meno', { n: g.serieMancanti }))
  if (g.serieCorte) parti.push(g.serieCorte === 1 ? t('1 serie corta') : t('{n} serie corte', { n: g.serieCorte }))
  if (g.caloCarico) parti.push(g.caloCarico === 1 ? t('1 carico sceso') : t('{n} carichi scesi', { n: g.caloCarico }))
  return parti.length ? { testo: parti.join(' · '), problemi: true } : { testo: '', problemi: false }
}

function RigaGiornata({ g, aperta, onToggle, onCorreggi }: { g: Giornata; aperta: boolean; onToggle: () => void; onCorreggi?: Correggi }) {
  const t = useT()
  const nomiSchede = g.gruppi.map(x => x.scheda?.nome).filter(Boolean) as string[]
  const { testo, problemi } = riassunto(g, t)
  const confrontabile = g.gruppi.some(x => x.confrontabile)

  return (
    <NucCard pad={0}>
      <button onClick={onToggle} aria-expanded={aperta} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        {/* Il filo a sinistra ha il colore del quadratino di questo giorno
            nella riga della settimana: i carichi saliti, scesi, tutte e due le
            cose, o come la volta prima. Quello che non torna con la scheda lo
            dice la riga sotto la data, in rosso. */}
        <span aria-hidden="true" style={{
          alignSelf: 'stretch', width: 3, flexShrink: 0, borderRadius: 'var(--radius-pill)',
          background: esitoCarichi(g) === 'misto' ? `linear-gradient(180deg, ${VERDE} 50%, ${ROSSO} 50%)` : FONDO_ESITO[esitoCarichi(g)],
        }}/>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: NUC.label, fontSize: 13, color: 'var(--fg)', fontVariantNumeric: 'tabular-nums' }}>{fmtShortDate(g.date)}</span>
            <span style={{ fontSize: 13, color: 'var(--fg-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {g.soloHyrox ? t('Solo hyrox') : nomiSchede.length ? nomiSchede.join(' + ') : t('Senza scheda')}
            </span>
            {/* Quanto ci ha messo, quando l'app dell'allievo l'ha misurato. */}
            {g.durataSec !== undefined && (
              <span style={{ marginLeft: 'auto', flexShrink: 0, fontFamily: NUC.label, fontSize: 11, color: 'var(--fg-mute)', fontVariantNumeric: 'tabular-nums' }}>
                {fmtDurata(g.durataSec)}
              </span>
            )}
          </span>
          <span style={{ display: 'block', marginTop: 2, fontFamily: NUC.label, fontSize: 10, letterSpacing: '.03em', color: problemi ? ROSSO : 'var(--fg-mute)' }}>
            {testo || (g.soloHyrox ? '—' : confrontabile ? t('scheda rispettata') : `${fmtVol(g.volume)} kg`)}
            {/* Anche quello che è andato BENE, già da chiusa: i carichi saliti.
                Prima l'anteprima diceva solo cosa non tornava, e una giornata
                con tre aumenti si leggeva uguale a una senza. */}
            {g.caricoSalito > 0 && (
              <span style={{ color: VERDE, fontWeight: 600 }}>
                {' · '}▲ {g.caricoSalito === 1 ? t('1 carico salito') : t('{n} carichi saliti', { n: g.caricoSalito })}
              </span>
            )}
          </span>
        </span>
        <span style={{ color: 'var(--fg-mute)', display: 'flex', transform: aperta ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
          <Icons.chev size={14} stroke={2}/>
        </span>
      </button>

      {aperta && !g.soloHyrox && (
        <div style={{ borderTop: '1px solid var(--hairline-soft)', padding: '6px 14px 12px' }}>
          {g.gruppi.map((gr, i) => (
            <div key={gr.scheda?.id ?? 'mano'} style={{ marginTop: i === 0 ? 4 : 14 }}>
              <div style={{ fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--tertiary-ink)', marginBottom: 4 }}>
                {gr.scheda ? gr.scheda.nome : t('Registrate a mano')}
                {gr.scheda && !gr.confrontabile && <span style={{ color: 'var(--fg-mute)', textTransform: 'none', letterSpacing: 0 }}> · {t('scheda non più disponibile, niente confronto')}</span>}
              </div>
              {gr.esercizi.map((e, j) => <RigaEsercizio key={j} e={e} primo={j === 0} onCorreggi={onCorreggi}/>)}
            </div>
          ))}
          <div style={{ marginTop: 10, fontFamily: NUC.label, fontSize: 10, color: 'var(--fg-mute)', textAlign: 'right' }}>
            {t('Volume')} {fmtVol(g.volume)} kg
          </div>
        </div>
      )}
    </NucCard>
  )
}

function RigaEsercizio({ e, primo, onCorreggi }: { e: EsitoEsercizio; primo: boolean; onCorreggi?: Correggi }) {
  const t = useT()
  const tData = useTData()
  const colpi = e.fatto ? setRepsOf(e.fatto) : []
  const delta = e.carico?.delta ?? null

  return (
    <div style={{ padding: '8px 0', borderTop: primo ? 'none' : '1px solid var(--hairline-soft)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{
          flex: 1, minWidth: 0, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: e.saltato ? ROSSO : 'var(--fg)', textDecoration: e.saltato ? 'line-through' : 'none',
        }}>{tData(e.nome)}</span>
        {e.saltato && <Etichetta colore={ROSSO}>{t('Saltato')}</Etichetta>}
        {e.fuoriScheda && <Etichetta colore="var(--fg-mute)">{t('Fuori scheda')}</Etichetta>}
        {/* Il carico rispetto all'ultima volta: la freccia dice il verso, il
            numero di quanto. */}
        {delta !== null && delta !== 0 && (
          <span style={{ flexShrink: 0, fontFamily: NUC.label, fontSize: 11, fontWeight: 600, color: delta > 0 ? VERDE : ROSSO }}>
            {delta > 0 ? '▲' : '▼'} {delta > 0 ? '+' : '−'}{fmtNum(Math.abs(delta))} kg
          </span>
        )}
        {delta === 0 && <span style={{ flexShrink: 0, fontFamily: NUC.label, fontSize: 11, color: 'var(--fg-mute)' }}>= {t('stesso carico')}</span>}
        {/* La matita: l'allievo ha scritto un numero sbagliato, e lo si sistema
            da qui senza chiedergli di rifarlo. */}
        {onCorreggi && e.exId && e.fatto && (
          <button
            onClick={() => onCorreggi(e.exId!, e.fatto!)}
            aria-label={`${t('Correggi')} ${tData(e.nome)}`} title={t('Correggi')}
            style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              background: 'var(--surface-2)', border: '1px solid var(--hairline)', color: 'var(--fg-mute)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icons.pencil size={11} stroke={1.8}/>
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 10px', marginTop: 3, fontFamily: NUC.label, fontSize: 11, color: 'var(--fg-mute)' }}>
        {e.previsto && (
          <span>{t('previsto')} {e.previsto.serie} × {e.previsto.colpi}</span>
        )}
        {e.fatto && (
          <span>
            {t('fatto')}{' '}
            <span style={{ color: e.serieMancanti > 0 ? ROSSO : 'var(--fg-soft)', fontWeight: e.serieMancanti > 0 ? 600 : 400 }}>
              {e.fatto.sets_n}
            </span>
            {' × '}
            {/* I colpi serie per serie: quelli sotto il previsto in rosso. */}
            {colpi.map((c, i) => (
              <span key={i}>
                {i > 0 && '/'}
                <span style={{ color: e.serieCorte.includes(i) ? ROSSO : 'var(--fg-soft)', fontWeight: e.serieCorte.includes(i) ? 600 : 400 }}>{c}</span>
              </span>
            ))}
            {' — '}{fmtKg(e.fatto)}
          </span>
        )}
        {/* Solo se c'è una differenza da spiegare: a carico uguale, o senza un
            carico da confrontare (corpo libero), "prima 0 kg" è rumore. */}
        {e.carico?.prima != null && delta !== null && delta !== 0 && (
          <span>{t('prima {kg} kg', { kg: fmtNum(e.carico.prima) })}</span>
        )}
      </div>
      {e.fatto?.correttaDa && (
        <div style={{ marginTop: 3, fontFamily: NUC.label, fontSize: 10, color: 'var(--j-accent-ink)' }}>
          {t('corretta da {chi}', { chi: e.fatto.correttaDa })}
        </div>
      )}
      {/* La nota che l'atleta ha scritto mentre si allenava: spesso spiega il
          rosso qui sopra ("spalla che tirava") meglio di qualunque numero. */}
      {e.fatto?.note && (
        <div style={{ marginTop: 3, fontFamily: NUC.label, fontSize: 11, lineHeight: 1.45, color: 'var(--fg-soft)', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
          {e.fatto.note}
        </div>
      )}
    </div>
  )
}

function Etichetta({ colore, children }: { colore: string; children: ReactNode }) {
  return (
    <span style={{
      flexShrink: 0, fontFamily: NUC.label, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
      color: colore, border: `1px solid ${colore}`, borderRadius: 'var(--radius-pill)', padding: '1px 6px',
    }}>{children}</span>
  )
}

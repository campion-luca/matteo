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
import { fmtKg, fmtNum, fmtVol, setRepsOf } from '@/features/gym/gymModel'
import { fmtShortDate } from '@/lib/dateFormat'
import { useT, useTData } from '@/lib/i18n'
import type { AthleteData } from '@/lib/coach'
import type { GymScheda } from '@/store/useJarvisStore'
import { analizzaGiornate, type EsitoEsercizio, type Giornata } from './analisiSessioni'

// Rosso e verde veri anche nel tema premium, che --danger e --ok li scolora.
const ROSSO = 'var(--segnale-giu)'
const VERDE = 'var(--segnale-su)'

export function CoachSessioni({ data, schedeAssegnate, onConfronto }: {
  data: AthleteData
  /** Le schede scritte dall'allenatore: l'allievo le esegue, ma non stanno nel suo blob. */
  schedeAssegnate: GymScheda[]
  onConfronto?: () => void
}) {
  const t = useT()
  const giornate = useMemo(() => {
    // Le assegnate prima: a parità di id è la versione dell'allenatore a dire
    // cosa andava fatto.
    const schede = [...schedeAssegnate, ...(data.gymSchede ?? []).filter(s => !schedeAssegnate.some(a => a.id === s.id))]
    const giorniHyrox = (data.hyroxExercises ?? []).flatMap(ex => ex.history.map(h => h.date)).filter(Boolean)
    return analizzaGiornate(data.palestraExercises ?? [], schede, data.userWeight ?? 0, giorniHyrox)
  }, [data, schedeAssegnate])

  // La giornata aperta: la più recente, finché non se ne sceglie un'altra.
  const [aperta, setAperta] = useState<string | null>(giornate[0]?.date ?? null)

  if (!giornate.length) return <div className="j-empty">{t('Nessuna sessione registrata')}</div>

  return (
    <div>
      <NucEyebrow right={
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, textTransform: 'none' }}>
          <span>{t('{n} in tutto', { n: giornate.length })}</span>
          {onConfronto && (
            <button onClick={onConfronto} className="j-hard-sm" style={{
              padding: '4px 9px', borderRadius: 0, cursor: 'pointer',
              background: 'var(--surface)', border: '1px solid var(--hairline)',
              fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.12em',
              textTransform: 'uppercase', color: 'var(--j-accent-ink)',
            }}>{t('Confronto')}</button>
          )}
        </span>
      }>{t('Giornate')}</NucEyebrow>

      <Legenda/>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {giornate.map(g => (
          <RigaGiornata
            key={g.date} g={g}
            aperta={aperta === g.date}
            onToggle={() => setAperta(a => (a === g.date ? null : g.date))}
          />
        ))}
      </div>
    </div>
  )
}

function Legenda() {
  const t = useT()
  const voce = (colore: string, testo: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 7, height: 7, background: colore, display: 'inline-block' }}/>
      {testo}
    </span>
  )
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginBottom: 10, fontFamily: NUC.label, fontSize: 10, letterSpacing: '.04em', color: 'var(--fg-mute)' }}>
      {voce(ROSSO, t('meno del previsto o carico sceso'))}
      {voce(VERDE, t('carico salito'))}
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

function RigaGiornata({ g, aperta, onToggle }: { g: Giornata; aperta: boolean; onToggle: () => void }) {
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
        {/* Il filo a sinistra dice lo stato senza leggere: rosso se qualcosa non
            torna, accent se la scheda è stata rispettata, niente se non c'era una
            scheda con cui confrontare. */}
        <span aria-hidden="true" style={{
          alignSelf: 'stretch', width: 3, flexShrink: 0,
          background: problemi ? ROSSO : confrontabile ? 'var(--j-accent)' : 'var(--hairline)',
        }}/>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: NUC.label, fontSize: 13, color: 'var(--fg)', fontVariantNumeric: 'tabular-nums' }}>{fmtShortDate(g.date)}</span>
            <span style={{ fontSize: 13, color: 'var(--fg-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {g.soloHyrox ? t('Solo hyrox') : nomiSchede.length ? nomiSchede.join(' + ') : t('Senza scheda')}
            </span>
          </span>
          <span style={{ display: 'block', marginTop: 2, fontFamily: NUC.label, fontSize: 10, letterSpacing: '.03em', color: problemi ? ROSSO : 'var(--fg-mute)' }}>
            {testo || (g.soloHyrox ? '—' : confrontabile ? t('scheda rispettata') : `${fmtVol(g.volume)} kg`)}
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
              {gr.esercizi.map((e, j) => <RigaEsercizio key={j} e={e} primo={j === 0}/>)}
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

function RigaEsercizio({ e, primo }: { e: EsitoEsercizio; primo: boolean }) {
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
        {e.carico?.prima != null && delta !== 0 && (
          <span>{t('prima {kg} kg', { kg: fmtNum(e.carico.prima) })}</span>
        )}
      </div>
    </div>
  )
}

function Etichetta({ colore, children }: { colore: string; children: ReactNode }) {
  return (
    <span style={{
      flexShrink: 0, fontFamily: NUC.label, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
      color: colore, border: `1px solid ${colore}`, padding: '1px 5px',
    }}>{children}</span>
  )
}

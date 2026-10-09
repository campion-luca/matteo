// Due allenamenti di un allievo, uno accanto all'altro.
//
// Il "Confronto" di prima metteva l'ultimo allenamento contro "il solito": una
// tabella che decideva da sé cosa guardare, e a chi allena non diceva niente.
// Qui a scegliere è lui: tocca due giornate, e per ogni esercizio fatto in tutte
// e due legge i chili e i colpi di allora e di adesso — in verde quello che è
// salito, in rosso quello che è sceso. I conti stanno in analisiSessioni.
//
// Due passi nella stessa pagina: prima l'elenco da cui scegliere, poi — scelte
// le due — la tabella. Dalla tabella si torna all'elenco con «Cambia».
import { useMemo, useState, type ReactNode } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { NucCard, NucEyebrow } from '@/components/ui/NucComponents'
import { Icons } from '@/components/ui/Icons'
import { fmtKg, fmtNum, fmtReps, fmtDurata } from '@/features/gym/gymModel'
import { fmtDayMonthFull, fmtShortDate, fmtDayMonth } from '@/lib/dateFormat'
import { useT, useTData } from '@/lib/i18n'
import type { AthleteData } from '@/lib/coach'
import type { GymScheda, PalestraHistoryEntry } from '@/store/useJarvisStore'
import { giornateAllievo, confrontaGiornate, type Giornata, type RigaConfronto } from './analisiSessioni'

// Rosso e verde veri anche nel tema premium, che --danger e --ok li scolora.
const ROSSO = 'var(--segnale-giu)'
const VERDE = 'var(--segnale-su)'
const colore = (delta: number | null) => (!delta ? 'var(--fg)' : delta > 0 ? VERDE : ROSSO)

const esercizi = (g: Giornata) => g.gruppi.flatMap(gr => gr.esercizi).filter(e => !!e.fatto)
const schedeDi = (g: Giornata) => g.gruppi.map(x => x.scheda).filter((x): x is { id: string; nome: string } => !!x)

export function CoachConfronto({ data, schedeAssegnate }: {
  data: AthleteData
  /** Le schede scritte dall'allenatore: l'allievo le esegue, ma non stanno nel suo blob. */
  schedeAssegnate: GymScheda[]
}) {
  const t = useT()
  // Solo le giornate con almeno un'alzata: di una giornata vuota non c'è niente
  // da mettere accanto a un'altra.
  const giornate = useMemo(
    () => giornateAllievo(data, schedeAssegnate).filter(g => esercizi(g).length > 0),
    [data, schedeAssegnate],
  )
  // Le due giornate scelte, per data. Con due si passa alla tabella.
  const [scelte, setScelte] = useState<string[]>([])
  const tocca = (date: string) => setScelte(s => (s.includes(date) ? s.filter(d => d !== date) : s.length < 2 ? [...s, date] : s))

  const prima = giornate.find(g => g.date === scelte[0])
  const seconda = giornate.find(g => g.date === scelte[1])
  const confronto = useMemo(() => (prima && seconda ? confrontaGiornate(prima, seconda) : null), [prima, seconda])

  if (giornate.length < 2) {
    return <div className="j-empty">{t('Servono almeno due allenamenti per fare un confronto.')}</div>
  }

  if (confronto) return <Tabella c={confronto} onCambia={() => setScelte([])}/>

  const nomeScheda = (g: Giornata) => schedeDi(g).map(x => x.nome).join(' + ') || t('Senza scheda')
  // Scelta la prima, le giornate fatte con la stessa scheda sono quelle con più
  // esercizi in comune: si dicono, così la seconda si trova senza aprirle.
  const schedeDellaPrima = new Set(prima ? schedeDi(prima).map(x => x.id) : [])

  return (
    <div>
      <NucEyebrow right={`${scelte.length} / 2`}>{t('Scegli due allenamenti')}</NucEyebrow>
      <div style={{ marginBottom: 10, fontFamily: NUC.label, fontSize: 11, lineHeight: 1.5, color: 'var(--fg-mute)' }}>
        {scelte.length === 0
          ? t('Tocca i due allenamenti da mettere a confronto: chili e colpi, esercizio per esercizio.')
          : t('Scelto il primo: ora tocca il secondo.')}
      </div>
      <NucCard pad={0} style={{ overflow: 'hidden' }}>
        {giornate.map((g, i) => {
          const scelta = scelte.includes(g.date)
          const stessa = !scelta && schedeDi(g).some(x => schedeDellaPrima.has(x.id))
          const n = esercizi(g).length
          return (
            <button
              key={g.date}
              onClick={() => tocca(g.date)}
              aria-pressed={scelta}
              className="j-riga-gruppo"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', textAlign: 'left',
                background: scelta ? 'color-mix(in srgb, var(--j-accent) 10%, transparent)' : 'transparent',
                border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--hairline-soft)', cursor: 'pointer',
              }}
            >
              {/* Il tondo della scelta: vuoto finché non la si tocca. */}
              <span aria-hidden style={{
                width: 22, height: 22, flexShrink: 0, borderRadius: 'var(--radius-pill)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: scelta ? 'var(--j-accent)' : 'transparent',
                border: `1.5px solid ${scelta ? 'var(--j-accent)' : 'var(--hairline)'}`,
                color: 'var(--j-accent-fg)',
              }}>
                {scelta && <Icons.check size={12} stroke={2.8}/>}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: NUC.label, fontSize: 13, color: 'var(--fg)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmtShortDate(g.date)}</span>
                  <span style={{ fontSize: 13, color: 'var(--fg-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomeScheda(g)}</span>
                </span>
                <span style={{ display: 'block', marginTop: 2, fontFamily: NUC.label, fontSize: 10.5, color: 'var(--fg-mute)' }}>
                  {n === 1 ? t('1 esercizio') : t('{n} esercizi', { n })}
                  {g.durataSec !== undefined && ` · ${fmtDurata(g.durataSec)}`}
                  {stessa && <span style={{ color: 'var(--j-accent-ink)', fontWeight: 600 }}> · {t('stessa scheda')}</span>}
                </span>
              </span>
            </button>
          )
        })}
      </NucCard>
    </div>
  )
}

// ── La tabella ─────────────────────────────────────────────────
function Tabella({ c, onCambia }: { c: ReturnType<typeof confrontaGiornate>; onCambia: () => void }) {
  const t = useT()
  const insieme = c.righe.filter(r => r.prima && r.dopo)
  const conta = (campo: 'kg' | 'colpi', verso: 1 | -1) => insieme.filter(r => Math.sign(r[campo] ?? 0) === verso).length

  return (
    <div>
      <NucEyebrow right={
        <button onClick={onCambia} className="j-hard-sm" style={{
          padding: '4px 9px', borderRadius: 'var(--radius)', cursor: 'pointer',
          background: 'var(--surface)', border: '1px solid var(--hairline)',
          fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.12em',
          textTransform: 'uppercase', color: 'var(--j-accent-ink)',
        }}>{t('Cambia')}</button>
      }>{t('Confronto')}</NucEyebrow>

      {/* Le due giornate: quella di prima a sinistra, quella dopo a destra,
          in qualunque ordine siano state toccate. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <Tessera etichetta={t('Prima')} g={c.prima}/>
        <Tessera etichetta={t('Dopo')} g={c.dopo}/>
      </div>

      {insieme.length === 0 ? (
        <div className="j-empty" style={{ marginBottom: 10 }}>{t('Nessun esercizio in comune fra i due allenamenti.')}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <Bilancio titolo={t('Chili')} su={conta('kg', 1)} giu={conta('kg', -1)}/>
          <Bilancio titolo={t('Colpi')} su={conta('colpi', 1)} giu={conta('colpi', -1)}/>
        </div>
      )}

      <NucCard pad={0}>
        <div style={{
          display: 'flex', gap: 8, padding: '9px 14px', borderBottom: '1px solid var(--divider)',
          fontFamily: NUC.label, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-mute)',
        }}>
          <span style={{ flex: 1, minWidth: 0 }}>{t('Esercizio')}</span>
          <span style={{ width: COL_PRIMA, textAlign: 'right', flexShrink: 0 }}>{fmtDayMonth(c.prima.date)}</span>
          <span style={{ width: COL_DOPO, textAlign: 'right', flexShrink: 0 }}>{fmtDayMonth(c.dopo.date)}</span>
        </div>
        {c.righe.map((r, i) => <Riga key={`${r.nome}-${i}`} r={r} primo={i === 0} dataPrima={c.prima.date} dataDopo={c.dopo.date}/>)}
      </NucCard>
    </div>
  )
}

const COL_PRIMA = 74
const COL_DOPO = 84

function Riga({ r, primo, dataPrima, dataDopo }: { r: RigaConfronto; primo: boolean; dataPrima: string; dataDopo: string }) {
  const t = useT()
  const tData = useTData()
  const freccia = (d: number) => (d > 0 ? '▲ +' : '▼ −')
  return (
    <div style={{ padding: '10px 14px', borderTop: primo ? 'none' : '1px solid var(--hairline-soft)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.3, color: 'var(--fg)', overflowWrap: 'anywhere' }}>{tData(r.nome)}</span>
        <Colonna h={r.prima} w={COL_PRIMA}/>
        <Colonna h={r.dopo} w={COL_DOPO} kg={colore(r.kg)} colpi={r.colpi ? colore(r.colpi) : undefined} forte/>
      </div>
      {/* Di quanto, scritto solo dove qualcosa è cambiato. */}
      {(!!r.kg || !!r.colpi) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4, fontFamily: NUC.label, fontSize: 10.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {!!r.kg && <span style={{ color: colore(r.kg) }}>{freccia(r.kg)}{fmtNum(Math.abs(r.kg))} kg</span>}
          {!!r.colpi && <span style={{ color: colore(r.colpi) }}>{freccia(r.colpi)}{Math.abs(r.colpi)} {Math.abs(r.colpi) === 1 ? t('colpo') : t('colpi')}</span>}
        </div>
      )}
      {r.prima && r.dopo && !r.kg && !r.colpi && (
        <div style={{ textAlign: 'right', marginTop: 4, fontFamily: NUC.label, fontSize: 10.5, color: 'var(--fg-mute)' }}>= {t('uguale')}</div>
      )}
      {(!r.prima || !r.dopo) && (
        <div style={{ textAlign: 'right', marginTop: 4, fontFamily: NUC.label, fontSize: 10.5, color: 'var(--fg-mute)' }}>
          {t('solo il {data}', { data: fmtDayMonth(r.dopo ? dataDopo : dataPrima) })}
        </div>
      )}
    </div>
  )
}

// Una delle due alzate: i chili sopra, serie × colpi sotto. Quella di adesso
// porta i colori; quella di prima è il metro, e resta neutra.
function Colonna({ h, w, kg = 'var(--fg-soft)', colpi, forte = false }: {
  h?: PalestraHistoryEntry; w: number
  /** Il colore dei chili, e quello dei colpi quando sono cambiati. */
  kg?: string; colpi?: string
  forte?: boolean
}) {
  if (!h) return <span style={{ width: w, flexShrink: 0, textAlign: 'right', fontFamily: NUC.label, fontSize: 13, color: 'var(--fg-mute)' }}>—</span>
  return (
    <span style={{ width: w, flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
      <span style={{ display: 'block', fontFamily: NUC.label, fontSize: 13, fontWeight: forte ? 600 : 400, color: kg, whiteSpace: 'nowrap' }}>{fmtKg(h)}</span>
      <span style={{ display: 'block', marginTop: 1, fontFamily: NUC.label, fontSize: 10.5, fontWeight: colpi ? 600 : 400, color: colpi ?? 'var(--fg-mute)', whiteSpace: 'nowrap' }}>
        {h.sets_n} × {fmtReps(h)}
      </span>
    </span>
  )
}

function Tessera({ etichetta, g }: { etichetta: string; g: Giornata }) {
  const t = useT()
  const nome = schedeDi(g).map(x => x.nome).join(' + ') || t('Senza scheda')
  return (
    <div style={{ minWidth: 0, padding: '10px 12px', borderRadius: 'var(--radius)', background: 'var(--surface-2)', border: '1px solid var(--hairline)' }}>
      <div style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-mute)' }}>{etichetta}</div>
      <div style={{ fontFamily: NUC.font, fontSize: 17, fontWeight: 500, letterSpacing: -0.2, color: 'var(--fg)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmtDayMonthFull(g.date)}</div>
      <div style={{ fontFamily: NUC.label, fontSize: 10.5, color: 'var(--fg-mute)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {nome}{g.durataSec !== undefined && ` · ${fmtDurata(g.durataSec)}`}
      </div>
    </div>
  )
}

// Quanti esercizi sono saliti e quanti scesi, per i chili e per i colpi.
function Bilancio({ titolo, su, giu }: { titolo: string; su: number; giu: number }) {
  const t = useT()
  const voce = (n: number, verso: boolean): ReactNode => (
    <span style={{ color: n === 0 ? 'var(--fg-mute)' : verso ? VERDE : ROSSO, fontWeight: n === 0 ? 400 : 600 }}>
      {verso ? '▲' : '▼'} {verso ? t('{n} in salita', { n }) : t('{n} in calo', { n })}
    </span>
  )
  return (
    <div style={{ minWidth: 0, padding: '9px 12px', borderRadius: 'var(--radius)', background: 'var(--surface)', border: '1px solid var(--hairline)' }}>
      <div style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--tertiary-ink)', marginBottom: 4 }}>{titolo}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontFamily: NUC.label, fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>
        {voce(su, true)}
        {voce(giu, false)}
      </div>
    </div>
  )
}

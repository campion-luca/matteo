// I grafici di un allievo, esercizio per esercizio.
//
// Le sessioni dicono com'è andata una giornata; qui si guarda un esercizio solo
// lungo il tempo — "la panca sta salendo?" — che è una domanda diversa, e dalle
// sessioni si ricostruiva aprendo le giornate una per una.
//
// Due pagine: l'elenco degli esercizi, divisi per muscolo come ovunque, e la
// scheda di quello scelto, con il grafico del carico e tutte le sue alzate.
// Ogni alzata si può correggere da qui (vedi lib/correzioni).
import { useMemo, useState } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { NucCard, NucEyebrow } from '@/components/ui/NucComponents'
import { Icons } from '@/components/ui/Icons'
import { LineChart } from '@/features/gym/gymShared'
import { colpiMigliori, effectiveLoad, entry1RM, fmtKg, fmtNum, fmtReps, sortedHistory } from '@/features/gym/gymModel'
import { aColpi, quotaCorpo } from '@/features/gym/catalogo'
import { fmtDayMonth, fmtShortDate } from '@/lib/dateFormat'
import { useT, useTData } from '@/lib/i18n'
import type { PalestraExercise } from '@/store/useJarvisStore'
import { perMuscolo } from './gruppi'
import { TendinaGruppo } from './TendinaGruppo'
import type { Correggi } from './CoachSessioni'

// ── L'elenco ───────────────────────────────────────────────────
export function CoachGrafici({ esercizi, onApri }: {
  esercizi: PalestraExercise[]
  onApri: (ex: PalestraExercise) => void
}) {
  const t = useT()
  const tData = useTData()
  // Solo quelli con almeno un'alzata: di un esercizio mai fatto non c'è niente
  // da guardare, e nell'elenco sarebbe una riga che porta a una pagina vuota.
  const gruppi = useMemo(() => perMuscolo(esercizi.filter(ex => ex.history.length > 0)), [esercizi])
  // Chiusi all'ingresso, come le note: si apre il gruppo che si cerca.
  const [aperti, setAperti] = useState<Set<string>>(() => new Set())
  const apri = (m: string) => setAperti(prev => {
    const next = new Set(prev)
    if (next.has(m)) next.delete(m); else next.add(m)
    return next
  })

  if (!gruppi.length) return <div className="j-empty">{t('Nessuna sessione registrata')}</div>

  return (
    <div>
      <NucEyebrow right={<span style={{ textTransform: 'none' }}>{t('tocca un esercizio per il grafico')}</span>}>{t('Esercizi')}</NucEyebrow>
      {gruppi.map(g => (
        <TendinaGruppo key={g.muscle} muscle={g.muscle} conta={g.esercizi.length} aperta={aperti.has(g.muscle)} onToggle={() => apri(g.muscle)}>
          <NucCard pad={0}>
            {g.esercizi.map((ex, i) => {
              const ultima = sortedHistory(ex.history)[ex.history.length - 1]
              return (
                <button key={ex.id} onClick={() => onApri(ex)} className="j-riga-gruppo" style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', textAlign: 'left',
                  background: 'none', border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--hairline-soft)', cursor: 'pointer',
                }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tData(ex.n)}</span>
                    <span style={{ display: 'block', marginTop: 2, fontFamily: NUC.label, fontSize: 10.5, color: 'var(--fg-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ex.history.length === 1 ? t('1 sessione') : t('{n} sessioni', { n: ex.history.length })}
                      {' · '}{t('ultima')} {ultima.sets_n} × {fmtReps(ultima)} – {fmtKg(ultima)}
                    </span>
                  </span>
                  <Icons.chev size={14} stroke={2} style={{ color: 'var(--fg-mute)', flexShrink: 0 }}/>
                </button>
              )
            })}
          </NucCard>
        </TendinaGruppo>
      ))}
    </div>
  )
}

// ── La scheda di un esercizio ──────────────────────────────────
export function CoachEsercizio({ ex, peso, onCorreggi }: {
  ex: PalestraExercise
  /** Il peso dell'ALLIEVO: a corpo libero è lui il carico, non chi guarda. */
  peso: number
  onCorreggi?: Correggi
}) {
  const t = useT()
  const corpo = peso * quotaCorpo(ex)
  const hist = useMemo(() => sortedHistory(ex.history), [ex.history])
  const { kgs, oneRMs, colpi, etichette } = useMemo(() => ({
    kgs:       hist.map(h => effectiveLoad(h, corpo)),
    oneRMs:    hist.map(h => Math.round(entry1RM(h, corpo))),
    colpi:     hist.map(colpiMigliori),
    etichette: hist.map(h => (h.date ? fmtDayMonth(h.date) : h.d)),
  }), [hist, corpo])
  // Un esercizio che non va a chili si legge a colpi: vedi `aColpi`.
  const soloColpi = aColpi(ex) && kgs.every(k => k === 0)

  const delta = (v: number[]) => (v.length >= 2 ? v[v.length - 1] - v[0] : 0)
  const riquadri = soloColpi ? [
    { k: t('Serie migliore'), v: colpi.length ? `${Math.max(...colpi)} ${t('colpi')}` : '—' },
    { k: t('Dall’inizio'),    v: colpi.length >= 2 ? `${delta(colpi) > 0 ? '+' : ''}${delta(colpi)} ${t('colpi')}` : '—' },
    { k: t('Sessioni'),       v: String(hist.length) },
  ] : [
    { k: t('Miglior Kg'),     v: kgs.length ? `${fmtNum(Math.max(...kgs))} kg` : '—' },
    { k: t('Dall’inizio'),    v: kgs.length >= 2 ? `${delta(kgs) > 0 ? '+' : ''}${fmtNum(delta(kgs))} kg` : '—' },
    { k: t('Sessioni'),       v: String(hist.length) },
  ]

  if (!hist.length) return <div className="j-empty">{t('Nessuna sessione registrata')}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="grid grid-cols-3 gap-2">
        {riquadri.map(r => (
          <div key={r.k} className="j-stat-tile">
            <div className="j-eyebrow mb-1.5">{r.k}</div>
            <div style={{ fontFamily: NUC.label, fontSize: 13, color: 'var(--j-accent-ink)', letterSpacing: -0.4 }}>{r.v}</div>
          </div>
        ))}
      </div>

      {hist.length >= 2 ? (
        <>
          <div>
            <NucEyebrow>{soloColpi ? t('Colpi') : t('Carico (kg)')}</NucEyebrow>
            <NucCard pad={12}>
              <LineChart data={soloColpi ? colpi : kgs} labels={etichette} pointLabels={(soloColpi ? colpi : kgs).map(v => fmtNum(v))} height={150} color="var(--j-accent)" yAxis labelSize={10}/>
            </NucCard>
          </div>
          {!soloColpi && (
            <div>
              <NucEyebrow>{t('Massimale stimato (kg)')}</NucEyebrow>
              <NucCard pad={12}>
                <LineChart data={oneRMs} labels={etichette} pointLabels={oneRMs.map(String)} height={150} color="var(--chart-2)" yAxis labelSize={10}/>
              </NucCard>
            </div>
          )}
        </>
      ) : (
        <div className="j-empty">{t('Registra almeno 2 alzate per vedere i grafici')}</div>
      )}

      <div>
        <NucEyebrow>{hist.length === 1 ? t('1 sessione') : t('{n} sessioni', { n: hist.length })}</NucEyebrow>
        <NucCard pad={0}>
          {[...hist].reverse().map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: i === 0 ? 'none' : '1px solid var(--hairline-soft)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: 'var(--fg)' }}>{h.sets_n} × {fmtReps(h)} – {fmtKg(h)}</div>
                <div style={{ fontFamily: NUC.label, fontSize: 10.5, color: 'var(--fg-mute)', marginTop: 2 }}>
                  {h.date ? fmtShortDate(h.date) : h.d}
                  {h.scheda && ` · ${h.scheda.nome}`}
                  {h.maxLift && ` · ${t('Massimale')}`}
                </div>
                {h.correttaDa && (
                  <div style={{ fontFamily: NUC.label, fontSize: 10, color: 'var(--j-accent-ink)', marginTop: 2 }}>{t('corretta da {chi}', { chi: h.correttaDa })}</div>
                )}
                {h.note && (
                  <div style={{ fontFamily: NUC.label, fontSize: 11, lineHeight: 1.45, color: 'var(--fg-soft)', fontStyle: 'italic', marginTop: 3, whiteSpace: 'pre-wrap' }}>{h.note}</div>
                )}
              </div>
              {onCorreggi && (
                <button
                  onClick={() => onCorreggi(ex.id, h)}
                  aria-label={`${t('Correggi')} ${h.date ? fmtShortDate(h.date) : h.d}`} title={t('Correggi')}
                  style={{
                    flexShrink: 0, width: 30, height: 30, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    background: 'var(--surface-2)', border: '1px solid var(--hairline)', color: 'var(--fg-mute)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icons.pencil size={12} stroke={1.8}/>
                </button>
              )}
            </div>
          ))}
        </NucCard>
      </div>
    </div>
  )
}

// Il calendario degli allenamenti: si apre toccando "La tua settimana" in home.
//
// Un mese alla volta, sfogliabile all'indietro fino al primo allenamento
// registrato. I giorni allenati sono pieni. Toccando un giorno, sotto compare cosa
// si è fatto: le schede eseguite come righe che si aprono sui loro esercizi, poi
// le alzate registrate a parte — oppure "Non ti sei allenato". In cima la fiamma
// con le settimane di fila (vedi `settimaneDiFila`).
import { useMemo, useState, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { NUC } from '@/lib/jarvis-tokens'
import { JModal } from '@/components/ui/Primitives'
import { Icons } from '@/components/ui/Icons'
import { useJarvisStore } from '@/store/useJarvisStore'
import { localISO } from '@/lib/isoDate'
import { daysShort, fmtDayMonthFull, fmtMeseAnno } from '@/lib/dateFormat'
import { useT, useTData, useLang } from '@/lib/i18n'
import { fmtKg, fmtReps, fmtTime } from '@/features/gym/gymModel'
import { giorniAllenati, settimaneDiFila, raggruppaGiorno, type VoceAllenamento } from './allenamenti'

export function CalendarioAllenamenti({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const tData = useTData()
  const lang = useLang()
  const s = useJarvisStore(useShallow(st => ({ palestra: st.palestraExercises, hyrox: st.hyroxExercises })))

  const oggi = new Date()
  const oggiISO = localISO(oggi)

  const giorni = useMemo(() => giorniAllenati(s.palestra, s.hyrox), [s.palestra, s.hyrox])
  const serie = useMemo(() => settimaneDiFila(giorni.keys(), oggiISO), [giorni, oggiISO])
  const primo = useMemo(() => [...giorni.keys()].sort()[0], [giorni])

  const [mese, setMese] = useState({ y: oggi.getFullYear(), m: oggi.getMonth() })
  const [scelto, setScelto] = useState<string | null>(null)
  const [schedaAperta, setSchedaAperta] = useState<string | null>(null)
  const scegli = (iso: string | null) => { setScelto(iso); setSchedaAperta(null) }

  // A ogni apertura si riparte dal mese corrente e dall'ultimo giorno allenato:
  // è la domanda più probabile ("cosa ho fatto l'ultima volta?").
  useEffect(() => {
    if (!open) return
    const n = new Date()
    setMese({ y: n.getFullYear(), m: n.getMonth() })
    const ultimo = [...giorni.keys()].sort().pop() ?? null
    scegli(ultimo && ultimo.slice(0, 7) === localISO(n).slice(0, 7) ? ultimo : null)
    // Solo all'apertura: `giorni` cambia mentre il modale è aperto solo se si
    // registra qualcosa altrove, e riportare indietro la selezione sarebbe un dispetto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const celle = useMemo(() => {
    const primoDelMese = new Date(mese.y, mese.m, 1)
    const vuote = (primoDelMese.getDay() + 6) % 7
    const quanti = new Date(mese.y, mese.m + 1, 0).getDate()
    return [
      ...Array.from({ length: vuote }, () => null),
      ...Array.from({ length: quanti }, (_, i) => localISO(new Date(mese.y, mese.m, i + 1))),
    ]
  }, [mese])

  const allenatiNelMese = celle.filter(c => c && giorni.has(c)).length
  const puoiIndietro = !!primo && `${mese.y}-${String(mese.m + 1).padStart(2, '0')}` > primo.slice(0, 7)
  const puoiAvanti = mese.y < oggi.getFullYear() || (mese.y === oggi.getFullYear() && mese.m < oggi.getMonth())
  const sposta = (delta: number) => {
    const d = new Date(mese.y, mese.m + delta, 1)
    setMese({ y: d.getFullYear(), m: d.getMonth() })
    scegli(null)
  }

  const voci = scelto ? giorni.get(scelto) ?? [] : []
  const giorno = raggruppaGiorno(voci)

  // Una riga dello storico: nome dell'esercizio e com'è andata. Rientrata quando
  // sta dentro una scheda aperta.
  const riga = (v: VoceAllenamento, rientro = false) => {
    const ex = v.tipo === 'pesi' ? s.palestra.find(e => e.id === v.id) : undefined
    const hx = v.tipo === 'hyrox' ? s.hyrox.find(e => e.id === v.id) : undefined
    const h = ex?.history[v.indice]
    const hh = hx?.history[v.indice]
    const dettaglio = h
      ? `${h.sets_n}×${fmtReps(h)} · ${fmtKg(h)}`
      : hh && hx ? `${fmtTime(hh.sec)} · ${hh.units} ${hx.unit}` : ''
    return (
      <div key={`${v.id}-${v.indice}`} style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
        padding: rientro ? '7px 0 7px 26px' : '8px 0', borderTop: '1px solid var(--hairline-soft)',
      }}>
        <span style={{ fontFamily: NUC.font, fontSize: rientro ? 13 : 14, color: 'var(--fg)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tData(v.nome)}</span>
        <span style={{ fontFamily: NUC.label, fontSize: 11, color: 'var(--fg-mute)', flexShrink: 0 }}>{dettaglio}</span>
      </div>
    )
  }

  const frecce = (dir: -1 | 1, attiva: boolean) => (
    <button
      onClick={() => attiva && sposta(dir)}
      disabled={!attiva}
      aria-label={dir < 0 ? t('Mese precedente') : t('Mese successivo')}
      className="j-btn-ghost"
      style={{ width: 34, height: 34, opacity: attiva ? 1 : 0.35, cursor: attiva ? 'pointer' : 'default' }}
    >
      {dir < 0 ? <Icons.chevL size={16} stroke={2}/> : <Icons.chev size={16} stroke={2}/>}
    </button>
  )

  return (
    <JModal open={open} onClose={onClose} title={t('I tuoi allenamenti')} width={400}>
      {/* La serie: la fiamma è accesa solo se c'è qualcosa da tenere acceso. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', marginBottom: 14,
        border: '1px solid var(--hairline)', background: 'var(--surface-2)',
      }}>
        <span style={{ display: 'flex', color: serie > 0 ? 'var(--j-accent)' : 'var(--fg-mute)' }}>
          <Icons.flame size={30} stroke={1.6}/>
        </span>
        <span style={{ fontFamily: NUC.font, fontSize: 30, fontWeight: 600, lineHeight: 1, color: 'var(--tertiary-ink)', letterSpacing: -0.5 }}>{serie}</span>
        <span style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-mute)', lineHeight: 1.35 }}>
          {serie === 1 ? t('settimana di fila') : t('settimane di fila')}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        {frecce(-1, puoiIndietro)}
        <div style={{ textAlign: 'center', minWidth: 0 }}>
          <div style={{ fontFamily: NUC.font, fontSize: 15, fontWeight: 600, color: 'var(--fg)' }}>{fmtMeseAnno(mese.y, mese.m, lang)}</div>
          <div style={{ fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg-mute)', marginTop: 2 }}>
            {allenatiNelMese === 1 ? t('1 giorno di allenamento') : t('{n} giorni di allenamento', { n: allenatiNelMese })}
          </div>
        </div>
        {frecce(1, puoiAvanti)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {daysShort(lang).map(d => (
          <div key={d} style={{ textAlign: 'center', fontFamily: NUC.label, fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fg-mute)', paddingBottom: 4 }}>{d}</div>
        ))}
        {celle.map((iso, i) => {
          if (!iso) return <div key={`v${i}`}/>
          const fatto = giorni.has(iso)
          const eOggi = iso === oggiISO
          const futuro = iso > oggiISO
          const sel = iso === scelto
          return (
            <button
              key={iso}
              // Si tocca anche un giorno vuoto: la risposta "non ti sei allenato"
              // è un'informazione anch'essa. Solo il futuro resta inerte.
              onClick={() => !futuro && scegli(sel ? null : iso)}
              disabled={futuro}
              aria-pressed={futuro ? undefined : sel}
              aria-label={fmtDayMonthFull(iso)}
              style={{
                aspectRatio: '1 / 1', minWidth: 0, padding: 0, borderRadius: 'var(--radius)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: fatto ? 'var(--j-accent)' : 'transparent',
                border: sel
                  ? '2px solid var(--tertiary-ink)'
                  : fatto ? '1px solid var(--j-accent)' : `1px ${futuro ? 'dashed' : 'solid'} var(--hairline-soft)`,
                outline: eOggi ? '1px solid var(--j-accent)' : undefined,
                outlineOffset: eOggi ? 2 : undefined,
                color: fatto ? 'var(--j-accent-fg)' : futuro ? 'var(--fg-mute)' : 'var(--fg-soft)',
                fontFamily: NUC.label, fontSize: 12, fontWeight: fatto ? 600 : 400,
                cursor: futuro ? 'default' : 'pointer',
                opacity: futuro ? 0.5 : 1,
              }}
            >{Number(iso.slice(8))}</button>
          )
        })}
      </div>

      <div style={{ marginTop: 16, borderTop: '1px solid var(--divider)', paddingTop: 12 }}>
        {!scelto ? (
          <div style={{ fontFamily: NUC.font, fontSize: 13, color: 'var(--fg-mute)', lineHeight: 1.5 }}>
            {giorni.size === 0 ? t('Nessun allenamento registrato.') : t('Tocca un giorno per vedere cosa hai fatto.')}
          </div>
        ) : (
          <>
            <div style={{ fontFamily: NUC.label, fontSize: 10, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--tertiary-ink)', marginBottom: 8 }}>
              {fmtDayMonthFull(scelto)}
            </div>

            {voci.length === 0 && (
              <div style={{ fontFamily: NUC.font, fontSize: 14, color: 'var(--fg-mute)', padding: '9px 0', borderTop: '1px solid var(--hairline-soft)' }}>
                {t('Non ti sei allenato')}
              </div>
            )}

            {/* Una scheda eseguita è UNA riga col suo nome: gli esercizi compaiono
                solo aprendola. Chi ha fatto "Spinta A" ricorda quel giorno come
                "Spinta A", non come sei alzate in fila. */}
            {giorno.schede.map(sc => {
              const aperta = schedaAperta === sc.id
              return (
                <div key={sc.id}>
                  <button
                    onClick={() => setSchedaAperta(aperta ? null : sc.id)}
                    aria-expanded={aperta}
                    className="j-focus"
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 0', background: 'transparent', border: 'none',
                      borderTop: '1px solid var(--hairline-soft)', borderRadius: 'var(--radius)',
                      cursor: 'pointer', textAlign: 'left', color: 'var(--fg)',
                    }}
                  >
                    <span style={{ display: 'flex', color: 'var(--j-accent-ink)', flexShrink: 0 }}>
                      <Icons.bookOpen size={16} stroke={1.7}/>
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 14.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc.nome}</span>
                      <span style={{ display: 'block', fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg-mute)', marginTop: 2 }}>
                        {sc.voci.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: sc.voci.length })}
                      </span>
                    </span>
                    <span style={{ display: 'flex', color: 'var(--fg-mute)', transform: aperta ? 'rotate(90deg)' : 'none', transition: 'transform var(--motion-fast) var(--ease)' }}>
                      <Icons.chev size={15} stroke={1.8}/>
                    </span>
                  </button>
                  {aperta && <div className="j-rise-in">{sc.voci.map(v => riga(v, true))}</div>}
                </div>
              )
            })}

            {giorno.alzate.length > 0 && giorno.schede.length > 0 && (
              <div style={{ fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-mute)', padding: '14px 0 6px' }}>
                {t('Alzate registrate')}
              </div>
            )}
            {giorno.alzate.map(v => riga(v))}
          </>
        )}
      </div>
    </JModal>
  )
}

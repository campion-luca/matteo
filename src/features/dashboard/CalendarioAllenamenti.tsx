// Il calendario degli allenamenti: si apre toccando "La tua settimana" in home.
//
// Si apre anche dalle Statistiche, toccando "Questa settimana": è lo stesso
// componente, e cambia insieme nei due posti.
//
// Un mese alla volta, sfogliabile all'indietro fino al primo allenamento
// registrato. In cima, su fondo nero, le settimane di fila (vedi
// `settimaneDiFila`) e i giorni di allenamento del mese che si guarda. I giorni
// allenati hanno il trattino d'accento sotto il numero, oggi è la cella piena
// d'inchiostro, il giorno scelto ha la cornice. Toccando un giorno, sotto
// compare cosa si è fatto: le schede eseguite come righe che si aprono sui loro
// esercizi, poi le alzate registrate a parte — oppure "Non ti sei allenato".
import { useMemo, useState, useEffect, type CSSProperties, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { NUC } from '@/lib/jarvis-tokens'
import { JModal } from '@/components/ui/Primitives'
import { NucEyebrow } from '@/components/ui/NucComponents'
import { Icons } from '@/components/ui/Icons'
import { useJarvisStore } from '@/store/useJarvisStore'
import { hyroxVisibili } from '@/features/gym/hyroxAttivo'
import { localISO } from '@/lib/isoDate'
import { daysAbbr, fmtDayMonthFull, fmtGiornoLungo, fmtMese, fmtMeseAnno } from '@/lib/dateFormat'
import { useT, useTData, useLang } from '@/lib/i18n'
import { fmtKg, fmtReps, fmtTime } from '@/features/gym/gymModel'
import { giorniAllenati, settimaneDiFila, raggruppaGiorno, type VoceAllenamento } from './allenamenti'

export function CalendarioAllenamenti({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const tData = useTData()
  const lang = useLang()
  const s = useJarvisStore(useShallow(st => ({ palestra: st.palestraExercises, hyrox: hyroxVisibili(st.hyroxExercises) })))

  const oggi = new Date()
  const oggiISO = localISO(oggi)

  const giorni = useMemo(() => giorniAllenati(s.palestra, s.hyrox), [s.palestra, s.hyrox])
  const serie = useMemo(() => settimaneDiFila(giorni.keys(), oggiISO), [giorni, oggiISO])
  const primo = useMemo(() => [...giorni.keys()].sort()[0], [giorni])

  const [mese, setMese] = useState({ y: oggi.getFullYear(), m: oggi.getMonth() })
  const [scelto, setScelto] = useState<string | null>(null)
  // Le schede aperte del giorno scelto: si aprono una per una toccandole, o
  // tutte insieme con "Apri".
  const [aperte, setAperte] = useState<Set<string>>(() => new Set())
  const scegli = (iso: string | null) => { setScelto(iso); setAperte(new Set()) }
  const apriScheda = (id: string) => setAperte(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

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
    // Anche in fondo si riempie la settimana: la griglia resta un rettangolo,
    // con le celle che non sono del mese in grigio.
    const dopo = (7 - ((vuote + quanti) % 7)) % 7
    return [
      ...Array.from({ length: vuote }, () => null),
      ...Array.from({ length: quanti }, (_, i) => localISO(new Date(mese.y, mese.m, i + 1))),
      ...Array.from({ length: dopo }, () => null),
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

  // Una riga dello storico: il nome dell'esercizio a sinistra, a destra quanto
  // (i chili grandi, sotto serie × colpi). Rientrata quando sta dentro una
  // scheda aperta.
  const riga = (v: VoceAllenamento, primo: boolean, rientro = false) => {
    const ex = v.tipo === 'pesi' ? s.palestra.find(e => e.id === v.id) : undefined
    const hx = v.tipo === 'hyrox' ? s.hyrox.find(e => e.id === v.id) : undefined
    const h = ex?.history[v.indice]
    const hh = hx?.history[v.indice]
    const grande = h ? chiliGrandi(fmtKg(h)) : hh ? fmtTime(hh.sec) : ''
    const sotto = h ? `${h.sets_n} × ${fmtReps(h)}` : hh && hx ? `${hh.units} ${hx.unit}` : ''
    return (
      <div key={`${v.id}-${v.indice}`} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        padding: rientro ? '10px 14px 10px 30px' : '12px 14px',
        borderTop: primo ? 'none' : '1px solid var(--line)',
      }}>
        <span style={{ fontFamily: NUC.font, fontSize: rientro ? 14 : 15, fontWeight: 600, color: 'var(--fg)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tData(v.nome)}</span>
        <span style={{ flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ display: 'block', fontFamily: NUC.display, fontSize: rientro ? 19 : 22, fontWeight: 800, lineHeight: 1, color: NUC.ink, whiteSpace: 'nowrap' }}>{grande}</span>
          {sotto && <span style={{ display: 'block', fontFamily: NUC.display, fontSize: 12.5, fontWeight: 700, color: NUC.faint, marginTop: 3, whiteSpace: 'nowrap' }}>{sotto}</span>}
        </span>
      </div>
    )
  }

  const frecce = (dir: -1 | 1, attiva: boolean) => (
    <button
      onClick={() => attiva && sposta(dir)}
      disabled={!attiva}
      aria-label={dir < 0 ? t('Mese precedente') : t('Mese successivo')}
      className="j-hard j-focus"
      style={{
        width: 44, height: 44, flexShrink: 0, padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface)',
        // Spenta, la freccia resta al suo posto ma grigia: il mese dopo non c'è
        // ancora, quello prima del primo allenamento non ha niente.
        border: attiva ? 'var(--bordo)' : '2px solid var(--line)',
        color: attiva ? NUC.ink : 'var(--muted-dark)',
        cursor: attiva ? 'pointer' : 'default',
      }}
    >
      {dir < 0 ? <Icons.chevL size={18} stroke={2.2}/> : <Icons.chev size={18} stroke={2.2}/>}
    </button>
  )

  const tutteAperte = giorno.schede.length > 0 && giorno.schede.every(sc => aperte.has(sc.id))

  return (
    <JModal open={open} onClose={onClose} title={t('I tuoi allenamenti')} width={400}>
      {/* I due numeri, su fondo nero: la serie e il mese che si guarda. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', background: 'var(--ink)', color: 'var(--surface)', marginBottom: 18 }}>
        <NumeroNero v={serie} k={serie === 1 ? t('settimana di fila') : t('settimane di fila')}/>
        <NumeroNero
          v={allenatiNelMese}
          k={allenatiNelMese === 1 ? t('giorno a {mese}', { mese: fmtMese(mese.m, lang) }) : t('giorni a {mese}', { mese: fmtMese(mese.m, lang) })}
          style={{ borderLeft: '1px solid var(--line-dark)' }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        {frecce(-1, puoiIndietro)}
        <div style={{ fontFamily: NUC.display, fontSize: 24, fontWeight: 800, textTransform: 'uppercase', color: 'var(--fg)', textAlign: 'center', minWidth: 0 }}>
          {fmtMeseAnno(mese.y, mese.m, lang)}
        </div>
        {frecce(1, puoiAvanti)}
      </div>

      <div style={{ background: 'var(--surface)', border: 'var(--bordo)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: '1px solid var(--line)' }}>
          {daysAbbr(lang).map(d => (
            <div key={d} style={{ textAlign: 'center', padding: '8px 0 7px', fontFamily: NUC.display, fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fg-mute)' }}>{d}</div>
          ))}
        </div>
        {/* Le righe fra le celle sono lo spazio fra l'una e l'altra, col fondo
            della griglia che ci passa sotto. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1, background: 'var(--line)' }}>
          {celle.map((iso, i) => {
            if (!iso) return <div key={`v${i}`} style={{ minWidth: 0, background: 'var(--bg)' }}/>
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
                data-allenato={fatto || undefined}
                className="j-focus"
                style={{
                  // Altezza fissa e non una proporzione: con la proporzione e un
                  // minimo di 46 una colonna stretta si allargava oltre il bordo.
                  minWidth: 0, height: 48, padding: 0, border: 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                  background: eOggi ? 'var(--ink)' : 'var(--surface)',
                  // Il giorno scelto ha la cornice d'inchiostro; se è oggi, che è
                  // già nero, la cornice si stacca con un filo bianco.
                  boxShadow: sel ? (eOggi ? 'inset 0 0 0 2px var(--ink), inset 0 0 0 4px var(--surface)' : 'inset 0 0 0 2px var(--ink)') : 'none',
                  color: eOggi ? 'var(--surface)' : futuro ? 'var(--muted-dark)' : 'var(--fg)',
                  fontFamily: NUC.display, fontSize: 18, fontWeight: eOggi || fatto ? 800 : 600, lineHeight: 1,
                  cursor: futuro ? 'default' : 'pointer',
                }}
              >
                {Number(iso.slice(8))}
                {/* Il trattino c'è sempre, trasparente dove non serve: il numero
                    non si sposta fra un giorno fatto e uno no. */}
                <span aria-hidden style={{ width: 18, height: 3, background: fatto ? 'var(--j-accent)' : 'transparent' }}/>
              </button>
            )
          })}
        </div>
      </div>

      {/* La legenda: i tre segni della griglia. */}
      <div aria-hidden style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 16px', marginTop: 10 }}>
        <Segno disegno={<span style={{ width: 14, height: 3, background: 'var(--j-accent)' }}/>}>{t('allenato')}</Segno>
        <Segno disegno={<span style={{ width: 10, height: 10, background: 'var(--ink)' }}/>}>{t('oggi')}</Segno>
        <Segno disegno={<span style={{ width: 10, height: 10, boxSizing: 'border-box', border: '1.5px solid var(--ink)' }}/>}>{t('selezionato')}</Segno>
      </div>

      <div style={{ marginTop: 22 }}>
        {!scelto ? (
          <div style={{ fontFamily: NUC.font, fontSize: 13.5, color: 'var(--fg-mute)', lineHeight: 1.5 }}>
            {giorni.size === 0 ? t('Nessun allenamento registrato.') : t('Tocca un giorno per vedere cosa hai fatto.')}
          </div>
        ) : (
          <>
            <NucEyebrow style={{ marginBottom: 10 }} right={giorno.schede.length > 0 ? (
              // Apre (o richiude) tutte le schede del giorno insieme: per
              // vedere ogni esercizio fatto senza toccarle una per una.
              <button
                onClick={() => setAperte(tutteAperte ? new Set() : new Set(giorno.schede.map(sc => sc.id)))}
                aria-expanded={tutteAperte}
                // Il nome intero per il lettore di schermo: "Chiudi" da solo
                // sarebbe lo stesso della X del modale.
                aria-label={tutteAperte ? t('Chiudi le schede del giorno') : t('Apri le schede del giorno')}
                className="j-focus"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0, minHeight: 32,
                  background: 'none', border: 'none', cursor: 'pointer',
                  font: 'inherit', fontSize: 14, letterSpacing: 'inherit', textTransform: 'inherit', color: 'inherit',
                }}
              >
                {tutteAperte ? t('Chiudi') : t('Apri')}
                <span style={{ display: 'flex', transform: tutteAperte ? 'rotate(90deg)' : 'none', transition: 'transform var(--motion-fast) var(--ease)' }}>
                  <Icons.arrow size={15} stroke={2.2}/>
                </span>
              </button>
            ) : undefined}>
              {fmtGiornoLungo(new Date(`${scelto}T12:00:00`), lang)}
            </NucEyebrow>

            <div style={{ background: 'var(--surface)', border: 'var(--bordo)' }}>
              {voci.length === 0 && (
                <div style={{ fontFamily: NUC.font, fontSize: 14, color: 'var(--fg-mute)', padding: '12px 14px' }}>
                  {t('Non ti sei allenato')}
                </div>
              )}

              {/* Una scheda eseguita è UNA riga col suo nome: gli esercizi
                  compaiono solo aprendola. Chi ha fatto "Spinta A" ricorda quel
                  giorno come "Spinta A", non come sei alzate in fila. */}
              {giorno.schede.map((sc, i) => {
                const aperta = aperte.has(sc.id)
                return (
                  <div key={sc.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
                    <button
                      onClick={() => apriScheda(sc.id)}
                      aria-expanded={aperta}
                      className="j-focus j-riga-gruppo"
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 14px', background: 'transparent', border: 'none',
                        cursor: 'pointer', textAlign: 'left', color: 'var(--fg)',
                      }}
                    >
                      <span style={{ display: 'flex', color: NUC.ink, flexShrink: 0 }}>
                        <Icons.bookOpen size={16} stroke={1.8}/>
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc.nome}</span>
                        <span style={{ display: 'block', fontFamily: NUC.display, fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--fg-mute)', marginTop: 2 }}>
                          {sc.voci.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: sc.voci.length })}
                        </span>
                      </span>
                      <span style={{ display: 'flex', color: NUC.ink, transform: aperta ? 'rotate(90deg)' : 'none', transition: 'transform var(--motion-fast) var(--ease)' }}>
                        <Icons.chev size={16} stroke={2}/>
                      </span>
                    </button>
                    {aperta && <div style={{ borderTop: '1px solid var(--line)' }}>{sc.voci.map((v, j) => riga(v, j === 0, true))}</div>}
                  </div>
                )
              })}

              {giorno.alzate.length > 0 && giorno.schede.length > 0 && (
                <div style={{ fontFamily: NUC.display, fontSize: 11.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg-mute)', padding: '10px 14px 8px', borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                  {t('Alzate registrate')}
                </div>
              )}
              {giorno.alzate.map((v, j) => riga(v, j === 0 && giorno.schede.length === 0))}
            </div>
          </>
        )}
      </div>
    </JModal>
  )
}

/** Un numero grande bianco con la sua etichetta grigia: le due celle nere in cima. */
function NumeroNero({ v, k, style }: { v: number; k: string; style?: CSSProperties }) {
  return (
    <div style={{ minWidth: 0, padding: '14px 14px 13px', ...style }}>
      <div style={{ fontFamily: NUC.display, fontSize: 36, fontWeight: 800, lineHeight: 1 }}>{v}</div>
      <div style={{ fontFamily: NUC.display, fontSize: 11.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted-dark)', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</div>
    </div>
  )
}

/** Una voce della legenda: il segno, e accanto cosa vuol dire. */
function Segno({ disegno, children }: { disegno: ReactNode; children: ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: NUC.display, fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--fg-mute)' }}>
      <span style={{ display: 'flex' }}>{disegno}</span>{children}
    </span>
  )
}

/** "9 kg" → il numero grande e l'unità piccola; "BW +25 kg" resta intero. Lo
 *  spazio resta, così il testo della riga è ancora "9 kg". */
function chiliGrandi(testo: string): ReactNode {
  const m = testo.match(/^(.*)\s(kg)$/)
  return m ? <>{m[1]} <span style={{ fontSize: '.5em', fontWeight: 700, color: NUC.faint, textTransform: 'uppercase' }}>{m[2]}</span></> : testo
}

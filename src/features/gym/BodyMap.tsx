import { useState } from 'react'
import { NUC, cursore } from '@/lib/jarvis-tokens'
import { LEVEL_LABELS, type DistrictStrength, type StrengthLevel } from './gymStrength'
import { useT, useTData } from '@/lib/i18n'
import { NucEyebrow } from '@/components/ui/NucComponents'
import {
  VIEWBOX_CORPO, neutri, SPALLE, PETTO, CORE, DORSO, GLUTEI, BRACCIA, GAMBE, GAMBE_RETRO, type Forma,
} from './bodyBlocks'

// Mappa del corpo: la sagoma con i distretti colorati per quanto sei forte.
//
// Le coordinate della figura stanno in bodyBlocks, condivise con le icone dei
// gruppi muscolari: sono lo stesso corpo visto da due distanze, e tenerne due
// copie voleva dire vederle scivolare l'una rispetto all'altra.

const LEVEL_OPACITY: Record<StrengthLevel, number> = {
  0: 0,       // nessun dato → resta il fondo neutro
  1: 0.20,
  2: 0.45,
  3: 0.70,
  4: 1,
}

// I distretti visibili da davanti e da dietro. `Gambe` sta su entrambi: l'app ha
// un gruppo solo per la coscia, e mostrarlo da un lato solo lascerebbe metà mappa
// vuota a chi allena le gambe.
// Nomi dei gruppi = chiavi dei dati (vedi MUSCLE_OPTIONS). Si traducono solo a
// video, con `tData`.
const FRONT = ['Spalle', 'Petto', 'Bicipiti', 'Core', 'Gambe']
const BACK  = ['Spalle', 'Dorso', 'Tricipiti', 'Glutei', 'Gambe']

interface RegionProps { d: DistrictStrength | undefined; onPick: () => void; active: boolean }

function useFill(d: DistrictStrength | undefined) {
  const lvl = d?.level ?? 0
  return {
    fill: lvl === 0 ? 'var(--surface-2)' : 'var(--j-accent)',
    fillOpacity: lvl === 0 ? 1 : LEVEL_OPACITY[lvl],
    stroke: 'var(--hairline)',
    strokeWidth: 0.8,
  }
}

// Le sagome di un gruppo di forme. Un solo posto in cui tradurre una `Forma` in
// un <path>, per la figura neutra come per i distretti.
function paths(fs: Forma[]) {
  return fs.map((d, i) => <path key={i} d={d}/>)
}

// Una regione è un gruppo di sagome (le braccia sono due, l'addome dieci pezzi):
// stanno insieme in un <g> così condividono colore, click ed evidenziazione.
function Region({ d, onPick, active, blocchi }: RegionProps & { blocchi: Forma[] }) {
  const f = useFill(d)
  return (
    <g
      onClick={onPick}
      style={{ cursor: 'pointer' }}
      {...f}
      stroke={active ? 'var(--j-accent-ink)' : f.stroke}
      strokeWidth={active ? 1.6 : f.strokeWidth}
    >
      {paths(blocchi)}
    </g>
  )
}

const NEUTRAL = { fill: 'var(--surface-2)', stroke: 'var(--hairline)', strokeWidth: 0.8, strokeOpacity: 0.6 }

export function BodyMap({ districts, side, onPick, picked }: {
  districts: DistrictStrength[]
  side: 'front' | 'back'
  onPick: (muscle: string) => void
  picked: string | null
}) {
  const by = (m: string) => districts.find(x => x.muscle === m)
  const reg = (m: string) => ({ d: by(m), onPick: () => onPick(m), active: picked === m })

  return (
    // Alta quanto lo schermo concede, larga di conseguenza: la figura è la parte
    // più alta della home, ed è lei a decidere se il riepilogo sta tutto in una
    // schermata. A 24dvh su un iPhone normale è ~190px; su uno schermo basso
    // scende fino a 150, su un tablet si ferma a 230.
    <svg viewBox={VIEWBOX_CORPO} strokeLinejoin="round" style={{ height: 'clamp(150px, 24dvh, 230px)', width: 'auto', maxWidth: '100%', display: 'block' }}>
      {/* Parti neutre, sotto tutto: il filo è più tenue, così i distretti — che
          sono ciò che si legge — si staccano dal resto del corpo. */}
      <g {...NEUTRAL}>{paths(neutri(side))}</g>

      {/* Gambe — coscia e polpaccio, su entrambi i lati. Da dietro la coscia
          comincia sotto i glutei (vedi FEMORALI). */}
      <Region {...reg('Gambe')} blocchi={side === 'front' ? GAMBE : GAMBE_RETRO}/>

      {side === 'front' ? (
        <>
          <Region {...reg('Petto')} blocchi={PETTO}/>
          <Region {...reg('Core')}  blocchi={CORE}/>
          <Region {...reg('Bicipiti')} blocchi={BRACCIA}/>
        </>
      ) : (
        <>
          <Region {...reg('Dorso')}  blocchi={DORSO}/>
          <Region {...reg('Glutei')} blocchi={GLUTEI}/>
          <Region {...reg('Tricipiti')} blocchi={BRACCIA}/>
        </>
      )}

      {/* Spalle — su entrambi i lati. Dopo il dorso: il deltoide copre l'attacco
          del trapezio, com'è davvero. */}
      <Region {...reg('Spalle')} blocchi={SPALLE}/>
    </svg>
  )
}

// ── Il modulo completo: titolo con fronte/retro, sagoma, legenda ──
// La sagoma qui sopra resta com'è (realistica, coi distretti accesi); attorno,
// la forma del rebranding: il titolo di sezione con l'interruttore a destra,
// e accanto alla figura una barra per distretto col suo punteggio.
export function BodyMapPanel({ districts, noWeight, onOpenProfile }: {
  districts: DistrictStrength[]
  /** Senza peso corporeo il rapporto non esiste e la mappa resta tutta vuota. */
  noWeight: boolean
  onOpenProfile?: () => void
}) {
  const t = useT()
  const tData = useTData()
  // Il livello scorre dentro la riga ("base · 82 kg · 1.10× peso"), e ci sta
  // minuscolo, in italiano come in inglese.
  const livello = (l: StrengthLevel) => t(LEVEL_LABELS[l]).toLowerCase()
  const [side, setSide] = useState<'front' | 'back'>('front')
  const [picked, setPicked] = useState<string | null>(null)

  // Dal più forte: si legge come una classifica. Quelli senza dati in fondo.
  const visibili = (side === 'front' ? FRONT : BACK)
    .map(m => districts.find(d => d.muscle === m))
    .filter((d): d is DistrictStrength => !!d)
    .sort((a, b) => (b.level > 0 ? b.score : -1) - (a.level > 0 ? a.score : -1))

  const interruttore = (
    <div className="j-switch" style={{ ...cursore(side === 'front' ? 0 : 1, 2), width: 'fit-content' }}>
      {(['front', 'back'] as const).map(v => (
        <button key={v} type="button" onClick={() => { setSide(v); setPicked(null) }} aria-pressed={side === v}
          // `minWidth` e non `width`: le celle sono `flex: 1`, e il cursore
          // ne vale esattamente una.
          className="j-switch-cell" style={{ minWidth: 64, height: 34, padding: '0 12px' }}>
          {v === 'front' ? t('Fronte') : t('Retro')}
        </button>
      ))}
    </div>
  )

  return (
    <section style={{ marginBottom: 26 }}>
      <NucEyebrow right={noWeight ? undefined : interruttore}>{t('Mappa della forza')}</NucEyebrow>
      <div style={{ background: 'var(--surface)', border: 'var(--bordo)', padding: 14 }}>
        {noWeight ? (
          <div style={{ fontFamily: NUC.font, fontSize: 14, color: 'var(--fg-mute)', lineHeight: 1.5 }}>
            {t('La forza si misura sul tuo peso corporeo.')}{' '}
            <button onClick={onOpenProfile} className="j-focus" style={{
              padding: 0, background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 'inherit', color: 'var(--j-accent-ink)', textDecoration: 'underline',
            }}>{t('Inseriscilo nel profilo')}</button>.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, maxWidth: '40%' }}>
              <BodyMap districts={districts} side={side} onPick={m => setPicked(p => p === m ? null : m)} picked={picked}/>
            </div>

            {/* Legenda: il nome del distretto e il suo PUNTEGGIO su 100, dove 100
                è la soglia "Forte" di quel distretto, e sotto la barra che lo
                disegna — piena d'accento quanto il distretto sulla sagoma, con
                una tacca d'inchiostro dove arriva. I chili veri restano, ma solo
                per il distretto toccato: sono il dettaglio che si va a cercare. */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {visibili.map(d => {
                const on = picked === d.muscle
                const fino = Math.min(100, Math.max(0, d.score))
                return (
                  <button key={d.muscle} onClick={() => setPicked(p => p === d.muscle ? null : d.muscle)} className="j-focus" style={{
                    display: 'block', width: '100%', padding: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{
                        fontFamily: NUC.font, fontSize: 14, fontWeight: on ? 600 : 400,
                        color: d.level === 0 ? 'var(--fg-mute)' : 'var(--fg)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{tData(d.muscle)}</span>
                      {/* Il punteggio è il numero grosso della riga: in tabulare,
                          perché incolonnato si legge come una classifica. */}
                      <span style={{
                        flexShrink: 0, fontFamily: NUC.display, fontSize: 22, fontWeight: 800, lineHeight: 1,
                        fontVariantNumeric: 'tabular-nums', color: d.level === 0 ? 'var(--fg-mute)' : 'var(--fg)',
                      }}>{d.level === 0 ? '—' : d.score}</span>
                    </span>
                    <span aria-hidden style={{ position: 'relative', display: 'block', height: 4, marginTop: 6, background: 'var(--line)' }}>
                      {d.level > 0 && (
                        <>
                          <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fino}%`, background: 'var(--j-accent)', opacity: Math.max(0.35, LEVEL_OPACITY[d.level]) }}/>
                          <span style={{ position: 'absolute', left: `calc(${fino}% - 2px)`, top: -3, width: 2, height: 10, background: 'var(--ink)' }}/>
                        </>
                      )}
                    </span>
                    {on && d.best > 0 && (
                      <span style={{ display: 'block', fontFamily: NUC.display, fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fg-mute)', marginTop: 5 }}>
                        {livello(d.level)} · {Math.round(d.best)} kg · {t('{r}× peso', { r: d.ratio?.toFixed(2) ?? '' })}
                      </span>
                    )}
                  </button>
                )
              })}

              {/* Senza questa riga il "72" resta un numero senza unità: l'utente
                  deve poter sapere dove finisce la scala senza aprire una ⓘ. */}
              <div style={{
                marginTop: 2, paddingTop: 8, borderTop: '1px solid var(--line)',
                fontFamily: NUC.display, fontSize: 12, fontWeight: 600, letterSpacing: '.08em',
                textTransform: 'uppercase', color: 'var(--fg-mute)',
              }}>
                {t('100 = forte per questo distretto')}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

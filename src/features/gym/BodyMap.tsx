import { useState } from 'react'
import { NUC, cursore } from '@/lib/jarvis-tokens'
import { LEVEL_LABELS, type DistrictStrength, type StrengthLevel } from './gymStrength'
import { useT, useTData } from '@/lib/i18n'
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

// ── Il modulo completo: sagoma, interruttore fronte/retro, legenda ──
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

  const visibili = (side === 'front' ? FRONT : BACK)
    .map(m => districts.find(d => d.muscle === m))
    .filter((d): d is DistrictStrength => !!d)

  if (noWeight) {
    return (
      <div style={{ fontFamily: NUC.font, fontSize: 12.5, color: 'var(--fg-mute)', padding: '8px 0', lineHeight: 1.5 }}>
        {t('La forza si misura sul tuo peso corporeo.')}{' '}
        <button onClick={onOpenProfile} className="j-focus" style={{
          padding: 0, background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 'inherit', color: 'var(--j-accent-ink)', textDecoration: 'underline',
        }}>{t('Inseriscilo nel profilo')}</button>.
      </div>
    )
  }

  return (
    <>
      {/* Interruttore fronte/retro: lo stesso `.j-switch` di tutti gli altri
          (vedi globals.css), col cursore pieno d'accent com'era il suo. Prima
          era un pezzo a sé, con un contorno a spigoli vivi attorno a una
          pillola arrotondata — l'ultimo rimasto squadrato da quando l'app ha
          gli angoli smussati. */}
      <div className="j-switch j-switch-accent" style={{
        ...cursore(side === 'front' ? 0 : 1, 2),
        width: 'fit-content', marginBottom: 'clamp(8px, 1.3dvh, 12px)',
      }}>
        {(['front', 'back'] as const).map(v => (
          <button key={v} type="button" onClick={() => { setSide(v); setPicked(null) }} aria-pressed={side === v}
            className="j-switch-cell" style={{
              // `minWidth` e non `width`: le celle sono `flex: 1`, e il cursore
              // ne vale esattamente una.
              minWidth: 70, padding: '6px 12px',
              fontFamily: NUC.label, fontSize: 9.5, fontWeight: side === v ? 600 : 500,
              letterSpacing: '.14em', textTransform: 'uppercase',
            }}>
            {v === 'front' ? t('Fronte') : t('Retro')}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0, maxWidth: '40%' }}>
          <BodyMap districts={districts} side={side} onPick={m => setPicked(p => p === m ? null : m)} picked={picked}/>
        </div>

        {/* Legenda: il nome del distretto e il suo PUNTEGGIO su 100, dove 100 è la
            soglia "Forte" di quel distretto. È il numero che rende la mappa
            leggibile a colpo d'occhio: prima l'unico numero era "8 kg · 0.11×",
            che chiede due conti a chi legge — i chili non si confrontano fra
            distretti, e il moltiplicatore va confrontato con una soglia che non è
            scritta da nessuna parte. Qui la soglia è già dentro il numero.
            I chili veri restano, ma solo per il distretto toccato: sono il
            dettaglio che si va a cercare, non il colpo d'occhio. */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visibili.map(d => {
            const on = picked === d.muscle
            return (
              <button key={d.muscle} onClick={() => setPicked(p => p === d.muscle ? null : d.muscle)} className="j-focus" style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{
                  width: 9, height: 9, flexShrink: 0, borderRadius: 'var(--radius-sm)',
                  background: d.level === 0 ? 'var(--surface-2)' : 'var(--j-accent)',
                  opacity: d.level === 0 ? 1 : LEVEL_OPACITY[d.level],
                  border: '1px solid var(--hairline)',
                }}/>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{
                    fontFamily: NUC.font, fontSize: 12.5,
                    color: d.level === 0 ? 'var(--fg-mute)' : 'var(--fg)',
                    fontWeight: on ? 500 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{tData(d.muscle)}</span>
                  {on && d.best > 0 && (
                    <span style={{ fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.06em', color: 'var(--fg-mute)', marginTop: 1 }}>
                      {livello(d.level)} · {Math.round(d.best)} kg · {t('{r}× peso', { r: d.ratio?.toFixed(2) ?? '' })}
                    </span>
                  )}
                </span>
                {/* Il punteggio è il numero grosso della riga: sta in tabulare
                    perché incolonnato si legge come una classifica. */}
                <span style={{
                  flexShrink: 0, minWidth: 26, textAlign: 'right',
                  fontFamily: NUC.label, fontSize: 14, fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums',
                  color: d.level === 0 ? 'var(--fg-mute)' : 'var(--j-accent-ink)',
                }}>{d.level === 0 ? '—' : d.score}</span>
              </button>
            )
          })}

          {/* Senza questa riga il "72" resta un numero senza unità: l'utente
              deve poter sapere dove finisce la scala senza aprire una ⓘ. */}
          <div style={{
            marginTop: 2, paddingTop: 6, borderTop: '1px solid var(--divider)',
            fontFamily: NUC.label, fontSize: 9, letterSpacing: '.08em',
            textTransform: 'uppercase', color: 'var(--fg-mute)',
          }}>
            {t('100 = forte per questo distretto')}
          </div>
        </div>
      </div>
    </>
  )
}

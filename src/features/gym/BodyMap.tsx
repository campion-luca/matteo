import { useState } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { fireCoach } from '@/components/CoachMark'
import { LEVEL_LABELS, type DistrictStrength, type StrengthLevel } from './gymStrength'
import { useT, useTData, useLang } from '@/lib/i18n'
import {
  VIEWBOX_CORPO, neutri, SPALLE, PETTO, CORE, DORSO, BACINO, BRACCIA, GAMBE, type Blocco,
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

// I rettangoli di un gruppo di blocchi. Un solo posto in cui tradurre una
// `Blocco` in un <rect>, per la sagoma neutra come per i distretti.
function rects(bs: Blocco[]) {
  return bs.map(([x, y, w, h, r], i) => <rect key={i} x={x} y={y} width={w} height={h} rx={r}/>)
}

// Una regione è un gruppo di rettangoli (le braccia sono due): stanno insieme in
// un <g> così condividono colore, click ed evidenziazione.
function Region({ d, onPick, active, blocchi }: RegionProps & { blocchi: Blocco[] }) {
  const f = useFill(d)
  return (
    <g
      onClick={onPick}
      style={{ cursor: 'pointer' }}
      {...f}
      stroke={active ? 'var(--j-accent-ink)' : f.stroke}
      strokeWidth={active ? 1.6 : f.strokeWidth}
    >
      {rects(blocchi)}
    </g>
  )
}

const NEUTRAL = { fill: 'var(--surface-2)', stroke: 'var(--hairline)', strokeWidth: 0.8 }

export function BodyMap({ districts, side, onPick, picked }: {
  districts: DistrictStrength[]
  side: 'front' | 'back'
  onPick: (muscle: string) => void
  picked: string | null
}) {
  const by = (m: string) => districts.find(x => x.muscle === m)
  const reg = (m: string) => ({ d: by(m), onPick: () => onPick(m), active: picked === m })

  return (
    <svg viewBox={VIEWBOX_CORPO} style={{ width: '100%', maxWidth: 168, height: 'auto', display: 'block' }}>
      {/* Parti neutre, sotto tutto */}
      <g {...NEUTRAL}>{rects(neutri(side))}</g>

      {/* Spalle — su entrambi i lati, nella stessa posizione */}
      <Region {...reg('Spalle')} blocchi={SPALLE}/>

      {side === 'front' ? (
        <>
          <Region {...reg('Petto')} blocchi={PETTO}/>
          <Region {...reg('Core')}  blocchi={CORE}/>
          <Region {...reg('Bicipiti')} blocchi={BRACCIA}/>
        </>
      ) : (
        <>
          <Region {...reg('Dorso')}  blocchi={DORSO}/>
          <Region {...reg('Glutei')} blocchi={BACINO}/>
          <Region {...reg('Tricipiti')} blocchi={BRACCIA}/>
        </>
      )}

      {/* Gambe — coscia e polpaccio, su entrambi i lati */}
      <Region {...reg('Gambe')} blocchi={GAMBE}/>
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
  const lang = useLang()
  // Il livello scorre dentro la riga ("base · 82 kg · 1.10× peso"), e in italiano
  // ci sta minuscolo. In tedesco no: "Grundlage" è un sostantivo, e minuscolo
  // sarebbe un errore di ortografia, non una scelta di stile.
  const livello = (l: StrengthLevel) => {
    const etichetta = t(LEVEL_LABELS[l])
    return lang === 'de' ? etichetta : etichetta.toLowerCase()
  }
  const [side, setSide] = useState<'front' | 'back'>('front')
  const [pickedRaw, setPickedRaw] = useState<string | null>(null)
  const picked = pickedRaw

  // La mappa non ha un tasto che la apre: vive già sulla home. Il primo tocco su
  // un distretto è il momento in cui l'utente le sta chiedendo qualcosa, ed è lì
  // che ha senso spiegarle cos'è quel punteggio.
  const setPicked = (v: React.SetStateAction<string | null>) => {
    fireCoach('bodyMap')
    setPickedRaw(v)
  }

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
      {/* Interruttore fronte/retro */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12, border: '1px solid var(--hairline)', width: 'fit-content' }}>
        {(['front', 'back'] as const).map(v => (
          <button key={v} onClick={() => { setSide(v); setPickedRaw(null) }} style={{
            padding: '5px 12px', borderRadius: 0, border: 'none', cursor: 'pointer',
            background: side === v ? 'var(--j-accent)' : 'transparent',
            color: side === v ? 'var(--j-accent-fg)' : 'var(--fg-soft)',
            fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase',
            transition: 'background 180ms',
          }}>
            {v === 'front' ? t('Fronte') : t('Retro')}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0, width: '38%', maxWidth: 168 }}>
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
                  width: 9, height: 9, flexShrink: 0, borderRadius: 0,
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
            marginTop: 2, paddingTop: 6, borderTop: '1px solid var(--hairline)',
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

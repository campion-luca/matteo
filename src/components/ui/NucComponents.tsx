import { useState, type ReactNode, type CSSProperties } from 'react'
import { NUC } from '@/lib/jarvis-tokens'



// ── Paper card ─────────────────────────────────────────────────
interface NucCardProps {
  children: ReactNode; style?: CSSProperties; strong?: boolean; pad?: number
  onPress?: () => void
  hard?: boolean
  /** La card affonda anche se il click lo gestisce un figlio (card Ricerca: il
   *  bottone è tutta la card). Regge perché :hover/:active risalgono dal figlio.
   *
   *  Combinato con `onPress` significa: il click su tutta la card funziona, ma il
   *  controllo ACCESSIBILE è un figlio. Serve alle card che ospitano già altri
   *  bottoni (la ⓘ del riepilogo settimanale): dare un `role="button"` al
   *  contenitore ci anniderebbe dentro un secondo controllo, che è peggio del
   *  problema che risolve. */
  pressable?: boolean
}

export function NucCard({ children, style = {}, strong = false, pad = 18, onPress, hard, pressable = false }: NucCardProps) {
  const [pressed, setPressed] = useState(false)

  // `hard` = ombra piena offsettata (vedi .j-hard in globals.css). Ma solo le card
  // che si premono davvero la prendono INTERATTIVA: un hover che affonda su una card
  // che non fa niente al click è una promessa falsa. Le altre la portano e basta.
  //
  // Con l'ombra attiva NON si scrivono boxShadow/transform/transition inline: uno
  // stile inline batte qualsiasi regola del foglio e li spegnerebbe in silenzio. Per
  // lo stesso motivo lo `scale` di pressione se ne va: è il vecchio linguaggio, e
  // adesso lo dice l'ombra.
  // Di default ce l'ha chi si preme: una card cliccabile è un tasto grande, e
  // lasciarla piatta la rendeva indistinguibile dal contenuto che le sta intorno.
  // `hard={false}` esplicito la toglie a chi non la vuole.
  const conOmbra = hard ?? (!!onPress || pressable)
  const soft = !conOmbra
  const sinks = !!onPress || pressable
  const isControl = !!onPress && !pressable

  return (
    <div
      className={conOmbra ? (sinks ? 'j-hard' : 'j-hard-flat') : undefined}
      // La card è un controllo solo se il click è suo E non c'è già un bottone
      // figlio a portare il nome accessibile: vedi `pressable`.
      role={isControl ? 'button' : undefined}
      tabIndex={isControl ? 0 : undefined}
      onKeyDown={isControl ? e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPress?.() }
      } : undefined}
      // Lo stato "premuto" serve solo alla scala delle card piatte che si
      // premono. Prima lo scrivevano tutte, a ogni tocco: una spunta dentro la
      // card di un esercizio ridisegnava due volte la card intera, campi compresi.
      onMouseDown={onPress && soft ? () => setPressed(true) : undefined}
      onMouseUp={onPress ? () => { if (soft) setPressed(false); onPress() } : undefined}
      onMouseLeave={onPress && soft ? () => setPressed(false) : undefined}
      style={{
        position: 'relative',
        borderRadius: 'var(--radius-lg)', padding: pad,
        background: strong ? NUC.cardStrong : NUC.card,
        border: `1px solid ${NUC.hairline}`,
        ...(soft && {
          boxShadow: 'var(--shadow-card)',
          transform: `scale(${pressed && onPress ? 0.99 : 1})`,
          transition: 'transform 200ms cubic-bezier(.2,.8,.2,1)',
        }),
        cursor: onPress ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ── Segmented toggle ───────────────────────────────────────────
interface SegOption {
  id: string
  label: string
  icon?: ReactNode
  /** Appeso DOPO l'etichetta: il pallino rosso delle cose da leggere. Separato da
   *  `icon`, che sta prima, perché una notifica letta a sinistra del nome sembra
   *  una figurina della voce e non un avviso. */
  badge?: ReactNode
}
interface NucSegmentedProps { options: SegOption[]; value: string; onChange: (id: string) => void; fontSize?: number }

export function NucSegmented({ options, value, onChange, fontSize = 10 }: NucSegmentedProps) {
  const idx = Math.max(0, options.findIndex(o => o.id === value))
  return (
    <div style={{ position: 'relative', display: 'flex', background: 'var(--surface)', border: `1px solid var(--hairline)`, borderRadius: 'var(--radius)', padding: 3, height: 44 }}>
      <div className="nuc-seg-pill" style={{
        position: 'absolute', top: 3, bottom: 3,
        width: `calc((100% - 6px) / ${options.length})`,
        left: 3,
        transform: `translateX(calc(${idx} * 100%))`,
        // Un gradino sotto al guscio: a raggio uguale, con i 3px di padding in
        // mezzo, gli angoli della pillola uscirebbero da quelli del contenitore.
        borderRadius: 'var(--radius-sm)',
        // Più CHIARA del guscio, non più scura: vedi `.j-switch` in globals.css.
        background: 'var(--surface-2)',
        border: 'none',
        boxShadow: 'var(--shadow-card)',
      }}/>
      {options.map(o => (
        <button key={o.id} onClick={() => onChange(o.id)} style={{
          flex: 1, position: 'relative', zIndex: 1, background: 'transparent', border: 'none',
          color: o.id === value ? NUC.ink : NUC.faint,
          fontFamily: NUC.label, fontSize, fontWeight: o.id === value ? 600 : 500,
          letterSpacing: '.12em', textTransform: 'uppercase',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          transition: 'color 220ms',
        }}>
          {o.icon}{o.label}{o.badge}
        </button>
      ))}
    </div>
  )
}

// ── Sub-tab segmented (accent variant, sliding pill) ───────────
interface NucSubTabsProps { options: SegOption[]; value: string; onChange: (id: string) => void; style?: CSSProperties }

export function NucSubTabs({ options, value, onChange, style }: NucSubTabsProps) {
  const idx = Math.max(0, options.findIndex(o => o.id === value))
  return (
    <div style={{ position: 'relative', display: 'flex', background: 'var(--surface)', border: `1px solid var(--hairline)`, borderRadius: 'var(--radius-sm)', padding: 3, height: 34, ...style }}>
      <div className="nuc-seg-pill" style={{
        position: 'absolute', top: 3, bottom: 3,
        width: `calc((100% - 6px) / ${options.length})`,
        left: 3,
        transform: `translateX(calc(${idx} * 100%))`,
        // Il guscio è a `--radius-sm` con 3px di padding: la pillola dentro sta a
        // quel raggio meno il padding, o gli angoli le escono dai suoi.
        borderRadius: 9,
        background: 'var(--surface-2)',
        border: 'none',
        boxShadow: 'var(--shadow-card)',
      }}/>
      {options.map(o => (
        <button key={o.id} onClick={() => onChange(o.id)} style={{
          flex: 1, position: 'relative', zIndex: 1, background: 'transparent', border: 'none',
          color: o.id === value ? 'var(--fg)' : NUC.faint,
          fontFamily: NUC.label, fontSize: 10, fontWeight: o.id === value ? 600 : 500,
          letterSpacing: '.16em', textTransform: 'uppercase',
          cursor: 'pointer', transition: 'color 220ms',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          {o.icon}{o.label}{o.badge}
        </button>
      ))}
    </div>
  )
}

// ── Eyebrow label ──────────────────────────────────────────────
interface NucEyebrowProps { children: ReactNode; right?: ReactNode; style?: CSSProperties }

export function NucEyebrow({ children, right, style }: NucEyebrowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 2px', marginBottom: 10, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
        {/* Il titolo di sezione è una rifinitura: prende il colore terziario. */}
        <div style={{ fontFamily: NUC.label, fontSize: 10, fontWeight: 600, letterSpacing: '.16em', color: 'var(--tertiary-ink)', textTransform: 'uppercase' }}>{children}</div>
      </div>
      {right && <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.16em', color: NUC.faint, textTransform: 'uppercase', flexShrink: 0 }}>{right}</div>}
    </div>
  )
}

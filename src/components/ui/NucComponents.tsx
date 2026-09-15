import { useState, type ReactNode, type CSSProperties } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { useT } from '@/lib/i18n'
import { Icons } from './Icons'

// ── Grain overlay (paper texture, very subtle) ─────────────────
export function NucGrain() {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.06, mixBlendMode: 'multiply', pointerEvents: 'none', zIndex: 70 }}>
      <filter id="nuc-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves={3} stitchTiles="stitch"/>
        <feColorMatrix values="0 0 0 0 0.24  0 0 0 0 0.16  0 0 0 0 0.08  0 0 0 0.6 0"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#nuc-grain)"/>
    </svg>
  )
}

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
      // `j-glass` smeriglia il fondo nei temi scuri (vedi "Vetro" in globals.css).
      className={`j-glass${conOmbra ? (sinks ? ' j-hard' : ' j-hard-flat') : ''}`}
      // La card è un controllo solo se il click è suo E non c'è già un bottone
      // figlio a portare il nome accessibile: vedi `pressable`.
      role={isControl ? 'button' : undefined}
      tabIndex={isControl ? 0 : undefined}
      onKeyDown={isControl ? e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPress?.() }
      } : undefined}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => { setPressed(false); onPress?.() }}
      onMouseLeave={() => setPressed(false)}
      style={{
        position: 'relative',
        borderRadius: 0, padding: pad,
        background: strong ? NUC.cardStrong : NUC.card,
        backgroundImage: 'var(--glass-sheen)',
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
interface SegOption { id: string; label: string; icon?: ReactNode }
interface NucSegmentedProps { options: SegOption[]; value: string; onChange: (id: string) => void; fontSize?: number }

export function NucSegmented({ options, value, onChange, fontSize = 10 }: NucSegmentedProps) {
  const idx = Math.max(0, options.findIndex(o => o.id === value))
  return (
    <div style={{ position: 'relative', display: 'flex', background: 'var(--surface-2)', border: `1px solid var(--hairline)`, borderRadius: 0, padding: 3, height: 44 }}>
      <div className="nuc-seg-pill" style={{
        position: 'absolute', top: 3, bottom: 3,
        width: `calc((100% - 6px) / ${options.length})`,
        left: 3,
        transform: `translateX(calc(${idx} * 100%))`,
        borderRadius: 0,
        background: 'var(--surface)',
        border: `1px solid var(--hairline)`,
        boxShadow: 'var(--shadow-card)',
      }}/>
      {options.map(o => (
        <button key={o.id} onClick={() => onChange(o.id)} style={{
          flex: 1, position: 'relative', zIndex: 1, background: 'transparent', border: 'none',
          color: o.id === value ? NUC.ink : NUC.faint,
          fontFamily: NUC.label, fontSize, fontWeight: 500,
          letterSpacing: '.12em', textTransform: 'uppercase',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          transition: 'color 220ms',
        }}>
          {o.icon}{o.label}
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
    <div style={{ position: 'relative', display: 'flex', background: 'var(--surface-2)', border: `1px solid var(--hairline)`, borderRadius: 0, padding: 3, height: 34, ...style }}>
      <div className="nuc-seg-pill" style={{
        position: 'absolute', top: 3, bottom: 3,
        width: `calc((100% - 6px) / ${options.length})`,
        left: 3,
        transform: `translateX(calc(${idx} * 100%))`,
        borderRadius: 0,
        background: 'var(--surface)',
        border: `1px solid var(--j-accent)`,
        boxShadow: 'var(--shadow-card)',
      }}/>
      {options.map(o => (
        <button key={o.id} onClick={() => onChange(o.id)} style={{
          flex: 1, position: 'relative', zIndex: 1, background: 'transparent', border: 'none',
          color: o.id === value ? 'var(--j-accent-ink)' : NUC.faint,
          fontFamily: NUC.label, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase',
          cursor: 'pointer', transition: 'color 220ms',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          {o.icon}{o.label}
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

// ── Navigazione ────────────────────────────────────────────────
// Su telefono non c'è più un tasto di navigazione: dalla home si entra
// nell'allenamento con "Alleniamoci", e ogni schermata ha la sua freccia in alto
// a sinistra. Su desktop resta la colonna qui sotto.
export type TabId = 'home' | 'gym'

export interface NucNavProps { active: TabId; onChange: (t: TabId) => void }

// ── Desktop sidebar nav ────────────────────────────────────────
interface SidebarNavProps extends NucNavProps {
  onOpenProfile?: () => void
  userName?: string
}

// Riga della sidebar: icona a sinistra, etichetta in maiuscoletto.
function SidebarRow({ icon: Ico, label, onClick, active = false, ariaLabel }: {
  icon: (p?: { size?: number; stroke?: number }) => JSX.Element
  label: string
  onClick?: () => void
  active?: boolean
  ariaLabel?: string
}) {
  return (
    <button onClick={onClick} aria-label={ariaLabel} aria-current={active ? 'page' : undefined} style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: 10,
      width: '100%', height: 40, padding: '0 12px',
      borderRadius: 0,
      background: active ? 'var(--surface-2)' : 'transparent',
      border: 'none', cursor: 'pointer',
      // 0.38 su fondo quasi nero era ~2.6:1 → sotto AA. Il token porta a ~5:1.
      color: active ? 'var(--fg)' : 'var(--fg-mute)',
      transition: 'color 160ms',
      textAlign: 'left',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--fg)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--fg-mute)' }}
    >
      {active && (
        <div style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: 3, height: 18, borderRadius: 0, background: 'var(--j-accent)',
        }}/>
      )}
      <Ico size={16} stroke={active ? 2 : 1.5}/>
      <span style={{
        fontFamily: NUC.label, fontSize: 10, letterSpacing: '.12em',
        textTransform: 'uppercase', fontWeight: active ? 600 : 400,
      }}>{label}</span>
    </button>
  )
}

const SidebarDivider = () => <div style={{ margin: '8px 0 6px', height: 1, background: 'var(--divider)' }}/>

export function NucSidebarNav({ active, onChange, onOpenProfile, userName }: SidebarNavProps) {
  const t = useT()
  const navItems: Array<{ id: TabId; icon: (p?: { size?: number; stroke?: number }) => JSX.Element; label: string }> = [
    { id: 'home',   icon: Icons.home,   label: t('Home')        },
    { id: 'gym',    icon: Icons.weight, label: t('Allenamento') },
  ]
  const onHome = active === 'home'

  return (
    <div style={{
      width: 200,
      height: '100%',
      background: 'var(--bg)',
      borderRight: '1px solid var(--hairline)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      zIndex: 40,
    }}>
      {/* Brand */}
      <div style={{ padding: '28px 20px 22px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{
          fontFamily: NUC.label, fontSize: 10, letterSpacing: '.28em',
          color: 'var(--fg-mute)', textTransform: 'uppercase', marginBottom: 5,
        }}>{t('Personal OS')}</div>
        <div style={{
          fontFamily: NUC.font, fontSize: 20, fontWeight: 500,
          letterSpacing: 0, color: 'var(--fg)',
        }}>{userName || 'Matteo'}</div>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 10px', gap: 2, overflowY: 'auto' }}>
        {navItems.map(item => (
          <SidebarRow key={item.id} icon={item.icon} label={item.label}
            active={item.id === active} onClick={() => onChange(item.id)}/>
        ))}

        {/* Personal Coach non è più qui: sta fra le card dell'allenamento. */}
        {/* Su desktop la chrome vive QUI e non in cima alla home: la barra è già una
            colonna permanente accanto al contenuto, e ripetere gli stessi tondi
            dentro la pagina voleva dire due posti dove cercare la stessa cosa. Su
            telefono la barra non c'è e i bottoni restano nell'intestazione dei moduli. */}
        <div style={{ flex: 1, minHeight: 12 }}/>
        <SidebarDivider/>
        {/* Una voce sola, ed è la rotella: dietro c'è tutto quello che si regola —
            dati, tema, widget della home, account. Il gestore dei moduli era una
            riga a parte e viveva solo sulla Home; adesso è una card lì dentro. */}
        <SidebarRow icon={Icons.settings} label={t('Impostazioni')} ariaLabel={t('Impostazioni')} onClick={onOpenProfile}/>
      </div>

      {/* Ritorno alla Home — dalla Home stessa non serve e non si mostra. */}
      {!onHome && (
      <div style={{ padding: '0 10px 28px' }}>
        {/* La pressione la fa .j-hard. Niente `transition` inline qui: uno stile inline
            batte qualsiasi regola del foglio, e azzererebbe l'animazione dell'ombra. */}
        <button
          className="j-hard"
          onClick={() => onChange('home')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', height: 40, padding: '0 14px',
            borderRadius: 0,
            background: 'var(--j-accent)',
            border: 'none', cursor: 'pointer',
            color: 'var(--j-accent-fg)',
          }}
        >
          <Icons.home size={15} stroke={1.8}/>
          <span style={{
            fontFamily: NUC.label, fontSize: 10, letterSpacing: '.12em',
            textTransform: 'uppercase', fontWeight: 600,
          }}>{t('Home')}</span>
        </button>
      </div>
      )}
    </div>
  )
}

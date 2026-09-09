import { useState, type ReactNode, type CSSProperties } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { useT } from '@/lib/i18n'
import type { MetricId } from '@/lib/metricInfo'
import { Icons } from './Icons'
import { InfoDot } from './InfoDot'

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
      className={conOmbra ? (sinks ? 'j-hard' : 'j-hard-flat') : undefined}
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
interface NucEyebrowProps { children: ReactNode; right?: ReactNode; info?: MetricId; style?: CSSProperties }

export function NucEyebrow({ children, right, info, style }: NucEyebrowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 2px', marginBottom: 10, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
        <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.16em', color: NUC.faint, textTransform: 'uppercase' }}>{children}</div>
        {/* La ⓘ sta accanto al titolo di sezione, non ai singoli numeri: vedi InfoDot. */}
        {info && <InfoDot id={info}/>}
      </div>
      {right && <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.16em', color: NUC.faint, textTransform: 'uppercase', flexShrink: 0 }}>{right}</div>}
    </div>
  )
}

// ── Bottom nav ─────────────────────────────────────────────────
export type TabId = 'home' | 'gym'

export interface NucNavProps { active: TabId; onChange: (t: TabId) => void }

// Da che parte cade il tasto. `centro` resta il default.
const ALLINEAMENTO: Record<string, 'flex-start' | 'center' | 'flex-end'> = {
  sinistra: 'flex-start', centro: 'center', destra: 'flex-end',
}

export function NucNav({ active, onChange, pos = 'centro' }: NucNavProps & { pos?: string }) {
  const t = useT()
  const onHome = active === 'home'

  // Con due sole schermate il tasto non apre un menù: porta direttamente
  // all'altra. Un menù orbitale che si apre per mostrare una voce sola sarebbe
  // un tocco in più per la stessa destinazione.
  const destinazione: TabId = onHome ? 'gym' : 'home'
  const Ico = onHome ? Icons.weight : Icons.home
  const etichetta = onHome ? t('Vai all’allenamento') : t('Vai alla Home')

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 40,
      pointerEvents: 'none',
      // Appoggiato al fondo: i 10px in più lo tenevano sospeso a metà aria sopra
      // il bordo, e su un telefono senza notch (dove la safe-area è zero) era
      // l'unica cosa che lo separava dal bordo dello schermo.
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 2px)',
      // A sinistra e a destra non va a filo: il pollice ci arriva, ma un tasto
      // incollato al bordo si legge come tagliato dallo schermo.
      paddingLeft: 18, paddingRight: 18,
      display: 'flex', flexDirection: 'column', alignItems: ALLINEAMENTO[pos] ?? 'center', gap: 5,
    }}>
      {/* Quadrato, non più una palla: è l'unico controllo di navigazione rimasto e
          parla la stessa lingua di tutto il resto — angoli vivi e ombra "stampa"
          (.j-hard), che è anche l'unica cosa che deve dire "si preme". Niente
          box-shadow/transform inline qui: uno stile inline batte il foglio e
          spegnerebbe l'ombra in silenzio. */}
      <button
        onClick={() => onChange(destinazione)}
        aria-label={etichetta}
        className="j-hard j-focus"
        style={{
          // 44 e non 54: il quadrato è un bersaglio da dito, e 44px è già la
          // misura minima buona. L'icona resta a 22 — è lei a dire dove porta,
          // e rimpicciolirla avrebbe reso il tasto più piccolo E più muto.
          width: 44, height: 44, borderRadius: 0,
          background: 'var(--j-accent)', border: 'none', cursor: 'pointer',
          color: 'var(--j-accent-fg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'auto',
        }}
      >
        <Ico size={22} stroke={1.9}/>
      </button>
      {/* L'icona da sola non dice dove porta: il tasto cambia glifo a ogni
          schermata, e senza etichetta il manubrio si confonde con la scorciatoia
          Personal Coach della home. */}
      <span style={{
        fontFamily: NUC.label, fontSize: 8.5, fontWeight: 600, letterSpacing: '.1em',
        textTransform: 'uppercase', color: 'var(--j-accent-ink)', whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}>{onHome ? t('Allenamento') : t('Home')}</span>
    </div>
  )
}

// ── Desktop sidebar nav ────────────────────────────────────────
interface SidebarNavProps extends NucNavProps {
  onOpenBudget?: () => void
  onOpenCoach?: () => void
  onOpenProfile?: () => void
  userName?: string
}

// Riga della sidebar: icona a sinistra, etichetta in maiuscoletto. Ne esistevano
// due copie quasi identiche (le tab e il Budget) prima che la barra si prendesse
// anche profilo e impostazioni; a quel punto sarebbero diventate cinque.
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

const SidebarDivider = () => <div style={{ margin: '8px 0 6px', height: 1, background: 'var(--hairline)' }}/>

export function NucSidebarNav({ active, onChange, onOpenBudget, onOpenCoach, onOpenProfile, userName }: SidebarNavProps) {
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
      <div style={{ padding: '28px 20px 22px', borderBottom: '1px solid var(--hairline)' }}>
        <div style={{
          fontFamily: NUC.label, fontSize: 10, letterSpacing: '.28em',
          color: 'var(--fg-mute)', textTransform: 'uppercase', marginBottom: 5,
        }}>{t('Personal OS')}</div>
        <div style={{
          fontFamily: NUC.serif, fontSize: 20, fontWeight: 500,
          letterSpacing: 0, color: 'var(--fg)',
        }}>{userName || 'Matteo'}</div>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 10px', gap: 2, overflowY: 'auto' }}>
        {navItems.map(item => (
          <SidebarRow key={item.id} icon={item.icon} label={item.label}
            active={item.id === active} onClick={() => onChange(item.id)}/>
        ))}

        {/* Strumenti: overlay, non tab, quindi senza stato "attivo". Separati da un
            filo perché non sono destinazioni di navigazione. */}
        <SidebarDivider/>
        <SidebarRow icon={Icons.dumbbell} label={t('Personal Coach')} ariaLabel={t('Apri Personal Coach')} onClick={onOpenCoach}/>
        <SidebarRow icon={Icons.wallet} label={t('Budget')} ariaLabel={t('Apri Budget')} onClick={onOpenBudget}/>

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

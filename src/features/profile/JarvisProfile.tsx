// Impostazioni: dati personali, aspetto, widget della home e uscita dall'account.
//
// È un overlay a tutta pagina, non una tab: si apre dalla rotella in home e
// dalla sidebar desktop. Ogni interruttore qui scrive nello store, cioè nel blob
// che va in cloud — tranne i widget della home, che sono una preferenza del
// dispositivo (vedi homeModules).
// Le anteprime (LayoutSwatch) sono disegnate a mano invece che con screenshot:
// devono seguire l'accent scelto in quel momento.
import { useState, useEffect, type ReactNode } from 'react'
import { NUC, ACCENT_PALETTES, accentFgFor, paletteFor, adjustPaletteForDark, MONO_LIGHT, MONO_DARK } from '@/lib/jarvis-tokens'
import { useStore, useJarvisStore, type LayoutMode, type NavPos } from '@/store/useJarvisStore'
import { todayISO } from '@/lib/isoDate'
import { fmtDayMonth } from '@/lib/dateFormat'
import { LineChart } from '@/features/gym/gymShared'
import { Icons } from '@/components/ui/Icons'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { HomeModulesManager } from '@/features/dashboard/HomeModulesManager'
import { supabase } from '@/lib/supabase'
import { useConfirmDelete } from '@/hooks/useConfirmDelete'
import { useT, translate, LANG_LABELS, LANGS, type Lang } from '@/lib/i18n'
import { Flag } from '@/components/ui/Flags'

interface JarvisProfileProps { open: boolean; onClose: () => void }

// "Notte" non è più qui: è diventato un layout (vedi LAYOUTS). Restano 3 palette,
// che è anche il numero di colonne della griglia — prima erano 4 su 3 colonne, con
// un orfano sulla seconda riga.
const PALETTE_LABELS: Record<string, string> = {
  green:   'Journal',
  rose:    'Rosa',
  malva:   'Malva',
}
const PALETTE_KEYS = ['green', 'rose', 'malva'] as const

// Etichette e spiegazioni restano in italiano qui: sono le CHIAVI del dizionario
// (vedi i18n.ts). Questa costante nasce una volta sola all'import, e tradurla in
// questo punto la bloccherebbe sulla lingua che c'era in quel momento.
const LAYOUTS: Array<{ id: LayoutMode; label: string; hint: string }> = [
  { id: 'standard', label: 'Standard', hint: 'I colori del tema scelto sopra.' },
  { id: 'notte',    label: 'Notte',    hint: 'Niente colori, ma segue chiaro/scuro: di giorno resta grigio su bianco.' },
  { id: 'nero',     label: 'Nero',     hint: 'Sempre nero pieno, testo e dettagli bianchi. Ignora l’interruttore chiaro/scuro.' },
]

// Sezione: una sola struttura per tutte. Prima ogni blocco aveva il suo gap
// (8/14/12/12/10) e i divider erano ripetuti a mano; il risultato era il vuoto
// incoerente fra un blocco e l'altro. Il divider ora lo mette il CSS
// (`.j-profile-sec + .j-profile-sec`), che regge da solo le sezioni condizionali.
function Section({ title, hint, action, right, children }: {
  title: string
  hint?: string
  action?: ReactNode
  right?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="j-profile-sec" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="j-eyebrow">{title}</div>
            {action}
          </div>
          {hint && <div style={{ fontFamily: NUC.font, fontSize: 13, color: 'var(--fg-mute)', lineHeight: 1.4 }}>{hint}</div>}
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

// Interruttore on/off, condiviso da tutte le impostazioni a due stati.
function Toggle({ on, onClick, disabled, label }: { on: boolean; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={disabled} role="switch" aria-checked={on} aria-label={label} style={{
      width: 42, height: 24, borderRadius: 12, padding: 0, flexShrink: 0,
      background: on ? 'var(--j-accent)' : 'var(--surface-2)',
      border: `1px solid ${on ? 'var(--j-accent)' : 'var(--hairline)'}`,
      cursor: disabled ? 'default' : 'pointer', position: 'relative', opacity: disabled ? 0.6 : 1,
      transition: 'all 220ms',
    }}>
      <div style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: 'var(--knob)', boxShadow: '0 1px 3px rgba(42,36,24,0.4)', transition: 'left 220ms cubic-bezier(.2,.9,.2,1.2)' }}/>
    </button>
  )
}

// Inline pencil/check toggle button
function EditToggle({ editing, onToggle }: { editing: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 20, height: 20, borderRadius: 0,
        background: editing ? 'var(--j-accent)' : 'transparent',
        border: `1px solid ${editing ? 'var(--j-accent)' : 'var(--hairline)'}`,
        color: editing ? 'var(--j-accent-fg)' : 'var(--fg-mute)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 160ms', flexShrink: 0,
      }}
    >
      {editing ? <Icons.check size={10} stroke={2.5}/> : <Icons.pencil size={10} stroke={1.8}/>}
    </button>
  )
}

// Pastiglia bicolore: mostra cosa fa il layout invece di dirlo. "Standard" campiona
// l'accent vivo, "Notte" il taglio bianco/nero, "Nero" il fondo pieno con il segno
// bianco sopra — che è esattamente il suo contrasto.
const SWATCH: Record<LayoutMode, [string, string]> = {
  standard: ['var(--j-accent)', 'var(--j-accent-soft)'],
  notte:    ['#ffffff', '#141414'],
  nero:     ['#000000', '#ffffff'],
}

function LayoutSwatch({ mode }: { mode: LayoutMode }) {
  const half = { width: 11, height: 22, flexShrink: 0 } as const
  const [a, b] = SWATCH[mode] ?? SWATCH.standard
  return (
    <div style={{ display: 'flex', border: '1px solid var(--hairline)' }}>
      <div style={{ ...half, background: a }}/>
      <div style={{ ...half, background: b }}/>
    </div>
  )
}

// Mini-anteprima: uno schermo con il tasto dove finirebbe. Disegnata e non
// fotografata, come LayoutSwatch, così segue l'accent scelto in quel momento.
function NavPosPreview({ pos, active }: { pos: NavPos; active: boolean }) {
  return (
    <div style={{
      position: 'relative', width: 30, height: 38, borderRadius: 0,
      background: 'var(--surface-2)',
      border: `1px solid ${active ? 'var(--j-accent)' : 'var(--hairline)'}`,
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', bottom: 3, width: 9, height: 9,
        background: 'var(--j-accent)',
        left:  pos === 'sinistra' ? 3 : pos === 'centro' ? '50%' : undefined,
        right: pos === 'destra' ? 3 : undefined,
        transform: pos === 'centro' ? 'translateX(-50%)' : undefined,
      }}/>
    </div>
  )
}

// `flex: 1` + `minWidth: 0`: nella riga a 3 colonne i campi si dimensionavano sul
// contenuto, quindi Sesso/Età/Peso venivano di larghezze diverse.
//
// La label è volutamente più piccola e chiara dell'eyebrow di sezione (10px/600 con
// letter-spacing .16em): erano quasi identiche, e "DATA DI NASCITA" — che è un campo
// dentro "Dati fisici" — si leggeva come un titolo di pari grado. Era quello il
// "troppo spazio tra le voci": non un gap sbagliato, una gerarchia piatta.
function StaticField({ label, value }: { label?: string; value: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <div style={{ fontFamily: 'var(--font-label)', fontSize: 9.5, fontWeight: 400, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--fg-mute)', opacity: 0.85 }}>{label}</div>
      )}
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: value === '—' ? 'var(--fg-mute)' : 'var(--fg)', padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--hairline)', borderRadius: 0, minHeight: 44, display: 'flex', alignItems: 'center' }}>
        {value}
      </div>
    </div>
  )
}

export function JarvisProfile({ open, onClose }: JarvisProfileProps) {
  const [s, set] = useStore()
  const t = useT()
  const isDesktop = useIsDesktop()
  const [name, setName] = useState(s.userName || '')
  const [editingBody, setEditingBody] = useState(false)
  // I due pannelli dell'aspetto e dei widget. Sono PAGINE dentro le impostazioni,
  // non modali: il modale si apre a z-index 90 e le impostazioni sono un overlay a
  // 95, quindi finiva sotto la pagina che l'aveva aperto — si vedevano le due
  // schermate una dentro l'altra. Alzare lo z-index del modale avrebbe spostato il
  // problema sul prossimo overlay; una pagina non ce l'ha proprio, e per due
  // pannelli grandi come questi è anche la forma giusta.
  const [pannello, setPannello] = useState<null | 'tema' | 'widget'>(null)
  const [age, setAge]       = useState(s.userAge ? String(s.userAge) : '')
  const [sex, setSex]       = useState<'M' | 'F' | ''>(s.userSex ?? '')
  const [weight, setWeight] = useState(s.userWeight ? String(s.userWeight) : '')
  const [height, setHeight] = useState(s.userHeight ? String(s.userHeight) : '')
  const [dob, setDob]       = useState(s.userDob ?? '')
  const [visible, setVisible] = useState(false)
  const [mount, setMount] = useState(open)
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [pwdOk, setPwdOk] = useState(false)

  useEffect(() => {
    if (open) {
      setName(s.userName || '')
      setAge(s.userAge ? String(s.userAge) : '')
      setSex(s.userSex ?? '')
      setWeight(s.userWeight ? String(s.userWeight) : '')
      setHeight(s.userHeight ? String(s.userHeight) : '')
      setDob(s.userDob ?? '')
      setEditingBody(false)
      setPannello(null)
      setMount(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else if (mount) {
      setVisible(false)
      const timer = setTimeout(() => setMount(false), 320)
      return () => clearTimeout(timer)
    }
    // Reset del form solo all'apertura: legge i valori correnti dello store una tantum,
    // non deve rieseguire a ogni loro cambiamento mentre il modal è aperto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const saveName = () => set({ userName: name.trim() })

  const saveBody = () => {
    set({
      userAge:    age    ? parseInt(age)      : undefined,
      userSex:    sex    ? sex                : undefined,
      userWeight: weight ? parseFloat(weight) : undefined,
      userHeight: height ? parseFloat(height) : undefined,
      userDob:    dob    ? dob                : undefined,
    })
    setEditingBody(false)
  }

  const handleSave = () => {
    set({
      userName:   name.trim(),
      userAge:    age    ? parseInt(age)      : undefined,
      userSex:    sex    ? sex                : undefined,
      userWeight: weight ? parseFloat(weight) : undefined,
      userHeight: height ? parseFloat(height) : undefined,
      userDob:    dob    ? dob                : undefined,
    })
    onClose()
  }

  // Stessa punteggiatura del resto delle date: barre in italiano, punti in
  // tedesco (vedi dateFormat).
  const formatDob = (v: string) => {
    if (!v) return '—'
    const [y, m, d] = v.split('-')
    return s.lang === 'de' ? `${d}.${m}.${y}` : `${d}/${m}/${y}`
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    onClose()
  }

  const current = s.accentColor ?? 'green'
  const monoOn  = s.layout === 'notte' || s.layout === 'nero'
  const initial = (name.trim() || '?')[0].toUpperCase()

  // Stessa risoluzione di App.tsx, altrimenti l'avatar mente: leggeva ACCENT_PALETTES
  // diretto, senza `paletteFor` né `adjustPaletteForDark`, e restava verde in dark mode
  // mentre tutta l'app passava all'oro (e cadeva sul verde con accentColor 'custom').
  const base = s.layout === 'nero' ? MONO_DARK
    : monoOn ? (s.darkMode ? MONO_DARK : MONO_LIGHT)
    : paletteFor(current, s.customAccentHex)
  const pal  = (!monoOn && s.darkMode) ? adjustPaletteForDark(base) : base

  if (!mount) return null

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 95,
      background: 'var(--bg)',
      backgroundImage: 'var(--paper-grain)',
      transform: visible ? 'translateY(0)' : 'translateY(100%)',
      transition: `transform ${visible ? '340ms' : '260ms'} cubic-bezier(.2,.9,.25,1.1)`,
      display: 'flex', flexDirection: 'column',
      fontFamily: NUC.font, color: 'var(--fg)',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px 12px',
        borderBottom: `1px solid var(--hairline)`,
        background: 'var(--surface)',
      }}>
        {/* Il back è uno solo e sa dov'è: da un pannello torna all'elenco, dall'elenco
            chiude le impostazioni. Due frecce sovrapposte — una del pannello e una
            della pagina — sono il modo più rapido di far uscire qualcuno per sbaglio. */}
        <button
          onClick={() => pannello ? setPannello(null) : onClose()}
          aria-label={pannello ? t('Torna alle impostazioni') : t('Chiudi le impostazioni')}
          className="j-btn-back" style={{ width: 34, height: 34 }}
        >
          <Icons.chevL size={15}/>
        </button>
        <div className="j-eyebrow" style={{ letterSpacing: '.18em' }}>
          {pannello === 'tema' ? t('Cambio tema') : pannello === 'widget' ? t('Cambio widget') : t('Impostazioni')}
        </div>
        {/* "Salva" vale per i campi dell'elenco (nome, dati). Dentro i pannelli non
            c'è niente da salvare — tema e widget si applicano al tocco — e un tasto
            che non fa nulla è peggio di un tasto assente. Lo spazio resta occupato
            perché il titolo, che è centrato, altrimenti scivolerebbe a destra. */}
        {pannello ? (
          <div style={{ width: 62, height: 34, flexShrink: 0 }} aria-hidden/>
        ) : (
          /* PROTOTIPO ombra hard — vedi .j-hard in globals.css */
          <button onClick={handleSave} className="j-hard" style={{
            height: 34, padding: '0 14px', borderRadius: 0,
            background: 'var(--j-accent)', border: 'none',
            color: 'var(--j-accent-fg)', fontFamily: NUC.font, fontSize: 13, fontWeight: 500,
            cursor: 'pointer',
          }}>{t('Salva')}</button>
        )}
      </div>

      {/* Content */}
      <div className="j-profile-body" style={{ flex: 1, overflowY: 'auto', padding: '22px 22px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {pannello === 'tema' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Dark mode */}
        <Section
          title={t('Dark mode')}
          hint={t('Fondo scuro e inchiostro chiaro.')}
          right={<Toggle on={!!s.darkMode} onClick={() => set({ darkMode: !s.darkMode })} label={t('Dark mode')}/>}
        />

        {/* Tema colore */}
        <Section title={t('Tema colore')} hint={monoOn ? t('Sospeso dal layout {layout} — torna attivo con Standard.', { layout: t(s.layout === 'nero' ? 'Nero' : 'Notte') }) : undefined}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, opacity: monoOn ? 0.5 : 1, transition: 'opacity 220ms' }}>
            {PALETTE_KEYS.map(c => {
              const p = ACCENT_PALETTES[c]
              // In layout "Notte" nessuna palette risulta spuntata: il colore non è
              // quello che si vede. Il valore resta però selezionabile e memorizzato,
              // e torna in vigore appena si rimette Standard.
              const active = current === c && !monoOn
              return (
                <button key={c} onClick={() => set({ accentColor: c })} style={{
                  height: 68, borderRadius: 0,
                  background: 'var(--surface)',
                  // Bordo sempre 2px (trasparente da spento): a 1px→2px il bottone
                  // sobbalzava di un pixel al click.
                  border: `2px solid ${active ? p.accent : 'transparent'}`,
                  outline: active ? 'none' : '1px solid var(--hairline)',
                  outlineOffset: -1,
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7,
                  transition: 'all 220ms',
                  position: 'relative',
                }}>
                  {active && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 14, height: 14, borderRadius: '50%',
                      background: p.accent,
                      // la spunta usa currentColor: senza questo eredita l'inchiostro
                      // di pagina e sparisce dentro i pallini scuri.
                      color: accentFgFor(p.accent),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icons.check size={8} stroke={3}/>
                    </div>
                  )}
                  <div style={{ width: 22, height: 22, borderRadius: 0, background: p.accent }}/>
                  <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.14em', color: active ? 'var(--fg)' : 'var(--fg-mute)', textTransform: 'uppercase' }}>
                    {t(PALETTE_LABELS[c] ?? c)}
                  </div>
                </button>
              )
            })}
          </div>
        </Section>

        {/* Cambio layout */}
        <Section title={t('Cambio layout')}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))', gap: 8 }}>
            {LAYOUTS.map(opt => {
              const active = (s.layout ?? 'standard') === opt.id
              return (
                <button key={opt.id} onClick={() => set({ layout: opt.id })} style={{
                  minHeight: 78, padding: '12px 10px', borderRadius: 0,
                  background: 'var(--surface)',
                  border: `2px solid ${active ? 'var(--j-accent)' : 'transparent'}`,
                  outline: active ? 'none' : '1px solid var(--hairline)',
                  outlineOffset: -1,
                  cursor: 'pointer', textAlign: 'left',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                  transition: 'all 220ms',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <LayoutSwatch mode={opt.id}/>
                    <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.14em', color: active ? 'var(--fg)' : 'var(--fg-mute)', textTransform: 'uppercase' }}>
                      {t(opt.label)}
                    </div>
                  </div>
                  <div style={{ fontFamily: NUC.font, fontSize: 11, color: 'var(--fg-mute)', lineHeight: 1.35 }}>
                    {t(opt.hint)}
                  </div>
                </button>
              )
            })}
          </div>
        </Section>

        {/* Posizione del tasto di navigazione. Solo su telefono: sul desktop la
            navigazione è la colonna a sinistra e questo tasto non esiste. */}
        {!isDesktop && (
          <Section title={t('Tasto di navigazione')} hint={t('Da che parte lo trovi in fondo allo schermo.')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {([
                { id: 'sinistra', label: t('Sinistra') },
                { id: 'centro',   label: t('Centro')   },
                { id: 'destra',   label: t('Destra')   },
              ] as Array<{ id: NavPos; label: string }>).map(opt => {
                const active = (s.navPos ?? 'centro') === opt.id
                return (
                  <button key={opt.id} onClick={() => set({ navPos: opt.id })} style={{
                    minHeight: 68, padding: '10px 8px', borderRadius: 0,
                    background: 'var(--surface)',
                    border: `2px solid ${active ? 'var(--j-accent)' : 'transparent'}`,
                    outline: active ? 'none' : '1px solid var(--hairline)',
                    outlineOffset: -1,
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    transition: 'all 220ms',
                  }}>
                    <NavPosPreview pos={opt.id} active={active}/>
                    <div style={{ fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.12em', color: active ? 'var(--fg)' : 'var(--fg-mute)', textTransform: 'uppercase' }}>
                      {opt.label}
                    </div>
                  </button>
                )
              })}
            </div>
          </Section>
        )}
        </div>
      ) : pannello === 'widget' ? (
        <HomeModulesManager/>
      ) : (
        <>

        {/* Avatar — quadrato a sinistra, il CAMPO del nome a destra sulla stessa
            riga. Prima erano due cose: il nome scritto qui e, sotto, una sezione
            "Nome utente" con la matita per aprirne la modifica. Due righe e un
            click per un campo da dieci caratteri. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 0, flexShrink: 0,
            background: pal.accentSoft,
            border: `2px solid var(--hairline)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            // accentSoft è la tinta CHIARA della palette: la crema fissa vi spariva sopra.
            fontFamily: NUC.serif, fontSize: 30, fontWeight: 500, color: accentFgFor(pal.accentSoft),
            transition: 'background 400ms',
          }}>
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="prof-nome" style={{ fontFamily: 'var(--font-label)', fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--fg-mute)', opacity: 0.85 }}>
              {t('Nome utente')}
            </label>
            {/* Salva all'uscita dal campo, non solo col tasto in alto: il nome è
                l'unica cosa che si scrive qui e uscire senza toccarlo era il caso
                normale. */}
            <input
              id="prof-nome"
              className="j-field-lg"
              value={name}
              onChange={e => setName(e.target.value.slice(0, 10))}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') { saveName(); (e.target as HTMLInputElement).blur() } }}
              maxLength={10}
              placeholder={t('Il tuo nome')}
            />
          </div>
        </div>

        {/* Body data section */}
        <Section
          title={t('Dati generali')}
          action={<EditToggle editing={editingBody} onToggle={() => { if (editingBody) saveBody(); else setEditingBody(true) }}/>}
        >
          {editingBody ? (
            <>
              {/* Sex picker */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: 'var(--fg-mute)' }}>{t('Sesso')}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['M', 'F'] as const).map(v => (
                    <button key={v} onClick={() => setSex(sex === v ? '' : v)} style={{
                      flex: 1, height: 40, borderRadius: 0,
                      background: sex === v ? 'var(--surface-2)' : 'var(--surface)',
                      border: `1px solid ${sex === v ? 'var(--j-accent)' : 'var(--hairline)'}`,
                      color: sex === v ? 'var(--j-accent-ink)' : 'var(--fg-mute)',
                      fontFamily: NUC.font, fontSize: 14, cursor: 'pointer',
                      transition: 'all 180ms',
                    }}>
                      {v === 'M' ? t('Uomo') : t('Donna')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Età, peso e altezza: tre campi su una riga. L'altezza sta qui e
                  non più nel Personal Coach perché la usano in due — il fabbisogno
                  calorico e la forza relativa della home. */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: 'var(--fg-mute)' }}>{t('Età')}</div>
                  <input
                    type="number" inputMode="numeric" min="10" max="100"
                    value={age} onChange={e => setAge(e.target.value)}
                    placeholder="—" className="j-field"
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: 'var(--fg-mute)' }}>{t('Peso (kg)')}</div>
                  <input
                    type="number" inputMode="decimal" min="30" max="250" step="0.5"
                    value={weight} onChange={e => setWeight(e.target.value)}
                    placeholder="—" className="j-field"
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: 'var(--fg-mute)' }}>{t('Altezza (cm)')}</div>
                  <input
                    type="number" inputMode="numeric" min="100" max="230"
                    value={height} onChange={e => setHeight(e.target.value)}
                    placeholder="—" className="j-field"
                  />
                </div>
              </div>

              {/* Date of birth */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: 'var(--fg-mute)' }}>{t('Data di nascita')}</div>
                <input
                  type="date" value={dob} onChange={e => setDob(e.target.value)}
                  className="j-field"
                />
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <StaticField label={t('Sesso')} value={sex === 'M' ? t('Uomo') : sex === 'F' ? t('Donna') : '—'}/>
                <StaticField label={t('Età')} value={age ? t('{n} anni', { n: age }) : '—'}/>
                <StaticField label={t('Peso')} value={weight ? `${weight} kg` : '—'}/>
                <StaticField label={t('Altezza')} value={height ? `${height} cm` : '—'}/>
              </div>
              <StaticField label={t('Data di nascita')} value={formatDob(dob)}/>
            </div>
          )}
        </Section>

        {/* Peso */}
        <PesoSection/>

        {/* Lingua */}
        <LinguaSection/>

        {/* Aspetto e widget: due card affiancate, ognuna apre il suo pannello.
            Erano tre sezioni impilate (dark mode, tema colore, layout) più, in un
            altro posto ancora, la rotella dei moduli in cima alla home: quattro
            schermate diverse per decidere che aspetto ha l'app. */}
        <div className="j-profile-sec" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <CardImpostazione
            icon={<Icons.book size={20} stroke={1.6}/>}
            label={t('Cambio tema')}
            sotto={monoOn ? t(s.layout === 'nero' ? 'Nero' : 'Notte') : `${t(PALETTE_LABELS[current] ?? current)}${s.darkMode ? ` · ${t('scuro')}` : ''}`}
            onClick={() => setPannello('tema')}
          />
          <CardImpostazione
            icon={<Icons.settings size={20} stroke={1.6}/>}
            label={t('Cambio widget')}
            sotto={t('Ordina la home')}
            onClick={() => setPannello('widget')}
          />
        </div>

        {/* Svuota le alzate */}
        <SvuotaAlzateSection/>

        {/* Change password */}
        <div className="j-profile-sec" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => { setShowChangePwd(v => !v); setPwdError(null); setPwdOk(false) }} style={{
            width: '100%', padding: '13px 16px', borderRadius: 0,
            background: 'var(--surface)', border: `1px solid var(--hairline)`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', transition: 'border-color 180ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--j-accent)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--hairline)')}
          >
            <span style={{ fontFamily: NUC.font, fontSize: 14, color: NUC.ink }}>{t('Cambia password')}</span>
            <span style={{ color: NUC.faint, fontSize: 12, transform: showChangePwd ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 200ms', display: 'inline-block' }}>▸</span>
          </button>

          {showChangePwd && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
              <input
                type="password" placeholder={t('Password attuale')}
                value={oldPwd} onChange={e => { setOldPwd(e.target.value); setPwdError(null); setPwdOk(false) }}
                className="j-field"
              />
              <input
                type="password" placeholder={t('Nuova password')}
                value={newPwd} onChange={e => { setNewPwd(e.target.value); setPwdError(null); setPwdOk(false) }}
                className="j-field"
              />
              {pwdError && <div style={{ fontFamily: NUC.label, fontSize: 10, color: 'var(--danger)', letterSpacing: '.02em' }}>{pwdError}</div>}
              {pwdOk   && <div style={{ fontFamily: NUC.label, fontSize: 10, color: 'var(--j-accent-ink)', letterSpacing: '.02em' }}>{t('Password aggiornata ✓')}</div>}
              <button
                disabled={pwdLoading || !oldPwd || !newPwd}
                onClick={async () => {
                  if (newPwd.length < 6) { setPwdError(t('La nuova password deve avere almeno 6 caratteri.')); return }
                  setPwdLoading(true); setPwdError(null)
                  const { data: { user } } = await supabase.auth.getUser()
                  if (!user?.email) { setPwdError(t('Utente non trovato.')); setPwdLoading(false); return }
                  const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: oldPwd })
                  if (signInErr) { setPwdError(t('Password attuale non corretta.')); setPwdLoading(false); return }
                  const { error: updateErr } = await supabase.auth.updateUser({ password: newPwd })
                  if (updateErr) { setPwdError(updateErr.message); setPwdLoading(false); return }
                  setPwdOk(true); setOldPwd(''); setNewPwd(''); setPwdLoading(false)
                }}
                style={{
                  width: '100%', height: 40, borderRadius: 0,
                  background: pwdLoading ? 'var(--surface-2)' : 'var(--j-accent)',
                  border: 'none', color: 'var(--j-accent-fg)',
                  fontFamily: NUC.font, fontSize: 13, fontWeight: 500,
                  cursor: pwdLoading ? 'default' : 'pointer',
                  opacity: (!oldPwd || !newPwd) ? 0.5 : 1,
                  transition: 'opacity 200ms',
                }}
              >
                {pwdLoading ? '...' : t('Aggiorna password')}
              </button>
            </div>
          )}
        </div>

        {/* Logout — wrapper: il divider è un border-top sulla sezione, e sul bottone
            si sommerebbe al bordo che ha già. */}
        <div className="j-profile-sec">
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 0,
              background: 'none', border: '1px solid var(--hairline)',
              fontFamily: NUC.label, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase',
              color: 'var(--fg-mute)', cursor: 'pointer',
              transition: 'border-color 200ms, color 200ms',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--danger)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--hairline)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-mute)' }}
          >
            {t('Logout')}
          </button>
        </div>
        </>
      )}
      </div>

    </div>
  )
}

// ── Lingua ─────────────────────────────────────────────────────
// Due bandiere affiancate, una per lingua, con la spunta su quella attiva.
//
// Le bandiere non sono decorazione: sono l'unica parte di questa schermata che si
// capisce quando l'app è nella lingua sbagliata. Chi apre le impostazioni per
// TORNARE indietro sta guardando parole che non legge, e "Sprache" non lo aiuta;
// il tricolore sì. Per lo stesso motivo sotto ogni bandiera c'è il nome della
// lingua scritto NELLA lingua — "Deutsch", non "Tedesco".
function LinguaSection() {
  const [s, set] = useStore()
  const t = useT()
  const { confirmDelete } = useConfirmDelete()
  const attuale: Lang = s.lang ?? 'it'

  const chiedi = (target: Lang) => {
    // Toccare la lingua che è già attiva non è un errore da segnalare: non è
    // successo niente, e un dialogo che chiede di confermare il nulla è peggio.
    if (target === attuale) return
    confirmDelete(
      () => set({ lang: target }),
      LANG_LABELS[target],
      {
        eyebrow: t('Lingua'),
        // Il titolo è già nella lingua di DESTINAZIONE: è l'anteprima di quello
        // che sta per succedere, e chi ha toccato la bandiera sbagliata se ne
        // accorge qui invece che a schermata cambiata.
        title: translate(target, 'Impostare la lingua su {lingua}?', { lingua: LANG_LABELS[target] }),
        // Il corpo resta nella lingua CORRENTE, cioè l'unica che chi legge sa di
        // capire. Un dialogo tutto in tedesco che chiede di passare al tedesco
        // presuppone risolta la domanda che sta ponendo.
        body: t('Tutta l’app passa in {lingua}. Puoi tornare indietro da qui quando vuoi.', { lingua: LANG_LABELS[target] }),
        cta: translate(target, 'Sì, cambia lingua'),
        tone: 'neutral',
      },
    )
  }

  return (
    <Section title={t('Lingua')} hint={t('La lingua dell’app. I nomi che hai scritto tu restano come li hai scritti.')}>
      <div role="radiogroup" aria-label={t('Lingua')} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {LANGS.map(l => {
          const on = l === attuale
          return (
            <button
              key={l}
              onClick={() => chiedi(l)}
              role="radio"
              aria-checked={on}
              className="j-hard"
              style={{
                padding: '14px 12px', borderRadius: 0, cursor: on ? 'default' : 'pointer',
                background: 'var(--surface)',
                border: `1px solid ${on ? 'var(--j-accent)' : 'var(--hairline)'}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
                transition: 'border-color 180ms',
              }}
            >
              <Flag lang={l} size={38}/>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                <span style={{
                  fontFamily: NUC.label, fontSize: 10, fontWeight: 600,
                  letterSpacing: '.14em', textTransform: 'uppercase',
                  color: on ? 'var(--j-accent-ink)' : 'var(--fg-mute)',
                  whiteSpace: 'nowrap',
                }}>{LANG_LABELS[l]}</span>
                {/* La spunta, non solo il bordo colorato: in layout "Nero" l'accent
                    non esiste e le due card sarebbero identiche. */}
                {on && <Icons.check size={13} stroke={2.4} style={{ color: 'var(--j-accent-ink)', flexShrink: 0 }}/>}
              </span>
            </button>
          )
        })}
      </div>
    </Section>
  )
}

// Card di un pannello di impostazioni: icona, nome, e sotto lo stato attuale.
// Sono due e stanno affiancate, quindi il testo deve reggere metà larghezza di un
// telefono: il sottotitolo dice a colpo d'occhio com'è messa la cosa ("Journal ·
// scuro") senza aprire nulla.
//
// La freccia in alto a destra non è decorazione: senza, la card si legge come
// un'ETICHETTA di stato — "Cambio tema: Journal" — e non come il collegamento
// che apre il pannello. La riga che queste card hanno sostituito ce l'aveva, e
// toglierla ha reso invisibili due delle impostazioni più usate.
function CardImpostazione({ icon, label, sotto, onClick }: {
  icon: ReactNode; label: string; sotto: string; onClick: () => void
}) {
  return (
    <button onClick={onClick} className="j-hard" style={{
      padding: '14px 12px', borderRadius: 0, textAlign: 'left',
      background: 'var(--surface)', border: '1px solid var(--hairline)',
      display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0,
      cursor: 'pointer',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ color: 'var(--j-accent-ink)', display: 'flex' }}>{icon}</span>
        <Icons.chev size={14} stroke={2} style={{ color: 'var(--fg-mute)', flexShrink: 0 }}/>
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: 'block', fontFamily: NUC.label, fontSize: 10, fontWeight: 600,
          letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--fg)',
        }}>{label}</span>
        <span style={{
          display: 'block', fontFamily: NUC.font, fontSize: 11.5, color: 'var(--fg-mute)',
          marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{sotto}</span>
      </span>
    </button>
  )
}

// ── Peso ───────────────────────────────────────────────────────
// Stava nella scheda Personal Coach, insieme a fabbisogno calorico e proteine.
// Quella parte è uscita dall'app; le pesate no, perché sono il denominatore di
// tutta la forza relativa — la mappa del corpo resta vuota senza — e sono la
// curva che un allenatore collegato guarda per prima.
//
// Il posto giusto è qui: il peso di oggi è già in "Dati fisici" due righe sopra,
// e tenere la misura e il suo storico in due schermate diverse era il motivo per
// cui si finiva a correggere il campo a mano invece di registrare una pesata.
function PesoSection() {
  const t = useT()
  const weightLog = useJarvisStore(st => st.weightLog)
  const [kg, setKg] = useState('')

  // Una pesata al giorno: risalvare oggi sovrascrive invece di accodare. E il
  // peso del profilo segue sempre l'ultima misura, così il resto dell'app legge
  // un valore solo e non deve scegliere fra due.
  const registra = () => {
    const v = parseFloat(kg)
    if (!(v > 20 && v < 400)) return
    const date = todayISO()
    useJarvisStore.setState(st => ({
      weightLog: [...st.weightLog.filter(e => e.date !== date), { date, kg: v }]
        .sort((a, b) => a.date.localeCompare(b.date)),
      userWeight: v,
    }))
    setKg('')
  }

  const ultime = weightLog.slice(-14)
  const delta = ultime.length >= 2 ? ultime[ultime.length - 1].kg - ultime[0].kg : null

  return (
    <Section title={t('Peso')} hint={t('Registralo quando ti pesi: conta la direzione, non il numero di oggi.')}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="number" inputMode="decimal" step="0.1"
          value={kg} onChange={e => setKg(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') registra() }}
          placeholder={t('Peso di oggi in kg')}
          className="j-field"
          style={{ flex: 1, minWidth: 0 }}
        />
        {/* Da spento NON è l'accent sbiadito: l'opacità vela testo e fondo insieme,
            e "REGISTRA" finisce a leggersi male su un verde slavato. Meglio un
            controllo neutro, che è anche più onesto — non è un tasto acceso a
            metà, è un tasto che aspetta un numero. */}
        <button onClick={registra} disabled={!kg} className={kg ? 'j-hard' : undefined} style={{
          flexShrink: 0, minHeight: 44, padding: '0 16px', borderRadius: 0,
          background: kg ? 'var(--j-accent)' : 'var(--surface-2)',
          border: kg ? 'none' : '1px solid var(--hairline)',
          color: kg ? 'var(--j-accent-fg)' : 'var(--fg-mute)',
          fontFamily: NUC.label, fontSize: 11, fontWeight: 500,
          letterSpacing: '.14em', textTransform: 'uppercase',
          cursor: kg ? 'pointer' : 'default',
        }}>{t('Registra')}</button>
      </div>

      {ultime.length >= 2 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', padding: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            gap: 8, marginBottom: 8,
          }}>
            <span style={{ fontFamily: NUC.serif, fontSize: 20, fontWeight: 500, letterSpacing: -0.4, color: 'var(--fg)' }}>
              {ultime[ultime.length - 1].kg} kg
            </span>
            {delta !== null && (
              <span style={{ fontFamily: 'var(--font-label)', fontSize: 11, letterSpacing: '.08em', color: 'var(--fg-mute)' }}>
                {delta > 0 ? '+' : ''}{t('{d} kg dalla prima delle {n} pesate', { d: delta.toFixed(1), n: ultime.length })}
              </span>
            )}
          </div>
          <LineChart
            data={ultime.map(e => e.kg)}
            labels={ultime.map(e => fmtDayMonth(e.date))}
            pointLabels={ultime.map(e => String(e.kg))}
            height={104} color="var(--chart-2)" yAxis labelSize={9}
            yFormat={v => v.toFixed(1)}
          />
        </div>
      ) : (
        <div className="j-empty j-empty-sm">
          {ultime.length === 1 ? t('Serve una seconda pesata per vedere la direzione.') : t('Nessuna pesata registrata.')}
        </div>
      )}
    </Section>
  )
}

// ── Svuota le alzate ───────────────────────────────────────────
// Azzerare lo storico di un esercizio si poteva già fare, ma un esercizio alla
// volta: dopo un lungo stop, o passando a un altro modo di allenarsi, servivano
// venti conferme per rimettere a zero i numeri.
//
// Quello che NON tocca è tutto il resto: gli esercizi restano in lista con nome,
// gruppo muscolare e colore, e con loro schede, dati personali, pesate e sessioni
// Hyrox. Si cancellano le alzate, non la palestra.
function SvuotaAlzateSection() {
  const t = useT()
  const { confirmDelete } = useConfirmDelete()
  const palestra = useJarvisStore(st => st.palestraExercises)
  const totale = palestra.reduce((n, ex) => n + ex.history.length, 0)

  const svuota = () => confirmDelete(
    () => useJarvisStore.setState(st => ({
      // `current` torna vuoto insieme allo storico: è il pre-compilato del
      // prossimo log, e lasciarlo sui carichi cancellati li farebbe rientrare
      // dalla finestra alla prima alzata registrata.
      palestraExercises: st.palestraExercises.map(ex => ({
        ...ex, history: [], current: { kg: 0, reps: 0, sets_n: 0 },
      })),
    })),
    t('tutte le alzate'),
    {
      eyebrow: t('Svuota memoria'),
      title: t('Cancellare tutte le alzate?'),
      body: t('Cancelli {quante} di tutti gli esercizi, e con esse massimali, record e grafici. Restano gli esercizi, le schede, i tuoi dati e le pesate. L’azione è definitiva.', {
        quante: totale === 1 ? t('l’unica alzata') : t('tutte le {n} alzate', { n: totale }),
      }),
      cta: t('Sì, svuota'),
    },
  )

  return (
    <Section
      title={t('Memoria delle alzate')}
      hint={t('Azzera lo storico di tutti gli esercizi e riparti da zero. Esercizi, schede, dati personali e pesate restano dove sono.')}
    >
      <button
        onClick={svuota}
        disabled={totale === 0}
        style={{
          width: '100%', padding: '11px 0', borderRadius: 0,
          background: 'none',
          border: `1px solid ${totale === 0 ? 'var(--hairline)' : 'rgba(var(--danger-rgb),0.35)'}`,
          fontFamily: NUC.label, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase',
          color: totale === 0 ? 'var(--fg-mute)' : 'var(--danger)',
          cursor: totale === 0 ? 'default' : 'pointer',
          transition: 'border-color 200ms, color 200ms',
        }}
        onMouseEnter={e => { if (totale > 0) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--danger)' }}
        onMouseLeave={e => { if (totale > 0) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(var(--danger-rgb),0.35)' }}
      >
        {totale === 0
          ? t('Nessuna alzata registrata')
          : totale === 1 ? t('Svuota 1 alzata') : t('Svuota {n} alzate', { n: totale })}
      </button>
    </Section>
  )
}

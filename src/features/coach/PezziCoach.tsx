// I pezzi comuni delle pagine del Personal Coach: la pagina con la sua testata,
// i tasti, gli avvisi, la riga di una persona. Stavano in fondo a JarvisCoach;
// sono qui da quando li usano anche la chat, i codici e il profilo, che hanno
// ciascuno il suo file.
import type { ReactNode } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { Avatar } from '@/components/ui/Avatar'
import { DisegnoAzione } from '@/features/gym/DisegniAzioni'
import { useT } from '@/lib/i18n'
import { BadgeNonLetti } from './messaggiUI'

export function Pagina({ titolo, sopra, onBack, isDesktop, destra, fisso, piede, children }: {
  titolo: string; onBack: () => void; isDesktop: boolean
  /** La riga piccola sopra il titolo: di chi o di cosa è la pagina ("Allievo"). */
  sopra?: string
  /** I tasti in alto a destra, accanto al titolo. */
  destra?: ReactNode
  /** La pagina non scorre: il contenuto riempie lo spazio e decide da sé cosa
   *  scorre. È la forma della chat, dove scorrono i messaggi e il campo per
   *  scrivere resta fermo in fondo. */
  fisso?: boolean
  /** Il tasto fermo in fondo, fuori dall'area che scorre ("Scrivi a…"). */
  piede?: ReactNode
  children: ReactNode
}) {
  const t = useT()
  // La stessa testata delle schede e delle statistiche: freccia a sinistra,
  // titolo grande accanto. Prima il Coaching aveva una barra sua — freccia
  // piccola, titolo in maiuscoletto al centro, fondo diverso — e passando dalle
  // schede al coach sembrava di cambiare app.
  // Sta FUORI dall'area che scorre, come sempre: sotto non le passa niente.
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 97,
      background: 'var(--bg)', backgroundImage: 'var(--paper-grain)',
      overflow: 'hidden', fontFamily: NUC.font, color: NUC.ink,
    }}>
      <div className="flex flex-col h-full overflow-hidden" style={{ width: '100%', maxWidth: isDesktop ? 720 : '100%', margin: '0 auto' }}>
        <div className="j-page-header">
          <div className="flex items-center gap-3">
            <button onClick={onBack} aria-label={t('Indietro')} className="j-btn-back"><Icons.back size={20} stroke={1.8}/></button>
            <div style={{ flex: 1, minWidth: 0 }}>
              {sopra && <div className="j-eyebrow" style={{ fontSize: 12, marginBottom: 1 }}>{sopra}</div>}
              <div className="j-page-title" style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                // Con i tasti a destra il titolo ha meno strada: su un telefono
                // stretto "Personal Coach" a 26px finiva coi puntini.
                ...(destra ? { fontSize: 'clamp(20px, 5.8vw, 32px)' } : {}),
              }}>{titolo}</div>
            </div>
            {destra && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{destra}</div>}
          </div>
        </div>
        {fisso ? (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
        ) : (
          // In fondo resta spazio: l'ultima cosa della pagina è spesso un campo
          // (una nota, un codice) e non deve finire sotto la tastiera.
          <div className="j-scroll-area" style={{ paddingTop: 4, paddingBottom: piede ? 24 : 'calc(var(--nav-clear, env(safe-area-inset-bottom)) + 96px)' }}>
            {children}
          </div>
        )}
        {piede && (
          <div className="j-page-cta" style={{ borderTop: 'var(--bordo)', background: 'var(--bg)' }}>{piede}</div>
        )}
      </div>
    </div>
  )
}

/** Un quadratino con un'icona, in testata: lo stesso del tasto indietro, così i
 *  tasti in alto si leggono come una famiglia sola. */
export function TastoIcona({ etichetta, onClick, badge = 0, children }: {
  etichetta: string; onClick: () => void
  /** Il pallino rosso nell'angolo (la chat, con i messaggi da leggere). */
  badge?: number
  children: ReactNode
}) {
  const t = useT()
  return (
    <button
      onClick={onClick}
      aria-label={badge > 0 ? `${etichetta} — ${t('{n} da leggere', { n: badge })}` : etichetta}
      title={etichetta}
      className="j-btn-back"
      style={{ position: 'relative', color: 'var(--fg)' }}
    >
      {children}
      <BadgeNonLetti n={badge} style={{ position: 'absolute', top: -7, right: -7 }}/>
    </button>
  )
}

/** Un tasto quadrato piccolo dentro una riga: il profilo, la x per scollegare. */
export function TastoRiga({ etichetta, onClick, tono = 'neutro', children }: {
  etichetta: string; onClick: () => void; tono?: 'neutro' | 'pericolo'; children: ReactNode
}) {
  const pericolo = tono === 'pericolo'
  return (
    <button onClick={onClick} aria-label={etichetta} title={etichetta} style={{
      // 44: il bersaglio minimo per un dito.
      width: 44, height: 44, flexShrink: 0, borderRadius: 'var(--radius-sm)',
      background: pericolo ? 'rgba(var(--danger-rgb),0.06)' : 'var(--surface-2)',
      border: `1px solid ${pericolo ? 'rgba(var(--danger-rgb),0.18)' : 'var(--hairline)'}`,
      color: pericolo ? 'var(--danger)' : 'var(--fg-soft)', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {children}
    </button>
  )
}

/** Una persona in un elenco: la faccia, il nome, e accanto alla x per toglierla
 *  il tasto del suo profilo. Toccando il resto della riga si apre lei. */
export function RigaPersona({ nome, foto, sotto, primo, onApri, onProfilo, onRimuovi }: {
  nome: string; foto?: string | null; sotto: string; primo: boolean
  onApri?: () => void; onProfilo: () => void; onRimuovi: () => void
}) {
  const t = useT()
  return (
    <div className="j-riga-gruppo" style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px 10px 14px',
      borderTop: primo ? 'none' : '1px solid var(--hairline-soft)',
    }}>
      <div
        onClick={onApri}
        role={onApri ? 'button' : undefined}
        tabIndex={onApri ? 0 : undefined}
        onKeyDown={onApri ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onApri() } } : undefined}
        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, cursor: onApri ? 'pointer' : 'default' }}
      >
        <Avatar foto={foto} nome={nome} size={42}/>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</div>
          <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.08em', color: 'var(--fg-mute)', marginTop: 2 }}>{sotto}</div>
        </div>
      </div>
      <TastoRiga etichetta={t('Profilo di {chi}', { chi: nome })} onClick={onProfilo}>
        <Icons.user size={14} stroke={1.8}/>
      </TastoRiga>
      <TastoRiga etichetta={t('Scollega {chi}', { chi: nome })} onClick={onRimuovi} tono="pericolo">
        <Icons.x size={12} stroke={1.8}/>
      </TastoRiga>
    </div>
  )
}

/** Una card da scegliere: le sezioni del Coaching, i due versi del
 *  collegamento. Bianca col bordo d'inchiostro; accesa diventa piena
 *  d'inchiostro (vedi `.j-card-azione` in globals.css). Le altre restano
 *  leggibili — sono tasti, non decorazione. */
export function CardScelta({ titolo, sotto, accesa, onClick, disegno, altezza, ruolo = 'tab' }: {
  titolo: string
  sotto?: string
  accesa: boolean
  onClick: () => void
  disegno?: 'allenatore' | 'gruppo' | 'coach' | 'schede' | 'stats' | 'esercizi'
  altezza?: string
  ruolo?: 'tab' | 'radio'
}) {
  return (
    <button
      role={ruolo}
      aria-selected={ruolo === 'tab' ? accesa : undefined}
      aria-checked={ruolo === 'radio' ? accesa : undefined}
      onClick={onClick}
      className={`j-hard j-card-azione${accesa ? ' accesa' : ''}`}
      style={{
        position: 'relative', minHeight: altezza, minWidth: 0,
        borderRadius: 'var(--radius-lg)', cursor: 'pointer', textAlign: 'left',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-end',
        padding: 'clamp(12px, 3.4vw, 16px)',
      }}
    >
      {/* Il disegno in alto a destra, quasi sul bordo, e il nome in fondo. Era
          appoggiato sopra la card, e un nome lungo o su due righe — «Seguire
          qualcuno» su un telefono stretto — gli finiva sotto. Adesso sta nel
          flusso: il margine automatico lo tiene in cima, e fra lui e il nome
          c'è sempre almeno lo stacco del titolo. Se non ci stanno, la card si
          allunga invece di sovrapporli (ott 2026). */}
      {disegno && (
        <DisegnoAzione id={disegno} style={{
          alignSelf: 'flex-end', flexShrink: 0, marginBottom: 'auto',
          marginTop: 'calc(-1 * clamp(4px, 1.4vw, 6px))', marginRight: 'calc(-1 * clamp(4px, 1.4vw, 6px))',
          width: altezza ? `min(clamp(64px, 24vw, 108px), calc(${altezza} - 58px))` : 64, height: 'auto',
          pointerEvents: 'none',
        }}/>
      )}
      {/* Titolo di riga: Condensed 700, 22px, maiuscolo. */}
      <span style={{
        position: 'relative', maxWidth: '100%', marginTop: disegno ? 'clamp(8px, 2.4vw, 12px)' : undefined,
        fontFamily: NUC.display, fontSize: 'clamp(18px, 5vw, 22px)', fontWeight: 700,
        lineHeight: 1.1, textTransform: 'uppercase',
      }}>{titolo}</span>
      {/* La riga c'è sempre, anche vuota: senza, il nome scenderebbe di una riga
          nella card che non ha niente da dire. */}
      <span style={{
        position: 'relative', maxWidth: '100%', minHeight: 16, marginTop: 3,
        fontFamily: NUC.label, fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', lineHeight: 1.25,
        color: accesa ? 'var(--muted-dark)' : 'var(--fg-mute)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{sotto ?? ''}</span>
    </button>
  )
}

/** La fascia in fondo alla chat dove si scrive. Sta fuori dall'area che scorre:
 *  si scorre fra i messaggi, e il campo resta lì. */
export function BarraScrittura({ children }: { children: ReactNode }) {
  return (
    <div style={{
      flexShrink: 0,
      padding: '8px 20px calc(var(--nav-clear, env(safe-area-inset-bottom)) + 10px)',
      borderTop: '1px solid var(--hairline-soft)',
      background: 'var(--bg)',
    }}>
      {children}
    </div>
  )
}

export function Bottone({ children, onClick, disabled, variante = 'accent' }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; variante?: 'accent' | 'chiaro'
}) {
  // Il tasto accent resta del suo colore anche da spento, solo attenuato.
  // Prima, spento, prendeva l'aspetto del tasto chiaro — serviva quando in
  // Premium l'accent era bianco e al 45% faceva una fascia chiara larga quanto la
  // card. Ma così "Collega", sotto il campo del codice, era un secondo
  // rettangolo grigio identico al campo: due caselle uguali, e nessuna che
  // sembrasse il tasto. Con l'accent di adesso il colore attenuato si legge per
  // quello che è: un tasto che aspetta il codice.
  const accent = variante === 'accent'
  return (
    // Il tasto pieno è un CTA, e ha l'ombra; quello chiaro è piatto.
    <button onClick={onClick} disabled={disabled} className={accent ? 'j-cta' : 'j-hard'} style={{
      flex: 1, width: '100%', minHeight: 44, borderRadius: 'var(--radius)',
      background: accent ? 'var(--j-accent)' : 'var(--surface-2)',
      border: accent ? 'none' : 'var(--bordo)',
      color: accent ? 'var(--j-accent-fg)' : disabled ? 'var(--fg-mute)' : 'var(--fg)',
      opacity: accent && disabled ? 0.5 : 1,
      fontFamily: NUC.display, fontSize: 16, fontWeight: accent ? 800 : 700,
      letterSpacing: '.06em', textTransform: 'uppercase',
      cursor: disabled ? 'default' : 'pointer',
    }}>{children}</button>
  )
}

export function Avviso({ testo, tono }: { testo: string; tono: 'ok' | 'errore' }) {
  return (
    <div style={{
      padding: '10px 12px', marginBottom: 12, borderRadius: 'var(--radius)',
      background: tono === 'errore' ? 'rgba(var(--danger-rgb),0.06)' : 'var(--surface-2)',
      border: `1px solid ${tono === 'errore' ? 'rgba(var(--danger-rgb),0.24)' : 'var(--hairline)'}`,
      fontFamily: NUC.font, fontSize: 12.5, lineHeight: 1.5,
      color: tono === 'errore' ? 'var(--danger)' : 'var(--fg-soft)',
    }}>{testo}</div>
  )
}

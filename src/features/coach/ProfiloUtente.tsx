// Il profilo di una persona, come lo vede chi le è collegato: il coach visto
// dal suo allievo, l'allievo visto dal suo coach.
//
// Per chi allena conta il mestiere — formazione, esperienze, su cosa lavora.
// Per chi si allena conta il percorso — da quando, verso cosa, con quali limiti
// — ed è quello che serve al coach successivo per non ricominciare da zero.
// Lo stesso foglio per tutti e due: le sezioni vuote non si disegnano.
import { useEffect, useState, type ReactNode } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { NucCard } from '@/components/ui/NucComponents'
import { Avatar } from '@/components/ui/Avatar'
import { useT } from '@/lib/i18n'
import {
  leggiProfili, useProfilo, nomeCompleto, etaDi, focusDi, haDettagli, type Profilo,
} from '@/lib/profili'
import { Pagina } from './PezziCoach'

/** La pagina: rilegge il profilo all'apertura (una foto non cambiata non si
 *  riscarica) e lo mostra. */
export function ProfiloUtente({ id, nomeRiserva, sotto, onBack, isDesktop }: {
  id: string
  /** Il nome copiato nel collegamento: c'è anche quando il profilo no. */
  nomeRiserva: string
  /** Una riga sul rapporto: "Ti segue dal 3 ott", "Lo segui dal…". */
  sotto?: string
  onBack: () => void
  isDesktop: boolean
}) {
  const t = useT()
  const profilo = useProfilo(id)
  const [stato, setStato] = useState<'carico' | 'pronto'>(profilo ? 'pronto' : 'carico')
  useEffect(() => {
    let vivo = true
    leggiProfili([id])
      .catch(() => { /* tabella non ancora creata o rete: si mostra quello che si sa */ })
      .finally(() => { if (vivo) setStato('pronto') })
    return () => { vivo = false }
  }, [id])

  return (
    <Pagina titolo={t('Profilo')} onBack={onBack} isDesktop={isDesktop}>
      {stato === 'carico' && !profilo
        ? <div className="j-empty">{t('Caricamento…')}</div>
        : <SchedaProfilo profilo={profilo} nomeRiserva={nomeRiserva} sotto={sotto}/>}
    </Pagina>
  )
}

/** Il profilo disegnato. Pura: la usa anche l'anteprima del proprio profilo. */
export function SchedaProfilo({ profilo, nomeRiserva, sotto }: {
  profilo: Profilo | undefined
  nomeRiserva: string
  sotto?: string
}) {
  const t = useT()
  const nome = nomeCompleto(profilo, nomeRiserva)
  const d = profilo?.dettagli ?? {}
  const eta = etaDi(profilo)
  const anno = new Date().getFullYear()
  const daAnni = d.dal && d.dal <= anno ? anno - d.dal : null
  const focus = focusDi(d)

  return (
    <>
      {/* In testa: la faccia, il nome, e se allena. */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '6px 0 18px' }}>
        <Avatar foto={profilo?.foto} nome={nome} size={112}/>
        <div style={{ fontFamily: NUC.font, fontSize: 26, fontWeight: 600, lineHeight: 1.15, letterSpacing: -0.3, color: 'var(--fg)', marginTop: 14, overflowWrap: 'anywhere' }}>
          {nome}
        </div>
        {d.pt && (
          <span style={{
            marginTop: 8, padding: '2px 9px', borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--j-accent)', color: 'var(--j-accent-ink)',
            fontFamily: NUC.label, fontSize: 9.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase',
          }}>{t('Personal trainer')}</span>
        )}
        {sotto && (
          <div style={{ fontFamily: NUC.label, fontSize: 10.5, letterSpacing: '.08em', color: 'var(--fg-mute)', marginTop: 8 }}>{sotto}</div>
        )}
      </div>

      {/* I numeri: età e anni di allenamento, quelli che si chiedono per primi. */}
      {(eta !== null || !!d.dal) && (
        <div style={{ display: 'grid', gridTemplateColumns: eta !== null && d.dal ? '1fr 1fr' : '1fr', gap: 10, marginBottom: 12 }}>
          {eta !== null && <Numero etichetta={t('Età')} valore={t('{n} anni', { n: eta })}/>}
          {!!d.dal && (
            <Numero
              etichetta={t('Si allena dal')}
              valore={String(d.dal)}
              nota={daAnni ? (daAnni === 1 ? t('1 anno') : t('{n} anni', { n: daAnni })) : undefined}
            />
          )}
        </div>
      )}

      {focus.length > 0 && (
        <Blocco titolo={t('Focus principali')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {focus.map(f => (
              <span key={f} style={{
                padding: '4px 10px', borderRadius: 'var(--radius-pill)',
                background: 'var(--surface-2)', border: '1px solid var(--hairline)',
                fontFamily: NUC.font, fontSize: 12.5, color: 'var(--fg)',
              }}>{f}</span>
            ))}
          </div>
        </Blocco>
      )}

      <Testo titolo={t('Chi è')} testo={d.bio}/>
      {d.pt && <Testo titolo={t('Formazione e certificazioni')} testo={d.curriculum}/>}
      {d.pt && <Testo titolo={t('Esperienze')} testo={d.esperienze}/>}
      <Testo titolo={t('Obiettivi')} testo={d.obiettivi}/>
      <Testo titolo={t('Percorso')} testo={d.percorso}/>
      <Testo titolo={t('Infortuni e limitazioni')} testo={d.limitazioni}/>

      {!haDettagli(d) && (
        <div className="j-empty" style={{ padding: '20px 0' }}>
          {t('{chi} non ha ancora compilato il profilo.', { chi: nome })}
        </div>
      )}
    </>
  )
}

function Numero({ etichetta, valore, nota }: { etichetta: string; valore: string; nota?: string }) {
  return (
    <NucCard pad={14}>
      <div className="j-eyebrow">{etichetta}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
        <span style={{ fontFamily: NUC.font, fontSize: 22, fontWeight: 600, color: 'var(--fg)', lineHeight: 1.1 }}>{valore}</span>
        {nota && <span style={{ fontFamily: NUC.label, fontSize: 10.5, letterSpacing: '.04em', color: 'var(--fg-mute)' }}>{nota}</span>}
      </div>
    </NucCard>
  )
}

function Blocco({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <NucCard pad={14} style={{ marginBottom: 12 }}>
      <div className="j-eyebrow" style={{ marginBottom: 8 }}>{titolo}</div>
      {children}
    </NucCard>
  )
}

function Testo({ titolo, testo }: { titolo: string; testo?: string }) {
  if (!testo?.trim()) return null
  return (
    <Blocco titolo={titolo}>
      <div style={{ fontFamily: NUC.font, fontSize: 13.5, lineHeight: 1.55, color: 'var(--fg-soft)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {testo.trim()}
      </div>
    </Blocco>
  )
}

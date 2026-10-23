// I codici: come nasce un collegamento. Si apre dalla chiave in alto a destra
// del Coaching, e lì si sceglie il verso — farsi seguire o seguire qualcuno.
//
// Stavano dentro le due sezioni, "Coach" e "Seguiti", e le occupavano per metà
// anche a collegamento fatto: un modulo che si usa una volta per persona, sopra
// le persone con cui si lavora tutti i giorni.
//
// Il codice lo genera SEMPRE chi condivide i propri dati. Nel verso opposto
// l'allenatore manderebbe una richiesta e all'allievo resterebbe da accettarla —
// un consenso che si dà per non far aspettare l'altro, che è il modo peggiore di
// darlo. Le regole vere stanno nel database: vedi supabase/coach_schema.sql.
import { useState } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { NucCard, NucEyebrow } from '@/components/ui/NucComponents'
import { useT } from '@/lib/i18n'
import { fmtShortDate } from '@/lib/dateFormat'
import { createInvite, revokeInvite, redeemCode, type CoachInvite } from '@/lib/coach'
import { avvisa } from '@/lib/messaggiLive'
import { bozzaChat } from '@/lib/messaggi'
import { Avviso, Bottone, CardScelta } from './PezziCoach'

export type Verso = 'farsi' | 'seguire'

export function CoachCodici({ userId, userName, invito, onInvito, coach, verso, onVerso, onCollegato, onVaiAiSeguiti }: {
  userId: string
  userName: string
  invito: CoachInvite | null
  onInvito: (i: CoachInvite | null) => void
  /** Il nome di chi mi segue già, se qualcuno c'è: allora un codice non si
   *  genera (un coach per volta). */
  coach: string | null
  verso: Verso | null
  onVerso: (v: Verso) => void
  /** Ho appena riscattato un codice: gli elenchi vanno riletti. */
  onCollegato: () => void
  onVaiAiSeguiti: () => void
}) {
  const t = useT()
  return (
    <>
      <div style={{ fontFamily: NUC.font, fontSize: 13, lineHeight: 1.55, color: 'var(--fg-soft)', margin: '0 2px 14px' }}>
        {t('Ci si collega con un codice: lo genera chi si fa seguire, e lo inserisce chi lo segue.')}
      </div>

      <div role="radiogroup" aria-label={t('Cosa vuoi fare?')} style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'clamp(8px, 2.4vw, 12px)', marginBottom: 18,
      }}>
        <CardScelta
          ruolo="radio"
          titolo={t('Farmi seguire')}
          sotto={t('Genero il mio codice')}
          disegno="allenatore"
          altezza="clamp(112px, 17dvh, 140px)"
          accesa={verso === 'farsi'}
          onClick={() => onVerso('farsi')}
        />
        <CardScelta
          ruolo="radio"
          titolo={t('Seguire qualcuno')}
          sotto={t('Inserisco il suo codice')}
          disegno="gruppo"
          altezza="clamp(112px, 17dvh, 140px)"
          accesa={verso === 'seguire'}
          onClick={() => onVerso('seguire')}
        />
      </div>

      {/* Tutti e due restano montati, e si nasconde quello non scelto: il codice
          scritto a metà non si perde cambiando idea. */}
      <div hidden={verso !== 'farsi'}>
        <FarmiSeguire userId={userId} userName={userName} invito={invito} onInvito={onInvito} coach={coach}/>
      </div>
      <div hidden={verso !== 'seguire'}>
        <SeguireQualcuno userId={userId} userName={userName} onCollegato={onCollegato} onVaiAiSeguiti={onVaiAiSeguiti}/>
      </div>
    </>
  )
}

// ── Farmi seguire: genero il codice ────────────────────────────
function FarmiSeguire({ userId, userName, invito, onInvito, coach }: {
  userId: string
  userName: string
  invito: CoachInvite | null
  onInvito: (i: CoachInvite | null) => void
  coach: string | null
}) {
  const t = useT()
  const [lavoro, setLavoro] = useState(false)
  const [copiato, setCopiato] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const genera = async () => {
    setLavoro(true); setErrore(null)
    try { onInvito(await createInvite(userId, userName.trim())) }
    catch (e) { setErrore(messaggio(e)) }
    finally { setLavoro(false) }
  }

  const annulla = async () => {
    setLavoro(true); setErrore(null)
    try { await revokeInvite(userId); onInvito(null) }
    catch (e) { setErrore(messaggio(e)) }
    finally { setLavoro(false) }
  }

  const copia = async () => {
    if (!invito) return
    try {
      await navigator.clipboard.writeText(invito.code)
      setCopiato(true)
      setTimeout(() => setCopiato(false), 1800)
    } catch {
      // Clipboard negata (contesto non sicuro, permesso rifiutato): il codice è
      // comunque scritto grande sullo schermo e si può ricopiare a mano. Un
      // messaggio d'errore qui direbbe che è andato storto qualcosa di importante.
    }
  }

  // Un allenatore per volta. Finché ce n'è uno il codice non si genera: darne
  // un altro in giro vorrebbe dire due persone a seguire lo stesso allievo, con
  // due schede e due voci sugli stessi esercizi. La regola vera sta nel database
  // (vedi redeem_coach_code); qui la si dice prima che qualcuno ci provi.
  if (coach) {
    return (
      <>
        <NucEyebrow>{t('Il tuo codice')}</NucEyebrow>
        <Avviso tono="ok" testo={`${t('Ti segue già {chi}.', { chi: coach })} ${t('Si può avere un solo coach per volta: per cambiarlo, scollegati prima da quello che hai.')}`}/>
      </>
    )
  }

  return (
    <>
      <NucEyebrow>{t('Il tuo codice')}</NucEyebrow>
      {errore && <Avviso testo={errore} tono="errore"/>}
      <NucCard pad={16}>
        <div style={{ fontFamily: NUC.font, fontSize: 13, lineHeight: 1.55, color: 'var(--fg-soft)', marginBottom: 14 }}>
          {/* Non più "in sola lettura": chi ti segue può correggere un'alzata
              scritta male (vedi lib/correzioni), e va detto a chi sta per
              dargli il codice. */}
          {t('Genera un codice e dallo a chi ti allena. Vedrà i tuoi allenamenti, il volume e l’andamento del peso, e potrà correggere un’alzata scritta male.')}{' '}
          {t('Puoi togliergli l’accesso quando vuoi.')}
        </div>

        {invito ? (
          <>
            {/* Il codice è il contenuto della card, non un campo di un modulo:
                si legge da lontano perché spesso si detta o si fotografa. */}
            <button onClick={copia} className="j-focus" style={{
              width: '100%', padding: '14px 12px', cursor: 'pointer',
              background: 'var(--surface-2)', border: '1px solid var(--fg)', borderRadius: 'var(--radius)',
              fontFamily: NUC.font, fontSize: 32, fontWeight: 500,
              letterSpacing: '.22em', textIndent: '.22em',
              color: 'var(--fg)',
            }}>
              {invito.code}
            </button>
            <div style={{
              marginTop: 8, fontFamily: NUC.label, fontSize: 10, letterSpacing: '.1em',
              textTransform: 'uppercase', color: copiato ? 'var(--j-accent-ink)' : 'var(--fg-mute)',
            }}>
              {copiato ? t('Copiato') : t('Tocca per copiare · scade il {data}', { data: fmtShortDate(invito.expires_at.slice(0, 10)) })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Bottone onClick={genera} disabled={lavoro} variante="chiaro">{t('Nuovo codice')}</Bottone>
              <Bottone onClick={annulla} disabled={lavoro} variante="chiaro">{t('Annulla')}</Bottone>
            </div>
          </>
        ) : (
          <Bottone onClick={genera} disabled={lavoro}>
            {lavoro ? t('Attendi…') : t('Genera un codice')}
          </Bottone>
        )}
      </NucCard>
    </>
  )
}

// ── Seguire qualcuno: inserisco il suo codice ──────────────────
function SeguireQualcuno({ userId, userName, onCollegato, onVaiAiSeguiti }: {
  userId: string
  userName: string
  onCollegato: () => void
  onVaiAiSeguiti: () => void
}) {
  const t = useT()
  const [codice, setCodice] = useState('')
  const [lavoro, setLavoro] = useState(false)
  const [esito, setEsito] = useState<{ testo: string; tono: 'ok' | 'errore' } | null>(null)

  const collega = async () => {
    if (codice.trim().length < 4) return
    setLavoro(true); setEsito(null)
    try {
      const r = await redeemCode(codice, userName.trim())
      setEsito({ testo: t('Collegato a {chi}.', { chi: r.athlete_name || t('questa persona') }), tono: 'ok' })
      setCodice('')
      // L'allievo lo viene a sapere subito, e sa da chi: è il primo messaggio
      // della chat fra i due, e gli arriva come notifica. Prima il collegamento
      // nasceva in silenzio — il codice l'aveva dato lui, ma chi lo avesse usato
      // lo scopriva solo andando a guardare.
      avvisa(bozzaChat({
        coachId: userId, athleteId: r.athlete_id, autore: userId, autoreNome: userName, tipo: 'collegamento',
        testo: t('Da adesso ti seguo io: vedo i tuoi allenamenti e possiamo scriverci da qui.'),
      }))
      onCollegato()
    } catch (e) {
      setEsito({ testo: messaggio(e), tono: 'errore' })
    } finally {
      setLavoro(false)
    }
  }

  return (
    <>
      <NucEyebrow>{t('Collega un allievo')}</NucEyebrow>
      <NucCard pad={16}>
        <div style={{ fontFamily: NUC.font, fontSize: 13, lineHeight: 1.55, color: 'var(--fg-soft)', marginBottom: 14 }}>
          {t('Chiedi il codice a chi vuoi seguire: lo genera dalla sua app, dalla chiave in alto a destra del Coaching.')}
        </div>
        <input
          value={codice}
          onChange={e => setCodice(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter') void collega() }}
          placeholder={t('CODICE')}
          // Il segnaposto ha uno stile suo (vedi `.j-codice` in globals.css):
          // con il corpo e il peso del codice vero sembrava un codice già scritto.
          className="j-codice"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={12}
          style={{
            width: '100%', boxSizing: 'border-box', minHeight: 52, padding: '0 14px',
            background: 'var(--surface-2)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)',
            outline: 'none', textAlign: 'center',
            fontFamily: NUC.font, fontSize: 24, fontWeight: 500,
            letterSpacing: '.2em', textIndent: '.2em', color: 'var(--fg)',
          }}
        />
        <div style={{ marginTop: 10 }}>
          <Bottone onClick={collega} disabled={lavoro || codice.trim().length < 4}>
            {lavoro ? t('Attendi…') : t('Collega')}
          </Bottone>
        </div>
        {esito && (
          <div style={{ marginTop: 10 }}>
            <Avviso testo={esito.testo} tono={esito.tono}/>
            {esito.tono === 'ok' && <Bottone onClick={onVaiAiSeguiti} variante="chiaro">{t('Vai ai seguiti')}</Bottone>}
          </div>
        )}
      </NucCard>
    </>
  )
}

function messaggio(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

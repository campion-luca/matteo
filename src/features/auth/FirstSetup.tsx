/* eslint-disable react-refresh/only-export-components -- co-esporta il questionario e `ageFromDob`, che è la sua regola ed è testata a parte */
// Le domande del primo accesso: nome, sesso, data di nascita, peso, altezza.
//
// Perché all'inizio e non "quando servono": senza peso corporeo la mappa della
// forza è tutta vuota, la forza relativa non esiste e le trazioni valgono zero
// chili. Sono i dati da cui dipende metà della home, e chiederli al primo accesso
// costa trenta secondi una volta sola invece di lasciare l'app mezza spenta
// finché l'utente non scopre da solo dove si inseriscono.
//
// L'ETÀ non è una domanda. Lo store ha sia `userAge` sia `userDob`, ma chiedere
// tutti e due significa avere due campi che possono contraddirsi e uno che
// invecchia male: l'età salvata a 27 anni resta 27 per sempre. Qui si chiede la
// data di nascita e l'età si calcola — è la stessa informazione, detta una volta.
//
// Una domanda per schermata: su un telefono il modulo lungo si legge come un
// modulo, e i moduli si abbandonano. Una domanda alla volta si risponde.
import { useState } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { useJarvisStore } from '@/store/useJarvisStore'
import { esercizidaCatalogo } from '@/features/gym/catalogo'
import { useT } from '@/lib/i18n'

export type SetupAnswers = {
  userName: string
  userSex?: 'M' | 'F'
  userDob?: string
  userAge?: number
  userWeight?: number
  userHeight?: number
}

/** Anni compiuti a oggi. `undefined` se la data non è una data. */
export function ageFromDob(dob: string, today = new Date()): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob)
  if (!m) return undefined
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  let age = today.getFullYear() - y
  // Il compleanno di quest'anno non è ancora arrivato: un anno in meno. Senza
  // questo controllo tutti compiono gli anni il 1° gennaio.
  const beforeBirthday =
    today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)
  if (beforeBirthday) age -= 1
  return age >= 0 && age < 130 ? age : undefined
}

type StepId = 'nome' | 'sesso' | 'nascita' | 'peso' | 'altezza'

const STEPS: StepId[] = ['nome', 'sesso', 'nascita', 'peso', 'altezza']

// Domande e spiegazioni restano in italiano: sono le chiavi del dizionario, e
// questa costante nasce all'import. Le traduce il render, sotto.
const TITLES: Record<StepId, { q: string; why: string }> = {
  nome:    { q: 'Come ti chiami?',      why: 'Serve solo per salutarti. Puoi metterci quello che vuoi.' },
  sesso:   { q: 'Sesso',                why: 'Cambia le soglie di forza: gli stessi chili non valgono lo stesso grado.' },
  nascita: { q: 'Quando sei nato?',     why: 'Da qui l’app ricava l’età, senza doverla aggiornare ogni anno.' },
  peso:    { q: 'Quanto pesi?',         why: 'È la misura su cui si calcola la forza. Senza, la mappa del corpo resta vuota.' },
  altezza: { q: 'Quanto sei alto?',     why: 'Serve al fabbisogno calorico del Personal Coach.' },
}

export function FirstSetup({ onDone }: { onDone: () => void }) {
  const t = useT()
  const [i, setI] = useState(0)
  const [name, setName] = useState('')
  const [sex, setSex] = useState<'M' | 'F' | ''>('')
  const [dob, setDob] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')

  const step = STEPS[i]
  const ultimo = i === STEPS.length - 1

  // Ogni passo ha una risposta valida o non si va avanti. Non è severità: un
  // peso vuoto qui diventa una mappa della forza vuota là, e a quel punto
  // l'utente non collega più le due cose.
  const valido =
    step === 'nome'    ? name.trim().length > 0 :
    step === 'sesso'   ? sex !== '' :
    step === 'nascita' ? ageFromDob(dob) !== undefined :
    step === 'peso'    ? Number(weight) > 20 && Number(weight) < 400 :
                         Number(height) > 80 && Number(height) < 260

  function salva() {
    const answers: SetupAnswers = {
      userName: name.trim(),
      userSex: sex || undefined,
      userDob: dob || undefined,
      userAge: dob ? ageFromDob(dob) : undefined,
      userWeight: weight ? parseFloat(weight) : undefined,
      userHeight: height ? parseFloat(height) : undefined,
    }
    useJarvisStore.setState(answers)
    // Il catalogo di partenza, così la palestra non si apre vuota. Solo se non
    // c'è già niente: questo passaggio lo rivede anche chi ha svuotato il
    // profilo, e a quel punto i suoi esercizi ci sono e non vanno toccati.
    useJarvisStore.setState(st => st.palestraExercises.length > 0 ? {} : {
      palestraExercises: esercizidaCatalogo(st.palestraExercises),
    })
    onDone()
  }

  function avanti() {
    if (!valido) return
    if (ultimo) salva()
    else setI(n => n + 1)
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 110,
      background: 'var(--bg)', backgroundImage: 'var(--paper-grain)',
      display: 'flex', flexDirection: 'column',
      fontFamily: NUC.font, color: 'var(--fg)',
      padding: 'calc(env(safe-area-inset-top) + 26px) 26px calc(env(safe-area-inset-bottom) + 22px)',
    }}>
      {/* Avanzamento: tacche, non una percentuale. Cinque tacche dicono anche
          quante domande mancano, che è la cosa che si vuole sapere. */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 34 }}>
        {STEPS.map((sId, n) => (
          <div key={sId} style={{
            flex: 1, height: 2,
            background: n <= i ? 'var(--j-accent)' : 'var(--hairline)',
            transition: 'background 280ms var(--ease)',
          }}/>
        ))}
      </div>

      <div style={{
        fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.2em',
        textTransform: 'uppercase', color: 'var(--fg-mute)', marginBottom: 10,
      }}>
        {t('Passo {n} di {tot}', { n: i + 1, tot: STEPS.length })}
      </div>

      {/* `key` sul contenitore: cambiando passo React rimonta il blocco e
          l'animazione d'ingresso riparte. Senza, la domanda successiva
          apparirebbe già ferma al suo posto. */}
      <div key={step} className="j-rise-in" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{
          fontFamily: NUC.serif, fontSize: 28, fontWeight: 500,
          letterSpacing: -0.6, lineHeight: 1.15, marginBottom: 8,
        }}>{t(TITLES[step].q)}</div>
        <div style={{
          fontFamily: NUC.font, fontSize: 13, lineHeight: 1.5,
          color: 'var(--fg-mute)', marginBottom: 26,
        }}>{t(TITLES[step].why)}</div>

        {step === 'nome' && (
          <input
            autoFocus value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') avanti() }}
            placeholder={t('Il tuo nome')} style={inputStyle}
          />
        )}

        {step === 'sesso' && (
          <div style={{ display: 'flex', gap: 10 }}>
            {([['M', 'Uomo'], ['F', 'Donna']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setSex(v)} style={{
                flex: 1, minHeight: 56, borderRadius: 0, cursor: 'pointer',
                background: sex === v ? 'var(--j-accent)' : 'var(--surface)',
                border: `1px solid ${sex === v ? 'var(--j-accent)' : 'var(--hairline)'}`,
                color: sex === v ? 'var(--j-accent-fg)' : 'var(--fg)',
                fontFamily: NUC.label, fontSize: 12, fontWeight: 500,
                letterSpacing: '.14em', textTransform: 'uppercase',
                transition: 'background 180ms var(--ease)',
              }}>{t(label)}</button>
            ))}
          </div>
        )}

        {step === 'nascita' && (
          <>
            <input
              autoFocus type="date" value={dob} onChange={e => setDob(e.target.value)}
              max="2020-12-31" style={inputStyle}
            />
            {ageFromDob(dob) !== undefined && (
              <div style={{
                marginTop: 10, fontFamily: NUC.label, fontSize: 11,
                letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--j-accent-ink)',
              }}>
                {t('{n} anni', { n: ageFromDob(dob) as number })}
              </div>
            )}
          </>
        )}

        {step === 'peso' && (
          <UnitInput value={weight} onChange={setWeight} onEnter={avanti} unit="kg" placeholder="75" step="0.1"/>
        )}

        {step === 'altezza' && (
          <UnitInput value={height} onChange={setHeight} onEnter={avanti} unit="cm" placeholder="178" step="1"/>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 18 }}>
        {i > 0 && (
          <button onClick={() => setI(n => n - 1)} className="j-btn-back" style={{ width: 44, height: 46, flexShrink: 0 }}>
            <Icons.chevL size={16}/>
          </button>
        )}
        <button
          onClick={avanti}
          disabled={!valido}
          className="j-hard"
          style={{
            flex: 1, minHeight: 46, borderRadius: 0, border: 'none',
            background: 'var(--j-accent)', color: 'var(--j-accent-fg)',
            fontFamily: NUC.label, fontSize: 11, fontWeight: 500,
            letterSpacing: '.16em', textTransform: 'uppercase',
            cursor: valido ? 'pointer' : 'default',
            opacity: valido ? 1 : 0.4,
            transition: 'opacity 180ms var(--ease)',
          }}
        >
          {ultimo ? t('Iniziamo') : t('Avanti')}
        </button>
      </div>
    </div>
  )
}

// Campo numerico con l'unità appoggiata a destra. `inputMode="decimal"` apre il
// tastierino sul telefono: con la tastiera piena si digita un peso col pollice
// destro su una fila di lettere.
function UnitInput({ value, onChange, onEnter, unit, placeholder, step }: {
  value: string; onChange: (v: string) => void; onEnter: () => void
  unit: string; placeholder: string; step: string
}) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        autoFocus type="number" inputMode="decimal" step={step}
        value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onEnter() }}
        placeholder={placeholder}
        style={{ ...inputStyle, paddingRight: 46 }}
      />
      <span style={{
        position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
        fontFamily: NUC.label, fontSize: 13, color: 'var(--fg-mute)', pointerEvents: 'none',
      }}>{unit}</span>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', minHeight: 56, boxSizing: 'border-box',
  padding: '0 14px',
  background: 'var(--surface)',
  border: '1px solid var(--hairline)',
  borderRadius: 0, outline: 'none',
  fontFamily: NUC.serif, fontSize: 22, fontWeight: 500,
  letterSpacing: -0.3, color: 'var(--fg)',
}

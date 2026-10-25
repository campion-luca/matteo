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
//
// L'ALTEZZA è l'unica facoltativa. Serviva al fabbisogno calorico del vecchio
// Personal Coach, che non c'è più: oggi resta nel profilo e arriva a chi ti
// allena con gli altri dati (vedi `AthleteData` in coach.ts), ma nessun calcolo
// la usa. Chiederla come obbligatoria voleva dire fermare qualcuno su una
// domanda che non gli rende niente.
import { useState, type CSSProperties } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { useJarvisStore, NOME_MAX } from '@/store/useJarvisStore'
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
  altezza: { q: 'Quanto sei alto?',     why: 'Non entra in nessun calcolo: resta nel tuo profilo e arriva a chi ti allena, con gli altri dati. Se preferisci, lascia vuoto.' },
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
  // L'altezza no: vuota si accetta, e non si salva. Scritta invece deve essere
  // un'altezza — un "17" lasciato a metà di "178" finirebbe nel profilo, e da
  // lì a chi ti allena.
  const valido =
    step === 'nome'    ? name.trim().length > 0 :
    step === 'sesso'   ? sex !== '' :
    step === 'nascita' ? ageFromDob(dob) !== undefined :
    step === 'peso'    ? Number(weight) > 20 && Number(weight) < 400 :
                         height.trim() === '' || (Number(height) > 80 && Number(height) < 260)

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

  // La domanda fa anche da nome del campo per il lettore di schermo: a vista
  // il campo sta sotto la domanda, ma niente li legava.
  const domanda = t(TITLES[step].q)

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 110,
      background: 'var(--bg)', backgroundImage: 'var(--paper-grain)',
      display: 'flex', flexDirection: 'column',
      fontFamily: NUC.font, color: 'var(--fg)',
      padding: 'calc(env(safe-area-inset-top) + 26px) 20px calc(env(safe-area-inset-bottom) + 22px)',
      // Da desktop le domande restano in colonna invece di stendersi sul monitor:
      // il campo del nome largo milleottocento pixel e il tasto "Avanti" lungo
      // quanto lo schermo non si leggono come un questionario, si leggono come un
      // errore. È la stessa colonna delle impostazioni (vedi .j-colonna).
      alignItems: 'center',
    }}>
    <div className="j-colonna" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Avanzamento: tacche, non una percentuale. Cinque tacche dicono anche
          quante domande mancano, che è la cosa che si vuole sapere. Quelle da
          fare sono grigio chiaro: `--hairline`, che usavano prima, adesso è
          l'inchiostro, e le domande mancanti sembravano le più importanti. */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 30 }}>
        {STEPS.map((sId, n) => (
          <div key={sId} style={{
            flex: 1, height: 4,
            background: n <= i ? 'var(--j-accent)' : 'var(--line)',
            transition: 'background 280ms var(--ease)',
          }}/>
        ))}
      </div>

      {/* L'occhiello: Condensed maiuscolo come la data in home. Sulla domanda
          facoltativa lo dice qui, prima ancora della spiegazione. */}
      <div className="j-eyebrow" style={{ fontSize: 14, marginBottom: 10 }}>
        {t('Passo {n} di {tot}', { n: i + 1, tot: STEPS.length })}
        {step === 'altezza' && <> · {t('facoltativa')}</>}
      </div>

      {/* `key` sul contenitore: cambiando passo React rimonta il blocco, che
          riparte dall'alto. Senza, una domanda scorsa fino in fondo lascerebbe
          la successiva già scorsa. */}
      <div key={step} style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {/* La domanda è il titolo della pagina (`.j-page-title`); la spiegazione
            una frase da leggere, in Barlow. Erano Barlow 500 a 28px e 13px. */}
        <div className="j-page-title" style={{ marginBottom: 10 }}>{domanda}</div>
        <div style={{
          fontFamily: NUC.font, fontSize: 15, lineHeight: 1.5,
          color: 'var(--fg-soft)', marginBottom: 24,
        }}>{t(TITLES[step].why)}</div>

        {/* Il nome si scrive come si leggerà nel saluto: Condensed 800
            maiuscolo, nel riquadro col bordo del nome di una scheda
            (`.j-campo-titolo`). */}
        {step === 'nome' && (
          <input
            autoFocus value={name} onChange={e => setName(e.target.value.slice(0, NOME_MAX))}
            onKeyDown={e => { if (e.key === 'Enter') avanti() }}
            maxLength={NOME_MAX}
            aria-label={domanda}
            placeholder={t('Il tuo nome')}
            className="j-campo-grande j-campo-titolo"
          />
        )}

        {/* Lo stesso interruttore del profilo: due celle in un riquadro col
            bordo, quella scelta piena d'inchiostro. Prima la scelta si
            riempiva d'accento, che adesso è il colore del solo tasto "Avanti". */}
        {step === 'sesso' && (
          <div role="radiogroup" aria-label={domanda} style={{ display: 'flex', border: 'var(--bordo)' }}>
            {([['M', 'Uomo'], ['F', 'Donna']] as const).map(([v, label], n) => (
              <button key={v} role="radio" aria-checked={sex === v} onClick={() => setSex(v)} className="j-focus" style={{
                flex: 1, height: 56, border: 'none', borderLeft: n === 0 ? 'none' : 'var(--bordo)', cursor: 'pointer',
                background: sex === v ? 'var(--ink)' : 'var(--surface)',
                color: sex === v ? 'var(--surface)' : 'var(--fg)',
                fontFamily: NUC.display, fontSize: 18, fontWeight: 700,
                letterSpacing: '.06em', textTransform: 'uppercase',
                transition: 'background var(--motion-fast) var(--ease), color var(--motion-fast) var(--ease)',
              }}>{t(label)}</button>
            ))}
          </div>
        )}

        {step === 'nascita' && (
          <>
            <input
              autoFocus type="date" value={dob} onChange={e => setDob(e.target.value)}
              max="2020-12-31" aria-label={domanda}
              className="j-campo-grande j-campo-titolo"
            />
            {ageFromDob(dob) !== undefined && (
              <div style={{
                marginTop: 10, fontFamily: NUC.display, fontSize: 15, fontWeight: 700,
                letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--j-accent-ink)',
              }}>
                {t('{n} anni', { n: ageFromDob(dob) as number })}
              </div>
            )}
          </>
        )}

        {step === 'peso' && (
          <UnitInput value={weight} onChange={setWeight} onEnter={avanti} unit="kg" placeholder="75" step="0.1" etichetta={domanda}/>
        )}

        {step === 'altezza' && (
          <UnitInput value={height} onChange={setHeight} onEnter={avanti} unit="cm" placeholder="178" step="1" etichetta={domanda}/>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 18 }}>
        {i > 0 && (
          <button onClick={() => setI(n => n - 1)} aria-label={t('Indietro')} className="j-btn-back j-focus" style={{ width: 56, height: 56 }}>
            <Icons.back size={20} stroke={1.8}/>
          </button>
        )}
        {/* Il CTA dell'app (`.j-btn-accent`), alto quanto i campi sopra. Da
            spento NON è l'accento sbiadito, come "Registra" nella pesata del
            profilo: velato, il bianco sull'arancio non si leggeva più, e un
            tasto grigio dice meglio che aspetta una risposta. */}
        <button
          onClick={avanti}
          disabled={!valido}
          className="j-btn-accent j-focus"
          style={{
            flex: 1, width: 'auto', height: 56, marginTop: 0,
            ...(valido ? null : SPENTO),
          }}
        >
          {ultimo ? t('Iniziamo') : t('Avanti')}
        </button>
      </div>
    </div>
    </div>
  )
}

/** Il tasto "Avanti" finché la risposta manca. */
const SPENTO: CSSProperties = {
  background: 'var(--surface)', border: '2px solid var(--line)',
  color: 'var(--muted-dark)', cursor: 'default',
}

// Campo numerico con l'unità appoggiata a destra, nel riquadro della pesata
// del profilo: il numero grande in Condensed, l'unità piccola accanto, il
// fuoco sul bordo intero (`.j-campo-riquadro`). `inputMode="decimal"` apre il
// tastierino sul telefono: con la tastiera piena si digita un peso col pollice
// destro su una fila di lettere.
function UnitInput({ value, onChange, onEnter, unit, placeholder, step, etichetta }: {
  value: string; onChange: (v: string) => void; onEnter: () => void
  unit: string; placeholder: string; step: string
  /** Il nome del campo per il lettore di schermo: la domanda. */
  etichetta: string
}) {
  return (
    <label className="j-campo-riquadro" style={{
      height: 56, display: 'flex', alignItems: 'center', gap: 8, boxSizing: 'border-box',
      padding: '0 14px', background: 'var(--surface)', border: 'var(--bordo)', cursor: 'text',
    }}>
      <input
        autoFocus type="number" inputMode="decimal" step={step}
        value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onEnter() }}
        aria-label={etichetta}
        placeholder={placeholder}
        className="j-campo-grande"
        style={{ flex: 1, minWidth: 0, fontSize: 28 }}
      />
      <span aria-hidden style={{
        fontFamily: NUC.display, fontSize: 15, fontWeight: 700,
        letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fg-mute)',
      }}>{unit}</span>
    </label>
  )
}

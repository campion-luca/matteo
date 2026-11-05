// Schermata di autenticazione: login, registrazione e reset password.
//
// È l'unica cosa che App.tsx mostra finché non c'è una sessione Supabase. Ha tre
// modi che vivono nello stesso componente perché condividono campi e stile:
// accesso, iscrizione e "password dimenticata"; il quarto — impostare la nuova
// password dopo aver seguito il link via mail — arriva dall'esterno con la prop
// `recovery`, perché lo decide l'evento PASSWORD_RECOVERY intercettato in App.
// Gli errori di Supabase passano da `translateAuthError`: arrivano in inglese e
// in gergo ("Invalid login credentials"), qui diventano frasi italiane utili.
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Icons } from '@/components/ui/Icons'
import { useT, t } from '@/lib/i18n'
import { readStorage, writeStorage, removeStorage } from '@/lib/safeStorage'

interface JarvisLoginProps { onAuth: () => void; recovery?: boolean; onRecoveryDone?: () => void }

type Mode = 'login' | 'register' | 'forgot' | 'reset'

const REMEMBER_KEY = 'jarvis-remember-email'

export function JarvisLogin({ onAuth, recovery = false, onRecoveryDone }: JarvisLoginProps) {
  // `tr` e non `t`: `t` è già importato a livello di modulo (lo usano i messaggi
  // d'errore, che nascono fuori dal render). Qui serve la versione che si iscrive
  // alla lingua e fa ridisegnare il form quando cambia.
  const tr = useT()
  const [mode, setMode] = useState<Mode>(recovery ? 'reset' : 'login')
  const [email, setEmail] = useState(() => readStorage('local', REMEMBER_KEY) ?? '')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [rememberMe, setRememberMe] = useState(() => !!readStorage('local', REMEMBER_KEY))
  // L'errore e il campo a cui si riferisce: sotto quel campo, e non in fondo al
  // form. Senza campo (credenziali, rete, troppi tentativi) resta in fondo.
  const [errore, setErrore] = useState<{ campo: Campo | null; testo: string } | null>(null)
  const setError = (testo: string | null, campo: Campo | null = null) => setErrore(testo ? { campo, testo } : null)
  const error = errore?.testo ?? null
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // quando arriva il link di recupero (evento PASSWORD_RECOVERY) passa alla schermata "nuova password"
  useEffect(() => { if (recovery) setMode('reset') }, [recovery])

  function switchMode(m: Mode) {
    setMode(m)
    setError(null)
    setInfo(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(translateAuthError(error.message), campoDellErrore(error.message))
      else {
        if (rememberMe) writeStorage('local', REMEMBER_KEY, email)
        else removeStorage('local', REMEMBER_KEY)
        onAuth()
      }
    } else if (mode === 'register') {
      if (password.length < PASSWORD_MIN) { setError(t('La password deve avere almeno 6 caratteri.'), 'password'); setLoading(false); return }
      // La conferma: una password sbagliata per un dito, al primo accesso,
      // voleva dire chiedere subito il recupero.
      if (password !== password2) { setError(t('Le password non coincidono.'), 'password2'); setLoading(false); return }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) setError(translateAuthError(error.message), campoDellErrore(error.message))
      // Conferma email attiva sul progetto: utente creato ma nessuna sessione →
      // niente accesso automatico, l'utente deve confermare l'indirizzo.
      else if (data.user && !data.session) {
        setInfo(t('Ti abbiamo inviato una email: conferma l’indirizzo per completare la registrazione.'))
        setTimeout(() => switchMode('login'), 2600)
      }
      else onAuth()
    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) setError(translateAuthError(error.message), campoDellErrore(error.message))
      else setInfo(t('Email inviata. Controlla la tua casella di posta.'))
    } else if (mode === 'reset') {
      if (password.length < PASSWORD_MIN) { setError(t('La password deve avere almeno 6 caratteri.'), 'password'); setLoading(false); return }
      if (password !== password2) { setError(t('Le password non coincidono.'), 'password2'); setLoading(false); return }
      const { error } = await supabase.auth.updateUser({ password })
      if (error) setError(translateAuthError(error.message))
      else { setInfo(t('Password aggiornata. Accesso in corso…')); setTimeout(() => onRecoveryDone?.(), 1200) }
    }
    setLoading(false)
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: 'var(--bg)', backgroundImage: 'var(--paper-grain)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0 24px',
    }}>
      {/* Il marchio: lo stesso Condensed 800 maiuscolo dei titoli dell'app, con
          l'occhiello sopra e il tratto d'accento sotto. Era in Barlow 500 con
          l'occhiello a 10px, l'ultima cosa rimasta del tema Journal — ed era la
          prima che si vedeva aprendo l'app. */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div className="j-eyebrow" style={{ fontSize: 13, letterSpacing: '.16em', marginBottom: 10 }}>
          {tr('Fatto in Italia')}
        </div>
        <div style={{
          fontFamily: 'var(--font-display)', textTransform: 'uppercase',
          fontSize: 60, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: .9,
          color: 'var(--fg)',
        }}>
          Matteo
        </div>
        <div style={{ width: 40, height: 4, background: 'var(--j-accent)', margin: '14px auto 0' }}/>
      </div>

      {/* Il form. Più largo di prima (320 e non 280): i campi adesso sono
          riquadri col bordo, e il tasto scrive in grande. */}
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 340 }}>
        {/* Entrare o crearsi un account: una scelta in cima, a due segmenti come
            le altre dell'app (4 nov 2026). Prima c'era un titolo, e la strada
            per registrarsi era un link grigio in fondo, sotto il tasto. */}
        {(mode === 'login' || mode === 'register') ? (
          <div role="tablist" aria-label={tr('Accesso')} className="flex" style={{ border: 'var(--bordo)', marginBottom: 22 }}>
            {(['login', 'register'] as const).map((m, i) => (
              <button
                key={m} type="button" role="tab" aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className="j-focus"
                style={{
                  flex: 1, height: 48, cursor: 'pointer', border: 'none', borderLeft: i === 0 ? 'none' : 'var(--bordo)',
                  background: mode === m ? 'var(--ink)' : 'var(--surface)', color: mode === m ? 'var(--surface)' : 'var(--fg)',
                  fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
                }}
              >
                {m === 'login' ? tr('Accedi') : tr('Registrati')}
              </button>
            ))}
          </div>
        ) : (
          <div style={{
            fontFamily: 'var(--font-display)', textTransform: 'uppercase',
            fontSize: 24, fontWeight: 800, letterSpacing: '.02em', lineHeight: 1,
            color: 'var(--fg)', marginBottom: 16, textAlign: 'center',
          }}>
            {mode === 'forgot' ? tr('Recupera password') : tr('Nuova password')}
          </div>
        )}

        {/* Ogni campo con la sua etichetta sopra: col solo testo grigio dentro,
            appena si cominciava a scrivere non si sapeva più cosa fosse. I campi
            sono quelli del resto dell'app (`.j-field`). */}
        {mode !== 'reset' && (
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="accesso-email" style={ETICHETTA}>{tr('Indirizzo email')}</label>
            <input
              id="accesso-email"
              type="email"
              placeholder={tr('nome@esempio.it')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoCapitalize="off"
              autoComplete="email"
              aria-invalid={errore?.campo === 'email' || undefined}
              aria-describedby={errore?.campo === 'email' ? 'accesso-errore-campo' : undefined}
              className="j-field"
            />
            {errore?.campo === 'email' && <ErroreCampo testo={errore.testo}/>}
          </div>
        )}

        {mode !== 'forgot' && (
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="accesso-password" style={ETICHETTA}>{mode === 'reset' ? tr('Nuova password') : tr('Password')}</label>
            <div style={{ position: 'relative' }}>
              <input
                id="accesso-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                // Il telefono propone di salvarla (nuova) o la compila (attuale).
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                aria-invalid={errore?.campo === 'password' || undefined}
                aria-describedby={errore?.campo === 'password' ? 'accesso-errore-campo' : mode !== 'login' ? 'accesso-requisito' : undefined}
                className="j-field"
                style={{ paddingRight: 44 }}
              />
              {/* Quadrato da 44 sul bordo destro del campo: è il bersaglio minimo
                  per un dito, e l'icona da sola ne era un terzo. */}
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="j-focus"
                style={{
                  position: 'absolute', right: 0, top: 0, width: 44, height: 44,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'none', border: 'none', padding: 0,
                  cursor: 'pointer', color: 'var(--fg-soft)',
                }}
                aria-label={showPassword ? tr('Nascondi password') : tr('Mostra password')}
              >
                {showPassword ? <Icons.occhioNo size={18} stroke={1.8}/> : <Icons.occhio size={18} stroke={1.8}/>}
              </button>
            </div>
            {/* Il requisito detto prima, non dopo l'errore: si accende quando
                è rispettato. */}
            {mode !== 'login' && errore?.campo !== 'password' && (
              <div id="accesso-requisito" style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.4, marginTop: 6, color: password.length >= PASSWORD_MIN ? 'var(--fg)' : 'var(--fg-mute)' }}>
                {password.length >= PASSWORD_MIN ? '✓ ' : ''}{tr('Almeno 6 caratteri')}
              </div>
            )}
            {errore?.campo === 'password' && <ErroreCampo testo={errore.testo}/>}
          </div>
        )}

        {(mode === 'register' || mode === 'reset') && (
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="accesso-password2" style={ETICHETTA}>{tr('Conferma password')}</label>
            <input
              id="accesso-password2"
              type={showPassword ? 'text' : 'password'}
              value={password2}
              onChange={e => setPassword2(e.target.value)}
              required
              autoComplete="new-password"
              aria-invalid={errore?.campo === 'password2' || undefined}
              aria-describedby={errore?.campo === 'password2' ? 'accesso-errore-campo' : undefined}
              className="j-field"
            />
            {errore?.campo === 'password2' && <ErroreCampo testo={errore.testo}/>}
          </div>
        )}

        {mode === 'login' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 20px' }}>
            {/* La casella è un quadrato col bordo d'inchiostro, e spuntata si
                riempie d'inchiostro: la stessa regola degli interruttori e delle
                scelte a segmenti. L'accento resta al tasto che fa entrare. */}
            <button
              type="button"
              role="checkbox"
              aria-checked={rememberMe}
              onClick={() => setRememberMe(v => !v)}
              className="j-focus"
              style={{
                width: 22, height: 22, padding: 0, flexShrink: 0,
                background: rememberMe ? 'var(--ink)' : 'var(--surface)',
                border: 'var(--bordo)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background var(--motion-fast) var(--ease)',
              }}
              aria-label={tr('Ricordami')}
            >
              {rememberMe && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--surface)" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 14, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
              color: 'var(--fg)', cursor: 'pointer',
            }} onClick={() => setRememberMe(v => !v)}>
              {tr('Ricordami')}
            </span>
          </div>
        )}

        {mode !== 'login' && <div style={{ height: 6 }}/>}

        {/* Gli errori che non sono di un campo (credenziali, rete, troppi
            tentativi) e le conferme sono frasi da leggere: Barlow a 14px. */}
        {error && !errore?.campo && (
          <div role="alert" style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14, lineHeight: 1.45, color: 'var(--danger)', marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {info && (
          <div role="status" style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14, lineHeight: 1.45, color: 'var(--j-accent-ink)', marginBottom: 16,
          }}>
            {info}
          </div>
        )}

        {/* Il tasto è il CTA dell'app (`.j-btn-accent`): bianco, grande e in
            grassetto sull'arancio, con l'ombra piena. */}
        {!info && (
          <button
            type="submit"
            disabled={loading}
            className="j-btn-accent"
            style={{
              marginTop: 0,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '...' : mode === 'login' ? tr('Entra') : mode === 'register' ? tr('Crea account') : mode === 'forgot' ? tr('Invia email') : tr('Aggiorna password')}
          </button>
        )}

        {/* I link sotto il tasto: alti 40 perché si toccano, e grigi perché
            non sono il gesto principale. Registrarsi non sta più qui: è la
            scelta in cima. */}
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {mode === 'login' && (
            <button type="button" onClick={() => switchMode('forgot')} style={linkStyle}>
              {tr('Password dimenticata?')}
            </button>
          )}
          {mode === 'forgot' && (
            <button type="button" onClick={() => switchMode('login')} style={linkStyle}>
              {tr('Torna al login')}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

// Gli errori di Supabase arrivano in inglese: li traduciamo nei casi comuni,
// con fallback al messaggio originale per quelli non mappati.
function translateAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return t('Email o password non corretti.')
  if (m.includes('email not confirmed')) return t('Devi prima confermare la tua email. Controlla la casella di posta.')
  if (m.includes('user already registered') || m.includes('already been registered')) return t('Esiste già un account con questa email.')
  if (m.includes('password should be at least')) return t('La password deve avere almeno 6 caratteri.')
  if (m.includes('unable to validate email') || m.includes('invalid email')) return t('Indirizzo email non valido.')
  if (m.includes('rate limit') || m.includes('too many requests')) return t('Troppi tentativi. Riprova tra qualche minuto.')
  if (m.includes('for security purposes')) return t('Troppi tentativi ravvicinati. Attendi qualche istante e riprova.')
  return message
}

const linkStyle: React.CSSProperties = {
  width: '100%', minHeight: 40, padding: 0,
  background: 'none', border: 'none',
  fontFamily: 'var(--font-display)',
  fontSize: 14, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
  color: 'var(--fg-soft)',
  cursor: 'pointer',
}

/** Il campo di cui parla un errore di Supabase, per scriverlo sotto quel campo.
 *  `null` per quelli che non sono di un campo (credenziali, rete, tentativi). */
function campoDellErrore(message: string): Campo | null {
  const m = message.toLowerCase()
  if (m.includes('unable to validate email') || m.includes('invalid email') || m.includes('already registered') || m.includes('already been registered')) return 'email'
  if (m.includes('password should be at least') || m.includes('weak password')) return 'password'
  return null
}

/** Un errore sotto il suo campo. */
function ErroreCampo({ testo }: { testo: string }) {
  return (
    <div id="accesso-errore-campo" role="alert" style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, lineHeight: 1.4, color: 'var(--danger)', marginTop: 6 }}>
      {testo}
    </div>
  )
}

type Campo = 'email' | 'password' | 'password2'

/** La lunghezza minima che il progetto Supabase chiede. */
const PASSWORD_MIN = 6

const ETICHETTA: React.CSSProperties = {
  display: 'block', marginBottom: 6,
  fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
  color: 'var(--fg-mute)',
}

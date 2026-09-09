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
  const [error, setError] = useState<string | null>(null)
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
      if (error) setError(translateAuthError(error.message))
      else {
        if (rememberMe) writeStorage('local', REMEMBER_KEY, email)
        else removeStorage('local', REMEMBER_KEY)
        onAuth()
      }
    } else if (mode === 'register') {
      if (password.length < 6) { setError(t('La password deve avere almeno 6 caratteri.')); setLoading(false); return }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) setError(translateAuthError(error.message))
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
      if (error) setError(translateAuthError(error.message))
      else setInfo(t('Email inviata. Controlla la tua casella di posta.'))
    } else if (mode === 'reset') {
      if (password.length < 6) { setError(t('La password deve avere almeno 6 caratteri.')); setLoading(false); return }
      if (password !== password2) { setError(t('Le password non coincidono.')); setLoading(false); return }
      const { error } = await supabase.auth.updateUser({ password })
      if (error) setError(translateAuthError(error.message))
      else { setInfo(t('Password aggiornata. Accesso in corso…')); setTimeout(() => onRecoveryDone?.(), 1200) }
    }
    setLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--fg-mute)',
    outline: 'none',
    padding: '6px 0',
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    color: 'var(--fg)',
    letterSpacing: '.04em',
  }

  const eyebrowStyle: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
    color: 'var(--fg-mute)', marginBottom: 24,
    textAlign: 'center',
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: 'var(--bg)', backgroundImage: 'var(--paper-grain)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0 40px',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{
          fontFamily: 'var(--font-body)',
          fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase',
          color: 'var(--fg-mute)', marginBottom: 12,
        }}>
          {tr('Fatto in Italia')}
        </div>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 44, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1,
          color: 'var(--fg)',
        }}>
          Matteo
        </div>
        <div style={{ width: 28, height: 1, background: 'var(--j-accent)', margin: '12px auto 0' }}/>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 280 }}>
        <div style={eyebrowStyle}>
          {mode === 'login' ? tr('Accedi') : mode === 'register' ? tr('Crea account') : mode === 'forgot' ? tr('Recupera password') : tr('Nuova password')}
        </div>

        {mode !== 'reset' && (
          <div style={{ marginBottom: 20 }}>
            <input
              type="email"
              placeholder={tr('email')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoCapitalize="off"
              style={inputStyle}
            />
          </div>
        )}

        {mode !== 'forgot' && (
          <div style={{ marginBottom: mode === 'reset' ? 16 : 32, position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder={mode === 'reset' ? tr('nuova password') : tr('password')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ ...inputStyle, paddingRight: 28 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{
                position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', padding: 0,
                cursor: 'pointer', color: 'var(--fg-mute)',
                fontSize: 14, lineHeight: 1,
              }}
              aria-label={showPassword ? tr('Nascondi password') : tr('Mostra password')}
            >
              {showPassword ? <Icons.bookOpen size={15} stroke={1.6}/> : <Icons.book size={15} stroke={1.6}/>}
            </button>
          </div>
        )}

        {mode === 'reset' && (
          <div style={{ marginBottom: 32 }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder={tr('conferma password')}
              value={password2}
              onChange={e => setPassword2(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
        )}

        {mode === 'forgot' && <div style={{ marginBottom: 32 }}/>}

        {mode === 'login' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => setRememberMe(v => !v)}
              style={{
                width: 16, height: 16, borderRadius: 0, padding: 0, flexShrink: 0,
                background: rememberMe ? 'var(--j-accent)' : 'transparent',
                border: `1px solid ${rememberMe ? 'var(--j-accent)' : 'var(--fg-mute)'}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 180ms',
              }}
              aria-label={tr('Ricordami')}
            >
              {rememberMe && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--j-accent-fg)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase',
              color: 'var(--fg-mute)', cursor: 'pointer',
            }} onClick={() => setRememberMe(v => !v)}>
              {tr('Ricordami')}
            </span>
          </div>
        )}

        {error && (
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: 10, color: 'var(--danger)', marginBottom: 16,
            letterSpacing: '.02em',
          }}>
            {error}
          </div>
        )}

        {info && (
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: 10, color: 'var(--j-accent-ink)', marginBottom: 16,
            letterSpacing: '.02em',
          }}>
            {info}
          </div>
        )}

        {!info && (
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              minHeight: 44,
              padding: '12px 0',
              background: 'var(--j-accent)',
              border: 'none',
              borderRadius: 0,
              fontFamily: 'var(--font-body)',
              fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase',
              color: 'var(--bg)',
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'opacity 200ms',
            }}
          >
            {loading ? '...' : mode === 'login' ? tr('Entra') : mode === 'register' ? tr('Registrati') : mode === 'forgot' ? tr('Invia email') : tr('Aggiorna password')}
          </button>
        )}

        {/* Bottom links */}
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mode === 'login' && (
            <>
              <button type="button" onClick={() => switchMode('register')} style={linkStyle}>
                {tr('Non hai un account? Registrati')}
              </button>
              <button type="button" onClick={() => switchMode('forgot')} style={linkStyle}>
                {tr('Password dimenticata?')}
              </button>
            </>
          )}
          {mode === 'register' && (
            <button type="button" onClick={() => switchMode('login')} style={linkStyle}>
              {tr('Hai già un account? Accedi')}
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
  width: '100%',
  background: 'none', border: 'none',
  fontFamily: 'var(--font-body)',
  fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase',
  color: 'var(--fg-mute)',
  cursor: 'pointer',
}

// Rete di sicurezza attorno all'intera app (montata in App.tsx).
//
// Un errore di render in React smonta tutto l'albero: senza boundary l'utente
// resterebbe su una pagina bianca, senza nemmeno il modo di ricaricare. Qui
// mostriamo una schermata leggibile con una via d'uscita — "svuota cache e
// ricarica", che butta le cache del service worker: dopo un deploy andato storto
// è l'unica cosa che sblocca davvero una PWA con codice vecchio in cache. Sotto,
// i dettagli tecnici a richiesta, perché "qualcosa è andato storto" da solo non
// permette a nessuno di segnalare il problema.
// Deve restare una class component: `getDerivedStateFromError`/`componentDidCatch`
// non hanno equivalente negli hook.
import { Component, type ReactNode, type ErrorInfo } from 'react'
// Componente a classe: niente hook, quindi `t` diretto invece di `useT`. Qui
// l'app è già ferma e non c'è nessun cambio lingua da inseguire.
import { t } from '@/lib/i18n'

interface Props { children: ReactNode }
interface State { error: Error | null; componentStack: string | null; showDetails: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null, showDetails: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null })
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'var(--bg)', backgroundImage: 'var(--paper-grain)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14,
          fontFamily: 'var(--font-body)',
          color: 'var(--fg)', padding: 32, textAlign: 'center',
          overflowY: 'auto',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500,
            letterSpacing: '-0.01em', color: 'var(--fg)',
          }}>
            {t('Qualcosa è andato storto')}
          </div>
          <div style={{
            fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5,
            color: 'var(--fg-soft)', maxWidth: 360,
          }}>
            {t('Si è verificato un errore imprevisto. Puoi svuotare la cache e ricaricare l’app.')}
          </div>

          <button
            onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
            style={{
              marginTop: 2, background: 'none', border: 'none',
              fontFamily: 'var(--font-label)', fontSize: 10, letterSpacing: '.14em',
              textTransform: 'uppercase', color: 'var(--fg-mute)', cursor: 'pointer',
            }}
          >
            {this.state.showDetails ? t('Nascondi dettagli tecnici') : t('Dettagli tecnici')}
          </button>

          {this.state.showDetails && (
            <div style={{
              maxWidth: 360, width: '100%', textAlign: 'left',
              background: 'var(--surface)', border: '1px solid var(--hairline)',
              borderRadius: 'var(--radius)', padding: '12px 14px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{
                fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--fg-soft)',
                wordBreak: 'break-word',
              }}>
                {this.state.error.message}
              </div>
              {this.state.componentStack && (
                <div style={{
                  fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--fg-mute)',
                  wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                }}>
                  {this.state.componentStack.trim()}
                </div>
              )}
            </div>
          )}

          <button
            onClick={async () => {
              if ('caches' in window) {
                const keys = await caches.keys()
                await Promise.all(keys.map(k => caches.delete(k)))
              }
              window.location.reload()
            }}
            style={{
              marginTop: 8, height: 44, padding: '0 24px', borderRadius: 'var(--radius)',
              background: 'var(--j-accent)', border: 'none',
              color: 'var(--j-accent-fg)', fontFamily: 'var(--font-body)',
              fontSize: 14, fontWeight: 500, cursor: 'pointer', flexShrink: 0,
            }}
          >
            {t('Svuota cache e ricarica')}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

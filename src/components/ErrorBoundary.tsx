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
          color: 'var(--fg)', padding: '32px 24px', textAlign: 'center',
          overflowY: 'auto',
        }}>
          {/* Un titolo come quelli delle pagine: Condensed 800 maiuscolo. La
              spiegazione sotto è una frase da leggere, in Barlow. */}
          <div style={{
            fontFamily: 'var(--font-display)', textTransform: 'uppercase',
            fontSize: 34, fontWeight: 800, lineHeight: .95,
            letterSpacing: '-0.01em', color: 'var(--fg)', maxWidth: 360,
          }}>
            {t('Qualcosa è andato storto')}
          </div>
          <div style={{
            fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.5,
            color: 'var(--fg-soft)', maxWidth: 360,
          }}>
            {t('Si è verificato un errore imprevisto. Puoi svuotare la cache e ricaricare l’app.')}
          </div>

          {/* Un'etichetta che si tocca: Condensed, e alta 40 perché è un tasto. */}
          <button
            onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
            style={{
              minHeight: 40, padding: '0 8px', background: 'none', border: 'none',
              fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, letterSpacing: '.06em',
              textTransform: 'uppercase', color: 'var(--fg-soft)', cursor: 'pointer',
            }}
          >
            {this.state.showDetails ? t('Nascondi dettagli tecnici') : t('Dettagli tecnici')}
          </button>

          {this.state.showDetails && (
            <div style={{
              maxWidth: 360, width: '100%', textAlign: 'left',
              background: 'var(--surface)', border: 'var(--bordo)',
              padding: '12px 14px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{
                fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.45, color: 'var(--fg)',
                wordBreak: 'break-word',
              }}>
                {this.state.error.message}
              </div>
              {/* Il percorso dei componenti è per chi lo legge in una
                  segnalazione: più piccolo del messaggio, ma non sotto i 12px. */}
              {this.state.componentStack && (
                <div style={{
                  fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: 1.45, color: 'var(--fg-mute)',
                  wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                }}>
                  {this.state.componentStack.trim()}
                </div>
              )}
            </div>
          )}

          {/* L'unica via d'uscita, quindi il CTA dell'app (`.j-btn-accent`),
              largo quanto il testo sopra. */}
          <button
            onClick={async () => {
              if ('caches' in window) {
                const keys = await caches.keys()
                await Promise.all(keys.map(k => caches.delete(k)))
              }
              window.location.reload()
            }}
            className="j-btn-accent"
            style={{ marginTop: 8, maxWidth: 360, padding: '0 12px', flexShrink: 0 }}
          >
            {t('Svuota cache e ricarica')}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

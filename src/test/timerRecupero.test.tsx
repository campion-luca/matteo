import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { TimerRecupero } from '@/features/gym/TimerRecupero'
import { leggiRecupero, salvaRecupero, scartaSessione, RECUPERO_SEC, OLTRE_MAX_SEC } from '@/features/gym/sessioneInCorso'

// Il timer conta sull'ISTANTE di fine, non sui secondi passati: è ciò che lo fa
// reggere al telefono bloccato e alla pagina rimontata. I casi qui sotto sono
// quelli in cui un timer scritto "a intervalli" sbaglierebbe.

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-01T10:00:00'))
})
afterEach(() => { cleanup(); vi.useRealTimers() })

const avanti = (sec: number) => act(() => { vi.advanceTimersByTime(sec * 1000) })
const avvia = () => fireEvent.click(screen.getByRole('button', { name: 'Timer' }))

describe('esecuzione, recupero, e oltre', () => {
  it('parte in esecuzione: il quadrante è il tasto TIMER, e niente scorre', () => {
    render(<TimerRecupero schedaId="sc1"/>)
    expect(screen.getByRole('button', { name: 'Timer' })).toBeInTheDocument()
    expect(screen.getByText('Esecuzione')).toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  it('il tasto fa partire un minuto e mezzo, col promemoria di cosa farne', () => {
    render(<TimerRecupero schedaId="sc1"/>)
    avvia()
    expect(screen.getByRole('timer')).toHaveTextContent('1:30')
    expect(screen.getByText('Tempo di recuperare e registrare la serie.')).toBeInTheDocument()
    avanti(31)
    expect(screen.getByRole('timer')).toHaveTextContent('0:59')
  })

  it('a zero non si ferma: conta in su col "+", finché non si riparte', () => {
    render(<TimerRecupero schedaId="sc1"/>)
    avvia()
    avanti(RECUPERO_SEC)
    expect(screen.getByRole('timer')).toHaveTextContent('+0:00')
    expect(screen.getByText('Oltre il recupero')).toBeInTheDocument()
    avanti(7)
    expect(screen.getByRole('timer')).toHaveTextContent('+0:07')
    avanti(60)
    expect(screen.getByRole('timer')).toHaveTextContent('+1:07')
    // Un tocco sul quadrante e si torna in esecuzione, pronti per il prossimo.
    fireEvent.click(screen.getByRole('button', { name: 'Riprendi' }))
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    avvia()
    expect(screen.getByRole('timer')).toHaveTextContent('1:30')
  })

  it('vibra una volta sola, al passaggio per lo zero', () => {
    const vibra = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibra, configurable: true })
    render(<TimerRecupero schedaId="sc1"/>)
    avvia()
    avanti(RECUPERO_SEC - 1)
    expect(vibra).not.toHaveBeenCalled()
    avanti(30)
    expect(vibra).toHaveBeenCalledTimes(1)
  })

  it('«Salta» lo chiude prima del tempo', () => {
    render(<TimerRecupero schedaId="sc1"/>)
    avvia()
    avanti(10)
    fireEvent.click(screen.getByRole('button', { name: 'Salta' }))
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Timer' })).toBeInTheDocument()
    expect(leggiRecupero('sc1')).toBeNull()
  })

  it('uscendo e rientrando riprende dal tempo giusto, non da capo', () => {
    render(<TimerRecupero schedaId="sc1"/>)
    avvia()
    cleanup()
    // Quaranta secondi fuori dalla pagina: nessuno li ha contati, ma sono passati.
    vi.setSystemTime(new Date('2026-10-01T10:00:40'))
    render(<TimerRecupero schedaId="sc1"/>)
    expect(screen.getByRole('timer')).toHaveTextContent('0:50')
  })

  it('rientrando a recupero già scaduto si trova il conto in su, senza vibrazione', () => {
    const vibra = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibra, configurable: true })
    salvaRecupero('sc1', Date.now() + 5000)
    vi.setSystemTime(new Date('2026-10-01T10:02:05'))
    render(<TimerRecupero schedaId="sc1"/>)
    expect(screen.getByRole('timer')).toHaveTextContent('+2:00')
    // Lo zero è passato mentre non c'era nessuno: niente segnale in ritardo.
    expect(vibra).not.toHaveBeenCalled()
  })

  it('dimenticato per mezz’ora oltre lo zero, si azzera da sé', () => {
    render(<TimerRecupero schedaId="sc1"/>)
    avvia()
    avanti(RECUPERO_SEC + OLTRE_MAX_SEC + 1)
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(leggiRecupero('sc1')).toBeNull()
  })

  it('un recupero scaduto da più di mezz’ora non si riprende', () => {
    salvaRecupero('sc1', Date.now())
    expect(leggiRecupero('sc1', Date.now() + (OLTRE_MAX_SEC - 1) * 1000)).not.toBeNull()
    expect(leggiRecupero('sc1', Date.now() + (OLTRE_MAX_SEC + 1) * 1000)).toBeNull()
  })

  it('il recupero di un’altra scheda non si riprende qui', () => {
    salvaRecupero('altra', Date.now() + 60_000)
    expect(leggiRecupero('sc1')).toBeNull()
    expect(leggiRecupero('altra')).not.toBeNull()
  })

  it('finita la sessione, il timer se ne va con lei', () => {
    salvaRecupero('sc1', Date.now() + 60_000)
    scartaSessione()
    expect(leggiRecupero('sc1')).toBeNull()
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { TimerRecupero } from '@/features/gym/TimerRecupero'
import { leggiRecupero, salvaRecupero, scartaSessione, RECUPERO_SEC } from '@/features/gym/sessioneInCorso'

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

describe('esecuzione e recupero', () => {
  it('parte in esecuzione: nessun conto alla rovescia finché non lo si chiede', () => {
    render(<TimerRecupero schedaId="sc1"/>)
    expect(screen.getByText('Esecuzione')).toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  it('«Serie finita» fa partire un minuto e mezzo, col promemoria di cosa farne', () => {
    render(<TimerRecupero schedaId="sc1"/>)
    fireEvent.click(screen.getByRole('button', { name: /serie finita/i }))
    expect(screen.getByRole('timer')).toHaveTextContent('1:30')
    expect(screen.getByText('Tempo di recuperare e registrare la serie.')).toBeInTheDocument()
    avanti(31)
    expect(screen.getByRole('timer')).toHaveTextContent('0:59')
  })

  it('a zero torna in esecuzione e dice che il recupero è finito', () => {
    render(<TimerRecupero schedaId="sc1"/>)
    fireEvent.click(screen.getByRole('button', { name: /serie finita/i }))
    avanti(RECUPERO_SEC + 1)
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(screen.getByText('Esecuzione')).toBeInTheDocument()
    expect(screen.getByText(/Recupero finito/)).toBeInTheDocument()
    // Ed è pronto per la serie dopo.
    fireEvent.click(screen.getByRole('button', { name: /serie finita/i }))
    expect(screen.getByRole('timer')).toHaveTextContent('1:30')
  })

  it('«Salta» lo chiude senza dire che è finito', () => {
    render(<TimerRecupero schedaId="sc1"/>)
    fireEvent.click(screen.getByRole('button', { name: /serie finita/i }))
    avanti(10)
    fireEvent.click(screen.getByRole('button', { name: 'Salta' }))
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(screen.queryByText(/Recupero finito/)).not.toBeInTheDocument()
    expect(leggiRecupero('sc1')).toBeNull()
  })

  it('uscendo e rientrando riprende dal tempo giusto, non da capo', () => {
    render(<TimerRecupero schedaId="sc1"/>)
    fireEvent.click(screen.getByRole('button', { name: /serie finita/i }))
    cleanup()
    // Quaranta secondi fuori dalla pagina: nessuno li ha contati, ma sono passati.
    vi.setSystemTime(new Date('2026-10-01T10:00:40'))
    render(<TimerRecupero schedaId="sc1"/>)
    expect(screen.getByRole('timer')).toHaveTextContent('0:50')
  })

  it('rientrando a recupero già scaduto si è in esecuzione', () => {
    salvaRecupero('sc1', Date.now() + 5000)
    vi.setSystemTime(new Date('2026-10-01T10:05:00'))
    render(<TimerRecupero schedaId="sc1"/>)
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
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

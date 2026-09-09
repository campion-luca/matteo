import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JarvisDashboard } from '@/features/dashboard/JarvisDashboard'
import { HomeModulesManager } from '@/features/dashboard/HomeModulesManager'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'

// La home è la schermata d'ingresso: se non monta, l'app è inutilizzabile.
// Qui si verifica che monti con lo stato vuoto (utente nuovo), che il tasto
// "Alleniamoci" e le due scorciatoie a feature chiamino la cosa giusta, e che
// dei moduli rimossi non resti traccia.

const props = () => ({
  onOpenGym: vi.fn(),
  onOpenProfile: vi.fn(),
  onOpenBudget: vi.fn(),
  onOpenCoach: vi.fn(),
})

beforeEach(() => {
  useJarvisStore.setState({ ...EMPTY_STATE, userName: 'Luca' }, true)
  localStorage.clear()
})
afterEach(cleanup)

describe('JarvisDashboard', () => {
  it('monta con lo stato vuoto e saluta per nome', () => {
    render(<JarvisDashboard {...props()}/>)
    expect(screen.getByText(/Luca/)).toBeInTheDocument()
    expect(screen.getByText('Widget')).toBeInTheDocument()
  })

  it('il tasto Alleniamoci porta all’allenamento', async () => {
    const user = userEvent.setup()
    const p = props()
    render(<JarvisDashboard {...p}/>)

    await user.click(screen.getByRole('button', { name: /alleniamoci/i }))
    expect(p.onOpenGym).toHaveBeenCalledOnce()
  })

  it('le due scorciatoie aprono Personal Coach e Budget', async () => {
    const user = userEvent.setup()
    const p = props()
    render(<JarvisDashboard {...p}/>)

    await user.click(screen.getByLabelText('Apri Personal Coach'))
    expect(p.onOpenCoach).toHaveBeenCalledOnce()

    await user.click(screen.getByLabelText('Apri Budget'))
    expect(p.onOpenBudget).toHaveBeenCalledOnce()
  })

  it('non è rimasto il menù Strumenti, sostituito dal collegamento diretto', () => {
    render(<JarvisDashboard {...props()}/>)
    expect(screen.queryByLabelText('Strumenti')).not.toBeInTheDocument()
  })

  it('la home ha un solo tondo, ed è quello delle impostazioni', async () => {
    // Il gestore dei moduli non è più in home: vive nel menù utente, e la rotella
    // porta lì. I due tondi separati (utente + moduli) sono diventati uno.
    const user = userEvent.setup()
    const p = props()
    render(<JarvisDashboard {...p}/>)

    expect(screen.queryByLabelText('Impostazioni moduli')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Menù utente')).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('Impostazioni'))
    expect(p.onOpenProfile).toHaveBeenCalledOnce()
  })
})

describe('HomeModulesManager', () => {
  it('non offre più i moduli delle schede rimosse', () => {
    render(<HomeModulesManager/>)
    const testo = document.body.textContent ?? ''
    for (const morto of ['Idratazione', 'Readiness', 'Insight', 'Attività oggi', 'Calendario', 'Agenda di oggi', 'Riepilogo settimanale']) {
      expect(testo, `"${morto}" è ancora fra i moduli`).not.toContain(morto)
    }
  })

  it('riordina e spegne i moduli della home', async () => {
    const user = userEvent.setup()
    render(<HomeModulesManager/>)

    const settimana = screen.getByRole('switch', { name: /La tua settimana/ })
    expect(settimana).toHaveAttribute('aria-checked', 'true')
    await user.click(settimana)
    expect(screen.getByRole('switch', { name: /La tua settimana/ })).toHaveAttribute('aria-checked', 'false')
  })
})

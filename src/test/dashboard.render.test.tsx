import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Riepilogo } from '@/features/dashboard/Riepilogo'
import { HomeModulesManager } from '@/features/dashboard/HomeModulesManager'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'

// Il riepilogo complessivo era la home dell'app; adesso è una sezione aperta in
// cima a Stats (vedi JarvisGym). Qui si verifica che monti con lo stato vuoto, che
// la settimana apra il calendario, e che di quello che stava nella vecchia home —
// saluto, "Alleniamoci", ricerca globale — non sia rimasto niente: sono cose che
// adesso vivono in SalutoHeader.

const props = () => ({
  onOpenProfile: vi.fn(),
})

beforeEach(() => {
  useJarvisStore.setState({ ...EMPTY_STATE, userName: 'Luca' }, true)
  localStorage.clear()
})
afterEach(cleanup)

describe('Riepilogo', () => {
  it('monta con lo stato vuoto', () => {
    render(<Riepilogo {...props()}/>)
    expect(screen.getByText('Riepilogo complessivo')).toBeInTheDocument()
  })

  it('è una sezione, non una pagina: nessuna intestazione propria', () => {
    // Sta dentro Stats, che ha già la sua testata: una freccia e un titolo qui
    // dentro vorrebbero dire due intestazioni una sotto l'altra.
    render(<Riepilogo {...props()}/>)
    expect(screen.queryByLabelText('Indietro')).not.toBeInTheDocument()
  })

  it('non è più una schermata d’ingresso: niente saluto né "Alleniamoci"', () => {
    render(<Riepilogo {...props()}/>)
    expect(screen.queryByRole('button', { name: /alleniamoci/i })).not.toBeInTheDocument()
    // Saluto, ricerca e rotella sono passati alla testata dell'allenamento.
    expect(screen.queryByLabelText('Ricerca globale')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Impostazioni')).not.toBeInTheDocument()
  })

  it('Budget e Personal Coach non sono più qui', () => {
    // Il Budget è stato tolto dall'app; Personal Coach vive fra le card
    // dell'allenamento.
    render(<Riepilogo {...props()}/>)
    expect(screen.queryByLabelText('Apri Budget')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Apri Personal Coach')).not.toBeInTheDocument()
  })

  it('toccando la settimana si apre il calendario con la serie di settimane', async () => {
    const user = userEvent.setup()
    render(<Riepilogo {...props()}/>)
    await user.click(screen.getByLabelText('Apri il calendario degli allenamenti'))
    expect(await screen.findByText('I tuoi allenamenti')).toBeInTheDocument()
    expect(screen.getByText('settimane di fila')).toBeInTheDocument()
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

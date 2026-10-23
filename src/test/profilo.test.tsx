import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JarvisProfile } from '@/features/profile/JarvisProfile'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'

// Il Profilo dopo il rebranding (ott 2026): il nome in un riquadro con la foto,
// i dati generali in griglia, la pesata di oggi col campo e «Registra» sulla
// stessa riga, e niente «Salva» in testata — la freccia salva e chiude.

const monta = (onClose = vi.fn()) => render(
  <ConfirmDeleteProvider>
    <JarvisProfile open onClose={onClose} sezione="utente"/>
  </ConfirmDeleteProvider>,
)

describe('il profilo', () => {
  beforeEach(() => {
    useJarvisStore.setState({
      ...EMPTY_STATE, userName: 'Luca', userWeight: 76.2, userHeight: 178, userAge: 29, userSex: 'M', userDob: '1997-08-11',
      weightLog: [{ date: '2026-10-20', kg: 76.2 }],
    }, true)
  })
  afterEach(() => { vi.useRealTimers(); cleanup() })

  it('mostra i dati generali coi loro numeri, e l’età dalla data di nascita', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-23T10:00:00'))
    // L'età salvata è vecchia di un compleanno: conta la data di nascita.
    useJarvisStore.setState({ userAge: 28 })
    monta()
    expect(screen.getByText('76,2')).toBeInTheDocument()
    expect(screen.getByText('178')).toBeInTheDocument()
    expect(screen.getByText('29')).toBeInTheDocument()
    expect(screen.getByText('Uomo')).toBeInTheDocument()
    expect(screen.getByText('11/08/1997')).toBeInTheDocument()
  })

  it('«Registra» sta accanto al campo, si accende solo con un peso, e registra la pesata', async () => {
    const user = userEvent.setup()
    monta()
    const campo = screen.getByLabelText('Peso di oggi in kg')
    const registra = screen.getByRole('button', { name: 'Registra' })
    // Stessa riga: il tasto e il riquadro del campo sono fratelli.
    expect(registra.parentElement).toContainElement(campo)
    expect(registra).toBeDisabled()
    expect(screen.getByText('Con una seconda pesata qui compare la direzione.')).toBeInTheDocument()

    await user.type(campo, '75.8')
    expect(registra).toBeEnabled()
    await user.click(registra)

    const st = useJarvisStore.getState()
    expect(st.userWeight).toBe(75.8)
    expect(st.weightLog).toHaveLength(2)
    // Con due pesate il posto tratteggiato lascia il posto al grafico.
    expect(screen.queryByText('Con una seconda pesata qui compare la direzione.')).not.toBeInTheDocument()
  })

  it('in testata non c’è «Salva»: la freccia salva il nome e chiude', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    monta(onClose)
    expect(screen.queryByRole('button', { name: 'Salva' })).not.toBeInTheDocument()
    const nome = screen.getByLabelText('Nome utente')
    await user.clear(nome)
    await user.type(nome, 'Matteo')
    await user.click(screen.getByRole('button', { name: 'Chiudi il profilo' }))
    expect(useJarvisStore.getState().userName).toBe('Matteo')
    expect(onClose).toHaveBeenCalled()
  })
})

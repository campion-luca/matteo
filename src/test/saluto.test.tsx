import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SalutoHeader } from '@/components/ui/SalutoHeader'
import { FirstSetup } from '@/features/auth/FirstSetup'
import { SettimanaStrip } from '@/features/dashboard/SettimanaStrip'
import { useJarvisStore, EMPTY_STATE, NOME_MAX } from '@/store/useJarvisStore'
import { todayISO } from '@/lib/isoDate'

// La testata della home: il saluto e la settimana.
//
// Il saluto su telefono sta su due righe — la formula, il nome — qualunque sia
// l'ora e comunque ci si chiami. Che le righe ci STIANO lo decide il CSS sulla
// larghezza vera (`.j-saluto`, verificato nel browser): qui si controlla quello
// che gli passa il componente, cioè quali sono le due righe e quanto è lunga la
// più lunga.

const azioni = () => ({ onSearch: vi.fn(), onUser: vi.fn(), onSettings: vi.fn() })
const alle = (ora: number, giorno = new Date(2026, 9, 8)) => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(giorno.getFullYear(), giorno.getMonth(), giorno.getDate(), ora, 30))
}
const conNome = (userName: string) => useJarvisStore.setState({ ...EMPTY_STATE, userName }, true)
// Quanti `em` il componente dice che occupa la riga più lunga: 0,57 a carattere.
const larghezza = (c: HTMLElement) => Number(c.querySelector<HTMLElement>('.j-saluto')!.style.getPropertyValue('--saluto-em'))

beforeEach(() => { localStorage.clear() })
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('il saluto in testata', () => {
  it('su telefono sta su due righe: la formula, poi il nome', () => {
    alle(15)
    conNome('Luca')
    const { container } = render(<SalutoHeader {...azioni()}/>)
    const righe = [...container.querySelectorAll('.j-saluto-riga')].map(r => r.textContent)
    expect(righe).toEqual(['Buon pomeriggio,', 'Luca.'])
  })

  it('il corpo si regola sulla riga più lunga: la formula, o il nome', () => {
    // «Buon pomeriggio,» sono sedici caratteri, «Luca.» cinque.
    alle(15)
    conNome('Luca')
    expect(larghezza(render(<SalutoHeader {...azioni()}/>).container)).toBeCloseTo(0.57 * 16)
    cleanup()
    // La mattina la formula è corta: con un nome lungo comanda il nome.
    alle(9)
    conNome('Maria Vittoria')
    expect(larghezza(render(<SalutoHeader {...azioni()}/>).container)).toBeCloseTo(0.57 * 15)
  })

  it('un nome oltre il limite, salvato prima che ci fosse, non rimpicciolisce tutto: conta fino al limite', () => {
    alle(9)
    conNome('Giovanni Battista Maria')
    const { container } = render(<SalutoHeader {...azioni()}/>)
    // Il nome c'è per intero — a tagliarlo coi puntini è la riga — ma nel conto
    // vale quanto il più lungo che oggi si possa scrivere.
    expect(container.querySelectorAll('.j-saluto-riga')[1]).toHaveTextContent('Giovanni Battista Maria.')
    expect(larghezza(container)).toBeCloseTo(0.57 * (NOME_MAX + 1))
  })

  it('la formula del 2 giugno è troppo lunga per una riga: va a capo lei, non il nome', () => {
    alle(10, new Date(2027, 5, 2))
    conNome('Luca')
    const { container } = render(<SalutoHeader {...azioni()}/>)
    expect(screen.getByText('Buona Festa della Repubblica,')).not.toHaveClass('j-saluto-riga')
    expect(container.querySelectorAll('.j-saluto-riga')).toHaveLength(1)
    // E non stringe il corpo oltre quello che serve a una formula normale.
    expect(larghezza(container)).toBeCloseTo(0.57 * 20)
  })

  it('senza nome resta una frase sola', () => {
    alle(9)
    conNome('')
    const { container } = render(<SalutoHeader {...azioni()}/>)
    expect(screen.getByText('Buongiorno.')).toBeInTheDocument()
    expect(container.querySelector('.j-saluto')).toBeNull()
  })
})

describe('il nome ha una lunghezza massima', () => {
  it('nel questionario del primo accesso non si scrive oltre il limite', async () => {
    useJarvisStore.setState({ ...EMPTY_STATE }, true)
    const user = userEvent.setup()
    render(<FirstSetup onDone={vi.fn()}/>)
    const campo = screen.getByPlaceholderText('Il tuo nome')
    await user.type(campo, 'Massimiliano Alessandro Maria')
    expect(campo).toHaveValue('Massimiliano Alessandro Maria'.slice(0, NOME_MAX))
    // Ci stanno i nomi lunghi veri: dodici lettere, e un doppio nome.
    expect(NOME_MAX).toBeGreaterThanOrEqual('Maria Vittoria'.length)
  })
})

describe('la settimana in testata', () => {
  const oggiAllenato = [{ id: 'p1', n: 'Panca piana', muscle: 'Petto', current: { kg: 60, reps: 10, sets_n: 3 }, history: [{ d: 'W', date: todayISO(), kg: 60, reps: 10, sets_n: 3 }] }]

  it('senza allenamenti nessun giorno è segnato', () => {
    useJarvisStore.setState({ ...EMPTY_STATE }, true)
    const { container } = render(<SettimanaStrip/>)
    expect(container.querySelectorAll('[data-allenato]')).toHaveLength(0)
  })

  it('il giorno in cui ci si è allenati è pieno, nel verde del "fatto"', () => {
    useJarvisStore.setState({ ...EMPTY_STATE, palestraExercises: oggiAllenato }, true)
    const { container } = render(<SettimanaStrip/>)
    const pieni = container.querySelectorAll<HTMLElement>('[data-allenato]')
    expect(pieni).toHaveLength(1)
    expect(pieni[0]).toHaveTextContent(String(new Date().getDate()))
    expect(pieni[0].style.background).toContain('--fatto-bg')
    // È oggi: l'anello d'accent attorno lo dice ancora, anche se il fondo è verde.
    expect(pieni[0].style.outline).toContain('--j-accent')
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Il form di accesso (4 nov 2026): «Accedi | Registrati» in cima, le etichette
// sopra i campi, la conferma della password in registrazione, e gli errori
// sotto il campo che li causa.

const signUp = vi.fn()
const signInWithPassword = vi.fn()
vi.mock('@/lib/supabase', async importOriginal => ({
  ...(await importOriginal<object>()),
  supabase: { auth: { signUp: (...a: unknown[]) => signUp(...a), signInWithPassword: (...a: unknown[]) => signInWithPassword(...a) } },
}))

const { JarvisLogin } = await import('@/features/auth/JarvisLogin')

beforeEach(() => {
  localStorage.clear()
  signUp.mockReset()
  signInWithPassword.mockReset()
})
afterEach(cleanup)

describe('il form di accesso', () => {
  it('in cima si sceglie fra accedere e registrarsi', async () => {
    const user = userEvent.setup()
    render(<JarvisLogin onAuth={vi.fn()}/>)
    expect(screen.getByRole('tab', { name: 'Accedi' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Indirizzo email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.queryByLabelText('Conferma password')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Registrati' }))
    expect(screen.getByLabelText('Conferma password')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByText('Almeno 6 caratteri')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crea account' })).toBeInTheDocument()
  })

  it('una password corta si dice sotto il campo, prima di chiedere al server', async () => {
    const user = userEvent.setup()
    render(<JarvisLogin onAuth={vi.fn()}/>)
    await user.click(screen.getByRole('tab', { name: 'Registrati' }))
    await user.type(screen.getByLabelText('Indirizzo email'), 'luca@esempio.it')
    await user.type(screen.getByLabelText('Password'), '123')
    await user.type(screen.getByLabelText('Conferma password'), '123')
    await user.click(screen.getByRole('button', { name: 'Crea account' }))
    expect(screen.getByRole('alert')).toHaveTextContent('La password deve avere almeno 6 caratteri.')
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true')
    expect(signUp).not.toHaveBeenCalled()
  })

  it('due password diverse si dicono sotto la conferma', async () => {
    const user = userEvent.setup()
    render(<JarvisLogin onAuth={vi.fn()}/>)
    await user.click(screen.getByRole('tab', { name: 'Registrati' }))
    await user.type(screen.getByLabelText('Indirizzo email'), 'luca@esempio.it')
    await user.type(screen.getByLabelText('Password'), 'segreta1')
    await user.type(screen.getByLabelText('Conferma password'), 'segreta2')
    await user.click(screen.getByRole('button', { name: 'Crea account' }))
    expect(screen.getByLabelText('Conferma password')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Le password non coincidono.')
    expect(signUp).not.toHaveBeenCalled()
  })

  it('un’email già registrata si dice sotto l’email; credenziali sbagliate in fondo', async () => {
    const user = userEvent.setup()
    signUp.mockResolvedValue({ data: {}, error: { message: 'User already registered' } })
    render(<JarvisLogin onAuth={vi.fn()}/>)
    await user.click(screen.getByRole('tab', { name: 'Registrati' }))
    await user.type(screen.getByLabelText('Indirizzo email'), 'luca@esempio.it')
    await user.type(screen.getByLabelText('Password'), 'segreta1')
    await user.type(screen.getByLabelText('Conferma password'), 'segreta1')
    await user.click(screen.getByRole('button', { name: 'Crea account' }))
    expect(await screen.findByText('Esiste già un account con questa email.')).toBeInTheDocument()
    expect(screen.getByLabelText('Indirizzo email')).toHaveAttribute('aria-invalid', 'true')

    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    await user.click(screen.getByRole('tab', { name: 'Accedi' }))
    await user.type(screen.getByLabelText('Password'), 'sbagliata')
    await user.click(screen.getByRole('button', { name: 'Entra' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email o password non corretti.')
    expect(screen.getByLabelText('Indirizzo email')).not.toHaveAttribute('aria-invalid')
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JarvisGym } from '@/features/gym/JarvisGym'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'
import type { HyroxExercise } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { HYROX_ATTIVO, hyroxVisibili } from '@/features/gym/hyroxAttivo'
import { todayISO } from '@/lib/isoDate'

// Hyrox è spento (ott 2026): l'app è solo palestra. Spento vuol dire che non
// compare, non che i dati spariscono — le sessioni restano nello store, e
// riaccendendo l'interruttore tornano.

const sessione: HyroxExercise = {
  id: 'hx_ski', n: 'SkiErg', unit: 'm', target: 1000,
  history: [{ d: 'W41', date: todayISO(), sec: 260, units: 1000 }],
}

beforeEach(() => {
  useJarvisStore.setState({ ...EMPTY_STATE, userName: 'Luca', hyroxExercises: [sessione] }, true)
  localStorage.clear()
})
afterEach(cleanup)

const monta = () => render(
  <ConfirmDeleteProvider>
    <JarvisGym onOpenCoach={vi.fn()} onOpenProfile={vi.fn()} onOpenUser={vi.fn()}/>
  </ConfirmDeleteProvider>,
)

describe('Hyrox spento', () => {
  it('l’interruttore è spento', () => {
    expect(HYROX_ATTIVO).toBe(false)
  })

  it('in home non c’è «Pesi | Hyrox», e il menù dei pesi resta', () => {
    monta()
    expect(screen.queryByRole('button', { name: 'Hyrox' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pesi' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Schede' })).toBeInTheDocument()
  })

  it('una sessione Hyrox di oggi non conta come giorno allenato', () => {
    expect(hyroxVisibili(useJarvisStore.getState().hyroxExercises)).toEqual([])
    monta()
    // La settimana in cima: nessun giorno ha il puntino dei giorni allenati.
    const striscia = screen.getByRole('button', { name: 'Apri il calendario degli allenamenti' })
    const accesi = [...striscia.querySelectorAll<HTMLElement>('span[aria-hidden]')].filter(e => e.style.background.includes('--j-accent'))
    expect(accesi).toHaveLength(0)
  })

  it('la ricerca non trova le stazioni', async () => {
    const user = userEvent.setup()
    monta()
    await user.click(screen.getByRole('button', { name: /cerca/i }))
    await user.type(screen.getByRole('textbox'), 'ski')
    expect(screen.queryByText('SkiErg')).not.toBeInTheDocument()
  })

  it('i dati restano dove sono', () => {
    monta()
    expect(useJarvisStore.getState().hyroxExercises).toEqual([sessione])
  })
})

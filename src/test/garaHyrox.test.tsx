import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JarvisGym } from '@/features/gym/JarvisGym'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'
import type { HyroxExercise } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { cifreInTempo, cifreInSec, secInCifre } from '@/features/gym/hyroxStima'
import { RACE_STATIONS } from '@/features/gym/gymModel'
import { todayISO } from '@/lib/isoDate'

// Hyrox si apre sulla gara: il tempo stimato, da dove viene, e il + per
// registrare una gara o una simulazione intera, Roxzone compresa.

beforeEach(() => {
  useJarvisStore.setState({ ...EMPTY_STATE, userName: 'Luca' }, true)
  localStorage.clear()
})
afterEach(cleanup)

async function apriHyrox() {
  const user = userEvent.setup()
  render(
    <ConfirmDeleteProvider>
      <JarvisGym onOpenCoach={vi.fn()} onOpenProfile={vi.fn()} onOpenUser={vi.fn()}/>
    </ConfirmDeleteProvider>,
  )
  await user.click(screen.getByRole('button', { name: 'Hyrox' }))
  return user
}

describe('il campo tempo', () => {
  it('si scrivono solo le cifre, i due punti li mette lui', () => {
    expect(cifreInTempo('5')).toBe('0:05')
    expect(cifreInTempo('425')).toBe('4:25')
    expect(cifreInTempo('4040')).toBe('40:40')
    expect(cifreInTempo('11500')).toBe('1:15:00')
    expect(cifreInSec('425')).toBe(265)
    expect(cifreInSec('11500')).toBe(4500)
    expect(cifreInSec('475')).toBeNull()        // 4:75 non è un tempo
    expect(cifreInSec('')).toBe(0)
  })

  it('riaprendo una gara i tempi tornano cifre', () => {
    expect(secInCifre(265)).toBe('425')
    expect(secInCifre(4500)).toBe('11500')
    expect(cifreInSec(secInCifre(2440))).toBe(2440)
  })
})

describe('la gara in Hyrox', () => {
  it('Hyrox si apre sulla gara, e Gara viene prima di Esercizi', async () => {
    await apriHyrox()
    const tabs = screen.getAllByRole('button').map(b => b.textContent)
    expect(tabs.indexOf('Gara')).toBeLessThan(tabs.indexOf('Esercizi'))
    expect(screen.getByText('Tempo gara stimato')).toBeInTheDocument()
    expect(screen.getByText('Stazioni · PB')).toBeInTheDocument()
  })

  it('una gara registrata col + entra nella stima, con la sua Roxzone', async () => {
    const user = await apriHyrox()
    await user.click(screen.getAllByRole('button', { name: 'Registra una gara o una simulazione' })[0])

    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Corsa'), '4000')
    for (const r of RACE_STATIONS) await user.type(within(dialog).getByLabelText(r.n), '400')
    await user.type(within(dialog).getByLabelText('Roxzone'), '600')
    expect(within(dialog).getByLabelText('Corsa')).toHaveValue('40:00')
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }))

    const gare = useJarvisStore.getState().hyroxGare ?? []
    expect(gare).toHaveLength(1)
    expect(gare[0]).toMatchObject({ tipo: 'gara', categoria: 'double', corsa: 2400, roxzone: 360, date: todayISO() })
    // 40:00 + 8 × 4:00 + 6:00
    expect(screen.getAllByText('1:18:00').length).toBeGreaterThan(0)
  })

  it('una giornata registrata a metà si può riportare alla distanza intera', async () => {
    const data = '2026-09-20'
    const mezze: HyroxExercise[] = RACE_STATIONS.slice(0, 6).map(r => ({
      ...r, history: [{ d: 'W38', date: data, sec: 270, units: r.target / 2 }],
    }))
    useJarvisStore.setState({ hyroxExercises: mezze })
    const user = await apriHyrox()

    expect(screen.getByText('Da controllare')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Erano intere' }))
    const dopo = useJarvisStore.getState().hyroxExercises
    expect(dopo.every(e => e.history[0].units === e.target)).toBe(true)
    expect(screen.queryByText('Da controllare')).not.toBeInTheDocument()
  })
})

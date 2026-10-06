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

// Hyrox nell'app è spento (vedi hyroxAttivo). Qui lo si riaccende: finché il suo
// codice resta nel repo, le sue prove devono continuare a dire se funziona.
vi.mock('@/features/gym/hyroxAttivo', () => ({
  HYROX_ATTIVO: true,
  hyroxVisibili: (lista?: unknown[]) => lista ?? [],
}))

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

// L'elenco degli esercizi è diviso come in palestra: quello che si registra
// allenandosi da una parte, i tempi delle gare registrate dall'altra. In cima
// c'era "1 km | 500 m"; la distanza adesso sta scritta sulla riga.
describe('gli esercizi: sessioni o gare', () => {
  const ski = RACE_STATIONS.find(r => r.id === 'hx_ski')!

  async function apriEsercizi() {
    const user = await apriHyrox()
    await user.click(screen.getByRole('button', { name: 'Esercizi' }))
    return user
  }

  it('le sessioni mostrano l’ultima con la sua distanza, e il trend sulla stessa distanza', async () => {
    useJarvisStore.setState({
      hyroxExercises: [{ ...ski, history: [
        { d: 'W38', date: '2026-09-15', sec: 270, units: 1000 },
        { d: 'W39', date: '2026-09-22', sec: 140, units: 500 },
        { d: 'W40', date: '2026-09-29', sec: 130, units: 500 },
      ] }],
    })
    await apriEsercizi()

    expect(screen.getByRole('button', { name: 'Sessioni' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: '500 m' })).not.toBeInTheDocument()
    // L'ultima è da 500 m in 2:10: lo dice la riga, e il confronto è col 2:20
    // di prima sui 500 m — non col 4:30 sui 1000, che darebbe "▼ 140s".
    expect(screen.getByText('500 m')).toBeInTheDocument()
    expect(screen.getByText('2:10')).toBeInTheDocument()
    expect(screen.getByText('▼ 10s')).toBeInTheDocument()
  })

  it('aprendo una stazione si arriva sulla distanza dell’ultima sessione', async () => {
    useJarvisStore.setState({
      hyroxExercises: [{ ...ski, history: [
        { d: 'W38', date: '2026-09-15', sec: 270, units: 1000 },
        { d: 'W40', date: '2026-09-29', sec: 130, units: 500 },
      ] }],
    })
    const user = await apriEsercizi()
    await user.click(screen.getByText('SkiErg'))

    // La pagina mostra una distanza alla volta: quella vista sulla card.
    expect(screen.getByRole('button', { name: '500 m' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('2:10 · 500 m')).toBeInTheDocument()
  })

  it('le gare mostrano i tempi delle gare registrate, non le sessioni', async () => {
    useJarvisStore.setState({
      hyroxExercises: [{ ...ski, history: [{ d: 'W40', date: '2026-09-29', sec: 130, units: 500 }] }],
      hyroxGare: [
        { id: 'g1', date: '2026-05-10', tipo: 'gara', categoria: 'double', corsa: 2720, stazioni: { hx_ski: 262 }, roxzone: 420 },
        { id: 'g2', date: '2026-09-12', tipo: 'simulazione', categoria: 'singolo', corsa: 2640, stazioni: { hx_ski: 250 }, roxzone: 400 },
      ],
    })
    const user = await apriEsercizi()
    await user.click(screen.getByRole('button', { name: 'Gare' }))

    // La corsa di gara è la somma degli 8 km, col passo che la fa.
    expect(screen.getByText('44:00')).toBeInTheDocument()
    expect(screen.getByText('5:30/km')).toBeInTheDocument()
    // Tutti i tempi della stazione, e il migliore segnato.
    expect(screen.getByText('4:10')).toBeInTheDocument()
    expect(screen.getByText('4:22')).toBeInTheDocument()
    expect(screen.getAllByText('PB')).toHaveLength(2)   // corsa e SkiErg
    // Una stazione mai fatta in gara lo dice, invece di mostrare una sessione.
    expect(screen.getAllByText('Nessun tempo in gara').length).toBe(RACE_STATIONS.length - 1)
    expect(screen.queryByText('2:10')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sessione' })).not.toBeInTheDocument()
  })

  it('senza gare registrate la vista Gare invita a registrarne una', async () => {
    const user = await apriEsercizi()
    await user.click(screen.getByRole('button', { name: 'Gare' }))
    await user.click(screen.getByRole('button', { name: /Registra una gara o una simulazione/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

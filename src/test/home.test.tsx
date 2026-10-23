import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JarvisGym } from '@/features/gym/JarvisGym'
import { schedaDiOggi, serieDellaScheda } from '@/features/gym/anteprimaScheda'
import { useJarvisStore, EMPTY_STATE, type GymScheda, type PalestraExercise } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { localISO } from '@/lib/isoDate'

// La home dopo il rebranding (ott 2026): tre card — Coaching, Esercizi,
// Statistiche — e sotto la scheda di oggi, col tasto per cominciare. I gruppi
// muscolari, che stavano lì, si aprono dalla card "Esercizi".

const OGGI = '2026-10-23'
const scheda = (id: string, title: string, o: Partial<GymScheda> = {}): GymScheda => ({
  id, title, createdAt: '2026-09-01', updatedAt: '2026-09-01',
  exercises: [{ id: `${id}-1`, name: 'Panca piana', sets: 4, reps: '8', muscle: 'Petto' }, { id: `${id}-2`, name: 'Croci', sets: 3, reps: '12', muscle: 'Petto' }],
  ...o,
})
/** Un esercizio con un'alzata fatta il giorno `data` dentro la scheda `id`. */
const fatta = (id: string, data: string): PalestraExercise => ({
  id: `px-${id}-${data}`, n: `Es ${id}`, muscle: 'Petto', current: { kg: 60, reps: 8, sets_n: 3 },
  history: [{ d: 'W', date: data, kg: 60, reps: 8, sets_n: 3, scheda: { id, nome: id } }],
})

describe('la scheda di oggi', () => {
  const A = scheda('a', 'A'), B = scheda('b', 'B'), C = scheda('c', 'C')

  it('è la prossima del giro: quella che non si fa da più tempo', () => {
    const r = schedaDiOggi([A, B, C], [fatta('a', '2026-10-21'), fatta('b', '2026-10-15'), fatta('c', '2026-10-19')], OGGI)
    expect(r?.scheda.id).toBe('b')
    expect(r?.giorniFa).toBe(8)
    expect(r?.fattaOggi).toBe(false)
  })

  it('una mai fatta viene prima, nell’ordine dell’elenco', () => {
    const r = schedaDiOggi([A, B, C], [fatta('a', '2026-10-01')], OGGI)
    expect(r?.scheda.id).toBe('b')
    expect(r?.giorniFa).toBeNull()
  })

  it('fatta oggi resta lei, segnata come fatta', () => {
    const r = schedaDiOggi([A, B], [fatta('a', OGGI), fatta('b', '2026-10-01')], OGGI)
    expect(r).toMatchObject({ scheda: { id: 'a' }, fattaOggi: true })
  })

  it('le bozze e le schede vuote non contano', () => {
    const bozza = scheda('d', 'Bozza', { draft: true })
    const vuota = scheda('e', 'Vuota', { exercises: [{ id: 'x', name: '  ', sets: 3, reps: '8' }] })
    expect(schedaDiOggi([bozza, vuota], [], OGGI)).toBeNull()
  })

  it('le serie sono la somma delle righe', () => {
    expect(serieDellaScheda(A)).toBe(7)
  })
})

describe('la home', () => {
  beforeEach(() => {
    useJarvisStore.setState({ ...EMPTY_STATE, userName: 'Luca' }, true)
    localStorage.clear()
  })
  afterEach(cleanup)

  const monta = () => render(
    <ConfirmDeleteProvider>
      <JarvisGym onOpenCoach={vi.fn()} onOpenProfile={vi.fn()} onOpenUser={vi.fn()}/>
    </ConfirmDeleteProvider>,
  )

  it('ha Coaching, Esercizi e Statistiche, e i gruppi muscolari non stanno più qui', () => {
    monta()
    for (const nome of ['Coaching', 'Esercizi', 'Statistiche']) expect(screen.getByRole('button', { name: nome })).toBeInTheDocument()
    expect(screen.queryByText(/Gruppi muscolari/)).not.toBeInTheDocument()
  })

  it('«Esercizi» apre i gruppi muscolari, e la freccia riporta alla home', async () => {
    const user = userEvent.setup()
    monta()
    await user.click(screen.getByRole('button', { name: 'Esercizi' }))
    expect(screen.getByText('Esercizi', { selector: '.j-page-title' })).toBeInTheDocument()
    expect(screen.getByText(/Gruppi muscolari/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Indietro' }))
    expect(screen.getByRole('button', { name: 'Esercizi' })).toBeInTheDocument()
  })

  it('senza schede invita a scriverne una', () => {
    monta()
    expect(screen.getByText(/Nessuna scheda/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crea una scheda' })).toBeInTheDocument()
  })

  it('mostra la scheda di oggi, coi suoi numeri, e «Inizia allenamento» entra nell’allenamento', async () => {
    const user = userEvent.setup()
    const ieri = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return localISO(d) })()
    useJarvisStore.setState({
      gymSchede: [scheda('a', 'Lunedì'), scheda('b', 'Giovedì')],
      palestraExercises: [fatta('a', ieri)],
    })
    monta()
    // Giovedì non è mai stata fatta: tocca a lei.
    expect(screen.getByText('Oggi · Giovedì')).toBeInTheDocument()
    expect(screen.getByText('mai fatta', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Petto')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Inizia allenamento/ }))
    // Dritti nell'allenamento della scheda, non nel suo dettaglio.
    expect(await screen.findByRole('button', { name: /termina allenamento/i })).toBeInTheDocument()
  })
})

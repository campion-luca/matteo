import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useJarvisStore, EMPTY_STATE, type GymScheda, type PalestraExercise, type PalestraHistoryEntry } from '@/store/useJarvisStore'
import { recordFatti, sessioniFatte, settimaneDiFilaRecord, variazionePeso, volumeSettimana } from '@/features/desktop/numeriOggi'
import { useNavDesktop } from '@/features/desktop/navDesktop'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { localISO } from '@/lib/isoDate'

// Il desktop come gestionale (ott 2026): la barra laterale con le sezioni, e la
// pagina «Oggi» coi suoi numeri. Qui i conti, e il giro fra le sezioni.

vi.mock('@/hooks/useIsDesktop', () => ({ useIsDesktop: () => true }))
// Gli allievi si leggono dalla rete: qui non ce ne sono.
vi.mock('@/features/desktop/allieviDesktop', async orig => ({ ...(await orig() as object), caricaAllievi: async () => {} }))

const { JarvisGym } = await import('@/features/gym/JarvisGym')
const { BarraLaterale } = await import('@/features/desktop/BarraLaterale')

const alzata = (date: string, o: Partial<PalestraHistoryEntry> = {}): PalestraHistoryEntry =>
  ({ d: 'W', date, kg: 60, reps: 8, sets_n: 3, ...o })
const esercizio = (id: string, history: PalestraHistoryEntry[], o: Partial<PalestraExercise> = {}): PalestraExercise =>
  ({ id, n: id, muscle: 'Petto', current: { kg: 60, reps: 8, sets_n: 3 }, history, ...o })

describe('i record', () => {
  it('la prima alzata non è un record, pareggiare non è battere, superare sì', () => {
    const ex = esercizio('panca', [alzata('2026-10-01'), alzata('2026-10-08'), alzata('2026-10-15', { kg: 65 }), alzata('2026-10-22', { kg: 62.5 })])
    const r = recordFatti([ex], 0)
    expect(r.map(x => x.alzata.date)).toEqual(['2026-10-15'])
  })

  it('dal più recente, fra tutti gli esercizi', () => {
    const a = esercizio('a', [alzata('2026-10-01'), alzata('2026-10-05', { kg: 70 })])
    const b = esercizio('b', [alzata('2026-10-02'), alzata('2026-10-20', { kg: 70 })])
    expect(recordFatti([a, b], 0).map(x => x.esercizio.id)).toEqual(['b', 'a'])
  })
})

describe('gli allenamenti fatti', () => {
  const sc = (id: string) => ({ id, nome: id.toUpperCase() })
  const palestra = [
    esercizio('panca', [alzata('2026-10-20', { scheda: sc('a'), durataSec: 3600 }), alzata('2026-10-22', { scheda: sc('b'), kg: 70, durataSec: 3000 })]),
    esercizio('croci', [alzata('2026-10-20', { scheda: sc('a'), sets_n: 4, durataSec: 3600 }), alzata('2026-10-20', { kg: 20, sets_n: 2 })]),
  ]

  it('una scheda per giorno è un allenamento, e le alzate a parte un altro', () => {
    const s = sessioniFatte(palestra, 0)
    expect(s.map(x => [x.data, x.scheda?.id ?? null])).toEqual([['2026-10-22', 'b'], ['2026-10-20', null], ['2026-10-20', 'a']])
    const a = s.find(x => x.scheda?.id === 'a')!
    expect(a).toMatchObject({ esercizi: 2, serie: 7, durataSec: 3600, volume: 60 * 8 * 3 + 60 * 8 * 4 })
  })

  it('segna i record del giorno sull’allenamento in cui sono stati fatti', () => {
    const s = sessioniFatte(palestra, 0)
    expect(s.find(x => x.scheda?.id === 'b')?.record).toBe(1)
    expect(s.find(x => x.scheda?.id === 'a')?.record).toBe(0)
  })

  it('il volume della settimana si confronta solo con le settimane da quando ci si allena', () => {
    const s = sessioniFatte([esercizio('x', [alzata('2026-10-13', { kg: 100, reps: 10, sets_n: 1 }), alzata('2026-10-26', { kg: 50, reps: 10, sets_n: 1 })])], 0)
    // Mercoledì 28: la settimana del 26 ha 500, la media è su due settimane (1000 e 0).
    expect(volumeSettimana(s, '2026-10-28')).toEqual({ questa: 500, media: 500 })
    // Alla prima settimana non c'è un prima.
    expect(volumeSettimana(s.slice(0, 0), '2026-10-28')).toEqual({ questa: 0, media: null })
  })
})

describe('la costanza e il peso', () => {
  it('il record di settimane di fila è la serie più lunga, anche se è finita', () => {
    expect(settimaneDiFilaRecord(['2026-09-01', '2026-09-08', '2026-09-15', '2026-10-06', '2026-10-13'])).toBe(3)
    expect(settimaneDiFilaRecord([])).toBe(0)
  })

  it('il peso cambia dall’ultima pesata a quella prima; con una sola non c’è un prima', () => {
    expect(variazionePeso([{ date: '2026-10-20', kg: 76.2 }])).toBeNull()
    expect(variazionePeso([{ date: '2026-10-25', kg: 75.8 }, { date: '2026-10-11', kg: 76.25 }])).toEqual({ delta: -0.5, da: '2026-10-11' })
  })
})

// ── Le sezioni ─────────────────────────────────────────────────

const ieri = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return localISO(d) })()
const scheda = (id: string, title: string, righe: Array<[string, string]>): GymScheda => ({
  id, title, createdAt: '2026-09-01', updatedAt: '2026-09-01',
  exercises: righe.map(([name, muscle], i) => ({ id: `${id}-${i}`, name, sets: 3, reps: '8', muscle })),
})

describe('il desktop', () => {
  beforeEach(() => {
    localStorage.clear()
    useNavDesktop.setState({ dove: { sezione: 'oggi' }, giro: 0 })
    useJarvisStore.setState({
      ...EMPTY_STATE, userName: 'Luca', userWeight: 80,
      gymSchede: [scheda('a', 'Push', [['Panca piana', 'Petto']]), scheda('b', 'Gambe', [['Squat', 'Gambe'], ['Leg curl', 'Gambe']])],
      palestraExercises: [
        esercizio('px-panca', [alzata('2026-10-01', { scheda: { id: 'a', nome: 'Push' } }), alzata(ieri, { kg: 70, scheda: { id: 'a', nome: 'Push' } })], { n: 'Panca piana' }),
        esercizio('px-squat', [alzata('2026-09-20', { kg: 100 })], { n: 'Squat', muscle: 'Gambe' }),
      ],
    }, true)
  })
  afterEach(cleanup)

  const monta = () => render(
    <ConfirmDeleteProvider>
      <BarraLaterale userId="io" onUtente={vi.fn()} onImpostazioni={vi.fn()}/>
      <JarvisGym onOpenCoach={vi.fn()} onOpenProfile={vi.fn()} onOpenUser={vi.fn()}/>
    </ConfirmDeleteProvider>,
  )

  it('«Oggi» saluta, propone la scheda del giro riga per riga e ha l’ultimo record', () => {
    monta()
    expect(screen.getByRole('heading', { name: 'Ciao, Luca' })).toBeInTheDocument()
    // Push è stata fatta ieri: tocca a Gambe, con le sue due righe.
    expect(screen.getByText('Oggi · Gambe')).toBeInTheDocument()
    const tabella = screen.getAllByRole('table')[0]
    expect(within(tabella).getByRole('button', { name: 'Squat' })).toBeInTheDocument()
    expect(within(tabella).getByText('Leg curl')).toBeInTheDocument()
    expect(within(tabella).getByText('mai registrato')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^Record\s*·\s*1$/ })).toBeInTheDocument()
  })

  it('la barra porta alle sezioni e dice dov’è', async () => {
    const user = userEvent.setup()
    monta()
    const barra = screen.getByRole('navigation', { name: 'Sezioni' })
    expect(within(barra).getByRole('button', { name: /Oggi/ })).toHaveAttribute('aria-current', 'page')
    expect(within(barra).getByRole('button', { name: /Schede/ })).toHaveTextContent('2')
    await user.click(within(barra).getByRole('button', { name: 'Statistiche' }))
    expect(useNavDesktop.getState().dove.sezione).toBe('statistiche')
    expect(screen.getByText('Statistiche', { selector: '.j-page-title' })).toBeInTheDocument()
    expect(within(barra).getByRole('button', { name: 'Statistiche' })).toHaveAttribute('aria-current', 'page')
  })

  it('una scheda di «Oggi» si apre nella sezione Schede, e «Nuova scheda» apre il modulo', async () => {
    const user = userEvent.setup()
    monta()
    await user.click(screen.getByRole('button', { name: /N° 01.*Push/ }))
    expect(useNavDesktop.getState().dove).toMatchObject({ sezione: 'schede', apri: 'a' })
    expect(await screen.findByText('Push', { selector: '.j-page-title' })).toBeInTheDocument()

    await user.click(within(screen.getByRole('navigation', { name: 'Sezioni' })).getByRole('button', { name: /Oggi/ }))
    await user.click(screen.getAllByRole('button', { name: /Nuova scheda/ })[0])
    expect(useNavDesktop.getState().dove).toMatchObject({ sezione: 'schede', nuova: true })
    expect(await screen.findByPlaceholderText(/nome della scheda|Es\./i)).toBeInTheDocument()
  })

  it('una riga della scheda di oggi apre l’esercizio, e tornando a «Oggi» si richiude', async () => {
    const user = userEvent.setup()
    monta()
    await user.click(within(screen.getAllByRole('table')[0]).getByRole('button', { name: 'Squat' }))
    expect(useNavDesktop.getState().dove.sezione).toBe('esercizi')
    expect(await screen.findByRole('button', { name: /Nuova alzata/ })).toBeInTheDocument()
    await user.click(within(screen.getByRole('navigation', { name: 'Sezioni' })).getByRole('button', { name: /Oggi/ }))
    expect(screen.queryByRole('button', { name: /Nuova alzata/ })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Ciao, Luca' })).toBeInTheDocument()
  })

  it('⌘K apre la ricerca', () => {
    monta()
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(screen.getByRole('dialog', { name: 'Ricerca globale' })).toBeInTheDocument()
  })
})

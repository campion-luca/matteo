import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GymSchede, SchedaFormPage } from '@/features/gym/GymSchede'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'
import type { GymScheda, GymSchedaExercise, ProgressioneRiga, TecnicaRiga } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'
import { durataPrevista, RECUPERO_SEC } from '@/features/gym/anteprimaScheda'
import { conPreset, serieERipetizioni } from '@/features/gym/progressioneScheda'
import { serieConTecnica, tecnicaDi, tecnicaNuova } from '@/features/gym/tecniche'

// Le tecniche allenanti (2 nov 2026): drop set, myo reps, rest-pause ed
// eccentrica lenta. Si scelgono sulla riga della scheda, una per esercizio,
// sull'ultima serie o su tutte; in allenamento si legge cosa fare, e la serie
// toccata porta la sigla.

const riga = (o: Partial<GymSchedaExercise> & { name: string }): GymSchedaExercise =>
  ({ id: `r-${o.name}`, sets: 3, reps: '10', muscle: 'Petto', ...o })
const conRighe = (exercises: GymSchedaExercise[]): GymScheda =>
  ({ id: 'sc1', title: 'Spinta A', createdAt: '2026-09-01', updatedAt: '2026-09-01', exercises })

const drop: TecnicaRiga = { tipo: 'dropSet', serie: 'ultima' }

beforeEach(() => {
  useJarvisStore.setState({ ...EMPTY_STATE, userName: 'Luca' }, true)
  localStorage.clear()
})
afterEach(cleanup)

describe('le tecniche, a parte', () => {
  it('l’eccentrica parte su tutte le serie; le altre sull’ultima', () => {
    expect(tecnicaNuova('dropSet').serie).toBe('ultima')
    expect(tecnicaNuova('restPause').serie).toBe('ultima')
    // Il myo reps è già una serie d'attivazione e 3-4 mini-serie.
    expect(tecnicaNuova('myoReps').serie).toBe('ultima')
    expect(tecnicaNuova('eccentrica').serie).toBe('tutte')
  })

  it('le serie toccate: l’ultima, o tutte; senza tecnica nessuna', () => {
    expect(serieConTecnica(drop, 3)).toEqual([false, false, true])
    expect(serieConTecnica({ tipo: 'eccentrica', serie: 'tutte' }, 3)).toEqual([true, true, true])
    expect(serieConTecnica(undefined, 2)).toEqual([false, false])
  })

  it('il top set non la prende mai: a cedimento, il suo RIR non farebbe più salire il carico', () => {
    expect(serieConTecnica({ tipo: 'restPause', serie: 'tutte' }, 4, true)).toEqual([false, true, true, true])
    expect(serieConTecnica(drop, 4, true)).toEqual([false, false, false, true])
    // Col solo top set non c'è dove farla.
    expect(serieConTecnica(drop, 1, true)).toEqual([false])
  })

  it('una tecnica che questa versione non conosce non c’è', () => {
    expect(tecnicaDi({ tecnica: drop })).toEqual(drop)
    expect(tecnicaDi({ tecnica: { tipo: 'cluster', serie: 'ultima' } })).toBeUndefined()
    expect(tecnicaDi({ tecnica: { tipo: 'dropSet', serie: 'metà' } })).toBeUndefined()
    expect(tecnicaDi({})).toBeUndefined()
  })
})

describe('la durata stimata', () => {
  const base = durataPrevista(conRighe([riga({ name: 'Panca' })]))

  it('il drop set sull’ultima serie allunga solo quella: due scali col cambio del peso', () => {
    expect(durataPrevista(conRighe([riga({ name: 'Panca', tecnica: drop })])) - base).toBe(2 * (10 + 6 * 4))
  })

  it('su tutte le serie conta tre volte', () => {
    const tutte = durataPrevista(conRighe([riga({ name: 'Panca', tecnica: { tipo: 'restPause', serie: 'tutte' } })]))
    expect(tutte - base).toBe(3 * 2 * (15 + 3 * 4))
  })

  it('l’eccentrica lenta allunga ogni colpo, e il recupero resta quello', () => {
    const lenta = durataPrevista(conRighe([riga({ name: 'Panca', tecnica: { tipo: 'eccentrica', serie: 'tutte' } })]))
    expect(lenta - base).toBe(3 * 2 * 10)
    expect(base).toBe(3 * (40 + RECUPERO_SEC))
  })

  it('col top set la tecnica su tutte salta la prima serie', () => {
    const p = conPreset('multi')
    const top = riga({ name: 'Panca', ...serieERipetizioni(p), progressione: p })
    const senza = durataPrevista(conRighe([top]))
    const conRp = durataPrevista(conRighe([{ ...top, tecnica: { tipo: 'restPause', serie: 'tutte' } }]))
    expect(conRp - senza).toBe(3 * 2 * (15 + 3 * 4))
  })

  it('su una riga da 25 serie l’ultima è la venticinquesima, che la stima non conta', () => {
    // La stima si ferma a 20 serie; il drop set sta sulla 25ª, dove lo mette la card.
    const lunga = riga({ name: 'Panca', sets: 25 })
    expect(durataPrevista(conRighe([{ ...lunga, tecnica: drop }]))).toBe(durataPrevista(conRighe([lunga])))
  })

  it('una tecnica sconosciuta non entra nel conto, e il conto resta un numero', () => {
    const strana = { ...riga({ name: 'Panca' }), tecnica: { tipo: 'cluster', serie: 'ultima' } } as unknown as GymSchedaExercise
    expect(durataPrevista(conRighe([strana]))).toBe(base)
  })
})

describe('nel form della scheda', () => {
  const monta = (s: GymScheda) => {
    const onSave = vi.fn()
    render(
      <ConfirmDeleteProvider>
        <SchedaFormPage scheda={s} palestraExercises={[]} onCancel={vi.fn()} onSave={onSave} onSaveDraft={vi.fn()}/>
      </ConfirmDeleteProvider>,
    )
    return onSave
  }
  const salva = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getAllByRole('button', { name: /Salva modifiche/ })[0])

  it('si sceglie sulla riga: cosa si fa, su quali serie, e si salva con la scheda', async () => {
    const user = userEvent.setup()
    const onSave = monta(conRighe([riga({ name: 'Panca piana' })]))
    await user.click(screen.getByText('Panca piana').closest('button') as HTMLElement)

    await user.click(screen.getByRole('button', { name: 'Drop set' }))
    expect(screen.getByRole('button', { name: 'Drop set' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/scali subito il carico del 20-30%/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sull’ultima serie' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Su tutte le serie' }))
    await salva(user)
    expect(onSave.mock.calls[0][0].exercises[0].tecnica).toEqual({ tipo: 'dropSet', serie: 'tutte' })
  })

  it('cambiarla tiene una tecnica sola; ritoccarla la toglie', async () => {
    const user = userEvent.setup()
    const onSave = monta(conRighe([riga({ name: 'Panca piana', tecnica: drop })]))
    // Da compressa la riga dice che ce l'ha.
    expect(screen.getByText('Panca piana').closest('button')).toHaveTextContent('Drop set')
    await user.click(screen.getByText('Panca piana').closest('button') as HTMLElement)

    await user.click(screen.getByRole('button', { name: 'Eccentrica lenta' }))
    expect(screen.getByRole('button', { name: 'Drop set' })).toHaveAttribute('aria-pressed', 'false')
    // La nuova parte dalle serie dove va di solito.
    expect(screen.getByRole('button', { name: 'Su tutte le serie' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Eccentrica lenta' }))
    expect(screen.queryByRole('button', { name: 'Su tutte le serie' })).not.toBeInTheDocument()
    await salva(user)
    expect(onSave.mock.calls[0][0].exercises[0]).not.toHaveProperty('tecnica')
  })

  it('una tecnica che questa versione non conosce non si vede, e salvare non la cancella', async () => {
    const user = userEvent.setup()
    const nuova = { tipo: 'cluster', serie: 'ultima' } as unknown as TecnicaRiga
    const onSave = monta(conRighe([riga({ name: 'Panca piana', tecnica: nuova })]))
    await user.click(screen.getByText('Panca piana').closest('button') as HTMLElement)
    for (const nome of ['Drop set', 'Myo reps', 'Rest-pause', 'Eccentrica lenta']) {
      expect(screen.getByRole('button', { name: nome })).toHaveAttribute('aria-pressed', 'false')
    }
    await salva(user)
    expect(onSave.mock.calls[0][0].exercises[0].tecnica).toEqual(nuova)
  })

  it('su una riga col top set dice che va sulle back-off', async () => {
    const user = userEvent.setup()
    const p = conPreset('multi')
    monta({ ...conRighe([riga({ name: 'Panca piana', ...serieERipetizioni(p), progressione: p })]), conProgressioni: true })
    await user.click(screen.getByText('Panca piana').closest('button') as HTMLElement)
    await user.click(screen.getByRole('button', { name: 'Rest-pause' }))
    expect(screen.getByText('Sul top set no: è il suo RIR a dire se il carico sale. La tecnica va sulle back-off.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Su tutte le back-off' })).toBeInTheDocument()
  })
})

describe('nel dettaglio e in allenamento', () => {
  const apri = async (tecnica: TecnicaRiga) => {
    useJarvisStore.setState({ gymSchede: [conRighe([riga({ id: 'se1', name: 'Panca piana', tecnica })])] })
    const user = userEvent.setup()
    render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/><ConfirmModal/></ConfirmDeleteProvider>)
    await user.click(screen.getByText('Spinta A'))
    return user
  }

  it('il dettaglio la dice sotto l’esercizio', async () => {
    await apri(drop)
    expect(screen.getByText('Drop set · ultima serie')).toBeInTheDocument()
  })

  it('in allenamento si legge prima delle serie, e l’ultima serie porta la sigla', async () => {
    const user = await apri(drop)
    await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))

    const titolo = screen.getByText('Drop set · ultima serie')
    expect(screen.getByText(/scali subito il carico del 20-30%/)).toBeInTheDocument()
    expect(screen.getByText('Nei campi scrivi la serie prima degli scali.')).toBeInTheDocument()
    expect(titolo.compareDocumentPosition(screen.getByRole('button', { name: 'Serie 1' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Una sola sigla, sulla terza serie.
    expect(screen.getAllByText('DROP')).toHaveLength(1)
  })

  it('chi usa lo screen reader sente quale serie ha la tecnica', async () => {
    const user = await apri(drop)
    await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))
    expect(screen.getByRole('button', { name: 'Serie 3 · Drop set' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Serie 2' })).toBeInTheDocument()
  })

  it('su tutte le serie la sigla non si ripete: lo dice già il riquadro', async () => {
    const user = await apri({ tipo: 'eccentrica', serie: 'tutte' })
    await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))
    expect(screen.getByText('Eccentrica lenta · tutte le serie')).toBeInTheDocument()
    expect(screen.queryByText('ECC')).not.toBeInTheDocument()
  })

  it('una tecnica sconosciuta non fa cadere né il dettaglio né l’allenamento', async () => {
    const user = await apri({ tipo: 'cluster', serie: 'ultima' } as unknown as TecnicaRiga)
    expect(screen.getByText('Panca piana')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))
    expect(screen.getByRole('button', { name: 'Serie 3' })).toBeInTheDocument()
  })
})

describe('con il top set, in allenamento', () => {
  const p = conPreset('multi')
  const apri = async (tecnica: TecnicaRiga, progressione: ProgressioneRiga = p) => {
    useJarvisStore.setState({
      gymSchede: [{
        ...conRighe([riga({ id: 'r1', name: 'Panca piana', linkedExerciseId: 'px1', ...serieERipetizioni(progressione), progressione, tecnica })]),
        conProgressioni: true,
      }],
      palestraExercises: [{
        id: 'px1', n: 'Panca piana', muscle: 'Petto', current: { kg: 80, reps: 5, sets_n: 1 },
        history: [{ d: 'W', date: '2026-10-20', kg: 80, reps: 5, sets_n: 1 }],
      }],
    })
    const user = userEvent.setup()
    render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/><ConfirmModal/></ConfirmDeleteProvider>)
    await user.click(screen.getByText('Spinta A'))
    await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))
  }

  it('su tutte va sulle back-off: il top set resta senza sigla', async () => {
    await apri({ tipo: 'restPause', serie: 'tutte' })
    expect(screen.getByText('Rest-pause · tutte le back-off')).toBeInTheDocument()
    expect(screen.getAllByText('R-P')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Serie 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Serie 4 · Rest-pause' })).toBeInTheDocument()
  })

  it('col solo top set la tecnica non tocca niente, e non si mostra', async () => {
    const soloTop: ProgressioneRiga = { ...p, cfg: { ...p.cfg, backoffSets: 0 } } as ProgressioneRiga
    await apri(drop, soloTop)
    expect(screen.queryByText(/Drop set/)).not.toBeInTheDocument()
    expect(screen.queryByText('DROP')).not.toBeInTheDocument()
  })
})

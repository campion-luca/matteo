import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GymSchede, SchedaFormPage } from '@/features/gym/GymSchede'
import { useJarvisStore, EMPTY_STATE, type GymScheda, type PalestraExercise, type ProgressioneRiga } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'
import { localISO } from '@/lib/isoDate'
import { colpiPrevisti } from '@/features/gym/gymModel'
import {
  prescribeTopSet, progressTopSet, progressDouble, roundLoad, suggestRepRange, TOP_SET_DEFAULT, DOUBLE_PRESETS,
  type TopSetConfig, type DoubleProgressionConfig,
} from '@/features/gym/progression'
import {
  conPreset, conModello, serieERipetizioni, statoDiPartenza, oggiDellaRiga, rigaDiOggi, esitoEsercizio,
  rangeConsigliato, carichiValidi, leggiLista, leggiRir, chiaveProgressione,
} from '@/features/gym/progressioneScheda'

// Le progressioni delle schede nate dal 27 ott 2026: progression.ts (le regole,
// funzioni pure scritte dall'utente) e il ponte con l'app (progressioneScheda).

const giorniFa = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return localISO(d) }

// ── Le regole, come le descrive progression.ts ─────────────────
describe('progression.ts', () => {
  const panca: TopSetConfig = { ...TOP_SET_DEFAULT, steps: { kind: 'increment', step: 2.5, min: 20 } }

  it('top set: prescrive il top e le back-off al −10%', () => {
    expect(prescribeTopSet({ topWeight: 80, missCount: 0 }, panca)).toEqual([
      { label: 'top', weight: 80, reps: 5, rir: 2 },
      { label: 'backoff', weight: 72.5, reps: 8 },
      { label: 'backoff', weight: 72.5, reps: 8 },
      { label: 'backoff', weight: 72.5, reps: 8 },
    ])
  })

  it('top set: RIR sopra l’obiettivo sale, in obiettivo resta, colpi mancati scende', () => {
    const s = { topWeight: 80, missCount: 0 }
    expect(progressTopSet(s, { weight: 80, reps: 5, rir: 3 }, panca)).toMatchObject({ event: 'increase', state: { topWeight: 82.5 } })
    expect(progressTopSet(s, { weight: 80, reps: 5, rir: 2 }, panca)).toMatchObject({ event: 'hold', state: { topWeight: 80 } })
    expect(progressTopSet(s, { weight: 80, reps: 4, rir: 0 }, panca)).toMatchObject({ event: 'decrease', state: { topWeight: 77.5, missCount: 1 } })
  })

  it('top set senza RIR non sale: vale come l’obiettivo', () => {
    expect(progressTopSet({ topWeight: 80, missCount: 0 }, { weight: 80, reps: 5 }, panca).event).toBe('hold')
  })

  it('doppia: range completato sale al carico dopo, e il primo giro corto torna indietro con una serie in più', () => {
    const laterali: DoubleProgressionConfig = { ...DOUBLE_PRESETS.isolationSmall, steps: { kind: 'list', values: [4, 6, 8, 10, 12] } }
    const su = progressDouble({ weight: 8, sets: 3 }, [{ weight: 8, reps: 20 }, { weight: 8, reps: 20 }, { weight: 8, reps: 20 }], laterali)
    expect(su).toMatchObject({ event: 'increase', state: { weight: 10, sets: 3, previousWeight: 8 } })
    const giu = progressDouble(su.state, [{ weight: 10, reps: 11 }, { weight: 10, reps: 10 }, { weight: 10, reps: 9 }], laterali)
    expect(giu).toMatchObject({ event: 'add_set', state: { weight: 8, sets: 4 } })
  })

  it('roundLoad e suggestRepRange', () => {
    expect(roundLoad(9, { kind: 'list', values: [4, 6, 8, 10] })).toBe(8)
    expect(suggestRepRange(8, { kind: 'list', values: [8, 10] })).toEqual({ min: 12, max: 20 })
    expect(suggestRepRange(100, { kind: 'increment', step: 2.5 })).toEqual({ min: 6, max: 10 })
  })
})

// ── Il ponte con l'app ──────────────────────────────────────────
const esercizio = (history: PalestraExercise['history'], o: Partial<PalestraExercise> = {}): PalestraExercise => ({
  id: 'px1', n: 'Panca piana', muscle: 'Petto', current: { kg: 80, reps: 5, sets_n: 1 }, history, ...o,
})
const riga = (p = conPreset('multi')) => ({ id: 'r1', name: 'Panca piana', ...serieERipetizioni(p), muscle: 'Petto', linkedExerciseId: 'px1', progressione: p })

describe('progressioneScheda', () => {
  it('i tre preset: multiarticolare col top set, mono grande e piccola con la doppia', () => {
    expect(conPreset('multi')).toMatchObject({ modello: 'topSet', preset: 'multi', cfg: TOP_SET_DEFAULT })
    expect(conPreset('monoGrande')).toMatchObject({ modello: 'doppia', cfg: { repMin: 8, repMax: 12 } })
    expect(conPreset('monoPiccola')).toMatchObject({ modello: 'doppia', cfg: { repMin: 12, repMax: 20 } })
    // Cambiare modello da «Personalizza» la rende personalizzata, coi carichi di prima.
    const lista = { kind: 'list' as const, values: [4, 6] }
    expect(conModello(conPreset('multi', lista), 'doppia')).toMatchObject({ modello: 'doppia', preset: 'personalizzata', steps: lista })
  })

  it('la riga scrive serie e colpi della sua progressione', () => {
    expect(serieERipetizioni(conPreset('multi'))).toEqual({ sets: 4, reps: '5-8-8-8' })
    expect(serieERipetizioni(conPreset('monoGrande'))).toEqual({ sets: 3, reps: '8-12' })
  })

  it('un top set con una back-off sola si rilegge serie per serie, non come una forbice', () => {
    // "5-8" su due serie, per `colpiPrevisti`, è la forbice 5–8: la back-off
    // sarebbe finita nello storico a 5 colpi.
    const p: ProgressioneRiga = { modello: 'topSet', preset: 'personalizzata', cfg: { ...TOP_SET_DEFAULT, backoffSets: 1 }, steps: { kind: 'increment', step: 2.5 } }
    const { sets, reps } = serieERipetizioni(p)
    expect(colpiPrevisti(reps, sets)).toEqual([5, 8])
  })

  it('senza stato salvato si parte dall’ultima alzata: il top set dal massimale stimato', () => {
    // 80 × 5 → massimale stimato 93,3; per 5 colpi a RIR 2 → 75,7 → 75 al passo da 2,5.
    const ex = esercizio([{ d: 'W', date: giorniFa(7), kg: 80, reps: 5, sets_n: 1 }])
    expect(statoDiPartenza(conPreset('multi'), ex, 'sc1:r1')).toEqual({ stato: { modello: 'topSet', stato: { topWeight: 75, missCount: 0 } }, da: 'storico' })
    // La doppia dal carico più alto, arrotondato ai carichi che ci sono.
    const curl = esercizio([{ d: 'W', date: giorniFa(7), kg: 13, reps: 10, sets_n: 3 }])
    expect(statoDiPartenza(conPreset('monoGrande', { kind: 'list', values: [10, 12, 14] }), curl, 'k')?.stato)
      .toEqual({ modello: 'doppia', stato: { weight: 12, sets: 3 } })
  })

  it('lo stato salvato vince sullo storico, ma non se il modello è cambiato', () => {
    const salvato = { modello: 'topSet' as const, stato: { topWeight: 90, missCount: 1 }, il: giorniFa(3), evento: 'hold' as const, messaggio: 'x' }
    const ex = esercizio([{ d: 'W', date: giorniFa(7), kg: 80, reps: 5, sets_n: 1 }], { progressioni: { 'sc1:r1': salvato } })
    expect(statoDiPartenza(conPreset('multi'), ex, 'sc1:r1')?.da).toBe('salvato')
    expect(statoDiPartenza(conPreset('monoGrande'), ex, 'sc1:r1')?.da).toBe('storico')
  })

  it('alla prima volta di un esercizio niente peso, e lo stato nasce dal top set fatto', () => {
    const oggi = oggiDellaRiga('sc1', riga(), undefined)!
    expect(oggi).toMatchObject({ conPeso: false, da: 'nuovo', chiave: chiaveProgressione('sc1', 'r1') })
    const esito = esitoEsercizio(oggi, [{ weight: 80, reps: 5, rir: 3 }, null, null, null], '2026-10-28')
    expect(esito).toMatchObject({ modello: 'topSet', evento: 'increase', stato: { topWeight: 82.5 }, messaggio: 'Obiettivo superato: si sale di carico' })
    // Il top set saltato non dice niente: non si giudica.
    expect(esitoEsercizio(oggi, [null, { weight: 70, reps: 8 }], '2026-10-28')).toBeNull()
  })

  it('la doppia esegue tante serie quante lo stato dice', () => {
    const p = conPreset('monoGrande')
    const ex = esercizio([], { progressioni: { 'sc1:r1': { modello: 'doppia', stato: { weight: 20, sets: 4 }, il: giorniFa(3), evento: 'add_set', messaggio: 'x' } } })
    const oggi = oggiDellaRiga('sc1', riga(p), ex)!
    expect(rigaDiOggi(riga(p), oggi)).toMatchObject({ sets: 4, reps: '8-12' })
  })

  it('i carichi: la lista si legge con le virgole, vuota non vale', () => {
    expect(leggiLista('2, 4, 6')).toEqual([2, 4, 6])
    expect(leggiLista('2,5 5 7,5')).toEqual([2.5, 5, 7.5])
    expect(leggiLista('2,4,6')).toEqual([2, 4, 6])
    expect(carichiValidi({ kind: 'list', values: [] })).toBe(false)
    expect(oggiDellaRiga('sc1', riga(conPreset('multi', { kind: 'list', values: [] })), undefined)).toBeNull()
  })

  it('il range consigliato misura il salto al carico dopo', () => {
    expect(rangeConsigliato({ kind: 'list', values: [8, 10, 12] }, 8)).toMatchObject({ min: 12, max: 20, peso: 8 })
    expect(rangeConsigliato({ kind: 'increment', step: 2.5 })).toBeNull()
  })

  it('il RIR è un intero da 0 a 10', () => {
    expect(leggiRir('2')).toBe(2)
    expect(leggiRir('')).toBeNull()
    expect(leggiRir('12')).toBeNull()
  })
})

// ── Il form: solo le schede nuove scelgono la progressione ──────
describe('il form della scheda', () => {
  beforeEach(() => {
    useJarvisStore.setState({ ...EMPTY_STATE, userName: 'Luca' }, true)
    // jsdom non lo ha: il form ci porta l'elenco di cosa manca.
    Element.prototype.scrollIntoView = vi.fn()
  })
  afterEach(cleanup)

  const monta = (s: GymScheda | null, onSave = vi.fn()) => {
    render(<ConfirmDeleteProvider><SchedaFormPage scheda={s} palestraExercises={[]} onCancel={vi.fn()} onSave={onSave} onSaveDraft={vi.fn()}/></ConfirmDeleteProvider>)
    return onSave
  }

  it('in una scheda nuova si sceglie la progressione: senza, non si salva', async () => {
    const user = userEvent.setup()
    const onSave = monta(null)
    await user.type(screen.getByPlaceholderText(/Nome scheda/), 'Upper A')
    await user.type(screen.getByLabelText('Nome esercizio'), 'Panca piana')
    await user.selectOptions(screen.getByLabelText('Gruppo muscolare'), 'Petto')
    // Serie e colpi non si scrivono: li dà la progressione.
    expect(screen.queryByPlaceholderText('3')).not.toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: /Salva scheda/ })[0])
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Esercizio 1: scegli la progressione')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Multiarticolare' }))
    await user.click(screen.getAllByRole('button', { name: /Salva/ })[0])
    expect(onSave).toHaveBeenCalledOnce()
    const salvata = onSave.mock.calls[0][0] as GymScheda
    expect(salvata.conProgressioni).toBe(true)
    expect(salvata.exercises[0]).toMatchObject({ sets: 4, reps: '5-8-8-8', progressione: { modello: 'topSet', preset: 'multi' } })
  })

  it('i carichi a lista e il range consigliato dal salto', async () => {
    const user = userEvent.setup()
    const onSave = monta(null)
    await user.type(screen.getByPlaceholderText(/Nome scheda/), 'Braccia')
    await user.type(screen.getByLabelText('Nome esercizio'), 'Alzate laterali')
    await user.selectOptions(screen.getByLabelText('Gruppo muscolare'), 'Spalle')
    await user.click(screen.getByRole('button', { name: 'Mono grande' }))
    await user.click(screen.getByRole('button', { name: 'Lista carichi' }))
    const lista = screen.getByLabelText('Carichi disponibili')
    await user.clear(lista)
    await user.type(lista, '4, 6, 8')
    // Da 4 a 6 è +50%: il range consigliato è 12–20, e «Usa» lo mette.
    expect(screen.getByText(/range consigliato 12–20/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Usa' }))
    await user.click(screen.getAllByRole('button', { name: /Salva/ })[0])
    expect((onSave.mock.calls[0][0] as GymScheda).exercises[0].progressione).toMatchObject({
      modello: 'doppia', preset: 'personalizzata', steps: { kind: 'list', values: [4, 6, 8] }, cfg: { repMin: 12, repMax: 20 },
    })
  })

  it('una scheda di prima resta com’era: serie, colpi, niente progressione', async () => {
    const user = userEvent.setup()
    monta({ id: 'sc0', title: 'Vecchia', createdAt: '2026-09-01', updatedAt: '2026-09-01', exercises: [{ id: 'r1', name: 'Panca piana', sets: 3, reps: '10', muscle: 'Petto' }] })
    await user.click(screen.getByText('Panca piana').closest('button')!)
    expect(screen.queryByText('Progressione')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('3')).toHaveValue('3')
  })
})

// ── In allenamento ──────────────────────────────────────────────
describe('allenamento con la progressione', () => {
  const p = conPreset('multi')
  const scheda: GymScheda = {
    id: 'sc1', title: 'Forza A', createdAt: '2026-10-27', updatedAt: '2026-10-27', conProgressioni: true,
    exercises: [{ id: 'r1', name: 'Panca piana', muscle: 'Petto', linkedExerciseId: 'px1', progressione: p, ...serieERipetizioni(p) }],
  }
  beforeEach(() => {
    useJarvisStore.setState({
      ...EMPTY_STATE, userName: 'Luca', gymSchede: [scheda],
      palestraExercises: [esercizio([{ d: 'W', date: giorniFa(7), kg: 80, reps: 5, sets_n: 1 }])],
    }, true)
    localStorage.clear()
  })
  afterEach(cleanup)

  it('prescrive, chiede il RIR, dice dove si va e salva lo stato con l’allenamento', async () => {
    const user = userEvent.setup()
    render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/><ConfirmModal/></ConfirmDeleteProvider>)
    await user.click(screen.getByText('Forza A'))
    await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))

    // La prescrizione: top 75 × 5 @ RIR 2, back-off 3 × 8 a 67,5. I campi la riportano.
    expect(screen.getByText('75 kg × 5 @ RIR 2')).toBeInTheDocument()
    expect(screen.getByText('3 × 8 · 67,5 kg')).toBeInTheDocument()
    expect(screen.getByLabelText('Panca piana · serie 1 · kg')).toHaveValue('75')
    expect(screen.getByLabelText('Panca piana · serie 2 · kg')).toHaveValue('67,5')
    expect(screen.getByLabelText('Panca piana · serie 2 · colpi')).toHaveValue('8')
    expect(screen.getByText('TOP')).toBeInTheDocument()
    // «Uguale su tutte» copierebbe il top sulle back-off: sul top set non c'è.
    expect(screen.queryByRole('button', { name: 'Uguale su tutte le serie' })).not.toBeInTheDocument()

    // Top set spuntato senza RIR: lo si dice.
    await user.click(screen.getByRole('button', { name: 'Serie 1' }))
    expect(screen.getByText('Scrivi il RIR del top set: senza, il carico non sale.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Panca piana · serie 1 · RIR'), '3')
    for (const n of [2, 3, 4]) await user.click(screen.getByRole('button', { name: `Serie ${n}` }))

    // Esercizio chiuso: il messaggio della progressione, com'è.
    const stato = screen.getByRole('status')
    expect(within(stato).getByText('Obiettivo superato: si sale di carico')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    await user.click(screen.getByRole('button', { name: /salva e chiudi/i }))
    const ex = useJarvisStore.getState().palestraExercises.find(e => e.id === 'px1')!
    expect(ex.progressioni?.['sc1:r1']).toMatchObject({ modello: 'topSet', evento: 'increase', stato: { topWeight: 77.5, missCount: 0 } })
    const ultima = ex.history[ex.history.length - 1]
    expect(ultima).toMatchObject({ kg: 75, sets_n: 4, setRir: [3, null, null, null], piano: { sets: 4, reps: '5-8-8-8' } })
  })

  it('la volta dopo riparte dallo stato salvato, e dice cosa era successo', async () => {
    const salvato = { modello: 'topSet' as const, stato: { topWeight: 77.5, missCount: 0 }, il: giorniFa(3), evento: 'increase' as const, messaggio: 'Obiettivo superato: si sale di carico' }
    useJarvisStore.setState({ palestraExercises: [esercizio([{ d: 'W', date: giorniFa(3), kg: 75, reps: 5, sets_n: 4 }], { progressioni: { 'sc1:r1': salvato } })] })
    const user = userEvent.setup()
    render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/><ConfirmModal/></ConfirmDeleteProvider>)
    await user.click(screen.getByText('Forza A'))
    await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))
    expect(screen.getByText('77,5 kg × 5 @ RIR 2')).toBeInTheDocument()
    expect(screen.getByText('L’ultima volta: Obiettivo superato: si sale di carico')).toBeInTheDocument()
  })

  it('uno scartato non fa avanzare niente', async () => {
    const user = userEvent.setup()
    render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/><ConfirmModal/></ConfirmDeleteProvider>)
    await user.click(screen.getByText('Forza A'))
    await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))
    await user.type(screen.getByLabelText('Panca piana · serie 1 · RIR'), '4')
    await user.click(screen.getByRole('button', { name: 'Serie 1' }))
    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    await user.click(screen.getAllByRole('button', { name: /chiudi senza salvare/i }).pop()!)
    await user.click(screen.getByRole('button', { name: 'Scarta' }))
    expect(useJarvisStore.getState().palestraExercises[0].progressioni).toBeUndefined()
  })
})

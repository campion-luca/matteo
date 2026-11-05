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
  conPreset, conModello, serieERipetizioni, statoDiPartenza, oggiDellaRiga, rigaDiOggi, esitoEsercizio, giudicataSu,
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

  it('un’alzata che non dice un peso non fa partire da 0 kg: si guarda la volta prima', () => {
    // L'ultima a 0 colpi (o a 0 kg, come le serie vuote di prima del 7 ott):
    // prima lo stato partiva da 0 kg "stimato dallo storico".
    const buona = { d: 'W', date: giorniFa(14), kg: 80, reps: 5, sets_n: 1 }
    const aZeroColpi = esercizio([buona, { d: 'W', date: giorniFa(7), kg: 80, reps: 0, sets_n: 1 }])
    expect(statoDiPartenza(conPreset('multi'), aZeroColpi, 'k')).toEqual({ stato: { modello: 'topSet', stato: { topWeight: 75, missCount: 0 } }, da: 'storico' })
    const aZeroKg = esercizio([{ ...buona, kg: 12, reps: 10, sets_n: 3 }, { d: 'W', date: giorniFa(7), kg: 0, reps: 10, sets_n: 3 }])
    expect(statoDiPartenza(conPreset('monoGrande'), aZeroKg, 'k')?.stato).toEqual({ modello: 'doppia', stato: { weight: 12.5, sets: 3 } })
    // Se nessuna dice un peso, si parte come la prima volta: il peso lo sceglie chi si allena.
    const maiUnPeso = esercizio([{ d: 'W', date: giorniFa(7), kg: 0, reps: 10, sets_n: 3 }])
    expect(statoDiPartenza(conPreset('multi'), maiUnPeso, 'k')).toBeNull()
    expect(statoDiPartenza(conPreset('monoGrande', { kind: 'list', values: [2, 4, 6] }), maiUnPeso, 'k')).toBeNull()
    expect(oggiDellaRiga('sc1', riga(), maiUnPeso)).toMatchObject({ conPeso: false, da: 'nuovo' })
  })

  it('carichi della riga cambiati, modello no: lo stato salvato si riporta ai carichi di oggi', () => {
    // Salvato col passo da 2,5; ora la riga ha i manubri da 60 e da 65.
    const lista = { kind: 'list' as const, values: [60, 65] }
    const doppia = { modello: 'doppia' as const, stato: { weight: 62.5, sets: 3, previousWeight: 57.5 }, il: giorniFa(3), evento: 'increase' as const, messaggio: 'x' }
    const ex = esercizio([], { progressioni: { 'sc1:r1': doppia } })
    expect(statoDiPartenza(conPreset('monoGrande', lista), ex, 'sc1:r1')).toEqual({ stato: { modello: 'doppia', stato: { weight: 60, sets: 3, previousWeight: 60 } }, da: 'salvato' })
    // La prescrizione è sui carichi che ci sono: prima diceva 62,5.
    expect(oggiDellaRiga('sc1', riga(conPreset('monoGrande', lista)), ex)!.prescrizione.map(s => s.weight)).toEqual([60, 60, 60])

    const top = { modello: 'topSet' as const, stato: { topWeight: 81, missCount: 1 }, il: giorniFa(3), evento: 'hold' as const, messaggio: 'x' }
    const exTop = esercizio([], { progressioni: { 'sc1:r1': top } })
    const oggi = oggiDellaRiga('sc1', riga(conPreset('multi', { kind: 'increment', step: 5 })), exTop)!
    expect(oggi.stato).toEqual({ modello: 'topSet', stato: { topWeight: 80, missCount: 1 } })
    expect(oggi.prescrizione[0]).toMatchObject({ label: 'top', weight: 80 })
    // Coi carichi di sempre non cambia niente.
    expect(statoDiPartenza(conPreset('multi'), esercizio([], { progressioni: { 'sc1:r1': { ...top, stato: { topWeight: 82.5, missCount: 0 } } } }), 'sc1:r1')?.stato)
      .toEqual({ modello: 'topSet', stato: { topWeight: 82.5, missCount: 0 } })
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

  it('salvare non toglie la progressione a un esercizio con l’ultima alzata a 0 kg', async () => {
    // Quella deduzione vale per la seduta; salvando per rinominare la scheda
    // cancellava la progressione senza dirlo.
    const user = userEvent.setup()
    const onSave = vi.fn()
    const p = conPreset('multi')
    const s: GymScheda = {
      id: 'sc1', title: 'Forza A', createdAt: '2026-10-27', updatedAt: '2026-10-27', conProgressioni: true,
      exercises: [{ id: 'r1', name: 'Panca piana', muscle: 'Petto', linkedExerciseId: 'px1', progressione: p, ...serieERipetizioni(p) }],
    }
    render(<ConfirmDeleteProvider><SchedaFormPage scheda={s} palestraExercises={[esercizio([{ d: 'W', date: giorniFa(9), kg: 0, reps: 8, sets_n: 3 }])]} onCancel={vi.fn()} onSave={onSave} onSaveDraft={vi.fn()}/></ConfirmDeleteProvider>)
    await user.clear(screen.getByPlaceholderText(/Nome scheda/))
    await user.type(screen.getByPlaceholderText(/Nome scheda/), 'Forza B')
    await user.click(screen.getAllByRole('button', { name: /Salva modifiche/ })[0])
    expect(onSave.mock.calls[0][0].exercises[0].progressione).toEqual(p)
  })

  // Dal 4 nov 2026 la progressione è facoltativa: un interruttore, spento di
  // serie, come Superset e Cedimento.
  it('in una scheda nuova la progressione è facoltativa: spenta si salva con serie e colpi', async () => {
    const user = userEvent.setup()
    const onSave = monta(null)
    await user.type(screen.getByPlaceholderText(/Nome scheda/), 'Upper A')
    await user.type(screen.getByLabelText('Nome esercizio'), 'Panca piana')
    await user.selectOptions(screen.getByLabelText('Gruppo muscolare'), 'Petto')
    expect(screen.getByPlaceholderText('3')).toHaveValue('3')
    await user.click(screen.getAllByRole('button', { name: /Salva scheda/ })[0])
    const salvata = onSave.mock.calls[0][0] as GymScheda
    expect(salvata.exercises[0]).toMatchObject({ sets: 3, reps: '8' })
    expect(salvata.exercises[0]).not.toHaveProperty('progressione')
  })

  it('accesa, serie e colpi li dà lei, e va scelta: senza, non si salva', async () => {
    const user = userEvent.setup()
    const onSave = monta(null)
    await user.type(screen.getByPlaceholderText(/Nome scheda/), 'Upper A')
    await user.type(screen.getByLabelText('Nome esercizio'), 'Panca piana')
    await user.selectOptions(screen.getByLabelText('Gruppo muscolare'), 'Petto')
    await user.click(screen.getByRole('switch', { name: 'Progressione' }))
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
    await user.click(screen.getByRole('switch', { name: 'Progressione' }))
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

  it('spenta su una riga che l’aveva, si salva senza; riaccesa, ritrova la scelta di prima', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const p = conPreset('multi')
    monta({
      id: 'sc1', title: 'Forza A', createdAt: '2026-10-27', updatedAt: '2026-10-27', conProgressioni: true,
      exercises: [{ id: 'r1', name: 'Panca piana', muscle: 'Petto', progressione: p, ...serieERipetizioni(p) }],
    }, onSave)
    await user.click(screen.getByText('Panca piana').closest('button')!)
    const interruttore = screen.getByRole('switch', { name: 'Progressione' })
    expect(interruttore).toHaveAttribute('aria-checked', 'true')
    await user.click(interruttore)
    expect(screen.getByPlaceholderText('3')).toHaveValue('4')
    await user.click(screen.getAllByRole('button', { name: /Salva modifiche/ })[0])
    expect(onSave.mock.calls[0][0].exercises[0]).not.toHaveProperty('progressione')

    await user.click(screen.getByRole('switch', { name: 'Progressione' }))
    await user.click(screen.getAllByRole('button', { name: /Salva modifiche/ })[0])
    expect(onSave.mock.calls[1][0].exercises[0].progressione).toEqual(p)
  })

  it('una scheda di prima resta com’era: serie, colpi, niente progressione', async () => {
    const user = userEvent.setup()
    monta({ id: 'sc0', title: 'Vecchia', createdAt: '2026-09-01', updatedAt: '2026-09-01', exercises: [{ id: 'r1', name: 'Panca piana', sets: 3, reps: '10', muscle: 'Petto' }] })
    await user.click(screen.getByText('Panca piana').closest('button')!)
    expect(screen.queryByRole('switch', { name: 'Progressione' })).not.toBeInTheDocument()
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

// ── La seduta si giudica sul peso alzato (3 nov 2026) ───────────
// Le regole di progression.ts partono dal peso prescritto: colpi e RIR fatti
// con un altro peso venivano presi per fatti con quello.
describe('il peso alzato davvero', () => {
  const salvato = (stato: Record<string, number>, modello: 'topSet' | 'doppia') =>
    ({ 'sc1:r1': { modello, stato, il: giorniFa(3), evento: 'hold' as const, messaggio: 'x' } }) as unknown as PalestraExercise['progressioni']

  it('top set: 70 × 5 a RIR 5 su un prescritto da 80 porta a 75, non a 85', () => {
    const p = conPreset('multi')
    const oggi = oggiDellaRiga('sc1', riga(p), esercizio([], { progressioni: salvato({ topWeight: 80, missCount: 0 }, 'topSet') }))!
    const serie = [{ weight: 70, reps: 5, rir: 5 }, null, null, null]
    expect(giudicataSu(oggi, serie)).toEqual({ alzato: 70, prescritto: 80 })
    expect(esitoEsercizio(oggi, serie, '2026-11-03')?.stato).toEqual({ topWeight: 75, missCount: 0 })
  })

  it('top set: 80 × 5 a RIR 2 su un prescritto da 75 resta a 80', () => {
    const p = conPreset('multi')
    const oggi = oggiDellaRiga('sc1', riga(p), esercizio([], { progressioni: salvato({ topWeight: 75, missCount: 0 }, 'topSet') }))!
    expect(esitoEsercizio(oggi, [{ weight: 80, reps: 5, rir: 2 }, null, null, null], '2026-11-03')).toMatchObject({ evento: 'hold', stato: { topWeight: 80 } })
  })

  it('doppia: 3 × 12 con 8 kg su un prescritto da 10 porta a 10, non a 12', () => {
    const p = conPreset('monoGrande', { kind: 'list', values: [6, 8, 10, 12] })
    const oggi = oggiDellaRiga('sc1', riga(p), esercizio([], { progressioni: salvato({ weight: 10, sets: 3 }, 'doppia') }))!
    const serie = [8, 8, 8].map(weight => ({ weight, reps: 12 }))
    expect(esitoEsercizio(oggi, serie, '2026-11-03')?.stato).toMatchObject({ weight: 10, sets: 3 })
  })

  it('doppia: più pesante del prescritto vale come un aumento, e sotto il minimo si torna indietro', () => {
    const p = conPreset('monoGrande', { kind: 'list', values: [6, 8, 10, 12] })
    const oggi = oggiDellaRiga('sc1', riga(p), esercizio([], { progressioni: salvato({ weight: 10, sets: 3 }, 'doppia') }))!
    const serie = [12, 12, 12].map(weight => ({ weight, reps: 6 }))
    expect(esitoEsercizio(oggi, serie, '2026-11-03')).toMatchObject({ evento: 'add_set', stato: { weight: 10, sets: 4 } })
  })

  it('col peso prescritto non cambia niente, e alla prima seduta non c’è un prescritto', () => {
    const p = conPreset('multi')
    const oggi = oggiDellaRiga('sc1', riga(p), esercizio([], { progressioni: salvato({ topWeight: 80, missCount: 1 }, 'topSet') }))!
    expect(giudicataSu(oggi, [{ weight: 80, reps: 5, rir: 2 }, null, null, null])).toBeNull()
    expect(esitoEsercizio(oggi, [{ weight: 80, reps: 3, rir: 0 }, null, null, null], '2026-11-03')?.stato).toMatchObject({ missCount: 2 })
    expect(giudicataSu(oggiDellaRiga('sc1', riga(p), esercizio([]))!, [{ weight: 60, reps: 5 }, null])).toBeNull()
  })
})

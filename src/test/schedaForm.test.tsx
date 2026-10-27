import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SchedaFormPage } from '@/features/gym/GymSchede'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import type { GymScheda } from '@/store/useJarvisStore'

// Nel form della scheda gli esercizi stanno compressi: una riga col nome e
// «serie×colpi», e toccandola si apre. Tutti aperti, otto esercizi erano otto
// schermate di campi da scorrere per rileggere la scheda.
//
// Dal rebranding (ott 2026) la riga aperta mostra l'esercizio scelto in un
// riquadro con la foto e «Cambia»: il campo del nome torna solo per cambiarlo.
// Serie e ripetizioni hanno il meno e il più, "max" è l'interruttore «Fino a
// cedimento».

const scheda: GymScheda = {
  id: 'sc1', title: 'Upper A', createdAt: '2026-09-01', updatedAt: '2026-09-01',
  exercises: [
    { id: 'r1', name: 'Panca piana', sets: 3, reps: '10', muscle: 'Petto', note: 'presa larga' },
    { id: 'r2', name: 'Rematore', sets: 4, reps: '8', muscle: 'Dorso' },
    { id: 'r3', name: 'Curl', sets: 3, reps: '12', muscle: 'Bicipiti' },
  ],
}

beforeEach(() => useJarvisStore.setState({ ...EMPTY_STATE, userName: 'Luca' }, true))
afterEach(cleanup)

const monta = (s: GymScheda | null, onSave = vi.fn()) => {
  render(
    <ConfirmDeleteProvider>
      <SchedaFormPage scheda={s} palestraExercises={[]} onCancel={vi.fn()} onSave={onSave} onSaveDraft={vi.fn()}/>
    </ConfirmDeleteProvider>,
  )
  return onSave
}

/** La riga compressa di un esercizio: il bottone che la apre. */
const riga = (nome: string) => screen.getByText(nome).closest('button') as HTMLElement

describe('il form della scheda — esercizi compressi', () => {
  it('una scheda che esiste già si apre tutta compressa: nomi e «serie × colpi», nessun campo', () => {
    monta(scheda)
    expect(screen.queryByLabelText('Nome esercizio')).not.toBeInTheDocument()
    expect(riga('Panca piana')).toHaveTextContent('Petto · con nota3×10')
    expect(riga('Rematore')).toHaveTextContent('Dorso4×8')
    expect(riga('Curl')).toHaveTextContent('Bicipiti3×12')
  })

  it('toccata, una riga si apre com’era — una per volta — e «Fatto» la richiude', async () => {
    const user = userEvent.setup()
    monta(scheda)
    await user.click(riga('Rematore'))
    // L'esercizio scelto, col tasto per cambiarlo; il campo del nome non c'è.
    expect(screen.getByRole('button', { name: 'Cambia' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Nome esercizio')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('3')).toHaveValue('4')
    // Le altre due restano righe.
    expect(riga('Panca piana')).toBeInTheDocument()
    expect(riga('Curl')).toBeInTheDocument()

    // Aprirne un'altra chiude questa.
    await user.click(riga('Curl'))
    expect(screen.getAllByRole('button', { name: 'Cambia' })).toHaveLength(1)
    expect(screen.getByPlaceholderText('3')).toHaveValue('3')

    // «Cambia» rimette il campo del nome, col nome dentro e il cursore.
    await user.click(screen.getByRole('button', { name: 'Cambia' }))
    expect(screen.getByLabelText('Nome esercizio')).toHaveValue('Curl')
    expect(screen.getByLabelText('Nome esercizio')).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Fatto' }))
    expect(screen.queryByRole('button', { name: 'Cambia' })).not.toBeInTheDocument()
  })

  it('quello che si scrive in una riga resta quando la si richiude', async () => {
    const user = userEvent.setup()
    const onSave = monta(scheda)
    await user.click(riga('Rematore'))
    const serie = screen.getByPlaceholderText('3')
    await user.clear(serie)
    await user.type(serie, '5')
    await user.click(screen.getByRole('button', { name: 'Fatto' }))
    expect(riga('Rematore')).toHaveTextContent('5×8')

    await user.click(screen.getAllByRole('button', { name: /Salva modifiche/ })[0])
    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave.mock.calls[0][0].exercises.map((e: { name: string; sets: number }) => [e.name, e.sets])).toEqual([
      ['Panca piana', 3], ['Rematore', 5], ['Curl', 3],
    ])
  })

  it('una scheda nuova parte con la prima riga già aperta, e ogni riga aggiunta si apre da sola', async () => {
    const user = userEvent.setup()
    monta(null)
    const nome = screen.getByLabelText('Nome esercizio')
    await user.type(nome, 'Squat')

    await user.click(screen.getByRole('button', { name: /Aggiungi esercizio/ }))
    // La prima si è richiusa sul suo nome; la nuova è aperta, vuota, col cursore dentro.
    // Su una scheda nuova serie e colpi li dà la progressione: non ancora scelta, un trattino.
    expect(riga('Squat')).toHaveTextContent('–')
    expect(screen.getAllByLabelText('Nome esercizio')).toHaveLength(1)
    expect(screen.getByLabelText('Nome esercizio')).toHaveValue('')
    expect(screen.getByLabelText('Nome esercizio')).toHaveFocus()
  })

  it('da compressa una riga dice se le manca qualcosa', async () => {
    const user = userEvent.setup()
    monta(null)
    await user.type(screen.getByLabelText('Nome esercizio'), 'Hip thrust')
    // Esercizio nuovo senza gruppo muscolare: non si può salvare così.
    await user.click(screen.getByRole('button', { name: 'Fatto' }))
    expect(riga('Hip thrust')).toHaveTextContent('da completare')
  })

  it('le frecce spostano un esercizio anche da compresso', async () => {
    const user = userEvent.setup()
    const onSave = monta(scheda)
    const card = riga('Curl').parentElement as HTMLElement
    await user.click(within(card).getByRole('button', { name: 'Sposta su' }))
    await user.click(screen.getAllByRole('button', { name: /Salva modifiche/ })[0])
    expect(onSave.mock.calls[0][0].exercises.map((e: { name: string }) => e.name)).toEqual(['Panca piana', 'Curl', 'Rematore'])
  })

  it('il meno e il più cambiano serie e ripetizioni, anche una forbice', async () => {
    const user = userEvent.setup()
    const onSave = monta({ ...scheda, exercises: [{ id: 'r1', name: 'Panca piana', sets: 3, reps: '8-10', muscle: 'Petto' }] })
    await user.click(riga('Panca piana'))
    await user.click(screen.getByRole('button', { name: 'Serie: uno in più' }))
    await user.click(screen.getByRole('button', { name: 'Ripetizioni: uno in meno' }))
    await user.click(screen.getAllByRole('button', { name: /Salva modifiche/ })[0])
    expect(onSave.mock.calls[0][0].exercises[0]).toMatchObject({ sets: 4, reps: '7-9' })
  })

  it('«Fino a cedimento» scrive max, e spento ridà le ripetizioni di prima', async () => {
    const user = userEvent.setup()
    monta(scheda)
    await user.click(riga('Curl'))
    const cedimento = screen.getByRole('switch', { name: 'Fino a cedimento' })
    await user.click(cedimento)
    expect(screen.getByLabelText('Ripetizioni')).toHaveValue('max')
    expect(screen.getByRole('button', { name: 'Ripetizioni: uno in più' })).toBeDisabled()
    await user.click(cedimento)
    expect(screen.getByLabelText('Ripetizioni')).toHaveValue('12')
  })

  it('«Superset col successivo» lega l’esercizio al prossimo', async () => {
    const user = userEvent.setup()
    const onSave = monta(scheda)
    await user.click(riga('Panca piana'))
    await user.click(screen.getByRole('switch', { name: 'Superset col successivo' }))
    await user.click(screen.getAllByRole('button', { name: /Salva modifiche/ })[0])
    expect(onSave.mock.calls[0][0].exercises[0].supersetWithNext).toBe(true)
  })
})

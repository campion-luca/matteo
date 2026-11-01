import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RANK, rankEsercizio, recordAlzata, traguardoScheda } from '@/features/gym/rankEsercizio'
import { RankCard } from '@/features/gym/RankCard'
import { RecordModal } from '@/features/gym/gymModals'
import { GymSchede } from '@/features/gym/GymSchede'
import { JarvisGym } from '@/features/gym/JarvisGym'
import { useJarvisStore, EMPTY_STATE, type PalestraExercise, type PalestraHistoryEntry } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'

// I rank: uno per esercizio, dal massimale rispetto a quello che alza di norma chi
// pesa uguale. Le cose che possono andare storte non danno errore: danno un rank
// a un esercizio che non ha una soglia, o uno che cambia a seconda di quale strada
// ha preso l'alzata.

const alzata = (kg: number, date: string, o: Partial<PalestraHistoryEntry> = {}): PalestraHistoryEntry =>
  ({ d: 'W1', date, kg, reps: 5, sets_n: 3, ...o })
const massimale = (kg: number, date = '2026-01-01') => alzata(kg, date, { reps: 1, sets_n: 1, maxLift: true })
const es = (history: PalestraHistoryEntry[], o: Partial<PalestraExercise> = {}): PalestraExercise =>
  ({ id: 'px', n: 'Panca piana', muscle: 'Petto', current: { kg: 0, reps: 0, sets_n: 0 }, history, ...o })
const panca = (kg: number) => es([massimale(kg)])

afterEach(cleanup)

describe('la scala dei rank', () => {
  it('sono cinque, uno per fascia delle tabelle', () => {
    expect(RANK.map(r => r.nome)).toEqual(['Bronzo', 'Argento', 'Oro', 'Platino', 'Diamante'])
  })

  // Panca, uomo di 80 kg: 81,5 · 96,4 · 111,4 · 135,1 kg di massimale.
  it.each([
    [80, 'Bronzo'], [82, 'Argento'], [96, 'Argento'], [97, 'Oro'], [111, 'Oro'], [112, 'Platino'], [135, 'Platino'], [136, 'Diamante'],
  ])('%i kg a 80 kg di peso: %s', (kg, nome) => {
    expect(rankEsercizio(panca(kg), 80, 'M')?.rank.nome).toBe(nome)
  })

  it('gli stessi 100 kg valgono di più a chi pesa meno', () => {
    expect(rankEsercizio(panca(100), 76, 'M')?.rank.nome).toBe('Oro')
    expect(rankEsercizio(panca(100), 100, 'M')?.rank.nome).toBe('Argento')
  })

  it('le donne hanno le loro tabelle, e il sesso ignoto usa quelle maschili', () => {
    expect(rankEsercizio(panca(50), 60, 'F')?.rank.nome).toBe('Platino')
    expect(rankEsercizio(panca(50), 60, 'M')?.rank.nome).toBe('Bronzo')
    expect(rankEsercizio(panca(50), 60)?.rank.nome).toBe('Bronzo')
  })

  it('dice quanti chili di massimale mancano al prossimo', () => {
    const r = rankEsercizio(panca(100), 80, 'M')
    expect(r?.prossimo).toMatchObject({ rank: { nome: 'Platino' }, kg: 112, mancano: 12 })
    expect(r?.avanzamento).toBeGreaterThan(0.2)
    expect(r?.avanzamento).toBeLessThan(0.3)
  })

  it('al Diamante non c’è un dopo', () => {
    expect(rankEsercizio(panca(150), 80, 'M')).toMatchObject({ prossimo: null, avanzamento: 1, posto: 5 })
  })
})

describe('quali esercizi hanno un rank', () => {
  it('conta il massimale migliore, stimato o dichiarato, da una scheda o da solo', () => {
    const scheda = { id: 'sc', nome: 'Push' }
    expect(rankEsercizio(es([alzata(50, '2026-01-01'), alzata(90, '2026-01-02', { scheda })]), 80, 'M')?.rank.nome).toBe('Oro')
    expect(rankEsercizio(es([massimale(120), alzata(50, '2026-01-02')]), 80, 'M')?.rank.nome).toBe('Platino')
  })

  it.each([
    ['Panca piana al MPW', 'Petto'],
    ['Lat machine presa larga', 'Dorso'],
    ['Military press al MPW', 'Spalle'],
    ['Curl panca Scott', 'Bicipiti'],
    ['Curl bilanciere Z', 'Bicipiti'],
    ['Leg press', 'Gambe'],
  ])('%s ha la sua tabella', (n, muscle) => {
    expect(rankEsercizio(es([massimale(40)], { n, muscle }), 76, 'M')).not.toBeNull()
  })

  it('ogni esercizio si misura sulla sua tabella: 80 kg non valgono uguale', () => {
    const rank = (n: string, muscle: string) => rankEsercizio(es([massimale(80)], { n, muscle }), 80, 'M')?.rank.nome
    expect(rank('Panca piana', 'Petto')).toBe('Bronzo')
    expect(rank('Curl panca Scott', 'Bicipiti')).toBe('Diamante')
  })

  it.each([
    ['Squat', 'Gambe', 130],
    ['Stacco', 'Dorso', 150],
    ['Rematore T-Bar presa larga', 'Dorso', 80],
  ])('%s usa le soglie della mappa', (n, muscle, kg) => {
    expect(rankEsercizio(es([massimale(kg)], { n, muscle }), 76, 'M')?.rank.nome).toBe('Oro')
  })

  it('anche chi usa le soglie della mappa può arrivare al Diamante', () => {
    const squat = (kg: number) => rankEsercizio(es([massimale(kg)], { n: 'Squat', muscle: 'Gambe' }), 80, 'M')?.rank.nome
    expect(squat(180)).toBe('Platino')
    expect(squat(210)).toBe('Diamante')
  })

  it.each([
    ['Alzate laterali con manubri', 'Spalle', 25],
    ['Croci alla peck deck', 'Petto', 120],
    ['Curl a martello', 'Bicipiti', 40],
    ['Leg curl seduto', 'Gambe', 100],
    ['Pulley basso presa stretta', 'Dorso', 100],
    ['Stacco rumeno', 'Gambe', 150],
  ])('%s non ha una soglia sua: niente rank, invece di uno sbagliato', (n, muscle, kg) => {
    expect(rankEsercizio(es([massimale(kg)], { n, muscle }), 76, 'M')).toBeNull()
  })

  it('senza alzate o senza peso nel profilo non c’è rank', () => {
    expect(rankEsercizio(es([]), 80, 'M')).toBeNull()
    expect(rankEsercizio(panca(100), 0, 'M')).toBeNull()
  })
})

describe('il traguardo in home', () => {
  const riga = (id: string, name: string) => ({ id, name, sets: 3, reps: '8', linkedExerciseId: id })
  const scheda = (...righe: Array<ReturnType<typeof riga>>) => ({ id: 'sc', title: 'Spinta', exercises: righe, createdAt: '2026-01-01', updatedAt: '2026-01-01' })
  const panca100 = es([massimale(100)], { id: 'p', n: 'Panca piana' })
  // Curl: 48 kg stimati sono circa il 50° percentile a 80 kg.
  const curl47 = es([massimale(47)], { id: 'c', n: 'Curl panca Scott', muscle: 'Bicipiti' })

  it('è quello a cui manca meno, in proporzione', () => {
    const t = traguardoScheda(scheda(riga('p', 'Panca piana'), riga('c', 'Curl panca Scott')), [panca100, curl47], 80, 'M')
    expect(t).toMatchObject({ esercizio: 'Curl panca Scott', rank: { nome: 'Oro' } })
    expect(t?.mancano).toBeLessThanOrEqual(2)
  })

  it('niente traguardo senza esercizi con un rank, o senza peso', () => {
    const lat = es([massimale(20)], { id: 'l', n: 'Alzate laterali con manubri', muscle: 'Spalle' })
    expect(traguardoScheda(scheda(riga('l', 'Alzate laterali con manubri')), [lat], 80, 'M')).toBeNull()
    expect(traguardoScheda(scheda(riga('p', 'Panca piana')), [panca100], 0, 'M')).toBeNull()
  })

  it('al Diamante non c’è più niente da raggiungere', () => {
    const forte = es([massimale(170)], { id: 'p', n: 'Panca piana' })
    expect(traguardoScheda(scheda(riga('p', 'Panca piana')), [forte], 80, 'M')).toBeNull()
  })
})

describe('l’alzata appena fatta', () => {
  const base = () => es([alzata(50, '2026-01-01')])

  it('non record: niente', () => {
    expect(recordAlzata(base(), alzata(40, '2026-02-01'), 80, 'M')).toBeNull()
  })

  it('la prima alzata di un esercizio non è un record', () => {
    expect(recordAlzata(es([]), alzata(100, '2026-02-01'), 80, 'M')).toBeNull()
  })

  it('un record dentro lo stesso rank non dice niente sul rank', () => {
    const r = recordAlzata(es([massimale(100)]), massimale(105), 80, 'M')
    expect(r).toMatchObject({ prev: 100, next: 105 })
    expect(r?.salitoA).toBeUndefined()
  })

  it('un record che fa salire lo dice', () => {
    expect(recordAlzata(es([massimale(100)]), massimale(125), 80, 'M')).toMatchObject({ salitoA: 'Platino' })
  })

  it('un esercizio senza rank fa record lo stesso', () => {
    const lat = es([massimale(10)], { n: 'Alzate laterali con manubri', muscle: 'Spalle' })
    const r = recordAlzata(lat, massimale(12), 80, 'M')
    expect(r).toMatchObject({ prev: 10, next: 12 })
    expect(r?.salitoA).toBeUndefined()
  })

  it('un record a colpi si conta in colpi', () => {
    const ab = es([alzata(0, '2026-01-01', { reps: 8 })], { n: 'Ab wheel', muscle: 'Core', bodyweight: true })
    expect(recordAlzata(ab, alzata(0, '2026-02-01', { reps: 12 }), 80, 'M')).toMatchObject({ colpi: true, prev: 8, next: 12 })
  })
})

describe('sullo schermo', () => {
  it('la card dice il rank e quanto manca al prossimo', () => {
    render(<RankCard rank={rankEsercizio(panca(100), 80, 'M')!}/>)
    expect(screen.getByText('Oro')).toBeInTheDocument()
    expect(screen.getByText('Mancano 12 kg di massimale per Platino')).toBeInTheDocument()
  })

  it('un chilo solo si dice al singolare', () => {
    render(<RankCard rank={rankEsercizio(panca(111), 80, 'M')!}/>)
    expect(screen.getByText('Manca 1 kg di massimale per Platino')).toBeInTheDocument()
  })

  it('al Diamante non chiede altro', () => {
    render(<RankCard rank={rankEsercizio(panca(150), 80, 'M')!}/>)
    expect(screen.getByText('Rank massimo')).toBeInTheDocument()
  })

  it('il messaggio di record mostra il rank nuovo', () => {
    render(<RecordModal records={[{ name: 'Panca piana', prev: 100, next: 125, salitoA: 'Platino' }]} onClose={() => {}}/>)
    expect(screen.getByText('Nuovo rank: Platino')).toBeInTheDocument()
  })

  it('un record a colpi si legge in colpi, senza la nota sul massimale stimato', () => {
    render(<RecordModal records={[{ name: 'Ab wheel', prev: 8, next: 12, colpi: true }]} onClose={() => {}}/>)
    expect(screen.getByText('12 colpi')).toBeInTheDocument()
    expect(screen.queryByText(/Massimale stimato/)).not.toBeInTheDocument()
  })
})

// ── Sul percorso vero ──────────────────────────────────────────
// Le due strade da cui arriva un'alzata, fino a quello che si vede. Chi scrive
// i record sono due pezzi di codice diversi: se uno si dimentica del rank, qui si vede.
describe('dalle due strade alla stessa pagina', () => {
  const scheda = {
    id: 'sc1', title: 'Spinta A', createdAt: '2026-09-01', updatedAt: '2026-09-01',
    exercises: [{ id: 'se1', name: 'Panca piana', sets: 1, reps: '10', muscle: 'Petto', linkedExerciseId: 'px' }],
  }
  beforeEach(() => {
    localStorage.clear()
    useJarvisStore.setState({
      ...EMPTY_STATE, userName: 'Luca', userWeight: 80, userSex: 'M', gymSchede: [scheda],
      // 70 × 5 sono quasi 82 kg stimati: Argento, a 15 dall'Oro.
      palestraExercises: [es([alzata(70, '2026-01-01')], { current: { kg: 70, reps: 5, sets_n: 3 } })],
    }, true)
  })

  it('un record fatto in una scheda porta il rank nuovo a fine allenamento', async () => {
    const user = userEvent.setup()
    render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/><ConfirmModal/></ConfirmDeleteProvider>)
    await user.click(screen.getByText('Spinta A'))
    await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))
    await user.clear(screen.getByLabelText('Panca piana · serie 1 · kg'))
    await user.type(screen.getByLabelText('Panca piana · serie 1 · kg'), '80')
    await user.click(screen.getByRole('button', { name: 'Serie 1' }))
    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    await user.click(screen.getByRole('button', { name: /salva e chiudi/i }))

    expect(await screen.findByText('Nuovo rank: Oro')).toBeInTheDocument()
  })

  it('un record segnato da solo fa lo stesso, e la pagina dell’esercizio lo mostra', async () => {
    const user = userEvent.setup()
    render(
      <ConfirmDeleteProvider>
        <JarvisGym onOpenCoach={vi.fn()} onOpenProfile={vi.fn()} onOpenUser={vi.fn()}/>
      </ConfirmDeleteProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Esercizi' }))
    await user.click(await screen.findByRole('button', { name: /Petto/ }))
    await user.click(await screen.findByRole('button', { name: /Panca piana/ }))

    expect(await screen.findByText('Argento')).toBeInTheDocument()
    expect(screen.getByText('Mancano 15 kg di massimale per Oro')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /nuova alzata/i }))
    const kg = await screen.findByLabelText('Kg')
    await user.clear(kg)
    await user.type(kg, '85')
    await user.click(screen.getByRole('button', { name: 'Salva alzata' }))

    expect(await screen.findByText('Nuovo rank: Oro')).toBeInTheDocument()
  })
})

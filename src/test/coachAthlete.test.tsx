import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CoachAthlete, UltimoAllenamento, NoteEsercizi } from '@/features/coach/CoachAthlete'
import type { AthleteData, NotaCoach } from '@/lib/coach'
import type { PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'

// La scheda di un allievo serve a rispondere a "sta calando?". Il volume
// settimanale non lo diceva — un numero in chili senza un metro con cui
// confrontarlo — e al suo posto c'è il confronto fra l'ultima volta e il solito
// di QUELLA persona su QUELL'esercizio, che ora vive in una pagina sua.

const h = (o: Partial<PalestraHistoryEntry>): PalestraHistoryEntry =>
  ({ d: 'W1', kg: 60, reps: 10, sets_n: 3, ...o })

const ex = (n: string, history: PalestraHistoryEntry[]): PalestraExercise => ({
  id: `px-${n}`, n, muscle: 'Petto',
  current: { kg: history[history.length - 1].kg, reps: history[history.length - 1].reps, sets_n: history[history.length - 1].sets_n },
  history,
})

const dati = (palestraExercises: PalestraExercise[]): AthleteData => ({
  userName: 'Marco', userSex: 'M', userWeight: 80, palestraExercises, hyroxExercises: [], weightLog: [],
})

afterEach(cleanup)

describe('CoachAthlete — il riepilogo dell’allievo', () => {
  it('non mostra più il volume della settimana', () => {
    render(<CoachAthlete data={dati([ex('Panca piana', [h({ date: '2026-08-20' }), h({ date: '2026-08-27' })])])}/>)
    expect(screen.queryByText('Volume')).not.toBeInTheDocument()
    // Le altre due tessere restano: sono quelle che dicono se si allena.
    expect(screen.getByText('Allenamenti')).toBeInTheDocument()
    expect(screen.getByText('Ultimo')).toBeInTheDocument()
  })

  it('le sezioni lunghe stanno dietro un bottone, non in pagina', async () => {
    const user = userEvent.setup()
    const onUltimo = vi.fn()
    const onNote = vi.fn()
    render(
      <CoachAthlete
        data={dati([ex('Panca piana', [h({ date: '2026-08-20' }), h({ date: '2026-08-27' })])])}
        note={2}
        onApriUltimo={onUltimo}
        onApriNote={onNote}
      />,
    )
    // La tabella del confronto non è in questa pagina: c'è il bottone che la apre.
    expect(screen.queryByText(/di solito/)).not.toBeInTheDocument()
    expect(screen.getByText('2 scritte')).toBeInTheDocument()

    // Il confronto è sceso di fianco a Sessioni e si chiama "Confronto", non
    // "Ultimo": quella parola è già sulla tile dei giorni dall'ultima volta, e
    // due cose diverse con lo stesso nome sulla stessa schermata sono una sola
    // cosa letta male. `getByText` fallirebbe da solo se tornassero a coincidere.
    await user.click(screen.getByText('Confronto'))
    expect(onUltimo).toHaveBeenCalledOnce()
    await user.click(screen.getByText('Note sugli esercizi'))
    expect(onNote).toHaveBeenCalledOnce()
  })

  it('le sessioni si scelgono una per volta invece di sfilare tutte', async () => {
    const user = userEvent.setup()
    render(<CoachAthlete data={dati([
      ex('Panca piana', [h({ date: '2026-08-20' })]),
      ex('Squat', [h({ date: '2026-08-27', kg: 90 })]),
    ])}/>)

    // I nomi degli esercizi compaiono anche in "Migliori alzate": qui interessa
    // solo cosa mostra la sezione delle sessioni.
    const tendina = screen.getByLabelText('Scegli la sessione')
    const sezione = within(tendina.parentElement!)

    // Si apre sulla più recente, e l'altra giornata NON è a schermo.
    expect(sezione.getByText('Squat')).toBeInTheDocument()
    expect(sezione.queryByText('Panca piana')).not.toBeInTheDocument()

    await user.selectOptions(tendina, '2026-08-20')
    expect(sezione.getByText('Panca piana')).toBeInTheDocument()
    expect(sezione.queryByText('Squat')).not.toBeInTheDocument()
  })
})

describe('UltimoAllenamento — il confronto col solito', () => {
  it('segnala il calo e scrive il metro con cui lo giudica', () => {
    render(<UltimoAllenamento palestra={[
      // Tre volte 3 × 10 a 60 kg, poi due serie da 8 a 50: cala su tutto.
      ex('Panca piana', [
        h({ date: '2026-08-06' }), h({ date: '2026-08-13' }), h({ date: '2026-08-20' }),
        h({ date: '2026-08-27', kg: 50, reps: 8, sets_n: 2 }),
      ]),
    ]}/>)
    expect(screen.getByText('di solito 3 × 10 — 60 kg')).toBeInTheDocument()
  })

  it('un allenamento in linea col solito non si segnala', () => {
    render(<UltimoAllenamento palestra={[
      ex('Panca piana', [h({ date: '2026-08-20' }), h({ date: '2026-08-27' })]),
    ]}/>)
    expect(screen.queryByText(/di solito/)).not.toBeInTheDocument()
  })

  it('migliorare non è calare', () => {
    render(<UltimoAllenamento palestra={[
      ex('Panca piana', [
        h({ date: '2026-08-20' }),
        h({ date: '2026-08-27', kg: 70, reps: 12, sets_n: 4 }),
      ]),
    ]}/>)
    expect(screen.queryByText(/di solito/)).not.toBeInTheDocument()
  })

  it('i colpi si giudicano sulla serie più corta, non su quella rappresentativa', () => {
    render(<UltimoAllenamento palestra={[
      // Solite 3 × 10 piene. L'ultima parte da 10 ma chiude a 6: il valore
      // rappresentativo resta 10 e da solo direbbe "tutto a posto".
      ex('Panca piana', [
        h({ date: '2026-08-13' }), h({ date: '2026-08-20' }),
        h({ date: '2026-08-27', reps: 10, sets_n: 3, setReps: [10, 8, 6] }),
      ]),
    ]}/>)
    expect(screen.getByText('di solito 3 × 10 — 60 kg')).toBeInTheDocument()
    // E i colpi si leggono come intervallo, non come il solo valore rappresentativo.
    expect(screen.getByText('6–10')).toBeInTheDocument()
  })

  it('un massimale isolato non alza il metro per gli allenamenti dopo', () => {
    render(<UltimoAllenamento palestra={[
      // Quattro volte a 60, una prova a 100, poi il solito 60: non è un calo.
      ex('Panca piana', [
        h({ date: '2026-08-01' }), h({ date: '2026-08-06' }), h({ date: '2026-08-13' }), h({ date: '2026-08-20' }),
        h({ date: '2026-08-24', kg: 100, reps: 1, sets_n: 1, maxLift: true }),
        h({ date: '2026-08-27' }),
      ]),
    ]}/>)
    // Con la MEDIA il solito sarebbe ~68 kg e il rientro a 60 sembrerebbe un crollo.
    expect(screen.queryByText(/di solito/)).not.toBeInTheDocument()
  })

  it('senza due allenamenti sullo stesso esercizio non c’è confronto', () => {
    render(<UltimoAllenamento palestra={[ex('Panca piana', [h({ date: '2026-08-27' })])]}/>)
    expect(screen.getByText(/Servono almeno due allenamenti/)).toBeInTheDocument()
  })
})

// ── Le note dell'allenatore ────────────────────────────────────
// Si salvavano uscendo dal campo, e il risultato è che non si salvavano: il
// blur salvava e chiudeva, il click che seguiva riapriva la riga rimettendoci
// dentro il testo di prima (quello nuovo stava ancora andando sul server), e
// alla chiusura dopo quel testo vecchio tornava sopra il nuovo. Adesso parte
// solo dal tasto, e questi test stanno qui perché non ci si torni.
describe('NoteEsercizi — il salvataggio è un gesto, non un effetto', () => {
  const esercizi = [ex('Panca piana al MPW', [h({ date: '2026-09-01' })])]
  const nota = (testo: string): NotaCoach => ({
    coach_id: 'c1', athlete_id: 'a1', exercise_id: 'px-Panca piana al MPW',
    nota: testo, coach_name: 'Coach', updated_at: '2026-09-01T10:00:00Z',
  })

  it('salva quello che è stato scritto, quando si tocca Salva', async () => {
    const user = userEvent.setup()
    const onSalva = vi.fn()
    render(<NoteEsercizi esercizi={esercizi} note={[]} onSalva={onSalva}/>)

    await user.click(screen.getByText('Scrivi'))
    await user.type(screen.getByRole('textbox'), 'Scendi più lento')
    await user.click(screen.getByText('Salva'))

    expect(onSalva).toHaveBeenCalledWith('px-Panca piana al MPW', 'Scendi più lento')
  })

  it('non salva niente solo perché il campo ha perso il fuoco', async () => {
    // Il cuore della regressione: uscire dal campo non deve decidere nulla.
    const user = userEvent.setup()
    const onSalva = vi.fn()
    render(<NoteEsercizi esercizi={esercizi} note={[]} onSalva={onSalva}/>)

    await user.click(screen.getByText('Scrivi'))
    await user.type(screen.getByRole('textbox'), 'Mezzo pensiero')
    await user.tab()

    expect(onSalva).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toBeInTheDocument()   // resta aperto
  })

  it('Annulla butta via la modifica senza scriverla', async () => {
    const user = userEvent.setup()
    const onSalva = vi.fn()
    render(<NoteEsercizi esercizi={esercizi} note={[nota('Presa larga')]} onSalva={onSalva}/>)

    await user.click(screen.getByText('Modifica'))
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'Ripensamento')
    await user.click(screen.getByText('Annulla'))

    expect(onSalva).not.toHaveBeenCalled()
    expect(screen.getByText('Presa larga')).toBeInTheDocument()
  })

  it('dice Elimina, non Salva, quando svuotare significa cancellare', async () => {
    const user = userEvent.setup()
    const onSalva = vi.fn()
    render(<NoteEsercizi esercizi={esercizi} note={[nota('Presa larga')]} onSalva={onSalva}/>)

    await user.click(screen.getByText('Modifica'))
    await user.clear(screen.getByRole('textbox'))

    await user.click(screen.getByText('Elimina'))
    expect(onSalva).toHaveBeenCalledWith('px-Panca piana al MPW', '')
  })

  it('non lascia salvare quando non è cambiato niente', async () => {
    const user = userEvent.setup()
    render(<NoteEsercizi esercizi={esercizi} note={[nota('Presa larga')]} onSalva={vi.fn()}/>)

    await user.click(screen.getByText('Modifica'))
    expect(screen.getByText('Salva')).toBeDisabled()
  })
})

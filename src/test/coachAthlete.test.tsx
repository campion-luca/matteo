import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CoachAthlete, UltimoAllenamento, NoteEsercizi } from '@/features/coach/CoachAthlete'
import { CoachSessioni } from '@/features/coach/CoachSessioni'
import { CoachGrafici, CoachEsercizio } from '@/features/coach/CoachEsercizi'
import type { AthleteData, NotaCoach } from '@/lib/coach'
import type { GymScheda, PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'

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

  it('sessioni e note stanno dietro un bottone, non in pagina', async () => {
    const user = userEvent.setup()
    const onSessioni = vi.fn()
    const onNote = vi.fn()
    render(
      <CoachAthlete
        data={dati([ex('Panca piana', [h({ date: '2026-08-20' }), h({ date: '2026-08-27' })])])}
        note={2}
        onApriSessioni={onSessioni}
        onApriNote={onNote}
      />,
    )
    // Né la tabella del confronto né la tendina delle sessioni sono qui.
    expect(screen.queryByText(/di solito/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Scegli la sessione')).not.toBeInTheDocument()
    expect(screen.getByText('2 scritte')).toBeInTheDocument()
    expect(screen.getByText('2 giornate')).toBeInTheDocument()

    await user.click(screen.getByText('Sessioni'))
    expect(onSessioni).toHaveBeenCalledOnce()
    await user.click(screen.getByText('Note'))
    expect(onNote).toHaveBeenCalledOnce()
  })

  it('fra sessioni e note c’è la porta dei grafici, e dice quanti esercizi hanno uno storico', async () => {
    const user = userEvent.setup()
    const onGrafici = vi.fn()
    render(
      <CoachAthlete
        data={dati([ex('Panca piana', [h({ date: '2026-08-20' })]), ex('Squat', [h({ date: '2026-08-20' })])])}
        onApriSessioni={vi.fn()} onApriGrafici={onGrafici} onApriNote={vi.fn()}
      />,
    )
    const porte = screen.getAllByRole('button').map(b => b.textContent).filter(x => /Sessioni|Grafici|Note/.test(x ?? ''))
    expect(porte.map(x => x!.match(/Sessioni|Grafici|Note/)![0])).toEqual(['Sessioni', 'Grafici', 'Note'])
    expect(screen.getByText('2 esercizi')).toBeInTheDocument()
    await user.click(screen.getByText('Grafici'))
    expect(onGrafici).toHaveBeenCalledOnce()
  })
})

describe('CoachSessioni — le giornate confrontate con la scheda', () => {
  const scheda: GymScheda = {
    id: 'sA', title: 'Scheda A', createdAt: '', updatedAt: '',
    exercises: [
      { id: 'e1', name: 'Panca piana', sets: 3, reps: '10' },
      { id: 'e2', name: 'Squat', sets: 3, reps: '8' },
    ],
  }
  const daScheda = { id: 'sA', nome: 'Scheda A' }

  it('ogni giornata dice cosa non torna, e il dettaglio lo segna in rosso', async () => {
    const user = userEvent.setup()
    const onConfronto = vi.fn()
    render(<CoachSessioni
      data={dati([
        ex('Panca piana', [
          h({ date: '2026-08-20', scheda: daScheda }),
          // Due serie invece di tre, 2,5 kg in meno.
          h({ date: '2026-08-27', kg: 57.5, sets_n: 2, scheda: daScheda }),
        ]),
        ex('Squat', [h({ date: '2026-08-20', kg: 90, reps: 8, scheda: daScheda })]),
      ])}
      schedeAssegnate={[scheda]}
      onConfronto={onConfronto}
    />)

    // Per settimane, contate dalla prima sessione (qui non c'è una data di
    // assegnazione). All'ingresso è tutto chiuso: si vedono le settimane, e
    // quella con un problema lo dice già dalla sua riga.
    expect(screen.getByText('Settimana 2')).toBeInTheDocument()
    expect(screen.getByText(/1 da guardare/)).toBeInTheDocument()
    expect(screen.queryByText(/1 esercizio saltato/)).not.toBeInTheDocument()
    expect(screen.queryByText('Saltato')).not.toBeInTheDocument()

    // Aperta la settimana, la giornata — ancora chiusa — riassume i problemi…
    await user.click(screen.getByText('Settimana 2'))
    expect(screen.getByText('1 esercizio saltato · 1 serie in meno · 1 carico sceso')).toBeInTheDocument()
    expect(screen.queryByText('Saltato')).not.toBeInTheDocument()
    // …e aperta anche lei mostra lo Squat saltato e il calo di carico.
    await user.click(screen.getByText(/1 esercizio saltato/))
    expect(screen.getByText('Saltato')).toBeInTheDocument()
    expect(screen.getByText(/−2,5 kg/)).toBeInTheDocument()

    // La precedente, nella settimana 1, è a posto.
    await user.click(screen.getByText('Settimana 1'))
    expect(screen.getByText('scheda rispettata')).toBeInTheDocument()

    await user.click(screen.getByText('Confronto'))
    expect(onConfronto).toHaveBeenCalledOnce()
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

    await user.click(screen.getByRole('button', { name: /^Petto/ }))   // i gruppi partono chiusi
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

    await user.click(screen.getByRole('button', { name: /^Petto/ }))   // i gruppi partono chiusi
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

    await user.click(screen.getByRole('button', { name: /^Petto/ }))   // i gruppi partono chiusi
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

    await user.click(screen.getByRole('button', { name: /^Petto/ }))   // i gruppi partono chiusi
    await user.click(screen.getByText('Modifica'))
    await user.clear(screen.getByRole('textbox'))

    await user.click(screen.getByText('Elimina'))
    expect(onSalva).toHaveBeenCalledWith('px-Panca piana al MPW', '')
  })

  it('non lascia salvare quando non è cambiato niente', async () => {
    const user = userEvent.setup()
    render(<NoteEsercizi esercizi={esercizi} note={[nota('Presa larga')]} onSalva={vi.fn()}/>)

    await user.click(screen.getByRole('button', { name: /^Petto/ }))   // i gruppi partono chiusi
    await user.click(screen.getByText('Modifica'))
    expect(screen.getByText('Salva')).toBeDisabled()
  })
})

// Con trenta esercizi in fila, per scrivere una nota sullo squat bisognava
// scorrerli tutti: adesso stanno sotto il loro muscolo.
describe('NoteEsercizi — raggruppate per muscolo', () => {
  const di = (n: string, muscle: string): PalestraExercise => ({ ...ex(n, [h({})]), muscle })
  const esercizi = [di('Squat', 'Gambe'), di('Panca piana', 'Petto'), di('Leg curl', 'Gambe'), di('Croci', 'Petto'), di('Presa', 'Avambracci')]

  it('un gruppo per muscolo, nell’ordine di sempre, con i gruppi creati dall’allievo in fondo', () => {
    render(<NoteEsercizi esercizi={esercizi} note={[]} onSalva={vi.fn()}/>)
    const titoli = screen.getAllByRole('button').map(e => e.textContent)
    expect(titoli).toEqual(['Petto · 2', 'Gambe · 2', 'Avambracci · 1'])
  })

  it('all’ingresso i gruppi sono tutti chiusi: si apre solo quello che serve', async () => {
    const user = userEvent.setup()
    render(<NoteEsercizi esercizi={esercizi} note={[]} onSalva={vi.fn()}/>)
    expect(screen.queryByText('Squat')).not.toBeInTheDocument()
    expect(screen.queryByText('Panca piana')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Gambe/ }))
    expect(screen.getByText('Squat')).toBeInTheDocument()
    // Gli altri restano chiusi.
    expect(screen.queryByText('Panca piana')).not.toBeInTheDocument()
    // E si richiude.
    await user.click(screen.getByRole('button', { name: /^Gambe/ }))
    expect(screen.queryByText('Squat')).not.toBeInTheDocument()
  })

  it('dentro al gruppo chi ha una nota sale in cima, e il gruppo dice quante ne ha', async () => {
    const user = userEvent.setup()
    const nota: NotaCoach = { coach_id: 'c', athlete_id: 'a', exercise_id: 'px-Squat', nota: 'Sotto il parallelo', coach_name: null, updated_at: '' }
    render(<NoteEsercizi esercizi={esercizi} note={[nota]} onSalva={vi.fn()}/>)
    // Quante note ha il gruppo si legge già da chiuso.
    expect(screen.getByText('1 nota')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Gambe/ }))
    const nomi = screen.getAllByText(/^(Squat|Leg curl)$/).map(e => e.textContent)
    expect(nomi).toEqual(['Squat', 'Leg curl'])
  })
})

// Fra due allievi, a corpo libero vince la bilancia e non la forza.
describe('Migliori alzate — senza il corpo libero', () => {
  it('trazioni e addominali non entrano in classifica, la panca sì', () => {
    render(<CoachAthlete data={dati([
      ex('Panca piana', [h({ date: '2026-08-20' })]),
      ex('Trazioni', [h({ date: '2026-08-20', kg: 0, bodyweight: true })]),
      ex('Sollevamenti gambe alla sbarra', [h({ date: '2026-08-20', kg: 0, reps: 15 })]),
    ])}/>)
    // Nel riepilogo i nomi degli esercizi compaiono solo in questa classifica.
    expect(screen.getByText('Migliori alzate')).toBeInTheDocument()
    expect(screen.getByText('Panca piana')).toBeInTheDocument()
    expect(screen.queryByText('Trazioni')).not.toBeInTheDocument()
    expect(screen.queryByText('Sollevamenti gambe alla sbarra')).not.toBeInTheDocument()
  })
})

describe('CoachSessioni — anteprima e correzione', () => {
  const scheda: GymScheda = {
    id: 'sA', title: 'Scheda A', createdAt: '', updatedAt: '',
    exercises: [{ id: 'e1', name: 'Panca piana', sets: 3, reps: '10' }],
  }
  const daScheda = { id: 'sA', nome: 'Scheda A' }
  const allievo = dati([ex('Panca piana', [
    h({ date: '2026-08-20', scheda: daScheda }),
    h({ date: '2026-08-21', kg: 62.5, scheda: daScheda }),
  ])])

  it('la giornata dice anche cosa è andato bene: il carico salito, già da chiusa', async () => {
    const user = userEvent.setup()
    render(<CoachSessioni data={allievo} schedeAssegnate={[scheda]}/>)
    await user.click(screen.getByText('Settimana 1'))
    expect(screen.getByText(/1 carico salito/)).toBeInTheDocument()
    // Il dettaglio dell'esercizio è ancora chiuso: lo si legge dalla riga.
    expect(screen.queryByText(/\+2,5 kg/)).not.toBeInTheDocument()
  })

  it('la matita su un’alzata chiede di correggerla, con l’esercizio e l’alzata giusti', async () => {
    const user = userEvent.setup()
    const onCorreggi = vi.fn()
    render(<CoachSessioni data={allievo} schedeAssegnate={[scheda]} onCorreggi={onCorreggi}/>)
    await user.click(screen.getByText('Settimana 1'))
    await user.click(screen.getByText(/1 carico salito/))
    await user.click(screen.getByRole('button', { name: /Correggi Panca piana/ }))
    expect(onCorreggi).toHaveBeenCalledWith('px-Panca piana', expect.objectContaining({ date: '2026-08-21', kg: 62.5 }))
  })

  it('senza chi sa correggere, la matita non c’è', async () => {
    const user = userEvent.setup()
    render(<CoachSessioni data={allievo} schedeAssegnate={[scheda]}/>)
    await user.click(screen.getByText('Settimana 1'))
    await user.click(screen.getByText(/1 carico salito/))
    expect(screen.queryByRole('button', { name: /Correggi/ })).not.toBeInTheDocument()
  })
})

describe('Grafici dell’allievo', () => {
  const di = (n: string, muscle: string, history: PalestraHistoryEntry[]): PalestraExercise => ({ ...ex(n, history), muscle })
  const esercizi = [
    di('Panca piana', 'Petto', [h({ date: '2026-08-20', kg: 60 }), h({ date: '2026-08-27', kg: 65 })]),
    di('Squat', 'Gambe', [h({ date: '2026-08-20', kg: 90 })]),
    { ...di('Leg curl', 'Gambe', [h({ date: '2026-08-20' })]), history: [] },
  ]

  it('l’elenco è per muscolo, chiuso, e senza gli esercizi mai fatti', async () => {
    const user = userEvent.setup()
    const onApri = vi.fn()
    render(<CoachGrafici esercizi={esercizi} onApri={onApri}/>)
    expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['Petto · 1', 'Gambe · 1'])
    await user.click(screen.getByRole('button', { name: /^Gambe/ }))
    expect(screen.queryByText('Leg curl')).not.toBeInTheDocument()
    await user.click(screen.getByText('Squat'))
    expect(onApri).toHaveBeenCalledWith(expect.objectContaining({ n: 'Squat' }))
  })

  it('la scheda di un esercizio mostra quanto è salito dall’inizio, e ogni alzata si corregge', async () => {
    const user = userEvent.setup()
    const onCorreggi = vi.fn()
    render(<CoachEsercizio ex={esercizi[0]} peso={80} onCorreggi={onCorreggi}/>)
    expect(screen.getByText('65 kg')).toBeInTheDocument()     // miglior kg
    expect(screen.getByText('+5 kg')).toBeInTheDocument()     // dall'inizio
    expect(screen.getByText('Carico (kg)')).toBeInTheDocument()
    // Dalla più recente: la prima matita è quella del 27.
    await user.click(screen.getAllByRole('button', { name: /Correggi/ })[0])
    expect(onCorreggi).toHaveBeenCalledWith('px-Panca piana', expect.objectContaining({ date: '2026-08-27', kg: 65 }))
  })

  it('un esercizio a colpi si legge a colpi, non a chili', () => {
    const abWheel = di('Ab wheel', 'Core', [h({ date: '2026-08-20', kg: 0, reps: 10, bodyweight: true }), h({ date: '2026-08-27', kg: 0, reps: 14, bodyweight: true })])
    render(<CoachEsercizio ex={abWheel} peso={104}/>)
    expect(screen.getByText('14 colpi')).toBeInTheDocument()
    expect(screen.getByText('+4 colpi')).toBeInTheDocument()
    expect(screen.queryByText('Massimale stimato (kg)')).not.toBeInTheDocument()
  })
})

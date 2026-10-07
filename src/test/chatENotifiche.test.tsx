import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { idChat, eChat, bozzaChat, creaMessaggio, conversazioni, nonLetti, type Messaggio } from '@/lib/messaggi'
import { contaAllenamento, riassuntoAllenamento } from '@/features/gym/riassuntoAllenamento'
import { chiaveInBytes } from '@/lib/push'
import { useMessaggiStore } from '@/lib/messaggiLive'
import { ChatDiretta } from '@/features/coach/ChatDiretta'
import { Bolla } from '@/features/coach/messaggiUI'
import type { GymScheda } from '@/store/useJarvisStore'

// La chat diretta vive nella tabella dei messaggi sulle schede, riconosciuta da
// un id costruito apposta. Quello che deve reggere: due chat con due persone
// diverse non si fondono, una chat non si confonde con una scheda, e il pallino
// rosso conta anche gli avvisi che l'app scrive da sé.

const COACH = 'coach-1', ANNA = 'atleta-anna', BRUNO = 'atleta-bruno'

const msg = (o: Partial<Messaggio> & Pick<Messaggio, 'autore' | 'athlete_id'>, quando: string): Messaggio =>
  creaMessaggio({
    scheda_id: idChat(COACH, o.athlete_id), scheda_titolo: null, coach_id: COACH,
    autore_nome: o.autore === COACH ? 'Luca' : 'Allievo', esercizio_id: null, esercizio_nome: null,
    tipo: 'chat', testo: 'ciao', ...o,
  }, quando)

describe('il filo diretto', () => {
  it('ha un id per ogni coppia, e si distingue da una scheda', () => {
    expect(idChat(COACH, ANNA)).not.toBe(idChat(COACH, BRUNO))
    expect(eChat(idChat(COACH, ANNA))).toBe(true)
    expect(eChat('sc_abc123')).toBe(false)
  })

  it('una bozza di chat è a nome di chi scrive, senza scheda né esercizio', () => {
    const b = bozzaChat({ coachId: COACH, athleteId: ANNA, autore: ANNA, autoreNome: ' Anna ', tipo: 'chat', testo: 'ci sono' })
    expect(b).toMatchObject({ scheda_id: idChat(COACH, ANNA), coach_id: COACH, athlete_id: ANNA, autore: ANNA, autore_nome: 'Anna', scheda_titolo: null, esercizio_id: null })
  })

  it('chi segue due persone ha due chat, non una', () => {
    const fili = conversazioni([
      msg({ autore: ANNA, athlete_id: ANNA }, '2026-10-01T10:00:00Z'),
      msg({ autore: BRUNO, athlete_id: BRUNO }, '2026-10-01T11:00:00Z'),
      msg({ autore: COACH, athlete_id: ANNA }, '2026-10-01T12:00:00Z'),
    ], COACH)
    expect(fili).toHaveLength(2)
    expect(fili.every(f => f.diretta)).toBe(true)
    // In cima il filo aggiornato più di recente.
    expect(fili[0].athleteId).toBe(ANNA)
    expect(fili[0].messaggi).toHaveLength(2)
  })

  it('una chat e una richiesta su una scheda restano due fili', () => {
    const suScheda = creaMessaggio({
      scheda_id: 'sc_1', scheda_titolo: 'Lunedì', coach_id: COACH, athlete_id: ANNA, autore: ANNA, autore_nome: 'Anna',
      esercizio_id: 'e1', esercizio_nome: 'Squat', tipo: 'sostituzione', testo: 'macchina occupata',
    }, '2026-10-01T09:00:00Z')
    const fili = conversazioni([suScheda, msg({ autore: ANNA, athlete_id: ANNA }, '2026-10-01T10:00:00Z')], COACH)
    expect(fili.map(f => f.diretta)).toEqual([true, false])
  })

  it('un avviso dell’app conta come messaggio da leggere, per chi lo riceve', () => {
    const avviso = msg({ autore: ANNA, athlete_id: ANNA, tipo: 'allenamento', testo: 'Allenamento finito' }, '2026-10-01T10:00:00Z')
    expect(nonLetti([avviso], COACH)).toHaveLength(1)
    expect(nonLetti([avviso], ANNA)).toHaveLength(0)
  })
})

describe('il riassunto di un allenamento finito', () => {
  const scheda: GymScheda = {
    id: 's', title: 'Lunedì', createdAt: '', updatedAt: '',
    exercises: [
      { id: 'a', name: 'Panca', sets: 3, reps: '8-10' },
      { id: 'b', name: 'Croci', sets: 3, reps: '12' },
      { id: 'c', name: 'Dip', sets: 2, reps: 'max' },
    ],
  }
  const t = (s: string, v?: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v?.[k]))
  const serie = (id: string, checks: boolean[], reps: string[]) => ({ id, checks, reps })

  it('tutto fatto: lo dice in due parole', () => {
    const esiti = [serie('a', [true, true, true], ['8', '9', '10']), serie('b', [true, true, true], ['12', '12', '12']), serie('c', [true, true], ['14', '11'])]
    expect(contaAllenamento(scheda, esiti)).toEqual({ fatti: 3, totali: 3, serieMancanti: 0, serieCorte: 0 })
    expect(riassuntoAllenamento(scheda, esiti, t)).toBe('Allenamento finito: «Lunedì». tutto come da scheda')
  })

  it('conta esercizi saltati, serie in meno e serie sotto i colpi', () => {
    const esiti = [
      serie('a', [true, true, false], ['8', '6', '']),           // una serie in meno, una corta
      serie('b', [false, false, false], ['12', '12', '12']),     // saltato
      serie('c', [true, true], ['14', '3']),                      // "max": niente è corto
    ]
    expect(contaAllenamento(scheda, esiti)).toEqual({ fatti: 2, totali: 3, serieMancanti: 1, serieCorte: 1 })
    expect(riassuntoAllenamento(scheda, esiti, t)).toBe('Allenamento finito: «Lunedì». 1 esercizio saltato · 1 serie in meno · 1 serie corta')
  })

  it('le serie di un esercizio saltato non si contano due volte', () => {
    const esiti = [serie('a', [true, true, true], ['8', '8', '8'])]
    expect(contaAllenamento(scheda, esiti)).toMatchObject({ fatti: 1, serieMancanti: 0 })
  })

  it('il campo dei colpi lasciato vuoto vale il previsto, non zero', () => {
    const esiti = [serie('b', [true, true, true], ['', '', ''])]
    expect(contaAllenamento(scheda, esiti).serieCorte).toBe(0)
  })

  // Le serie spuntate senza chili, con un attrezzo, valgono come non fatte:
  // l'allenatore deve leggere lo stesso allenamento che finisce nello storico.
  it('una serie con attrezzo senza chili non conta; a corpo libero sì', () => {
    const esiti = [
      { id: 'a', checks: [true, true, true], reps: ['8', '8', '8'], weights: ['60', '', '0'] },             // ne resta una
      { id: 'b', checks: [true, true, true], reps: ['12', '12', '12'], weights: ['', '', ''] },             // saltato
      { id: 'c', checks: [true, true], reps: ['14', '11'], weights: ['', ''], corpo: true },                 // corpo libero: valgono
    ]
    expect(contaAllenamento(scheda, esiti)).toEqual({ fatti: 2, totali: 3, serieMancanti: 2, serieCorte: 0 })
  })

  it('dice quanto è durato, se lo si sa', () => {
    const esiti = [serie('a', [true, true, true], ['8', '9', '10']), serie('b', [true, true, true], ['12', '12', '12']), serie('c', [true, true], ['14', '11'])]
    expect(riassuntoAllenamento(scheda, esiti, t, 52 * 60)).toBe('Allenamento finito: «Lunedì» in 52 min. tutto come da scheda')
    expect(riassuntoAllenamento(scheda, esiti, t, 65 * 60)).toContain('in 1 h 05')
  })

  it('porta la nota scritta su un esercizio saltato, che nello storico non avrebbe posto', () => {
    const esiti = [
      serie('a', [true, true, true], ['8', '9', '10']),
      { ...serie('b', [false, false, false], ['12', '12', '12']), note: 'macchina rotta' },
      { ...serie('c', [true, true], ['14', '11']), note: 'bene' },   // fatto: la sua nota sta nell'alzata
    ]
    expect(riassuntoAllenamento(scheda, esiti, t)).toBe('Allenamento finito: «Lunedì». 1 esercizio saltato — Sui saltati: Croci: macchina rotta')
  })
})

describe('la chiave delle notifiche', () => {
  it('passa da base64 "url-safe" ai 65 byte che vuole il browser', () => {
    // Una chiave pubblica P-256 non compressa: 0x04 + 64 byte.
    const chiave = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
    const bytes = chiaveInBytes(chiave)
    expect(bytes).toHaveLength(65)
    expect(bytes[0]).toBe(4)
  })
})

describe('la chat a schermo', () => {
  beforeEach(() => useMessaggiStore.setState({ userId: COACH, messaggi: [], primoGiroFatto: true, errore: null }))
  afterEach(cleanup)

  it('mostra solo i messaggi di questa coppia, in ordine', () => {
    useMessaggiStore.setState({ messaggi: [
      msg({ autore: COACH, athlete_id: ANNA, testo: 'secondo' }, '2026-10-01T11:00:00Z'),
      msg({ autore: ANNA, athlete_id: ANNA, testo: 'primo' }, '2026-10-01T10:00:00Z'),
      msg({ autore: BRUNO, athlete_id: BRUNO, testo: 'di un altro' }, '2026-10-01T10:30:00Z'),
    ] })
    render(<ChatDiretta coachId={COACH} athleteId={ANNA} io={COACH} mioNome="Luca"/>)
    expect(screen.getAllByText(/^(primo|secondo)$/).map(e => e.textContent)).toEqual(['primo', 'secondo'])
    expect(screen.queryByText('di un altro')).not.toBeInTheDocument()
  })

  it('vuota invita a scrivere, e il messaggio compare appena inviato', async () => {
    const user = userEvent.setup()
    // Un server finto che si ricorda cosa gli viene scritto, come quello vero:
    // il giro che rilegge i messaggi deve ritrovare quello appena mandato.
    const tabella: unknown[] = []
    const rete = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (String(url).includes('coach_messaggi') && init?.method === 'POST') tabella.push(JSON.parse(String(init.body)))
      return new Response(JSON.stringify(tabella), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    render(<ChatDiretta coachId={COACH} athleteId={ANNA} io={COACH} mioNome="Luca"/>)
    expect(screen.getByText('Nessun messaggio. Scrivi il primo.')).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('Scrivi un messaggio…'), 'Come è andata?')
    await user.click(screen.getByRole('button', { name: 'Invia' }))
    // Compare subito, prima che il server risponda (eco locale).
    expect(await screen.findByText('Come è andata?')).toBeInTheDocument()
    const scritture = rete.mock.calls
      .filter(([url, init]) => String(url).includes('coach_messaggi') && init?.method === 'POST')
      .map(([, init]) => JSON.parse(String(init?.body)))
    expect(scritture).toHaveLength(1)
    expect(scritture[0]).toMatchObject({ tipo: 'chat', autore: COACH, athlete_id: ANNA, scheda_id: idChat(COACH, ANNA), testo: 'Come è andata?' })
    vi.restoreAllMocks()
  })

  it('un avviso dell’app porta la sua etichetta, un messaggio scritto no', () => {
    const { unmount } = render(<Bolla io={COACH} m={msg({ autore: ANNA, athlete_id: ANNA, tipo: 'allenamento', testo: 'Allenamento finito' }, '2026-10-01T10:00:00Z')}/>)
    expect(screen.getByText('allenamento')).toBeInTheDocument()
    unmount()
    render(<Bolla io={COACH} m={msg({ autore: ANNA, athlete_id: ANNA, testo: 'ciao' }, '2026-10-01T10:00:00Z')}/>)
    expect(screen.queryByText('allenamento')).not.toBeInTheDocument()
  })
})

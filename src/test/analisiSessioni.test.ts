import { describe, it, expect } from 'vitest'
import { perSettimana, haProblemi, analizzaGiornate, rigaNataIl, serieSottoIlBersaglio, esitoCarichi, giorniDellaSettimana, confrontaGiornate, colpiTotali } from '@/features/coach/analisiSessioni'
import type { GymScheda, PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'

const SCHEDA_A: GymScheda = {
  id: 'sA', title: 'Scheda A', createdAt: '', updatedAt: '',
  exercises: [
    { id: 'e1', name: 'Panca piana', sets: 4, reps: '8' },
    { id: 'e2', name: 'Rematore', sets: 3, reps: '8-10' },
    { id: 'e3', name: 'Curl', sets: 3, reps: '12' },
  ],
}
const daScheda = { id: 'sA', nome: 'Scheda A' }
const alzata = (date: string, kg: number, reps: number, sets_n: number, extra: Partial<PalestraHistoryEntry> = {}): PalestraHistoryEntry =>
  ({ d: date, date, kg, reps, sets_n, ...extra })
const es = (id: string, n: string, history: PalestraHistoryEntry[], muscle = 'Petto'): PalestraExercise =>
  ({ id, n, muscle, current: { kg: 0, reps: 0, sets_n: 0 }, history })

/** L'id di una riga di scheda scritta quel giorno, com'è fatto davvero:
 *  "r" + l'istante in base 36 + qualche carattere a caso (vedi lib/uid.ts). */
const rigaDel = (giorno: string) => `r${new Date(`${giorno}T12:00:00`).getTime().toString(36)}ab12cd`

describe('quando è nata una riga di scheda', () => {
  it('si legge dal suo id', () => {
    expect(rigaNataIl(rigaDel('2026-09-20'))).toBe('2026-09-20')
  })

  it('un id fatto in un altro modo non dice niente', () => {
    expect(rigaNataIl('e1')).toBeNull()
    expect(rigaNataIl('riga-di-prova')).toBeNull()
    expect(rigaNataIl('')).toBeNull()
    // Sembra un id, ma l'istante che contiene non è plausibile.
    expect(rigaNataIl('r00000001abcdef')).toBeNull()
  })
})

describe('una giornata di scheda', () => {
  const palestra = [
    es('p', 'Panca piana', [
      alzata('2026-09-10', 80, 8, 4, { scheda: daScheda }),
      // Oggi: una serie in meno, l'ultima a 6 colpi, 2,5 kg in più.
      alzata('2026-09-17', 82.5, 8, 3, { scheda: daScheda, setReps: [8, 8, 6] }),
    ]),
    es('r', 'rematore', [
      alzata('2026-09-10', 60, 10, 3, { scheda: daScheda }),
      alzata('2026-09-17', 55, 8, 3, { scheda: daScheda }),                  // 8 su "8-10": va bene
    ], 'Dorso'),
    es('c', 'Curl', [alzata('2026-09-10', 14, 12, 3, { scheda: daScheda })], 'Bicipiti'),
    es('x', 'Crunch', [alzata('2026-09-17', 0, 20, 2, { scheda: daScheda, bodyweight: true })], 'Core'),
  ]
  const [oggi] = analizzaGiornate(palestra, [SCHEDA_A], 80)
  const gruppo = oggi.gruppi[0]
  const per = (nome: string) => gruppo.esercizi.find(e => e.nome === nome)!

  it('è la giornata più recente, con la sua scheda confrontabile', () => {
    expect(oggi.date).toBe('2026-09-17')
    expect(gruppo).toMatchObject({ scheda: daScheda, confrontabile: true })
  })

  it('un esercizio della scheda senza alzata è saltato', () => {
    expect(per('Curl')).toMatchObject({ saltato: true, serieMancanti: 3, carico: null })
    expect(oggi.saltati).toBe(1)
  })

  it('segna le serie mancanti e le serie corte', () => {
    expect(per('Panca piana')).toMatchObject({ serieMancanti: 1, serieCorte: [2] })
    expect(oggi.serieMancanti).toBe(1)                  // il Curl saltato non si conta due volte
    expect(oggi.serieCorte).toBe(1)
  })

  it('con un intervallo di colpi il minimo è rispettare la scheda', () => {
    expect(per('rematore').serieCorte).toEqual([])
  })

  it('il nome si abbina senza badare a maiuscole e spazi', () => {
    expect(per('rematore').saltato).toBe(false)
  })

  it('confronta il carico con l’ultima volta', () => {
    expect(per('Panca piana').carico).toEqual({ ora: 82.5, prima: 80, delta: 2.5 })
    expect(per('rematore').carico).toEqual({ ora: 55, prima: 60, delta: -5 })
    expect(oggi.caloCarico).toBe(1)
    // Si contano anche quelli saliti: e' cio' che la riga chiusa dice in verde.
    expect(oggi.caricoSalito).toBe(oggi.gruppi.flatMap(x => x.esercizi).filter(e => (e.carico?.delta ?? 0) > 0).length)
  })

  it('un esercizio non previsto resta visibile come fuori scheda', () => {
    expect(per('Crunch')).toMatchObject({ fuoriScheda: true, saltato: false })
    // A corpo libero il carico che si confronta è la sola zavorra: il peso di
    // chi si allena non è una scelta di quel giorno.
    expect(per('Crunch').carico).toMatchObject({ ora: 0, prima: null, delta: null })
  })

  it('segue l’ordine della scheda', () => {
    expect(gruppo.esercizi.map(e => e.nome)).toEqual(['Panca piana', 'rematore', 'Curl', 'Crunch'])
  })
})

// Una scheda si modifica. Ogni giornata va letta con la scheda com'era QUEL
// giorno: giudicandole tutte con quella di oggi, il giorno dopo una modifica
// le settimane passate cambiavano colore da sole.
describe('una scheda cambiata dopo quel giorno', () => {
  const scheda = (exercises: GymScheda['exercises']): GymScheda =>
    ({ id: 'sA', title: 'Scheda A', createdAt: '', updatedAt: '', exercises })
  const giorno = (giornate: ReturnType<typeof analizzaGiornate>, date: string) => giornate.find(g => g.date === date)!

  it('serie e colpi previsti sono quelli di allora, non quelli di oggi', () => {
    // Il 17 la scheda chiedeva 3 × 8, e li ha fatti. Poi è diventata 4 × 10.
    const palestra = [es('p', 'Panca piana', [alzata('2026-09-17', 80, 8, 3, { scheda: daScheda, piano: { sets: 3, reps: '8' } })])]
    const [g] = analizzaGiornate(palestra, [scheda([{ id: 'e1', name: 'Panca piana', sets: 4, reps: '10' }])], 80)
    expect(g.gruppi[0].esercizi[0]).toMatchObject({ previsto: { serie: 3, colpi: '8' }, serieMancanti: 0, serieCorte: [] })
    expect(g).toMatchObject({ serieMancanti: 0, serieCorte: 0 })
  })

  it('un’alzata di prima che il piano si salvasse si giudica con la scheda di oggi, come sempre', () => {
    const palestra = [es('p', 'Panca piana', [alzata('2026-09-17', 80, 8, 3, { scheda: daScheda })])]
    const [g] = analizzaGiornate(palestra, [scheda([{ id: 'e1', name: 'Panca piana', sets: 4, reps: '10' }])], 80)
    expect(g.gruppi[0].esercizi[0]).toMatchObject({ previsto: { serie: 4, colpi: '10' }, serieMancanti: 1 })
  })

  it('con i colpi a scalare ogni serie ha il suo bersaglio', () => {
    const riga = { id: 'e1', name: 'Squat', sets: 3, reps: '10-8-6' }
    const fatta = (setReps: number[]) => analizzaGiornate(
      [es('s', 'Squat', [alzata('2026-09-17', 100, 10, 3, { scheda: daScheda, setReps })], 'Gambe')], [scheda([riga])], 80,
    )[0].gruppi[0].esercizi[0].serieCorte
    expect(fatta([10, 8, 6])).toEqual([])     // alla lettera: prima erano due serie in rosso
    expect(fatta([10, 7, 6])).toEqual([1])
  })

  it('un esercizio aggiunto dopo non risulta saltato nei giorni di prima', () => {
    const def = scheda([
      { id: rigaDel('2026-09-01'), name: 'Panca piana', sets: 3, reps: '8' },
      { id: rigaDel('2026-09-20'), name: 'Croci', sets: 3, reps: '12' },      // aggiunto il 20
    ])
    const palestra = [es('p', 'Panca piana', [
      alzata('2026-09-17', 80, 8, 3, { scheda: daScheda }),
      alzata('2026-09-24', 80, 8, 3, { scheda: daScheda }),
    ])]
    const giornate = analizzaGiornate(palestra, [def], 80)
    // Il 17 le Croci non erano in scheda: non c'è niente da segnare.
    expect(giorno(giornate, '2026-09-17').saltati).toBe(0)
    expect(giorno(giornate, '2026-09-17').gruppi[0].esercizi.map(e => e.nome)).toEqual(['Panca piana'])
    // Il 24 sì, e non le ha fatte.
    expect(giorno(giornate, '2026-09-24').saltati).toBe(1)
  })

  it('una riga cambiata con un altro esercizio: l’alzata di allora resta al SUO posto', () => {
    // Il 17 la riga e1 era la Panca, e l'ha fatta. Poi chi allena l'ha cambiata
    // con la Chest press: stessa riga, altro esercizio. L'alzata sa da che riga
    // viene, e quel giorno si legge com'era.
    const def = scheda([
      { id: 'e1', name: 'Chest press', sets: 3, reps: '10' },
      { id: 'e2', name: 'Rematore', sets: 3, reps: '8' },
    ])
    const palestra = [
      es('p', 'Panca piana', [alzata('2026-09-17', 80, 8, 3, { scheda: daScheda, piano: { sets: 3, reps: '8', riga: 'e1' } })]),
      es('r', 'Rematore', [alzata('2026-09-17', 60, 8, 3, { scheda: daScheda, piano: { sets: 3, reps: '8', riga: 'e2' } })], 'Dorso'),
      es('c', 'Chest press', [alzata('2026-09-24', 50, 10, 3, { scheda: daScheda, piano: { sets: 3, reps: '10', riga: 'e1' } })]),
    ]
    const g = giorno(analizzaGiornate(palestra, [def], 80), '2026-09-17')
    expect(g.saltati).toBe(0)
    expect(g.gruppi[0].esercizi.map(e => e.nome)).toEqual(['Panca piana', 'Rematore'])
    expect(g.gruppi[0].esercizi[0]).toMatchObject({ fuoriScheda: false, saltato: false, previsto: { serie: 3, colpi: '8' } })
  })

  it('una riga tolta dopo: l’alzata di allora non è "fuori scheda", e i saltati veri restano', () => {
    // Il guasto che questo previene, trovato rileggendo: una regola che
    // "indovinava" la sostituzione dai numeri faceva sparire i Polpacci —
    // saltati da sempre — appena chi allena toglieva un'altra riga.
    const def = scheda([
      { id: 'e1', name: 'Panca piana', sets: 3, reps: '8' },
      { id: 'e3', name: 'Polpacci', sets: 3, reps: '15' },
    ])
    const palestra = [
      es('p', 'Panca piana', [alzata('2026-09-17', 80, 8, 3, { scheda: daScheda, piano: { sets: 3, reps: '8', riga: 'e1' } })]),
      es('c', 'Croci', [alzata('2026-09-17', 14, 12, 3, { scheda: daScheda, piano: { sets: 3, reps: '12', riga: 'e2' } })]),
    ]
    const g = giorno(analizzaGiornate(palestra, [def], 80), '2026-09-17')
    expect(g.saltati).toBe(1)
    expect(g.gruppi[0].esercizi.filter(e => e.saltato).map(e => e.nome)).toEqual(['Polpacci'])
    expect(g.gruppi[0].esercizi.find(e => e.nome === 'Croci')).toMatchObject({ fuoriScheda: false, previsto: { serie: 3, colpi: '12' } })
  })

  it('la stessa scheda fatta due volte in un giorno non nasconde un saltato', () => {
    const def = scheda([
      { id: 'e1', name: 'Panca piana', sets: 3, reps: '8' },
      { id: 'e3', name: 'Polpacci', sets: 3, reps: '15' },
    ])
    const fatta = () => alzata('2026-09-17', 80, 8, 3, { scheda: daScheda, piano: { sets: 3, reps: '8', riga: 'e1' } })
    const g = giorno(analizzaGiornate([es('p', 'Panca piana', [fatta(), fatta()])], [def], 80), '2026-09-17')
    expect(g.saltati).toBe(1)
    expect(g.gruppi[0].esercizi.filter(e => !e.saltato)).toHaveLength(2)
  })

  it('lo stesso esercizio su due righe: ogni alzata va sulla sua', () => {
    const def = scheda([
      { id: 'e1', name: 'Panca piana', sets: 3, reps: '5' },
      { id: 'e2', name: 'Panca piana', sets: 2, reps: '12' },
    ])
    // Nello storico la seconda viene prima della prima: per nome finirebbero scambiate.
    const palestra = [es('p', 'Panca piana', [
      alzata('2026-09-17', 60, 12, 2, { scheda: daScheda, piano: { sets: 2, reps: '12', riga: 'e2' } }),
      alzata('2026-09-17', 90, 5, 3, { scheda: daScheda, piano: { sets: 3, reps: '5', riga: 'e1' } }),
    ])]
    const g = giorno(analizzaGiornate(palestra, [def], 80), '2026-09-17')
    expect(g.gruppi[0].esercizi.map(e => e.fatto?.kg)).toEqual([90, 60])
    expect(g).toMatchObject({ saltati: 0, serieMancanti: 0, serieCorte: 0 })
  })

  it('un’alzata di prima che la riga si salvasse si abbina per nome, come sempre', () => {
    // Niente si indovina: la riga cambiata risulta saltata e l'esercizio di
    // allora, senza piano, fuori scheda. È com'era, e vale solo per i giorni
    // di prima.
    const def = scheda([{ id: 'e1', name: 'Chest press', sets: 3, reps: '10' }])
    const palestra = [es('p', 'Panca piana', [alzata('2026-09-17', 80, 8, 3, { scheda: daScheda })])]
    const g = giorno(analizzaGiornate(palestra, [def], 80), '2026-09-17')
    expect(g.saltati).toBe(1)
    expect(g.gruppi[0].esercizi.find(e => e.nome === 'Panca piana')).toMatchObject({ fuoriScheda: true })
  })

  it('senza alzate "orfane" una riga vecchia senza alzata è saltata, anche se non è mai stata fatta', () => {
    // È il caso che conta di più per chi allena: l'esercizio che l'allievo
    // salta da sempre. Non deve sparire solo perché non ha uno storico.
    const def = scheda([
      { id: rigaDel('2026-09-01'), name: 'Panca piana', sets: 3, reps: '8' },
      { id: rigaDel('2026-09-01'), name: 'Affondi', sets: 3, reps: '10' },
    ])
    const palestra = [es('p', 'Panca piana', [alzata('2026-09-17', 80, 8, 3, { scheda: daScheda, piano: { sets: 3, reps: '8' } })])]
    const [g] = analizzaGiornate(palestra, [def], 80)
    expect(g.saltati).toBe(1)
  })
})

// L'alzata salva solo le serie fatte, senza dire quali erano. Con i colpi a
// scalare e una serie in meno, l'avviso in chat (che le serie le ha davanti)
// diceva "tutto bene" e la schermata delle sessioni "due serie corte".
describe('le serie corte quando ne manca qualcuna', () => {
  it('con tutte le serie, ognuna si confronta col suo bersaglio', () => {
    expect(serieSottoIlBersaglio([10, 8, 6], [10, 8, 6])).toEqual([])
    expect(serieSottoIlBersaglio([10, 7, 6], [10, 8, 6])).toEqual([1])
    expect(serieSottoIlBersaglio([9, 8, 5], [10, 8, 6])).toEqual([0, 2])
  })

  it('con una serie in meno su un "10-8-6" non ne inventa di corte', () => {
    // Fatte la seconda e la terza, alla lettera: 8 e 6.
    expect(serieSottoIlBersaglio([8, 6], [10, 8, 6])).toEqual([])
    // Fatte la prima e la seconda.
    expect(serieSottoIlBersaglio([10, 8], [10, 8, 6])).toEqual([])
    // Una sola, a 6: può essere la terza.
    expect(serieSottoIlBersaglio([6], [10, 8, 6])).toEqual([])
  })

  it('…ma quelle che corte lo sono comunque le si mettano, restano corte', () => {
    expect(serieSottoIlBersaglio([8, 5], [10, 8, 6])).toEqual([1])
    expect(serieSottoIlBersaglio([5, 5], [10, 8, 6])).toEqual([0, 1])
  })

  it('con lo stesso bersaglio per tutte non c’è niente da abbinare', () => {
    expect(serieSottoIlBersaglio([8, 6], [8, 8, 8])).toEqual([1])
    expect(serieSottoIlBersaglio([12, 9, 9, 9], [10, 10, 10])).toEqual([1, 2, 3])
  })

  it('senza un bersaglio niente è corto', () => {
    expect(serieSottoIlBersaglio([3, 2], [])).toEqual([])
    expect(serieSottoIlBersaglio([3, 2], [0, 0])).toEqual([])
  })
})

describe('giornate senza confronto', () => {
  it('le alzate a mano non hanno serie mancanti né saltati', () => {
    const [g] = analizzaGiornate([es('p', 'Panca piana', [alzata('2026-09-17', 80, 8, 2)])], [SCHEDA_A], 80)
    expect(g.gruppi[0]).toMatchObject({ scheda: null, confrontabile: false })
    expect(g).toMatchObject({ saltati: 0, serieMancanti: 0 })
  })

  it('una scheda cancellata mostra le alzate senza inventare saltati', () => {
    const [g] = analizzaGiornate([es('p', 'Panca piana', [alzata('2026-09-17', 80, 8, 2, { scheda: { id: 'via', nome: 'Vecchia' } })])], [SCHEDA_A], 80)
    expect(g.gruppi[0]).toMatchObject({ confrontabile: false })
    expect(g.saltati).toBe(0)
  })

  it('i giorni di solo hyrox ci sono, vuoti', () => {
    const giornate = analizzaGiornate([], [], 80, ['2026-09-15'])
    expect(giornate).toHaveLength(1)
    expect(giornate[0]).toMatchObject({ soloHyrox: true, volume: 0 })
  })

  it('le giornate vanno dalla più recente', () => {
    const giornate = analizzaGiornate([es('p', 'Panca', [alzata('2026-09-01', 80, 8, 3), alzata('2026-09-20', 80, 8, 3)])], [], 80)
    expect(giornate.map(g => g.date)).toEqual(['2026-09-20', '2026-09-01'])
  })
})

// Le settimane dell'allenatore: sette giorni a partire da quando ha assegnato
// la prima scheda, non dal lunedì del calendario.
describe('le giornate per settimana', () => {
  const giorno = (date: string) => analizzaGiornate([es('p', 'Panca piana', [alzata(date, 80, 8, 3)])], [], 80)[0]
  const giornate = ['2026-09-08', '2026-09-16', '2026-09-18', '2026-09-30'].map(giorno)

  it('si contano dal giorno della prima scheda, non dal lunedì', () => {
    // Assegnata mercoledì 16: la settimana 1 va da mercoledì a martedì.
    const w = perSettimana(giornate, '2026-09-16', '2026-10-02')
    expect(w.map(s => s.n)).toEqual([3, 2, 1, null])
    const prima = w.find(s => s.n === 1)!
    expect(prima).toMatchObject({ da: '2026-09-16', a: '2026-09-22' })
    expect(prima.giornate.map(g => g.date)).toEqual(['2026-09-18', '2026-09-16'])
  })

  it('una settimana senza sessioni resta nell’elenco, vuota', () => {
    const w = perSettimana(giornate, '2026-09-16', '2026-10-02')
    expect(w.find(s => s.n === 2)).toMatchObject({ da: '2026-09-23', a: '2026-09-29', giornate: [] })
  })

  it('quella che contiene oggi è la settimana in corso', () => {
    const w = perSettimana(giornate, '2026-09-16', '2026-10-02')
    expect(w.filter(s => s.inCorso).map(s => s.n)).toEqual([3])
    expect(w[0].giornate.map(g => g.date)).toEqual(['2026-09-30'])
  })

  it('quello che è successo prima delle schede sta a parte, in fondo', () => {
    const w = perSettimana(giornate, '2026-09-16', '2026-10-02')
    expect(w[w.length - 1]).toMatchObject({ n: null, inCorso: false })
    expect(w[w.length - 1].giornate.map(g => g.date)).toEqual(['2026-09-08'])
  })

  it('senza schede assegnate si parte dalla prima sessione', () => {
    const w = perSettimana(giornate.slice(0, 3), null, '2026-09-20')
    expect(w.map(s => s.n)).toEqual([2, 1])
    expect(w[1]).toMatchObject({ da: '2026-09-08', a: '2026-09-14' })
  })

  it('niente giornate, niente settimane', () => {
    expect(perSettimana([], '2026-09-16')).toEqual([])
  })

  it('una giornata ha problemi se manca qualcosa rispetto alla scheda', () => {
    expect(haProblemi(giornate[0])).toBe(false)
    expect(haProblemi({ ...giornate[0], serieCorte: 1 })).toBe(true)
  })
})

// ── Il quadratino di una giornata nella riga della settimana ───
describe('com’è andata una giornata sui carichi', () => {
  const base = analizzaGiornate([es('p', 'Panca piana', [alzata('2026-09-10', 80, 8, 4)])], [], 80)[0]

  it('salito, sceso, tutte e due le cose, o come prima', () => {
    expect(esitoCarichi({ ...base, caricoSalito: 0, caloCarico: 0 })).toBe('pari')
    expect(esitoCarichi({ ...base, caricoSalito: 2, caloCarico: 0 })).toBe('su')
    expect(esitoCarichi({ ...base, caricoSalito: 0, caloCarico: 1 })).toBe('giu')
    expect(esitoCarichi({ ...base, caricoSalito: 1, caloCarico: 1 })).toBe('misto')
  })

  it('un esercizio saltato non è un carico sceso: il colore guarda solo i chili', () => {
    expect(esitoCarichi({ ...base, saltati: 2, serieCorte: 3 })).toBe('pari')
  })
})

describe('i sette giorni di una settimana', () => {
  const giorno = (date: string) => analizzaGiornate([es('p', 'Panca piana', [alzata(date, 80, 8, 4)])], [], 80)[0]

  it('uno per giorno, dal primo all’ultimo, con la giornata dove ci si è allenati', () => {
    const [sett] = perSettimana([giorno('2026-09-18'), giorno('2026-09-16')], '2026-09-16', '2026-09-19')
    const giorni = giorniDellaSettimana(sett, '2026-09-19')
    expect(giorni.map(d => d.date)).toEqual(['2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22'])
    expect(giorni.map(d => !!d.giornata)).toEqual([true, false, true, false, false, false, false])
    // Oggi è il 19: dal 20 in poi non sono giorni saltati, devono ancora venire.
    expect(giorni.map(d => d.futuro)).toEqual([false, false, false, false, true, true, true])
  })

  it('«prima delle schede» non è una settimana: solo le giornate fatte, dalla più vecchia', () => {
    const w = perSettimana([giorno('2026-09-20'), giorno('2026-09-03'), giorno('2026-08-28')], '2026-09-16', '2026-09-21')
    const prima = w[w.length - 1]
    expect(prima.n).toBeNull()
    expect(giorniDellaSettimana(prima).map(d => d.date)).toEqual(['2026-08-28', '2026-09-03'])
  })
})

// ── Due allenamenti a confronto ────────────────────────────────
describe('due allenamenti a confronto', () => {
  const palestra = [
    es('p', 'Panca piana', [alzata('2026-09-10', 80, 8, 4), alzata('2026-09-17', 82.5, 8, 3, { setReps: [8, 8, 6] })]),
    es('r', 'Rematore', [alzata('2026-09-10', 60, 10, 3), alzata('2026-09-17', 55, 12, 3)], 'Dorso'),
    es('c', 'Curl', [alzata('2026-09-10', 14, 12, 3)], 'Bicipiti'),
    es('s', 'Squat', [alzata('2026-09-17', 100, 5, 5)], 'Gambe'),
    es('t', 'Trazioni', [alzata('2026-09-10', 0, 8, 3, { bodyweight: true }), alzata('2026-09-17', 0, 10, 3, { bodyweight: true })], 'Dorso'),
  ]
  const [recente, vecchia] = analizzaGiornate(palestra, [], 80)
  const riga = (c: ReturnType<typeof confrontaGiornate>, nome: string) => c.righe.find(r => r.nome === nome)!

  it('il verso è sempre dal più vecchio al più recente, in qualunque ordine si scelgano', () => {
    expect(confrontaGiornate(recente, vecchia)).toMatchObject({ prima: { date: '2026-09-10' }, dopo: { date: '2026-09-17' } })
    expect(confrontaGiornate(vecchia, recente)).toMatchObject({ prima: { date: '2026-09-10' }, dopo: { date: '2026-09-17' } })
  })

  it('i chili sono il carico più pesante, i colpi quelli fatti in tutto', () => {
    const c = confrontaGiornate(vecchia, recente)
    // Panca: +2,5 kg, ma 22 colpi invece di 32.
    expect(riga(c, 'Panca piana')).toMatchObject({ kg: 2.5, colpi: -10 })
    // Rematore: 5 kg in meno, 6 colpi in più.
    expect(riga(c, 'Rematore')).toMatchObject({ kg: -5, colpi: 6 })
    expect(colpiTotali(alzata('2026-09-17', 82.5, 8, 3, { setReps: [8, 8, 6] }))).toBe(22)
  })

  it('a corpo libero senza zavorra non c’è un carico da confrontare: parlano i colpi', () => {
    expect(riga(confrontaGiornate(vecchia, recente), 'Trazioni')).toMatchObject({ kg: null, colpi: 6 })
  })

  it('quello che è stato fatto in una sola delle due resta, senza differenze', () => {
    const c = confrontaGiornate(vecchia, recente)
    expect(riga(c, 'Squat')).toMatchObject({ kg: null, colpi: null })
    expect(riga(c, 'Squat').prima).toBeUndefined()
    expect(riga(c, 'Squat').dopo).toBeDefined()
    expect(riga(c, 'Curl')).toMatchObject({ kg: null, colpi: null })
    expect(riga(c, 'Curl').dopo).toBeUndefined()
    // In fondo, dopo gli esercizi della giornata più recente.
    expect(c.righe[c.righe.length - 1].nome).toBe('Curl')
  })

  it('un esercizio saltato non entra nel confronto: non ha numeri', () => {
    const scheda: GymScheda = { ...SCHEDA_A, exercises: [{ id: 'e1', name: 'Panca piana', sets: 4, reps: '8' }, { id: 'e3', name: 'Curl', sets: 3, reps: '12' }] }
    const conScheda = [
      es('p', 'Panca piana', [alzata('2026-09-10', 80, 8, 4, { scheda: daScheda }), alzata('2026-09-17', 80, 8, 4, { scheda: daScheda })]),
      es('c', 'Curl', [alzata('2026-09-10', 14, 12, 3, { scheda: daScheda })], 'Bicipiti'),
    ]
    const [dopo, prima] = analizzaGiornate(conScheda, [scheda], 80)
    expect(dopo.saltati).toBe(1)
    const c = confrontaGiornate(prima, dopo)
    expect(riga(c, 'Curl').dopo).toBeUndefined()
    expect(riga(c, 'Panca piana')).toMatchObject({ kg: 0, colpi: 0 })
  })
})

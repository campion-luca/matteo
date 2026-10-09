import { describe, it, expect } from 'vitest'
import { muscoliDellaScheda, durataPrevista, durataRimanente, durataArrotondata, RECUPERO_SEC, natalDi, etaScheda, schedePerMese } from '@/features/gym/anteprimaScheda'
import type { GymScheda, GymSchedaExercise, PalestraExercise } from '@/store/useJarvisStore'

// Cosa dice una scheda prima di aprirla: i muscoli che tocca e quanto dura.

const riga = (o: Partial<GymSchedaExercise> & { name: string }): GymSchedaExercise =>
  ({ id: `r-${o.name}`, sets: 3, reps: '10', ...o })
const scheda = (exercises: GymSchedaExercise[]): GymScheda =>
  ({ id: 'sc1', title: 'Lunedì', createdAt: '', updatedAt: '', exercises })
const es = (id: string, n: string, muscle: string): PalestraExercise =>
  ({ id, n, muscle, current: { kg: 0, reps: 0, sets_n: 0 }, history: [] })

describe('i muscoli che una scheda tocca', () => {
  it('dal più presente, e a parità nell’ordine della scheda', () => {
    const s = scheda([
      riga({ name: 'Curl', muscle: 'Bicipiti' }),
      riga({ name: 'Panca', muscle: 'Petto' }),
      riga({ name: 'Croci', muscle: 'Petto' }),
      riga({ name: 'French press', muscle: 'Tricipiti' }),
    ])
    expect(muscoliDellaScheda(s)).toEqual([
      { muscolo: 'Petto', esercizi: 2 },
      { muscolo: 'Bicipiti', esercizi: 1 },
      { muscolo: 'Tricipiti', esercizi: 1 },
    ])
  })

  it('senza gruppo sulla riga lo prende dall’esercizio: collegato, o con lo stesso nome', () => {
    const palestra = [es('px1', 'Squat', 'Gambe'), es('px2', 'Lat machine', 'Dorso')]
    const s = scheda([
      riga({ name: 'Squat bulgaro', linkedExerciseId: 'px1' }),   // collegato per id
      riga({ name: '  lat MACHINE ' }),                            // scheda del coach: solo il nome
      riga({ name: 'Mai visto' }),
    ])
    expect(muscoliDellaScheda(s, palestra).map(m => m.muscolo)).toEqual(['Gambe', 'Dorso', 'Altro'])
  })

  it('"Schiena" è il Dorso, e le righe senza nome non contano', () => {
    const s = scheda([riga({ name: 'Rematore', muscle: 'Schiena' }), riga({ name: 'Pulley', muscle: 'Dorso' }), riga({ name: '  ', muscle: 'Petto' })])
    expect(muscoliDellaScheda(s)).toEqual([{ muscolo: 'Dorso', esercizi: 2 }])
  })

  it('una scheda vuota non tocca niente', () => {
    expect(muscoliDellaScheda(scheda([]))).toEqual([])
  })
})

describe('quanto dura una scheda', () => {
  it('ogni serie è il tempo di farla più un minuto e mezzo di recupero', () => {
    // 3 serie da 10 colpi: 40 secondi di lavoro + 90 di recupero, tre volte.
    expect(RECUPERO_SEC).toBe(90)
    expect(durataPrevista(scheda([riga({ name: 'Panca' })]))).toBe(3 * (40 + 90))
  })

  it('i colpi a scalare contano serie per serie, e un intervallo vale il suo minimo', () => {
    // 10-8-6 → 40 + 32 + 24 secondi di lavoro.
    expect(durataPrevista(scheda([riga({ name: 'Squat', reps: '10-8-6' })]))).toBe(40 + 32 + 24 + 3 * 90)
    expect(durataPrevista(scheda([riga({ name: 'Curl', reps: '8-10', sets: 2 })]))).toBe(2 * (32 + 90))
  })

  it('"max" e i testi valgono una serie da dieci; una serie non scende sotto i venti secondi', () => {
    expect(durataPrevista(scheda([riga({ name: 'Trazioni', reps: 'max', sets: 1 })]))).toBe(40 + 90)
    expect(durataPrevista(scheda([riga({ name: 'Stacco', reps: '2', sets: 1 })]))).toBe(20 + 90)
    expect(durataPrevista(scheda([riga({ name: 'Polpacci', reps: '50', sets: 1 })]))).toBe(120 + 90)
  })

  it('in un superset il recupero è uno solo, dopo il secondo esercizio', () => {
    const insieme = scheda([riga({ name: 'Curl', supersetWithNext: true }), riga({ name: 'French press' })])
    const separati = scheda([riga({ name: 'Curl' }), riga({ name: 'French press' })])
    expect(durataPrevista(separati) - durataPrevista(insieme)).toBe(3 * 90)
  })

  it('un numero di serie battuto male non fa durare la scheda un giorno', () => {
    expect(durataPrevista(scheda([riga({ name: 'Panca', sets: 9999 })]))).toBe(20 * (40 + 90))
    expect(durataPrevista(scheda([riga({ name: 'Panca', sets: 0 })]))).toBe(40 + 90)
  })

  it('si mostra ai cinque minuti, mai meno di cinque', () => {
    expect(durataArrotondata(0)).toBe(0)
    expect(durataArrotondata(130)).toBe(5 * 60)
    expect(durataArrotondata(53 * 60)).toBe(55 * 60)
    expect(durataArrotondata(62 * 60)).toBe(60 * 60)
    expect(durataArrotondata(63 * 60)).toBe(65 * 60)
  })

  it('una scheda da nove esercizi sta sull’ora', () => {
    const nove = scheda(Array.from({ length: 9 }, (_, i) => riga({ name: `E${i}`, sets: 3, reps: '8-10' })))
    // 27 serie × (32 + 90) secondi = 54,9 minuti.
    expect(durataArrotondata(durataPrevista(nove))).toBe(55 * 60)
  })
})

// Lo stesso conto, mentre ci si allena: solo sulle serie ancora da spuntare.
describe('quanto manca alla fine dell’allenamento', () => {
  const s = scheda([riga({ name: 'Panca' }), riga({ name: 'Squat', reps: '10-8-6' })])

  it('senza niente di spuntato è la durata della scheda', () => {
    expect(durataRimanente(s, {})).toBe(durataPrevista(s))
    expect(durataRimanente(s, { 'r-Panca': [false, false, false] })).toBe(durataPrevista(s))
  })

  it('ogni serie spuntata toglie il suo lavoro e il suo recupero', () => {
    expect(durataPrevista(s) - durataRimanente(s, { 'r-Panca': [true, false, false] })).toBe(40 + 90)
    // In un 10-8-6 la serie da sei pesa meno di quella da dieci.
    expect(durataPrevista(s) - durataRimanente(s, { 'r-Squat': [false, false, true] })).toBe(24 + 90)
  })

  it('non conta l’ordine: una serie saltata in mezzo manca ancora', () => {
    expect(durataRimanente(s, { 'r-Panca': [true, false, true], 'r-Squat': [true, true, true] })).toBe(40 + 90)
  })

  it('tutto spuntato, non manca niente', () => {
    expect(durataRimanente(s, { 'r-Panca': [true, true, true], 'r-Squat': [true, true, true] })).toBe(0)
  })

  it('in un superset il primo esercizio toglie solo il lavoro: il recupero è dopo il secondo', () => {
    const insieme = scheda([riga({ name: 'Curl', supersetWithNext: true }), riga({ name: 'French press' })])
    expect(durataPrevista(insieme) - durataRimanente(insieme, { 'r-Curl': [true, false, false] })).toBe(40)
  })

  it('spunte più corte o più lunghe delle serie non rompono il conto', () => {
    // La scheda è cresciuta di una serie dopo l'ingresso: quella nuova manca.
    expect(durataRimanente(scheda([riga({ name: 'Panca', sets: 4 })]), { 'r-Panca': [true, true, true] })).toBe(40 + 90)
    expect(durataRimanente(scheda([riga({ name: 'Panca', sets: 2 })]), { 'r-Panca': [true, true, true, true] })).toBe(0)
  })
})

// ── Da quanto esiste una scheda ────────────────────────────────
describe('da quanto esiste una scheda', () => {
  const t = (s: string, v?: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v?.[k]))

  it('il giorno di nascita: già un giorno, o un istante intero letto nel fuso del telefono', () => {
    expect(natalDi('2026-09-12')).toBe('2026-09-12')
    // Una scheda arrivata da un coach porta l'istante: a mezzogiorno il giorno
    // è lo stesso in qualunque fuso.
    expect(natalDi('2026-09-12T12:00:00.000Z')).toBe('2026-09-12')
    expect(natalDi('')).toBeNull()
    expect(natalDi(undefined)).toBeNull()
    expect(natalDi('boh')).toBeNull()
  })

  it('in giorni, poi in settimane, poi in mesi, poi in anni', () => {
    expect(etaScheda(0, t)).toBe('da oggi')
    expect(etaScheda(1, t)).toBe('da ieri')
    expect(etaScheda(9, t)).toBe('da 9 giorni')
    expect(etaScheda(13, t)).toBe('da 13 giorni')
    expect(etaScheda(14, t)).toBe('da 2 settimane')
    expect(etaScheda(41, t)).toBe('da 5 settimane')
    expect(etaScheda(69, t)).toBe('da 9 settimane')
    expect(etaScheda(70, t)).toBe('da 2 mesi')
    expect(etaScheda(200, t)).toBe('da 6 mesi')
    expect(etaScheda(800, t)).toBe('da 2 anni')
    // Una data nel futuro (orologio sbagliato) non diventa un numero negativo.
    expect(etaScheda(-3, t)).toBe('da oggi')
  })

  it('le schede per mese e anno, dal più recente; dentro al mese resta l’ordine dato', () => {
    const schede = [{ id: 'coach' }, { id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'vecchia' }, { id: 'boh' }]
    const nate = new Map([['coach', '2026-10-02'], ['a', '2026-09-20'], ['b', '2026-10-01'], ['c', '2026-09-03'], ['vecchia', '2025-12-30']])
    const gruppi = schedePerMese(schede, nate)
    expect(gruppi.map(g => [g.chiave, g.schede.map(s => s.id)])).toEqual([
      ['2026-10', ['coach', 'b']],
      ['2026-09', ['a', 'c']],
      ['2025-12', ['vecchia']],
      ['senza-data', ['boh']],
    ])
    // Il mese parte da zero, come `Date.getMonth()`.
    expect(gruppi[0]).toMatchObject({ anno: 2026, mese: 9 })
    expect(gruppi[3]).toMatchObject({ anno: null, mese: null })
  })
})

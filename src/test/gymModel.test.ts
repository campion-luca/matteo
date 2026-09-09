import { describe, it, expect } from 'vitest'
import { effectiveLoad, entry1RM, entryVolume, estimate1RM, fmtKg, fmtNum, fmtReps, normalizzaDecimale, parseNum, setRepsOf, sortedHistory, weekSortKey, weekLabel } from '@/features/gym/gymModel'
import { isoWeek } from '@/lib/isoDate'
import type { PalestraHistoryEntry } from '@/store/useJarvisStore'

const entry = (o: Partial<PalestraHistoryEntry>): PalestraHistoryEntry => ({
  d: 'W1', kg: 0, reps: 10, sets_n: 3, ...o,
})

describe('effectiveLoad — esercizi a corpo libero', () => {
  it('per un esercizio con bilanciere usa il peso registrato', () => {
    expect(effectiveLoad(entry({ kg: 80 }), 75)).toBe(80)
  })

  it('per il corpo libero somma il peso corporeo alla zavorra', () => {
    expect(effectiveLoad(entry({ kg: 10, bodyweight: true }), 75)).toBe(85)
  })

  it('corpo libero senza zavorra vale il peso corporeo, non zero', () => {
    // Il bug: trazioni a 0 kg davano volume 0 e sparivano da ogni statistica.
    expect(effectiveLoad(entry({ kg: 0, bodyweight: true }), 75)).toBe(75)
  })

  it('senza peso corporeo noto degrada alla sola zavorra', () => {
    expect(effectiveLoad(entry({ kg: 0, bodyweight: true }))).toBe(0)
  })
})

describe('estimate1RM — massimale stimato', () => {
  it('a una sola ripetizione il massimale è il carico stesso', () => {
    // Epley: kg × (1 + 1/30). Non è esattamente kg, ed è voluto — ma deve starci vicino.
    expect(estimate1RM(100, 1)).toBeCloseTo(103.33, 1)
  })

  it('mette sulla stessa scala serie con colpi diversi', () => {
    // È il caso che ha deciso la formula: 50×8 vale PIÙ di 40×15, al contrario
    // del volume (400 contro 600).
    expect(estimate1RM(50, 8)).toBeGreaterThan(estimate1RM(40, 15))
  })

  it('senza carico o senza colpi non inventa un numero', () => {
    expect(estimate1RM(0, 10)).toBe(0)
    expect(estimate1RM(80, 0)).toBe(0)
  })
})

describe('entry1RM', () => {
  it('una serie a corpo libero vale il peso corporeo, non zero', () => {
    expect(entry1RM(entry({ kg: 0, bodyweight: true }), 75)).toBeGreaterThan(0)
  })

  it('a corpo libero senza peso corporeo noto resta a zero (nessun dato)', () => {
    expect(entry1RM(entry({ kg: 0, bodyweight: true }))).toBe(0)
  })

  it('con pesi diversi per serie conta la serie migliore, non la media', () => {
    const h = entry({ kg: 60, sets_n: 3, reps: 8, setWeights: [60, 60, 40] })
    // La media (53.3) darebbe ~67 kg: la serie da 60 sparirebbe in quella da 40.
    expect(entry1RM(h)).toBeCloseTo(estimate1RM(60, 8), 5)
  })

  it('ogni serie porta i SUOI colpi, non quelli del valore rappresentativo', () => {
    // 10, 8, 6 tutte a 40 kg. Stimare tutte e tre su 10 colpi (il valore
    // rappresentativo) darebbe 53.3 a una serie da 6 che vale 48.
    const h = entry({ kg: 40, sets_n: 3, reps: 10, setReps: [10, 8, 6] })
    expect(entry1RM(h)).toBeCloseTo(estimate1RM(40, 10), 5)

    // Con carico crescente e colpi calanti la serie migliore è la PESANTE, e va
    // stimata sui suoi 6 colpi: accoppiare 60 kg ai 10 colpi della prima serie
    // gonfierebbe il massimale da 72 a 80.
    const misto = entry({ kg: 60, sets_n: 3, reps: 6, setWeights: [40, 50, 60], setReps: [10, 8, 6] })
    expect(entry1RM(misto)).toBeCloseTo(estimate1RM(60, 6), 5)
  })
})

describe('colpi per serie', () => {
  it('senza setReps replica reps su tutte le serie (le alzate vecchie non cambiano)', () => {
    expect(setRepsOf(entry({ reps: 10, sets_n: 3 }))).toEqual([10, 10, 10])
    // 3 serie da 60 kg per 10 colpi: 1800, come prima che i colpi per serie esistessero.
    expect(entryVolume(entry({ kg: 60, reps: 10, sets_n: 3 }))).toBe(1800)
  })

  it('il volume accoppia carico e colpi serie per serie', () => {
    // 60×10 + 60×8 + 40×6 = 600 + 480 + 240 = 1320.
    // Sommare prima i carichi e moltiplicarli per i colpi rappresentativi ne
    // farebbe 1600, cioè un allenamento che non è successo.
    const h = entry({ kg: 60, sets_n: 3, reps: 10, setWeights: [60, 60, 40], setReps: [10, 8, 6] })
    expect(entryVolume(h)).toBe(1320)
  })

  it('a corpo libero i colpi per serie si sommano al peso corporeo', () => {
    // (75+0)×10 + (75+0)×5 = 1125.
    const h = entry({ kg: 0, bodyweight: true, sets_n: 2, reps: 10, setReps: [10, 5] })
    expect(entryVolume(h, 75)).toBe(1125)
  })

  it('in lista i colpi variabili si leggono come intervallo', () => {
    expect(fmtReps(entry({ reps: 10, sets_n: 3 }))).toBe('10')
    expect(fmtReps(entry({ reps: 10, sets_n: 3, setReps: [10, 10, 10] }))).toBe('10')
    expect(fmtReps(entry({ reps: 10, sets_n: 3, setReps: [10, 8, 6] }))).toBe('6–10')
  })
})

describe('sortedHistory', () => {
  it('riordina cronologicamente una sessione inserita con data arretrata', () => {
    const hist = [
      entry({ date: '2026-07-01', kg: 60 }),
      entry({ date: '2026-07-08', kg: 70 }),
      entry({ date: '2026-07-04', kg: 65 }),   // inserita per ultima, ma di mezzo
    ]
    expect(sortedHistory(hist).map(h => h.date)).toEqual(['2026-07-01', '2026-07-04', '2026-07-08'])
  })

  it("l'ultima voce è la più recente, così `current` è corretto", () => {
    const hist = [entry({ date: '2026-07-08', kg: 70 }), entry({ date: '2026-07-04', kg: 65 })]
    const sorted = sortedHistory(hist)
    expect(sorted[sorted.length - 1].kg).toBe(70)
  })

  it('tiene davanti le voci legacy senza data e non muta la sorgente', () => {
    const hist = [entry({ date: '2026-07-08' }), entry({ date: undefined, kg: 99 })]
    expect(sortedHistory(hist)[0].kg).toBe(99)
    expect(hist[0].date).toBe('2026-07-08')  // originale intatto
  })
})

describe('weekSortKey / weekLabel (settimana ISO)', () => {
  it('ordina W2 prima di W10 e non collide fra anni', () => {
    const keys = [weekSortKey('2026-03-05'), weekSortKey('2026-01-08'), weekSortKey('2025-01-08')]
    expect([...keys].sort()).toEqual([weekSortKey('2025-01-08'), weekSortKey('2026-01-08'), weekSortKey('2026-03-05')])
  })

  it('la domenica sta nella stessa settimana del lunedì che la precede', () => {
    // lun 17 → dom 23 agosto 2026: una sola settimana di allenamento
    expect(weekSortKey('2026-08-23')).toBe(weekSortKey('2026-08-17'))
    expect(weekLabel('2026-08-23')).toBe(weekLabel('2026-08-17'))
    // il lunedì dopo cambia settimana
    expect(weekSortKey('2026-08-24')).not.toBe(weekSortKey('2026-08-23'))
  })

  it("inizio gennaio che cade nella settimana ISO dell'anno precedente", () => {
    // ven 1 gennaio 2027 appartiene alla W53 del 2026
    expect(weekLabel('2027-01-01')).toBe('W53')
    expect(weekSortKey('2027-01-01')).toBe('2026-W53')
    // e sta nella stessa settimana del lunedì 28 dicembre 2026
    expect(weekSortKey('2026-12-28')).toBe('2026-W53')
  })

  it('l’etichetta e la settimana ISO dicono lo stesso numero', () => {
    expect(weekLabel('2026-08-19')).toBe(`W${isoWeek('2026-08-19').week}`)
  })
})

describe('numeri decimali scritti a mano', () => {
  it('accetta il punto e la virgola, e tiene la virgola', () => {
    // È il bug che si vedeva registrando le serie di una scheda: il tastierino
    // decimale di iOS mostra l'uno o l'altra a seconda della lingua del sistema,
    // e il campo ne accettava uno solo.
    expect(normalizzaDecimale('62.5')).toBe('62,5')
    expect(normalizzaDecimale('62,5')).toBe('62,5')
  })

  it('scarta quello che non è un numero, seconda virgola compresa', () => {
    expect(normalizzaDecimale('6a2,5kg')).toBe('62,5')
    // "6,2,5" non è un numero: lasciarlo scrivere significa scoprirlo al
    // salvataggio, col valore già sbagliato.
    expect(normalizzaDecimale('6,2,5')).toBe('6,25')
  })

  it('lascia scrivere la virgola in fondo mentre si digita', () => {
    // "62," è uno stato di passaggio verso "62,5": ripulirlo qui farebbe
    // sparire la virgola sotto le dita a ogni tentativo.
    expect(normalizzaDecimale('62,')).toBe('62,')
  })

  it('rilegge il numero comunque sia stato scritto', () => {
    expect(parseNum('62,5')).toBe(62.5)
    expect(parseNum('62.5')).toBe(62.5)
    expect(parseNum('')).toBe(0)
    expect(parseNum(undefined)).toBe(0)
  })

  it('scrive i decimali con la virgola, e solo se ci sono', () => {
    expect(fmtNum(70)).toBe('70')       // non "70,0"
    expect(fmtNum(62.5)).toBe('62,5')
    expect(fmtKg({ kg: 62.5 })).toBe('62,5 kg')
  })
})

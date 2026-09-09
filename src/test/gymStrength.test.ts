import { describe, it, expect } from 'vitest'
import { districtStrength, achievements, strengthLevel, scoreFor } from '@/features/gym/gymStrength'
import { recordFor } from '@/features/gym/gymModel'
import type { PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'

const h = (o: Partial<PalestraHistoryEntry>): PalestraHistoryEntry => ({
  d: 'W1', kg: 0, reps: 10, sets_n: 3, ...o,
})
const ex = (o: Partial<PalestraExercise>): PalestraExercise => ({
  id: 'x', n: 'Es', muscle: 'Petto',
  current: { kg: 0, reps: 0, sets_n: 0 }, history: [], ...o,
})

describe('strengthLevel — soglie per distretto', () => {
  it('lo stesso rapporto vale gradi diversi su distretti diversi', () => {
    // È il motivo per cui questa tabella esiste: 1.2× il peso corporeo è tanto
    // sulle braccia e poco sulle gambe. Senza soglie separate la mappa direbbe a
    // chiunque che ha gambe fortissime e braccia inutili.
    expect(strengthLevel(1.2, 'Bicipiti', 'M')).toBe(4)
    expect(strengthLevel(1.2, 'Gambe', 'M')).toBe(2)
  })

  it('senza dati il livello è 0, non "iniziale"', () => {
    expect(strengthLevel(0, 'Petto', 'M')).toBe(0)
  })

  it('le soglie femminili sono più basse di quelle maschili', () => {
    expect(strengthLevel(0.7, 'Petto', 'F')).toBeGreaterThan(strengthLevel(0.7, 'Petto', 'M'))
  })

  it('sesso ignoto usa la tabella più severa, non regala un livello', () => {
    expect(strengthLevel(0.7, 'Petto', undefined)).toBe(strengthLevel(0.7, 'Petto', 'M'))
  })

  it('un distretto senza soglia (Altro) non finisce mai sulla mappa', () => {
    expect(strengthLevel(5, 'Altro', 'M')).toBe(0)
  })
})

describe('scoreFor — il numero della mappa', () => {
  it('100 è la soglia "forte" di QUEL distretto, non un fondoscala comune', () => {
    // È tutto il punto: 1.5× sul petto e 0.68× sui bicipiti sono lo stesso grado,
    // e devono dare lo stesso numero. Con i chili grezzi non succedeva.
    expect(scoreFor(1.50, 'Petto', 'M')).toBe(100)
    expect(scoreFor(0.68, 'Bicipiti', 'M')).toBe(100)
  })

  it('non sfonda oltre "forte"', () => {
    // Oltre la soglia servono standard veri, non questa tabella: il numero si
    // ferma a 100 e dice "obiettivo raggiunto" invece di gonfiarsi.
    expect(scoreFor(3, 'Petto', 'M')).toBe(100)
  })

  it('senza rapporto non c’è punteggio', () => {
    expect(scoreFor(null, 'Petto', 'M')).toBe(0)
    expect(scoreFor(0, 'Petto', 'M')).toBe(0)
  })

  it('un distretto fuori tabella resta a zero', () => {
    expect(scoreFor(5, 'Altro', 'M')).toBe(0)
  })

  it('cresce in proporzione fino alla soglia', () => {
    expect(scoreFor(0.75, 'Petto', 'M')).toBe(50)
  })
})

describe('districtStrength', () => {
  it('un distretto prende il suo esercizio migliore, non la media', () => {
    const d = districtStrength([
      ex({ id: 'a', n: 'Panca', muscle: 'Petto', history: [h({ kg: 80, reps: 5 })] }),
      ex({ id: 'b', n: 'Croci', muscle: 'Petto', history: [h({ kg: 15, reps: 12 })] }),
    ], 80, 'M')
    const petto = d.find(x => x.muscle === 'Petto')!
    // Epley su 80×5 ≈ 93 kg: se facesse la media con le croci scenderebbe sotto.
    expect(Math.round(petto.best)).toBe(93)
  })

  it('ogni distretto porta con sé il punteggio da mostrare', () => {
    const d = districtStrength([
      ex({ n: 'Panca', muscle: 'Petto', history: [h({ kg: 80, reps: 5 })] }),
    ], 80, 'M')
    const petto = d.find(x => x.muscle === 'Petto')!
    expect(petto.score).toBe(scoreFor(petto.ratio, 'Petto', 'M'))
    expect(petto.score).toBeGreaterThan(0)
    // I distretti mai allenati non finiscono a "0 su 100" per caso: sono a zero
    // perché non c'è niente, ed è la mappa a mostrarli come vuoti.
    expect(d.find(x => x.muscle === 'Gambe')!.score).toBe(0)
  })

  it('il secondo gruppo muscolare conta a metà, non per intero', () => {
    // Una trazione allena dorso E bicipiti: non contarla lascerebbe i bicipiti
    // vuoti a chi ne fa cento a settimana. Ma contarla per intero diceva
    // "bicipiti: forte" a chi rema 60 kg, e nessuno curla 60 kg.
    const d = districtStrength([
      ex({ n: 'Rematore', muscle: 'Dorso', muscle2: 'Bicipiti', history: [h({ kg: 60, reps: 10 })] }),
    ], 80, 'M')
    const dorso = d.find(x => x.muscle === 'Dorso')!
    const bicipiti = d.find(x => x.muscle === 'Bicipiti')!
    expect(bicipiti.best).toBeCloseTo(dorso.best / 2, 5)
    expect(bicipiti.level).toBeLessThan(4)
  })

  it('senza peso corporeo il rapporto non si inventa', () => {
    const d = districtStrength([ex({ history: [h({ kg: 80, reps: 5 })] })], 0, 'M')
    const petto = d.find(x => x.muscle === 'Petto')!
    expect(petto.ratio).toBeNull()
    expect(petto.level).toBe(0)
  })

  it('un esercizio senza storico non colora niente', () => {
    const d = districtStrength([ex({ history: [] })], 80, 'M')
    expect(d.every(x => x.level === 0)).toBe(true)
  })
})

describe('achievements — i primi 100 kg', () => {
  it('resta chiuso sotto i 100 kg', () => {
    const a = achievements([ex({ history: [h({ kg: 95, reps: 5 })] })], 78)
    expect(a[0].unlockedAt).toBeNull()
  })

  it('si sblocca sui chili SOLLEVATI, non sul massimale stimato', () => {
    // 60×10 stima 80 kg di massimale ma sul bilanciere ci sono 60 kg: "fare 100"
    // vuol dire averli davvero caricati.
    expect(achievements([ex({ history: [h({ kg: 60, reps: 10 })] })], 78)[0].unlockedAt).toBeNull()
    expect(achievements([ex({ history: [h({ date: '2026-08-01', kg: 100, reps: 1 })] })], 78)[0].unlockedAt).toBe('2026-08-01')
  })

  it('a corpo libero conta il peso corporeo più la zavorra', () => {
    const a = achievements([ex({ history: [h({ date: '2026-08-05', kg: 25, reps: 5, bodyweight: true })] })], 78)
    expect(a[0].unlockedAt).toBe('2026-08-05')   // 78 + 25 = 103
  })

  it('con pesi diversi per serie basta la serie più pesante', () => {
    const a = achievements([ex({ history: [h({ date: '2026-08-09', kg: 100, reps: 5, sets_n: 3, setWeights: [100, 80, 60] })] })], 78)
    expect(a[0].unlockedAt).toBe('2026-08-09')
  })

  it('tiene la data della PRIMA volta, non dell’ultima', () => {
    const a = achievements([ex({ history: [
      h({ date: '2026-08-20', kg: 120, reps: 3 }),
      h({ date: '2026-07-02', kg: 105, reps: 3 }),
    ] })], 78)
    expect(a[0].unlockedAt).toBe('2026-07-02')
  })
})

describe('recordFor — il momento del record', () => {
  const prev = [h({ kg: 60, reps: 8 })]   // Epley ≈ 76 kg

  it('la prima alzata di un esercizio non è un record', () => {
    expect(recordFor([], h({ kg: 200, reps: 10 }))).toBeNull()
  })

  it('conta i colpi, non solo i chili', () => {
    // 100×1 (103 kg stimati) batte 60×8; 50×10 (67 kg) no, pur essendo più volume.
    expect(recordFor(prev, h({ kg: 100, reps: 1 }))).not.toBeNull()
    expect(recordFor(prev, h({ kg: 50, reps: 10 }))).toBeNull()
  })

  it('pareggiare non è battere', () => {
    expect(recordFor(prev, h({ kg: 60, reps: 8 }))).toBeNull()
  })

  it('riporta il vecchio massimo accanto al nuovo', () => {
    const r = recordFor(prev, h({ kg: 70, reps: 8 }))!
    expect(r.prev).toBe(76)
    expect(r.next).toBe(89)
  })
})

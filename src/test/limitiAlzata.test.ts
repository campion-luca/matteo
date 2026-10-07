import { describe, it, expect } from 'vitest'
import { numeroImpossibile, saltoDaConfermare, caricoDiRiferimento, KG_MAX, COLPI_MAX, SERIE_MAX } from '@/features/gym/limitiAlzata'
import type { PalestraHistoryEntry } from '@/store/useJarvisStore'

// I numeri di un'alzata: l'impossibile non si salva, l'improbabile si conferma.
// Quello che non deve succedere è l'opposto di tutti e due: rifiutare un numero
// vero, o lasciar passare in silenzio 600 kg scritti al posto di 60.

const alzata = (o: Partial<PalestraHistoryEntry>): PalestraHistoryEntry =>
  ({ d: 'W', date: '2026-09-10', kg: 60, reps: 8, sets_n: 3, ...o })

describe('i numeri impossibili', () => {
  it('quelli normali passano tutti', () => {
    expect(numeroImpossibile({ kg: [60, 62.5], colpi: [10, 8], serie: 3, attrezzo: 20 })).toBeNull()
    expect(numeroImpossibile({ kg: [KG_MAX], colpi: [COLPI_MAX], serie: SERIE_MAX })).toBeNull()
    expect(numeroImpossibile({ kg: [0], colpi: [1], serie: 1 })).toBeNull()
  })

  it('oltre i limiti dice quale campo e quale limite', () => {
    expect(numeroImpossibile({ kg: [60, 600], colpi: [8], serie: 3 })).toEqual({ campo: 'kg', perche: 'troppo', limite: 500 })
    expect(numeroImpossibile({ kg: [60], colpi: [8, 101], serie: 3 })).toEqual({ campo: 'colpi', perche: 'troppo', limite: 100 })
    expect(numeroImpossibile({ kg: [60], colpi: [8], serie: 21 })).toEqual({ campo: 'serie', perche: 'troppo', limite: 20 })
    expect(numeroImpossibile({ kg: [60], colpi: [8], serie: 3, attrezzo: 2000 })).toMatchObject({ campo: 'attrezzo', perche: 'troppo' })
  })

  it('un numero negativo non è un’alzata', () => {
    expect(numeroImpossibile({ kg: [-5], colpi: [8], serie: 3 })).toMatchObject({ campo: 'kg', perche: 'negativo' })
    expect(numeroImpossibile({ kg: [60], colpi: [-8], serie: 3 })).toMatchObject({ campo: 'colpi', perche: 'negativo' })
    expect(numeroImpossibile({ kg: [60], colpi: [8], serie: -3 })).toMatchObject({ campo: 'serie', perche: 'negativo' })
  })

  it('i campi vuoti non sono affar suo', () => {
    expect(numeroImpossibile({ kg: [NaN], colpi: [NaN], serie: NaN })).toBeNull()
    expect(numeroImpossibile({})).toBeNull()
  })
})

describe('il salto da confermare', () => {
  it('più del doppio o meno della metà dell’ultima volta', () => {
    expect(saltoDaConfermare(600, 60)).toBe(true)     // uno zero di troppo
    expect(saltoDaConfermare(8, 80)).toBe(true)       // uno zero in meno
    expect(saltoDaConfermare(125, 60)).toBe(true)
    expect(saltoDaConfermare(25, 60)).toBe(true)
  })

  it('una progressione normale non chiede niente', () => {
    expect(saltoDaConfermare(62.5, 60)).toBe(false)
    expect(saltoDaConfermare(120, 60)).toBe(false)    // il doppio esatto: ancora no
    expect(saltoDaConfermare(30, 60)).toBe(false)     // la metà esatta: ancora no
    expect(saltoDaConfermare(45, 60)).toBe(false)
  })

  it('sui pesi piccoli il doppio è un martedì qualunque', () => {
    // Da 4 a 10 kg di manubri: più del doppio, sei chili di differenza.
    expect(saltoDaConfermare(10, 4)).toBe(false)
    expect(saltoDaConfermare(2, 8)).toBe(false)
    // Ma dieci chili di differenza sì.
    expect(saltoDaConfermare(16, 5)).toBe(true)
  })

  it('senza una volta prima non c’è niente da confrontare', () => {
    expect(saltoDaConfermare(600, null)).toBe(false)
    expect(saltoDaConfermare(600, 0)).toBe(false)
    expect(saltoDaConfermare(0, 60)).toBe(false)
  })
})

describe('con che cosa si confronta', () => {
  it('con il carico più alto dell’alzata più recente', () => {
    const storico = [
      alzata({ date: '2026-09-03', kg: 50 }),
      alzata({ date: '2026-09-17', kg: 62.5, setWeights: [60, 60, 62.5] }),
      alzata({ date: '2026-09-10', kg: 55 }),
    ]
    expect(caricoDiRiferimento(storico)).toBe(62.5)
  })

  it('con il totale, se l’attrezzo è dichiarato', () => {
    expect(caricoDiRiferimento([alzata({ kg: 40, attrezzo: 20 })])).toBe(60)
  })

  it('non con l’alzata che si sta modificando', () => {
    const sbagliata = alzata({ date: '2026-09-17', kg: 600 })
    const storico = [alzata({ date: '2026-09-10', kg: 60 }), sbagliata]
    expect(caricoDiRiferimento(storico, sbagliata)).toBe(60)
    expect(caricoDiRiferimento([sbagliata], sbagliata)).toBeNull()
  })

  it('a corpo libero, o senza storico, non c’è un riferimento', () => {
    expect(caricoDiRiferimento([])).toBeNull()
    expect(caricoDiRiferimento([alzata({ kg: 10, bodyweight: true })])).toBeNull()
    expect(caricoDiRiferimento([alzata({ kg: 0 })])).toBeNull()
  })
})

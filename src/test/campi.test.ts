import { describe, it, expect } from 'vitest'
import { preCompila } from '@/lib/campi'

// Il pre-compilato dei campi numerici del log. Sembra una riga sola, ma è una
// decisione: lo zero non è un valore di partenza, è un campo vuoto che va
// cancellato a mano prima di poter scrivere.
describe('pre-compilazione dei campi numerici', () => {
  it('non scrive lo zero: lascia parlare il segnaposto', () => {
    // È il caso di ogni esercizio mai allenato — cioè tutti, dopo l'azzeramento.
    expect(preCompila(0)).toBe('')
  })

  it('non scrive niente se il valore manca', () => {
    expect(preCompila(undefined)).toBe('')
  })

  it('ripropone il carico dell’ultima volta, che è il motivo per cui esiste', () => {
    expect(preCompila(62.5)).toBe('62.5')
    expect(preCompila(3)).toBe('3')
  })
})

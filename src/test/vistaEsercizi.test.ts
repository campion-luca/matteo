import { describe, it, expect, beforeEach } from 'vitest'
import { vistaIniziale, VISTA_KEY } from '@/features/gym/vistaEsercizi'
import { readStorage, writeStorage } from '@/lib/safeStorage'

// Come si aprono gli esercizi di un gruppo. Due regole sole, ma è la prima cosa
// che si vede entrando in palestra: se sbagliano, sbagliano ogni volta.

describe('vista di partenza degli esercizi', () => {
  beforeEach(() => localStorage.clear())

  it('è la griglia per chi non ha mai scelto', () => {
    expect(vistaIniziale(null)).toBe('griglia')
  })

  it('rispetta la scelta di chi è passato all’elenco', () => {
    expect(vistaIniziale('elenco')).toBe('elenco')
  })

  it('rispetta anche la griglia scelta a mano', () => {
    expect(vistaIniziale('griglia')).toBe('griglia')
  })

  it('non si fa portare all’elenco da un valore che non riconosce', () => {
    // Storage negato, chiave di un vecchio formato, valore scritto a mano: in
    // tutti questi casi nessuno ha chiesto l'elenco, e il default deve vincere.
    for (const spazzatura of ['', 'grid', 'lista', 'GRIGLIA', 'null', '0']) {
      expect(vistaIniziale(spazzatura), spazzatura).toBe('griglia')
    }
  })

  it('sopravvive a un giro completo di scrittura e rilettura', () => {
    // Il ciclo vero: si sceglie l'elenco, si chiude tutto, si rientra.
    writeStorage('local', VISTA_KEY, 'elenco')
    expect(vistaIniziale(readStorage('local', VISTA_KEY))).toBe('elenco')

    writeStorage('local', VISTA_KEY, 'griglia')
    expect(vistaIniziale(readStorage('local', VISTA_KEY))).toBe('griglia')
  })

  it('non viene portata via dal logout', () => {
    // Uscendo dall'account l'app cancella il blob dei dati (jarvis-store-v4) e
    // nient'altro. Questa preferenza è del dispositivo e deve restare: se un
    // domani il logout ripulisse tutto localStorage, questo test lo direbbe.
    writeStorage('local', VISTA_KEY, 'elenco')
    localStorage.removeItem('jarvis-store-v4')
    expect(vistaIniziale(readStorage('local', VISTA_KEY))).toBe('elenco')
  })
})

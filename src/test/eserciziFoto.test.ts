import { describe, it, expect } from 'vitest'
import { slugEsercizio, fotoEsercizio, SLUG_CON_FOTO } from '@/features/gym/eserciziFoto'
import { CATALOGO } from '@/features/gym/catalogo'

// Una foto si aggancia al suo esercizio solo per il nome del file. È un legame
// che non si vede da nessuna parte finché non si apre la griglia e manca
// un'immagine, quindi è qui che va guardato.

describe('slug di un esercizio', () => {
  it('non bada a maiuscole, spazi e punteggiatura', () => {
    const atteso = 'panca-piana-al-mpw'
    for (const scritto of ['Panca piana al MPW', 'panca  piana  al  mpw', '  Panca-piana al MPW.  ']) {
      expect(slugEsercizio(scritto), scritto).toBe(atteso)
    }
  })

  it('toglie gli accenti invece di mangiarsi la lettera', () => {
    expect(slugEsercizio('Séance')).toBe('seance')
    expect(slugEsercizio('Curl è martello')).toBe('curl-e-martello')
  })

  it('tiene distinti due esercizi che differiscono per una parola', () => {
    // Il caso da cui ci si scotta: il file chiamato quasi come l'esercizio.
    expect(slugEsercizio('Panca piana MPW')).not.toBe(slugEsercizio('Panca piana al MPW'))
  })
})

describe('le foto presenti in src/assets/esercizi', () => {
  it('sono tutte agganciate a un esercizio del catalogo', () => {
    // Se questo test fallisce, quasi sempre è un file scritto quasi giusto:
    // "Panca piana MPW.webp" per l'esercizio "Panca piana al MPW". Nessun
    // errore a schermo, solo un buco nella griglia — perciò si guarda qui.
    const delCatalogo = new Set(CATALOGO.map(v => slugEsercizio(v.n)))
    const orfane = SLUG_CON_FOTO.filter(s => !delCatalogo.has(s))
    expect(orfane, 'foto senza un esercizio con quel nome').toEqual([])
  })

  it('si trovano cercandole per nome dell’esercizio', () => {
    for (const v of CATALOGO) {
      const url = fotoEsercizio(v.n)
      if (SLUG_CON_FOTO.includes(slugEsercizio(v.n))) {
        expect(url, `"${v.n}" ha il file ma non lo trova`).toBeTruthy()
      } else {
        expect(url, `"${v.n}" trova una foto che non c'è`).toBeUndefined()
      }
    }
  })
})

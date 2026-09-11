import { describe, it, expect } from 'vitest'
// I sorgenti come testo: `?raw` è di Vite, quindi funziona qui senza tirare
// dentro i tipi di Node solo per leggere tre file.
import profiloSrc from '@/features/profile/JarvisProfile.tsx?raw'
import readmeSrc from '../../README.md?raw'
import licenseSrc from '../../LICENSE?raw'
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

// ── L'attribuzione ─────────────────────────────────────────────
// Le illustrazioni di RepDB sono concesse a una condizione sola: che il credito
// resti visibile. È un obbligo che non lascia traccia nel codice che lo usa —
// nessuno, cancellando quella riga dalle Impostazioni per fare ordine, vedrebbe
// rompersi qualcosa. Si romperebbe qui, ed è il punto.
describe('credito a RepDB', () => {
  const CREDITO = 'RepDB'

  it('è nelle Impostazioni, nel README e in LICENSE finché ci sono immagini', () => {
    if (SLUG_CON_FOTO.length === 0) return   // cartella vuota: niente da attribuire

    expect(profiloSrc, 'credito sparito dalle Impostazioni').toContain('Exercise data by RepDB (repdb.co)')
    expect(profiloSrc, 'il credito deve essere un link a repdb.co').toContain('https://repdb.co')
    expect(readmeSrc, 'credito sparito dal README').toContain(CREDITO)
    expect(licenseSrc, 'MIT non è più delimitato agli asset di terzi').toContain(CREDITO)
  })
})

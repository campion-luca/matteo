import { describe, it, expect } from 'vitest'
import { soglieAlPeso, type AlzataTabella } from '@/features/gym/tabelleForza'

// Le tabelle sono numeri copiati da due articoli: il rischio è un numero sbagliato o
// un conto che li deforma. Qui si ricontrollano alcuni valori con la tabella alla mano.
const KG = 0.45359237
const massimale = (libbre: number) => libbre * KG * (4 / 3)
const ALZATE: AlzataTabella[] = ['panca', 'lat', 'lento', 'curl', 'pressa']

describe('le soglie al peso', () => {
  it('al centro di una classe valgono i numeri dello studio, portati a massimale', () => {
    // Uomini, 165-190 libbre, Bench Press Post-Training: 135, 160, 185, 225.
    const s = soglieAlPeso('panca', 177.5 * KG, 'M')
    expect(s[0]).toBeCloseTo(massimale(135), 5)
    expect(s[1]).toBeCloseTo(massimale(160), 5)
    expect(s[2]).toBeCloseTo(massimale(185), 5)
    expect(s[3]).toBeCloseTo(massimale(225), 5)
  })

  it('anche per le donne e per gli altri esercizi', () => {
    // Donne, 155-175 libbre, Lat Pulldown Post-Training: 90, 90, 100, 110.
    expect(soglieAlPeso('lat', 165 * KG, 'F')[3]).toBeCloseTo(massimale(110), 5)
    // Uomini, 190-210 libbre, Leg Press Post-Training, 50° percentile: 500.
    expect(soglieAlPeso('pressa', 200 * KG, 'M')[1]).toBeCloseTo(massimale(500), 5)
    // Uomini, 150-165 libbre, Preacher Curl Post-Training, 80° percentile: 90.
    expect(soglieAlPeso('curl', 157.5 * KG, 'M')[2]).toBeCloseTo(massimale(90), 5)
  })

  it('fra due classi passa in modo continuo: un chilo non fa saltare', () => {
    const a = soglieAlPeso('panca', 75, 'M')[1]
    const b = soglieAlPeso('panca', 76, 'M')[1]
    expect(Math.abs(b - a)).toBeLessThan(2)
  })

  it('oltre le classi estreme resta l’ultimo valore', () => {
    expect(soglieAlPeso('panca', 40, 'M')).toEqual(soglieAlPeso('panca', 45, 'M'))
    expect(soglieAlPeso('panca', 160, 'M')).toEqual(soglieAlPeso('panca', 180, 'M'))
  })

  it.each(ALZATE)('%s: chi pesa di più non trova mai una soglia più bassa, e i percentili sono in ordine', alzata => {
    for (const sesso of ['M', 'F'] as const) {
      let prima = [0, 0, 0, 0]
      for (let peso = 40; peso <= 150; peso += 1) {
        const s = soglieAlPeso(alzata, peso, sesso)
        s.forEach((v, i) => expect(v).toBeGreaterThanOrEqual(prima[i] - 1e-9))
        for (let i = 1; i < 4; i++) expect(s[i]).toBeGreaterThanOrEqual(s[i - 1])
        prima = s
      }
    }
  })

  it('sesso ignoto: la tabella maschile', () => {
    expect(soglieAlPeso('panca', 80)).toEqual(soglieAlPeso('panca', 80, 'M'))
  })
})

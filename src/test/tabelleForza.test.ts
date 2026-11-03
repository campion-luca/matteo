import { describe, it, expect } from 'vitest'
import { soglieAlPeso, type AlzataTabella } from '@/features/gym/tabelleForza'

// Le tabelle sono numeri copiati da due articoli: il rischio è un numero sbagliato o
// un conto che li deforma. Qui si ricontrollano alcuni valori con la tabella alla mano.
const KG = 0.45359237
const massimale = (libbre: number) => libbre * KG * (4 / 3)
const ALZATE: AlzataTabella[] = ['panca', 'lat', 'lento', 'curl', 'pressa']

describe('le soglie al peso', () => {
  // Dal 3 novembre 2026 la soglia viene da una curva su tutte le classi (vedi
  // `curva`): al centro di una classe non è più il numero dello studio, ma gli
  // sta vicino. Il controllo è su tutti: un numero copiato male, o un conto che
  // li deforma, ne porterebbe almeno uno fuori.
  it('al centro di ogni classe resta vicina ai numeri dello studio', () => {
    // Uomini, 165-190 libbre, Bench Press Post-Training: 135, 160, 185, 225.
    const s = soglieAlPeso('panca', 177.5 * KG, 'M')
    ;[135, 160, 185, 225].forEach((libbre, i) => expect(Math.abs(s[i] / massimale(libbre) - 1)).toBeLessThan(0.1))
    // Donne, 155-175 libbre, Lat Pulldown Post-Training, 95°: 110.
    expect(Math.abs(soglieAlPeso('lat', 165 * KG, 'F')[3] / massimale(110) - 1)).toBeLessThan(0.1)
    // Uomini, 190-210 libbre, Leg Press Post-Training, 50°: 500.
    expect(Math.abs(soglieAlPeso('pressa', 200 * KG, 'M')[1] / massimale(500) - 1)).toBeLessThan(0.1)
  })

  it('i percentili sono sempre distinti: ogni rank si può prendere', () => {
    // Donne di 54 kg alla lat machine: lo studio dà 80 libbre sia al 20° sia
    // al 50°, e Argento stava alla stessa soglia di Bronzo.
    const [p20, p50] = soglieAlPeso('lat', 54, 'F')
    expect(p50).toBeGreaterThan(p20 * 1.05)
    for (const alzata of ALZATE) for (const sesso of ['M', 'F'] as const) for (let peso = 40; peso <= 150; peso += 1) {
      const s = soglieAlPeso(alzata, peso, sesso)
      for (let i = 1; i < 4; i++) expect(s[i]).toBeGreaterThan(s[i - 1] * 1.05)
    }
  })

  it('uomini e donne hanno tabelle loro', () => {
    expect(soglieAlPeso('panca', 70, 'F')[1]).toBeLessThan(soglieAlPeso('panca', 70, 'M')[1] * 0.6)
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

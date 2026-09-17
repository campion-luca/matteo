import { describe, it, expect } from 'vitest'
import {
  formatoSessione, sessioniDel, unitaFormato, distanzaLeggibile, proietta,
  giorniDiGara, contestoSessione, secFresco, stazioneDouble, esponentePersonale,
  stimaSegmento, stimaGara, fmtTempoGara,
  ESPONENTE, FATICA_CORSA, FATICA_CORSA_SIMULAZIONE, RIFERIMENTO, ROXZONE_PASSAGGI, ROXZONE_SEC,
} from '@/features/gym/hyroxStima'
import { RACE_STATIONS, RUNNING_STATION } from '@/features/gym/gymModel'
import type { HyroxExercise, HyroxHistoryEntry } from '@/store/useJarvisStore'

const sess = (date: string, sec: number, units: number): HyroxHistoryEntry => ({ d: date, date, sec, units })
const es = (id: string, target: number, unit: HyroxExercise['unit'], history: HyroxHistoryEntry[] = []): HyroxExercise =>
  ({ id, n: id, unit, target, history })
const nessunGiorno = { gara: new Set<string>(), simulazione: new Set<string>() }

// Un atleta finto di cui si conoscono i tempi "freschi, da solo" su distanza di
// gara: il riferimento stesso. Tutti gli scenari si costruiscono in avanti col
// modello, e la stima deve saperli rileggere all'indietro.
const FRESCO = RIFERIMENTO
const k = (id: string) => ESPONENTE[id]

/** Una gara registrata: 1 km di corsa (media) e tutte le stazioni intere. */
function gara(date: string, categoria: 'double' | 'singolo', scala = 1): HyroxExercise[] {
  const corsa = es(RUNNING_STATION.id, 1, 'km', [sess(date, Math.round(FRESCO.hx_run * scala * FATICA_CORSA[categoria]), 1)])
  const stazioni = RACE_STATIONS.map(r => {
    const f = FRESCO[r.id] * scala
    const sec = categoria === 'double' ? stazioneDouble(f, r.id) : f
    return es(r.id, r.target, r.unit, [sess(date, Math.round(sec), r.target)])
  })
  return [corsa, ...stazioni]
}

/** Una simulazione tutta a metà, fatta da solo. */
function simulazione(date: string, scala = 1): HyroxExercise[] {
  const corsa = es(RUNNING_STATION.id, 1, 'km',
    [sess(date, Math.round(FRESCO.hx_run * scala / Math.pow(2, k('hx_run')) * FATICA_CORSA_SIMULAZIONE), 0.5)])
  const stazioni = RACE_STATIONS.map(r =>
    es(r.id, r.target, r.unit, [sess(date, Math.round(FRESCO[r.id] * scala / Math.pow(2, k(r.id))), r.target / 2)]))
  return [corsa, ...stazioni]
}

/** Unisce gli storici di più "registrazioni" segmento per segmento. */
function unisci(...gruppi: HyroxExercise[][]): HyroxExercise[] {
  return gruppi[0].map((ex, i) => ({ ...ex, history: gruppi.flatMap(g => g[i].history) }))
}
const stima = (segmenti: HyroxExercise[], categoria: 'double' | 'singolo' = 'double') =>
  stimaGara(segmenti[0], segmenti.slice(1), categoria)

describe('formato di una sessione', () => {
  it('la distanza di gara è intera, la sua metà è mezza', () => {
    expect(formatoSessione({ units: 1000 }, 1000)).toBe('intero')
    expect(formatoSessione({ units: 500 }, 1000)).toBe('mezzo')
    expect(formatoSessione({ units: 0.5 }, 1)).toBe('mezzo')
    expect(formatoSessione({ units: 50 }, 100)).toBe('mezzo')
  })

  it('una prova un po’ corta resta intera, una molto corta è mezza', () => {
    expect(formatoSessione({ units: 800 }, 1000)).toBe('intero')
    expect(formatoSessione({ units: 750 }, 1000)).toBe('mezzo')
  })

  it('un dato vecchio o rotto non sparisce: conta come intero', () => {
    expect(formatoSessione({ units: 0 }, 1000)).toBe('intero')
    expect(formatoSessione({ units: NaN }, 1000)).toBe('intero')
  })

  it('filtra lo storico e propone la distanza giusta', () => {
    const h = [sess('2026-09-01', 240, 1000), sess('2026-09-02', 110, 500)]
    expect(sessioniDel(h, 1000, 'mezzo')).toHaveLength(1)
    expect(unitaFormato(1, 'mezzo')).toBe(0.5)
    expect(unitaFormato(100, 'intero')).toBe(100)
  })

  it('scrive le distanze come le dice una persona', () => {
    expect(distanzaLeggibile(0.5, 'km')).toBe('500 m')
    expect(distanzaLeggibile(1, 'km')).toBe('1 km')
    expect(distanzaLeggibile(50, 'rep')).toBe('50 rep')
  })
})

describe('Riegel', () => {
  it('raddoppiare la distanza con k 1,06 costa 2,085 volte il tempo', () => {
    expect(proietta(100, 500, 1000, 1.06)).toBeCloseTo(208.49, 1)
  })
  it('con k = 1 è una proporzione, a pari distanza non cambia niente', () => {
    expect(proietta(120, 500, 1000, 1)).toBe(240)
    expect(proietta(237, 1000, 1000, 1.12)).toBe(237)
  })
})

describe('gare e simulazioni si riconoscono da sole', () => {
  it('cinque segmenti interi lo stesso giorno sono una gara', () => {
    const g = giorniDiGara(gara('2026-06-14', 'double'))
    expect([...g.gara]).toEqual(['2026-06-14'])
    expect(g.simulazione.size).toBe(0)
  })

  it('cinque segmenti a metà lo stesso giorno sono una simulazione', () => {
    expect([...giorniDiGara(simulazione('2026-09-12')).simulazione]).toEqual(['2026-09-12'])
  })

  it('quattro segmenti sono ancora un allenamento', () => {
    const quattro = gara('2026-06-14', 'singolo').map((ex, i) => i < 4 ? ex : { ...ex, history: [] })
    expect(giorniDiGara(quattro).gara.size).toBe(0)
  })

  it('una mezza nel giorno di una gara intera non diventa "gara"', () => {
    const g = giorniDiGara(gara('2026-06-14', 'singolo'))
    expect(contestoSessione({ units: 500, date: '2026-06-14' }, 1000, g)).toBe('allenamento')
    expect(contestoSessione({ units: 1000, date: '2026-06-14' }, 1000, g)).toBe('gara')
  })
})

describe('passo 1: tutto riportato a "da solo, fresco"', () => {
  it('la corsa di gara perde la sua fatica, diversa fra singolo e double', () => {
    expect(secFresco({ sec: 330 }, 'hx_run', 'gara', 'singolo')).toBeCloseTo(300, 5)
    expect(secFresco({ sec: 315 }, 'hx_run', 'gara', 'double')).toBeCloseTo(300, 5)
    expect(secFresco({ sec: 315 }, 'hx_run', 'simulazione', 'double')).toBeCloseTo(300, 5)
    expect(secFresco({ sec: 300 }, 'hx_run', 'allenamento', 'double')).toBe(300)
  })

  it('una stazione in double si riporta a te da solo, e ritorno', () => {
    for (const r of RACE_STATIONS) {
      const coppia = stazioneDouble(FRESCO[r.id], r.id)
      expect(coppia).toBeLessThan(FRESCO[r.id])                         // in due si va più forte
      expect(secFresco({ sec: coppia }, r.id, 'gara', 'double')).toBeCloseTo(FRESCO[r.id], 5)
    }
  })

  it('una stazione in singolo o in allenamento resta com’è', () => {
    expect(secFresco({ sec: 270 }, 'hx_ski', 'gara', 'singolo')).toBe(270)
    expect(secFresco({ sec: 270 }, 'hx_ski', 'allenamento', 'double')).toBe(270)
  })

  it('un tempo di coppia registrato male non diventa zero', () => {
    expect(secFresco({ sec: 10 }, 'hx_wb', 'gara', 'double')).toBeGreaterThanOrEqual(10)
  })
})

describe('k personale', () => {
  it('serve almeno una intera E una mezza', () => {
    expect(esponentePersonale(es('hx_ski', 1000, 'm', [sess('2026-09-01', 240, 1000)]), nessunGiorno, 'double', 1.06)).toBeNull()
  })

  it('si ricava dal rapporto fra i tuoi tempi, con i limiti', () => {
    const h = [sess('2026-09-01', 110, 500), sess('2026-09-02', 242, 1000)]
    expect(esponentePersonale(es('hx_ski', 1000, 'm', h), nessunGiorno, 'double', 1.06)).toBeCloseTo(Math.log2(2.2), 3)
    const lenta = [sess('2026-09-01', 150, 500), sess('2026-09-02', 240, 1000)]
    expect(esponentePersonale(es('hx_ski', 1000, 'm', lenta), nessunGiorno, 'double', 1.06)).toBe(1.0)
  })

  it('una gara e una simulazione vicine dello stesso atleta non inventano un k diverso', () => {
    // La fatica di gara va tolta PRIMA del confronto: altrimenti finirebbe dentro
    // k, e la corsa sembrerebbe crollare sulla distanza.
    const segmenti = unisci(gara('2026-09-01', 'double'), simulazione('2026-09-12'))
    const giorni = giorniDiGara(segmenti)
    expect(esponentePersonale(segmenti[0], giorni, 'double', 1.06)).toBeCloseTo(1.06, 1)
  })

  it('un’intera e una mezza lontane mesi non tarano niente: in mezzo c’è la forma cambiata', () => {
    const h = [sess('2026-06-14', 242, 1000), sess('2026-09-12', 110, 500)]
    expect(esponentePersonale(es('hx_ski', 1000, 'm', h), nessunGiorno, 'double', 1.06)).toBeNull()
  })
})

describe('passo 1 per un segmento', () => {
  it('senza dati non inventa niente', () => {
    expect(stimaSegmento(es('hx_ski', 1000, 'm'), nessunGiorno, 'double')).toMatchObject({ fresco: null, fonte: 'mancante' })
  })

  it('una mezza si proietta sulla distanza di gara', () => {
    const s = stimaSegmento(es('hx_ski', 1000, 'm', [sess('2026-09-01', 110, 500)]), nessunGiorno, 'double')
    expect(s).toMatchObject({ fonte: 'misura', daMezza: true, kPersonale: false })
    expect(s.fresco).toBeCloseTo(110 * Math.pow(2, 1.06), 5)
  })

  it('una mezza registrata non abbassa la stima di un’intera', () => {
    // Il difetto di partenza: la media ingenua di 240 e 110 dava 175.
    const h = [sess('2026-09-01', 240, 1000), sess('2026-09-02', 110, 500)]
    expect(stimaSegmento(es('hx_ski', 1000, 'm', h), nessunGiorno, 'double').fresco).toBeCloseTo(240, 0)
  })

  it('usa le ultime tre sessioni, in ordine di data', () => {
    const h = [sess('2026-09-01', 250, 1000), sess('2026-09-05', 240, 1000), sess('2026-09-10', 230, 1000), sess('2026-01-01', 400, 1000)]
    expect(stimaSegmento(es('hx_row', 1000, 'm', h), nessunGiorno, 'double').fresco).toBeCloseTo(240, 5)
  })

  it('gare e simulazioni contano più dell’allenamento', () => {
    const segmenti = gara('2026-06-14', 'singolo')
    segmenti[1] = { ...segmenti[1], history: [...segmenti[1].history, sess('2026-09-01', 200, 1000), sess('2026-09-03', 200, 1000)] }
    const s = stimaSegmento(segmenti[1], giorniDiGara(segmenti), 'singolo')
    expect(s.contesti).toEqual(['gara'])
    expect(s.fresco).toBeCloseTo(FRESCO.hx_ski, 0)
  })
})

describe('la stima di gara', () => {
  it('rilegge una gara in double e restituisce il suo tempo', () => {
    const segmenti = gara('2026-06-14', 'double')
    const g = stima(segmenti, 'double')
    const vero = segmenti.reduce((s, ex, i) => s + ex.history[0].sec * (i === 0 ? 8 : 1), 0) + ROXZONE_PASSAGGI * ROXZONE_SEC
    expect(g.tempi.double!.totale).toBeCloseTo(vero, -1)                 // entro l'arrotondamento
    expect(g).toMatchObject({ misurati: 9, daProfilo: 0, gare: ['2026-06-14'] })
  })

  it('dalla stessa gara ricava anche il singolo, più lento', () => {
    const g = stima(gara('2026-06-14', 'double'), 'double')
    expect(g.tempi.singolo!.totale).toBeGreaterThan(g.tempi.double!.totale)
    // …e il singolo è quello che avrebbe fatto lo stesso atleta da solo.
    const soloVero = stima(gara('2026-06-14', 'singolo'), 'singolo').tempi.singolo!.totale
    expect(g.tempi.singolo!.totale).toBeCloseTo(soloVero, -1)
  })

  it('funziona con la sola simulazione a metà', () => {
    const g = stima(simulazione('2026-09-12'), 'double')
    expect(g).toMatchObject({ misurati: 9, daProfilo: 0, simulazioni: ['2026-09-12'] })
    expect(g.corsa.daMezza).toBe(true)
    // Stesso atleta della gara in double: stesso tempo, a meno degli arrotondamenti.
    const daGara = stima(gara('2026-06-14', 'double'), 'double').tempi.double!.totale
    expect(g.tempi.double!.totale).toBeCloseTo(daGara, -1)
  })

  it('in double ogni stazione è più veloce che da solo, anche col k tarato al minimo', () => {
    // Intera e mezza con k personale 1: prima i turni non davano nessun vantaggio
    // e la coppia usciva più lenta per colpa dei cambi.
    const segmenti = simulazione('2026-09-12').map(ex => ex.id === 'hx_ski'
      ? { ...ex, history: [sess('2026-09-10', 250, 1000), sess('2026-09-12', 125, 500)] } : ex)
    const g = stima(segmenti, 'double')
    const ski = g.stazioni.find(s => s.ex.id === 'hx_ski')!
    expect(ski.stima.kPersonale).toBe(true)
    expect(g.tempi.double!.perStazione.hx_ski).toBeLessThan(ski.stima.fresco!)
  })

  it('gara passata + simulazione più veloce: la stima migliora, senza cancellare la gara', () => {
    const soloGara = stima(gara('2026-06-14', 'double'), 'double').tempi.double!.totale
    const soloSim  = stima(simulazione('2026-09-12', 0.9), 'double').tempi.double!.totale
    const entrambe = stima(unisci(gara('2026-06-14', 'double'), simulazione('2026-09-12', 0.9)), 'double').tempi.double!.totale
    expect(entrambe).toBeLessThan(soloGara)
    expect(entrambe).toBeGreaterThan(soloSim)
  })

  it('la corsa in gara singola porta più fatica che in double', () => {
    const g = stima(simulazione('2026-09-12'), 'double')
    expect(g.tempi.singolo!.corsaKm / g.tempi.double!.corsaKm).toBeCloseTo(FATICA_CORSA.singolo / FATICA_CORSA.double, 5)
  })

  it('con dati parziali completa col profilo', () => {
    // Solo corsa, SkiErg e Rowing, tutti il 10% più lenti del riferimento.
    const segmenti = [es(RUNNING_STATION.id, 1, 'km', [sess('2026-09-01', 330, 1)]),
      ...RACE_STATIONS.map(r => es(r.id, r.target, r.unit,
        r.id === 'hx_ski' || r.id === 'hx_row' ? [sess('2026-09-01', FRESCO[r.id] * 1.1, r.target)] : []))]
    const g = stima(segmenti, 'singolo')
    expect(g).toMatchObject({ misurati: 3, daProfilo: 6 })
    expect(g.fattoreProfilo).toBeCloseTo(1.1, 5)
    const sled = g.stazioni.find(s => s.ex.id === 'hx_sled_p')!.stima
    expect(sled).toMatchObject({ fonte: 'profilo' })
    expect(sled.fresco).toBeCloseTo(FRESCO.hx_sled_p * 1.1, 5)
    expect(g.tempi.singolo).not.toBeNull()
  })

  it('con troppo pochi dati non inventa la gara', () => {
    const segmenti = [es(RUNNING_STATION.id, 1, 'km', [sess('2026-09-01', 300, 1)]),
      ...RACE_STATIONS.map(r => es(r.id, r.target, r.unit, r.id === 'hx_ski' ? [sess('2026-09-01', 270, 1000)] : []))]
    const g = stima(segmenti)
    expect(g.misurati).toBe(2)
    expect(g.tempi).toEqual({ double: null, singolo: null })
    expect(g.margine).toBeNull()
  })

  it('il margine cresce con quello che la stima deve supporre', () => {
    const piena = stima(gara('2026-06-14', 'double'))
    const segmenti = gara('2026-06-14', 'double').map((ex, i) => i >= 1 && i <= 3 ? { ...ex, history: [] } : ex)
    const bucata = stima(segmenti)
    expect(bucata.daProfilo).toBe(3)
    expect(bucata.margine! / bucata.tempi.double!.totale).toBeGreaterThan(piena.margine! / piena.tempi.double!.totale)
  })
})

describe('formato del tempo di gara', () => {
  it('sotto l’ora minuti e secondi, sopra anche le ore', () => {
    expect(fmtTempoGara(59 * 60 + 5)).toBe('59:05')
    expect(fmtTempoGara(72 * 60 + 40)).toBe('1:12:40')
  })
})

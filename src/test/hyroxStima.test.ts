import { describe, it, expect } from 'vitest'
import {
  formatoSessione, sessioniDel, unitaFormato, distanzaLeggibile, proietta,
  stimaPB, categoriaStima, totaleGara, giornateAMeta, aDistanzaIntera, fmtDelta, fmtTempoGara,
  ESPONENTE, RIFERIMENTO, ROXZONE_PASSAGGI, ROXZONE_SEC,
} from '@/features/gym/hyroxStima'
import { RACE_STATIONS, RUNNING_STATION } from '@/features/gym/gymModel'
import type { HyroxExercise, HyroxGara, HyroxHistoryEntry } from '@/store/useJarvisStore'

const sess = (date: string, sec: number, units: number): HyroxHistoryEntry => ({ d: date, date, sec, units })
const es = (id: string, target: number, unit: HyroxExercise['unit'], history: HyroxHistoryEntry[] = []): HyroxExercise =>
  ({ id, n: id, unit, target, history })

const OGGI = '2026-10-04'
const RECENTE = '2026-09-28'   // dentro l'ultimo mese
const VECCHIO = '2026-08-15'   // prima

/** Tutte le stazioni intere, con i tempi del riferimento × scala. */
function stazioni(date: string, scala = 1): HyroxExercise[] {
  return RACE_STATIONS.map(r => es(r.id, r.target, r.unit, [sess(date, Math.round(RIFERIMENTO[r.id] * scala), r.target)]))
}
const corsa = (...h: HyroxHistoryEntry[]) => es(RUNNING_STATION.id, 1, 'km', h)
const vuote = () => RACE_STATIONS.map(r => es(r.id, r.target, r.unit))

function garaReg(date: string, extra: Partial<HyroxGara> = {}): HyroxGara {
  return {
    id: `g-${date}`, date, tipo: 'gara', categoria: 'double',
    corsa: 8 * 330,
    stazioni: Object.fromEntries(RACE_STATIONS.map(r => [r.id, RIFERIMENTO[r.id]])),
    roxzone: 7 * 60,
    ...extra,
  }
}

const sommaRif = RACE_STATIONS.reduce((t, r) => t + RIFERIMENTO[r.id], 0)
const roxIpotesi = ROXZONE_PASSAGGI * ROXZONE_SEC

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

describe('la stima è la somma dei tuoi PB', () => {
  it('corsa al passo migliore × 8, più le stazioni, più la Roxzone', () => {
    const s = stimaPB(corsa(sess(RECENTE, 330, 1), sess(VECCHIO, 300, 1)), stazioni(RECENTE), [], OGGI)
    expect(s.corsa.passoKm).toBe(300)
    expect(s.corsa.sec).toBe(2400)
    expect(s.parti).toEqual({ corsa: 2400, stazioni: sommaRif, roxzone: roxIpotesi })
    expect(s.totale).toBe(2400 + sommaRif + roxIpotesi)
    expect(s.roxzone.fonte).toEqual({ tipo: 'ipotesi' })
  })

  it('di ogni stazione tiene il tempo migliore, e dice da dove viene', () => {
    const ski = es('hx_ski', 1000, 'm', [sess(VECCHIO, 260, 1000), sess(RECENTE, 275, 1000)])
    const s = stimaPB(corsa(sess(RECENTE, 300, 1)), [ski, ...stazioni(RECENTE).slice(1)], [], OGGI)
    expect(s.stazioni[0].pb.sec).toBe(260)
    expect(s.stazioni[0].pb.fonte).toEqual({ tipo: 'allenamento', data: VECCHIO })
  })

  it('una corsa registrata su più km vale per il suo passo medio', () => {
    const s = stimaPB(corsa(sess(RECENTE, 8 * 320, 8)), stazioni(RECENTE), [], OGGI)
    expect(s.corsa.passoKm).toBe(320)
  })

  it('una mezza si porta all’intera solo dove di intere non ce n’è', () => {
    const soloMezza = es('hx_ski', 1000, 'm', [sess(RECENTE, 120, 500)])
    const s = stimaPB(corsa(sess(RECENTE, 300, 1)), [soloMezza, ...stazioni(RECENTE).slice(1)], [], OGGI)
    expect(s.stazioni[0].pb.sec).toBeCloseTo(proietta(120, 500, 1000, ESPONENTE.hx_ski), 5)
    expect(s.stazioni[0].pb.fonte?.tipo).toBe('mezza')

    // Con un'intera, anche più lenta della proiezione, vince l'intera.
    const conIntera = es('hx_ski', 1000, 'm', [sess(RECENTE, 120, 500), sess(VECCHIO, 280, 1000)])
    const t = stimaPB(corsa(sess(RECENTE, 300, 1)), [conIntera, ...stazioni(RECENTE).slice(1)], [], OGGI)
    expect(t.stazioni[0].pb.sec).toBe(280)
  })

  it('una simulazione intera registrata con l’interruttore su 500 m non raddoppia più la stima', () => {
    // Il caso del 2:16 al posto di 1:30: i tempi veri, ma salvati come mezze.
    const mezze = RACE_STATIONS.map(r => es(r.id, r.target, r.unit, [sess(RECENTE, RIFERIMENTO[r.id], r.target / 2)]))
    const sim = garaReg(RECENTE, { tipo: 'simulazione', categoria: 'singolo' })
    const s = stimaPB(corsa(), mezze, [sim], OGGI)
    expect(s.totale).toBe(totaleGara(sim))
    expect(s.stazioni.every(x => x.pb.fonte?.tipo === 'simulazione')).toBe(true)
  })
})

describe('gare e simulazioni registrate', () => {
  it('il totale di una gara è corsa + stazioni + Roxzone', () => {
    expect(totaleGara(garaReg(RECENTE))).toBe(8 * 330 + sommaRif + 420)
  })

  it('la Roxzone viene dalle gare, la migliore', () => {
    const gare = [garaReg(VECCHIO, { roxzone: 400 }), garaReg(RECENTE, { id: 'b', roxzone: 380 })]
    const s = stimaPB(corsa(), vuote(), gare, OGGI)
    expect(s.roxzone.sec).toBe(380)
    expect(s.roxzone.fonte).toEqual({ tipo: 'gara', data: RECENTE })
  })

  it('la stima è nella categoria dell’ultima gara, e le stazioni dell’altra non valgono', () => {
    const singolo = garaReg(VECCHIO, { id: 's', categoria: 'singolo', stazioni: { hx_ski: 200 } })
    const double = garaReg(RECENTE, { id: 'd', categoria: 'double', stazioni: { hx_ski: 230 } })
    expect(categoriaStima([singolo, double])).toBe('double')
    const s = stimaPB(corsa(sess(RECENTE, 300, 1)), stazioni(RECENTE), [singolo, double], OGGI)
    expect(s.categoria).toBe('double')
    expect(s.stazioni[0].pb.sec).toBe(230)
  })

  it('la corsa di una gara vale in entrambe le categorie: corrono tutti e due', () => {
    const singolo = garaReg(VECCHIO, { id: 's', categoria: 'singolo', corsa: 8 * 290 })
    const double = garaReg(RECENTE, { id: 'd', categoria: 'double', corsa: 8 * 310 })
    const s = stimaPB(corsa(), vuote(), [singolo, double], OGGI)
    expect(s.corsa.passoKm).toBe(290)
  })

  it('senza gare non c’è una categoria: gli allenamenti valgono per tutte e due', () => {
    expect(categoriaStima([])).toBeNull()
  })
})

describe('il profilo completa i segmenti che mancano', () => {
  it('con almeno tre misurati, i mancanti seguono il tuo rapporto col riferimento', () => {
    const parziali = RACE_STATIONS.map((r, i) => es(r.id, r.target, r.unit, i < 3 ? [sess(RECENTE, RIFERIMENTO[r.id] * 1.1, r.target)] : []))
    const s = stimaPB(corsa(), parziali, [], OGGI)
    expect(s.daProfilo).toBe(6)                       // 5 stazioni e la corsa
    expect(s.stazioni[5].pb.fonte).toEqual({ tipo: 'profilo' })
    expect(s.stazioni[5].pb.sec).toBeCloseTo(RIFERIMENTO[RACE_STATIONS[5].id] * 1.1, 5)
    expect(s.corsa.passoKm).toBeCloseTo(RIFERIMENTO.hx_run * 1.1, 5)
    expect(s.totale).not.toBeNull()
  })

  it('con meno di tre non inventa: la stima resta senza totale', () => {
    const due = RACE_STATIONS.map((r, i) => es(r.id, r.target, r.unit, i < 2 ? [sess(RECENTE, 200, r.target)] : []))
    const s = stimaPB(corsa(), due, [], OGGI)
    expect(s.totale).toBeNull()
    expect(s.parti).toBeNull()
    expect(s.misurati).toBe(2)
  })
})

describe('nell’ultimo mese', () => {
  it('il delta è il PB di oggi meno quello di un mese fa', () => {
    const ski = es('hx_ski', 1000, 'm', [sess(VECCHIO, 280, 1000), sess(RECENTE, 265, 1000)])
    const s = stimaPB(corsa(sess(VECCHIO, 310, 1), sess(RECENTE, 305, 1)), [ski, ...stazioni(VECCHIO).slice(1)], [], OGGI)
    expect(s.stazioni[0].pb.delta).toBe(-15)
    expect(s.stazioni[1].pb.delta).toBe(0)
    expect(s.corsa.delta).toBe(-40)                   // 5 s al km × 8
    expect(s.delta).toBe(-55)
  })

  it('senza dati di un mese fa non c’è un delta', () => {
    const s = stimaPB(corsa(sess(RECENTE, 300, 1)), stazioni(RECENTE), [], OGGI)
    expect(s.stazioni[0].pb.delta).toBeNull()
    expect(s.delta).toBeNull()
  })

  it('scrive il delta col segno, come un cronometro', () => {
    expect(fmtDelta(-8)).toBe('−0:08')
    expect(fmtDelta(66)).toBe('+1:06')
    expect(fmtDelta(-160)).toBe('−2:40')
  })
})

describe('le giornate da controllare', () => {
  it('cinque o più stazioni a metà lo stesso giorno fanno una domanda', () => {
    const segmenti = RACE_STATIONS.map((r, i) => es(r.id, r.target, r.unit, i < 5 ? [sess(RECENTE, 200, r.target / 2)] : []))
    expect(giornateAMeta(segmenti)).toEqual([{ data: RECENTE, segmenti: RACE_STATIONS.slice(0, 5).map(r => r.id) }])
  })

  it('quattro no: è un allenamento a metà, non una gara registrata male', () => {
    const segmenti = RACE_STATIONS.map((r, i) => es(r.id, r.target, r.unit, i < 4 ? [sess(RECENTE, 200, r.target / 2)] : []))
    expect(giornateAMeta(segmenti)).toEqual([])
  })

  it('correggere riporta alla distanza intera solo le mezze di quel giorno', () => {
    const h = [sess(RECENTE, 250, 500), sess(VECCHIO, 120, 500), sess(RECENTE, 260, 1000)]
    expect(aDistanzaIntera(h, 1000, RECENTE).map(x => x.units)).toEqual([1000, 500, 1000])
  })
})

describe('formato del tempo di gara', () => {
  it('sotto l’ora minuti e secondi, sopra anche le ore', () => {
    expect(fmtTempoGara(59 * 60 + 5)).toBe('59:05')
    expect(fmtTempoGara(72 * 60 + 40)).toBe('1:12:40')
  })
})

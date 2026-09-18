import { describe, it, expect } from 'vitest'
import { creaMessaggio, letto, nonLetti, ruoloIn, conversazioni, type BozzaMessaggio, type Messaggio } from '@/lib/messaggi'
import { fmtQuando } from '@/lib/dateFormat'

// Le richieste su una scheda condivisa. Quello che può andare storto qui non dà
// un errore: dà un badge rosso che non si spegne più, o una risposta che arriva
// a chi non l'ha chiesta, o un messaggio che sparisce dall'elenco di uno dei due.

const COACH = 'u-coach-1111'
const ATLETA = 'u-atleta-2222'

const msg = (extra: Partial<Messaggio> = {}): Messaggio => ({
  id: 'ms1',
  scheda_id: 'sc-lunedi~u-atleta',
  scheda_titolo: 'Full A',
  coach_id: COACH,
  athlete_id: ATLETA,
  autore: ATLETA,
  autore_nome: 'Luca',
  esercizio_id: 'r1',
  esercizio_nome: 'Panca piana',
  tipo: 'info',
  testo: 'Quanto recupero?',
  letto_coach: false,
  letto_atleta: true,
  created_at: '2026-09-18T10:00:00.000Z',
  ...extra,
})

/** La stessa riga, ma nella forma che si passa a `creaMessaggio`: senza id,
 *  data e spunte, che è proprio quello che quella funzione ci mette. */
const bozza = (extra: Partial<BozzaMessaggio> = {}): BozzaMessaggio => {
  const pieno = msg()
  return {
    scheda_id: pieno.scheda_id, scheda_titolo: pieno.scheda_titolo,
    coach_id: pieno.coach_id, athlete_id: pieno.athlete_id,
    autore: pieno.autore, autore_nome: pieno.autore_nome,
    esercizio_id: pieno.esercizio_id, esercizio_nome: pieno.esercizio_nome,
    tipo: pieno.tipo, testo: pieno.testo,
    ...extra,
  }
}

describe('chi ha letto cosa', () => {
  it('il messaggio che ho scritto io non è mai da leggere', () => {
    // Il guasto che questo previene: il badge rosso che si accende da solo
    // appena si manda una domanda, cioè su ogni cosa che si scrive.
    const m = msg({ autore: ATLETA, letto_atleta: false })
    expect(letto(m, ATLETA)).toBe(true)
    expect(nonLetti([m], ATLETA)).toEqual([])
  })

  it('la spunta si legge dal lato in cui sto io', () => {
    const m = msg({ letto_coach: false, letto_atleta: true })
    // L'atleta l'ha scritto: letto. L'allenatore no.
    expect(letto(m, COACH)).toBe(false)
    expect(nonLetti([m], COACH)).toHaveLength(1)
  })

  it('chi non è né allenatore né atleta non ha niente da leggere', () => {
    // Non dovrebbe mai arrivare — la RLS non gli farebbe vedere la riga — ma
    // `nonLetti` alimenta un badge, e un badge acceso su messaggi di altri è
    // peggio di un badge spento.
    expect(nonLetti([msg()], 'u-estraneo-9999')).toEqual([])
    expect(ruoloIn(msg(), 'u-estraneo-9999')).toBeNull()
  })

  it('chi scrive nasce con la propria spunta già messa', () => {
    // `creaMessaggio` serve anche all'eco locale: la riga che compare subito
    // nell'elenco di chi scrive deve essere IDENTICA a quella che il server
    // salverà, spunte comprese, o il badge lampeggerebbe al primo giro.
    const daCoach = creaMessaggio(bozza({ autore: COACH, tipo: 'risposta' }))
    expect(daCoach.letto_coach).toBe(true)
    expect(daCoach.letto_atleta).toBe(false)

    const daAtleta = creaMessaggio(bozza({ autore: ATLETA }))
    expect(daAtleta.letto_atleta).toBe(true)
    expect(daAtleta.letto_coach).toBe(false)
  })

  it('dà un id nuovo a ogni messaggio', () => {
    // Due domande mandate nello stesso istante con lo stesso id: la seconda
    // insert fallisce sulla chiave primaria e la richiesta sembra partita.
    const a = creaMessaggio(bozza())
    const b = creaMessaggio(bozza())
    expect(a.id).not.toBe(b.id)
  })
})

describe('i fili di conversazione', () => {
  const righe: Messaggio[] = [
    msg({ id: 'a', scheda_id: 'sc-1', created_at: '2026-09-18T10:00:00.000Z' }),
    msg({ id: 'b', scheda_id: 'sc-1', autore: COACH, autore_nome: 'Marco', tipo: 'risposta',
          testo: 'Due minuti.', letto_coach: true, letto_atleta: false,
          created_at: '2026-09-18T11:00:00.000Z' }),
    msg({ id: 'c', scheda_id: 'sc-2', scheda_titolo: 'Lower B',
          testo: 'La pressa è occupata', tipo: 'sostituzione',
          created_at: '2026-09-18T12:00:00.000Z' }),
  ]

  it('raggruppa per scheda, non per persona', () => {
    // Un allenatore con cinque schede sulla stessa persona ha cinque fili: in
    // uno solo, la domanda sulla panca del lunedì finirebbe sotto quella sugli
    // stacchi del giovedì e non si capirebbe più di cosa si parla.
    const fili = conversazioni(righe, COACH)
    expect(fili.map(c => c.schedaId)).toEqual(['sc-2', 'sc-1'])
  })

  it('mette in cima il filo toccato per ultimo', () => {
    // Non l'ordine di nascita: una conversazione a cui è appena arrivata una
    // domanda deve stare in cima, o la si legge due giorni dopo.
    expect(conversazioni(righe, COACH)[0].ultimo.id).toBe('c')
  })

  it('conta solo quello che devo leggere IO', () => {
    const perCoach = conversazioni(righe, COACH).find(c => c.schedaId === 'sc-1')!
    // 'a' l'ha scritto l'atleta e il coach non l'ha letto; 'b' l'ha scritto lui.
    expect(perCoach.daLeggere).toBe(1)

    const perAtleta = conversazioni(righe, ATLETA).find(c => c.schedaId === 'sc-1')!
    // Specularmente: la risposta 'b' è quella che l'atleta deve ancora leggere.
    expect(perAtleta.daLeggere).toBe(1)
    expect(nonLetti(perAtleta.messaggi, ATLETA).map(m => m.id)).toEqual(['b'])
  })

  it('pesca il nome della controparte da quello che ha scritto lei', () => {
    // Nessuno dei due può leggere l'anagrafica dell'altro (vedi
    // coach_schema.sql): il nome viaggia dentro il messaggio, e va preso dalle
    // righe dell'altro — dalle proprie si leggerebbe il proprio nome.
    expect(conversazioni(righe, COACH).find(c => c.schedaId === 'sc-1')!.controparte).toBe('Luca')
    expect(conversazioni(righe, ATLETA).find(c => c.schedaId === 'sc-1')!.controparte).toBe('Marco')
  })

  it('ordina i messaggi dentro il filo dal più vecchio', () => {
    const fuoriOrdine = [righe[1], righe[0]]
    expect(conversazioni(fuoriOrdine, COACH)[0].messaggi.map(m => m.id)).toEqual(['a', 'b'])
  })

  it('ignora i fili di cui non faccio parte', () => {
    const altrui = msg({ id: 'z', scheda_id: 'sc-9', coach_id: 'u-x', athlete_id: 'u-y', autore: 'u-x' })
    expect(conversazioni([...righe, altrui], COACH).map(c => c.schedaId)).not.toContain('sc-9')
  })
})

describe('quando è arrivato', () => {
  const adesso = new Date(2026, 8, 18, 15, 0, 0) // 18 settembre 2026, 15:00 locali

  it('di oggi mostra solo l’ora', () => {
    expect(fmtQuando(new Date(2026, 8, 18, 9, 5).toISOString(), adesso)).toBe('09:05')
  })

  it('di ieri lo dice a parole', () => {
    expect(fmtQuando(new Date(2026, 8, 17, 23, 40).toISOString(), adesso)).toBe('ieri 23:40')
  })

  it('“ieri” è il giorno di calendario, non 24 ore', () => {
    // Il guasto che questo previene: alle due di notte, un messaggio dell'una
    // — stessa notte, un'ora prima — letto come "ieri".
    const notte = new Date(2026, 8, 18, 2, 0, 0)
    expect(fmtQuando(new Date(2026, 8, 18, 1, 0).toISOString(), notte)).toBe('01:00')
  })

  it('più indietro mostra il giorno', () => {
    expect(fmtQuando(new Date(2026, 8, 12, 18, 30).toISOString(), adesso)).toBe('12/09 18:30')
  })

  it('una data che non si legge esce com’è invece di dire NaN', () => {
    expect(fmtQuando('boh', adesso)).toBe('boh')
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Messaggio, PaginaMessaggi } from '@/lib/messaggi'

// Il giro che tiene aggiornati i messaggi. Quello che può andare storto qui è
// una schermata che aspetta una cosa che non arriverà mai — e, da quando il
// giro chiede solo gli ultimi, un elenco che non corrisponde più al server.

// Un server finto: le righe che ha, e cosa gli viene chiesto.
let server: Messaggio[] = []
const richieste: { quanti: number; da: number }[] = []
const messaggiRecenti = vi.fn<(quanti: number, da?: number) => Promise<PaginaMessaggi>>()
const segnaLetti = vi.fn<(ids: string[], ruolo: 'coach' | 'atleta') => Promise<void>>()
const eliminaMessaggio = vi.fn<(id: string) => Promise<void>>()

vi.mock('@/lib/messaggi', async () => {
  const vero = await vi.importActual<typeof import('@/lib/messaggi')>('@/lib/messaggi')
  return {
    ...vero,
    messaggiRecenti: (quanti: number, da?: number) => messaggiRecenti(quanti, da),
    salvaMessaggio: async (m: Messaggio) => { server.push(m) },
    segnaLetti: (ids: string[], ruolo: 'coach' | 'atleta') => segnaLetti(ids, ruolo),
    eliminaMessaggio: (id: string) => eliminaMessaggio(id),
  }
})
vi.mock('@/lib/push', () => ({ notificaPush: () => {} }))

const { idChat, bozzaChat, perData, nonLetti } = await import('@/lib/messaggi')
const {
  avviaMessaggi, fermaMessaggi, ricaricaMessaggi, useMessaggiStore,
  invia, elimina, segnaLettiOra, RECENTI, PAGINA, MASSIMO,
} = await import('@/lib/messaggiLive')

const COACH = 'coach-1', ANNA = 'atleta-anna'

/** Il messaggio numero `n`: uno al minuto, in ordine. */
const riga = (n: number, o: Partial<Messaggio> = {}): Messaggio => ({
  id: `ms${String(n).padStart(5, '0')}`, scheda_id: idChat(COACH, ANNA), scheda_titolo: null,
  coach_id: COACH, athlete_id: ANNA, autore: ANNA, autore_nome: 'Anna',
  esercizio_id: null, esercizio_nome: null, tipo: 'chat', testo: `messaggio ${n}`,
  letto_coach: true, letto_atleta: true,
  created_at: new Date(Date.UTC(2020, 0, 1) + n * 60_000).toISOString(), ...o,
})
const righe = (quante: number) => Array.from({ length: quante }, (_, i) => riga(i + 1))

/** Cosa risponde il server in questo istante: dal più recente, una fetta e il totale. */
function fetta(quanti: number, da = 0): PaginaMessaggi {
  const ordinate = [...server].sort((a, b) => perData(b, a))
  return { righe: ordinate.slice(da, da + quanti), totale: ordinate.length }
}

/** Lascia passare il `setTimeout(0)` con cui parte un giro, più le promesse che
 *  ci stanno dentro. */
const unGiro = () => new Promise(r => setTimeout(r, 30))
const ids = () => useMessaggiStore.getState().messaggi.map(m => m.id)

/** La prossima richiesta resta in viaggio finché non si chiama `arriva`, e
 *  risponde con quello che il server aveva QUANDO È PARTITA. */
function richiestaLenta(): () => void {
  let sblocca: (p: PaginaMessaggi) => void = () => {}
  let risposta: PaginaMessaggi = { righe: [], totale: 0 }
  messaggiRecenti.mockImplementationOnce((quanti, da = 0) => {
    richieste.push({ quanti, da })
    risposta = fetta(quanti, da)
    return new Promise(r => { sblocca = r })
  })
  return () => sblocca(risposta)
}

beforeEach(() => {
  server = []
  richieste.length = 0
  messaggiRecenti.mockReset()
  messaggiRecenti.mockImplementation(async (quanti, da = 0) => {
    richieste.push({ quanti, da })
    return fetta(quanti, da)
  })
  segnaLetti.mockReset()
  segnaLetti.mockImplementation(async (quali, ruolo) => {
    const campo = ruolo === 'coach' ? 'letto_coach' : 'letto_atleta'
    server = server.map(m => quali.includes(m.id) ? { ...m, [campo]: true } : m)
  })
  eliminaMessaggio.mockReset()
  eliminaMessaggio.mockImplementation(async id => { server = server.filter(m => m.id !== id) })
})
// Senza, il timer del giro successivo resta armato e il test dopo eredita
// l'utente di questo.
afterEach(() => { fermaMessaggi() })

describe('il primo giro', () => {
  it('finisce anche quando il server non risponderà MAI', async () => {
    // Il guasto che questo previene, ed è successo davvero: senza la tabella
    // `coach_messaggi` sul database ogni giro fallisce, e la sezione Messaggi
    // restava su "Caricamento…" per sempre — indistinguibile, per chi guarda,
    // da una rete lenta.
    messaggiRecenti.mockRejectedValue(new Error('La funzione non è ancora attiva sul server.'))
    avviaMessaggi('u-1')
    await unGiro()

    const st = useMessaggiStore.getState()
    expect(st.primoGiroFatto).toBe(true)
    expect(st.errore).toBe('La funzione non è ancora attiva sul server.')
    expect(st.messaggi).toEqual([])
  })

  it('riuscito, porta i messaggi e nessun errore', async () => {
    server = righe(1)
    avviaMessaggi(COACH)
    await unGiro()

    const st = useMessaggiStore.getState()
    expect(st.primoGiroFatto).toBe(true)
    expect(st.errore).toBeNull()
    expect(st.messaggi).toHaveLength(1)
  })

  it('un giro riuscito cancella l’errore di quello prima', async () => {
    messaggiRecenti.mockRejectedValueOnce(new Error('rete assente'))
    avviaMessaggi(COACH)
    await unGiro()
    expect(useMessaggiStore.getState().errore).toBe('rete assente')

    ricaricaMessaggi()
    await unGiro()
    expect(useMessaggiStore.getState().errore).toBeNull()
  })

  it('legge dal più recente, a pagine, finché li ha tutti — e li tiene in ordine', async () => {
    // Il guasto che questo previene: si chiedeva tutto in una volta dal più
    // vecchio, il server tagliava a mille, e a restare fuori erano gli ultimi.
    server = righe(2300)
    avviaMessaggi(COACH)
    await unGiro()

    expect(richieste).toEqual([
      { quanti: PAGINA, da: 0 }, { quanti: PAGINA, da: PAGINA }, { quanti: PAGINA, da: 2 * PAGINA },
    ])
    const elenco = ids()
    expect(elenco).toHaveLength(2300)
    expect(elenco[0]).toBe(riga(1).id)
    expect(elenco[2299]).toBe(riga(2300).id)
  })

  it('un server che dà pagine più corte di quelle chieste non ne salta nessuna', async () => {
    server = righe(700)
    messaggiRecenti.mockImplementation(async (quanti, da = 0) => {
      richieste.push({ quanti, da })
      return fetta(Math.min(quanti, 300), da)
    })
    avviaMessaggi(COACH)
    await unGiro()

    expect(richieste.map(r => r.da)).toEqual([0, 300, 600])
    expect(ids()).toHaveLength(700)
  })

  it('oltre il tetto restano fuori i più VECCHI, non i nuovi', async () => {
    server = righe(MASSIMO + 120)
    avviaMessaggi(COACH)
    await unGiro()

    const elenco = ids()
    expect(elenco).toHaveLength(MASSIMO)
    expect(elenco[elenco.length - 1]).toBe(riga(MASSIMO + 120).id)
    expect(elenco).not.toContain(riga(1).id)
  })
})

describe('i giri dopo', () => {
  /** Trecento messaggi già letti dal server: da qui in poi i giri sono normali. */
  async function avviato(quanti = 300) {
    server = righe(quanti)
    avviaMessaggi(COACH)
    await unGiro()
    richieste.length = 0
  }

  it('chiedono solo gli ultimi, e quello che arriva si aggiunge a quello che c’era', async () => {
    await avviato()
    server.push(riga(301))
    ricaricaMessaggi()
    await unGiro()

    expect(richieste).toEqual([{ quanti: RECENTI, da: 0 }])
    const elenco = ids()
    expect(elenco).toHaveLength(301)
    expect(elenco[0]).toBe(riga(1).id)
    expect(elenco[300]).toBe(riga(301).id)
  })

  it('un messaggio cancellato dall’altro sparisce, se era fra gli ultimi', async () => {
    await avviato()
    server = server.filter(m => m.id !== riga(295).id)
    ricaricaMessaggi()
    await unGiro()

    expect(ids()).not.toContain(riga(295).id)
    expect(ids()).toHaveLength(299)
    // Senza riscaricare tutto: bastava la fetta.
    expect(richieste).toEqual([{ quanti: RECENTI, da: 0 }])
  })

  it('…e anche se era vecchio: i conti non tornano, e si rilegge tutto', async () => {
    await avviato()
    server = server.filter(m => m.id !== riga(3).id)
    ricaricaMessaggi()
    await unGiro()

    expect(ids()).not.toContain(riga(3).id)
    expect(ids()).toHaveLength(299)
    expect(richieste).toEqual([{ quanti: RECENTI, da: 0 }, { quanti: PAGINA, da: 0 }])
  })

  it('più novità di quante ne stiano in una fetta: non resta un buco in mezzo', async () => {
    // Il telefono è stato in tasca un pomeriggio e nel frattempo sono arrivati
    // ottanta messaggi: gli ultimi cinquanta da soli lascerebbero fuori i trenta
    // di mezzo, senza che niente lo dica.
    await avviato()
    for (let n = 301; n <= 380; n++) server.push(riga(n))
    ricaricaMessaggi()
    await unGiro()

    expect(ids()).toHaveLength(380)
    expect(ids()).toContain(riga(310).id)
  })

  it('una spunta di lettura messa da un altro mio dispositivo arriva', async () => {
    server = [...righe(20), riga(21, { letto_coach: false })]
    avviaMessaggi(COACH)
    await unGiro()
    expect(nonLetti(useMessaggiStore.getState().messaggi, COACH)).toHaveLength(1)

    server = server.map(m => ({ ...m, letto_coach: true }))
    ricaricaMessaggi()
    await unGiro()
    expect(nonLetti(useMessaggiStore.getState().messaggi, COACH)).toHaveLength(0)
  })
})

// Quello che faccio io arriva al server mentre un giro è già in viaggio: la sua
// risposta è una fotografia di PRIMA, e non deve rimettere le cose com'erano.
describe('la risposta di un giro partito prima', () => {
  async function avviato(extra: Messaggio[] = []) {
    server = [...righe(80), ...extra]
    avviaMessaggi(COACH)
    await unGiro()
  }
  const bozza = () => bozzaChat({ coachId: COACH, athleteId: ANNA, autore: COACH, autoreNome: 'Luca', tipo: 'chat', testo: 'arrivo' })

  it('non fa sparire il messaggio appena inviato', async () => {
    await avviato()
    const arriva = richiestaLenta()
    ricaricaMessaggi()
    await new Promise(r => setTimeout(r, 10))

    const m = await invia(bozza())
    arriva()
    await unGiro()

    expect(ids()).toContain(m.id)
    expect(ids()).toHaveLength(81)
  })

  it('non fa ricomparire quello appena cancellato', async () => {
    await avviato()
    const arriva = richiestaLenta()
    ricaricaMessaggi()
    await new Promise(r => setTimeout(r, 10))

    await elimina(riga(80).id)
    arriva()
    await unGiro()

    expect(ids()).not.toContain(riga(80).id)
  })

  it('non riaccende il pallino sulla conversazione appena letta', async () => {
    await avviato([riga(81, { letto_coach: false })])
    expect(nonLetti(useMessaggiStore.getState().messaggi, COACH)).toHaveLength(1)
    const arriva = richiestaLenta()
    ricaricaMessaggi()
    await new Promise(r => setTimeout(r, 10))

    segnaLettiOra(useMessaggiStore.getState().messaggi, COACH)
    arriva()
    await unGiro()

    expect(nonLetti(useMessaggiStore.getState().messaggi, COACH)).toHaveLength(0)
  })

  it('…ma se la spunta sul server non è andata, il pallino torna', async () => {
    // Tenerlo per letto a oltranza sarebbe il guasto opposto: spento qui,
    // acceso sull'altro telefono, e nessuno che riprovi.
    await avviato([riga(81, { letto_coach: false })])
    segnaLetti.mockRejectedValueOnce(new Error('rete assente'))
    segnaLettiOra(useMessaggiStore.getState().messaggi, COACH)
    expect(nonLetti(useMessaggiStore.getState().messaggi, COACH)).toHaveLength(0)
    await unGiro()

    ricaricaMessaggi()
    await unGiro()
    expect(nonLetti(useMessaggiStore.getState().messaggi, COACH)).toHaveLength(1)
  })

  it('un messaggio che il server rifiuta se ne va, e gli altri restano', async () => {
    await avviato()
    eliminaMessaggio.mockRejectedValueOnce(new Error('rete assente'))
    await expect(elimina(riga(80).id)).rejects.toThrow('rete assente')
    // Non è stato cancellato: torna al suo posto.
    expect(ids()).toHaveLength(80)
    expect(ids()[79]).toBe(riga(80).id)
  })
})

describe('cambio di utente', () => {
  it('uscendo si svuota tutto', async () => {
    // I messaggi sono dell'ACCOUNT, non del dispositivo: restando in memoria li
    // vedrebbe chi entra dopo.
    server = righe(1)
    avviaMessaggi('u-1')
    await unGiro()
    expect(useMessaggiStore.getState().messaggi).toHaveLength(1)

    fermaMessaggi()
    const st = useMessaggiStore.getState()
    expect(st.userId).toBeNull()
    expect(st.messaggi).toEqual([])
    expect(st.primoGiroFatto).toBe(false)
  })

  it('una risposta in ritardo non finisce nell’elenco di un altro', async () => {
    // Il guasto che questo previene: la richiesta parte per u-1, mentre è in
    // viaggio si esce e rientra come u-2, e i messaggi del primo compaiono nella
    // schermata del secondo finché il giro dopo non corregge.
    server = [riga(1, { id: 'roba-di-u1' })]
    const arriva = richiestaLenta()
    avviaMessaggi('u-1')
    await new Promise(r => setTimeout(r, 10))

    fermaMessaggi()
    avviaMessaggi('u-2')
    arriva()
    await unGiro()

    expect(useMessaggiStore.getState().messaggi).toEqual([])
  })
})

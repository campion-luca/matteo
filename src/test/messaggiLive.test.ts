import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Il giro che tiene aggiornati i messaggi. Quello che può andare storto qui è
// una schermata che aspetta una cosa che non arriverà mai.

const messaggiDiUtente = vi.fn()
vi.mock('@/lib/messaggi', async () => {
  const vero = await vi.importActual<typeof import('@/lib/messaggi')>('@/lib/messaggi')
  return { ...vero, messaggiDiUtente: () => messaggiDiUtente() }
})

const { avviaMessaggi, fermaMessaggi, useMessaggiStore } = await import('@/lib/messaggiLive')

/** Lascia passare il `setTimeout(0)` con cui parte il primo giro, più la
 *  promessa che ci sta dentro. */
const unGiro = () => new Promise(r => setTimeout(r, 30))

beforeEach(() => { messaggiDiUtente.mockReset() })
// Senza, il timer del giro successivo resta armato e il test dopo eredita
// l'utente di questo.
afterEach(() => { fermaMessaggi() })

describe('il primo giro', () => {
  it('finisce anche quando il server non risponderà MAI', async () => {
    // Il guasto che questo previene, ed è successo davvero: senza la tabella
    // `coach_messaggi` sul database ogni giro fallisce, e la sezione Messaggi
    // restava su "Caricamento…" per sempre — indistinguibile, per chi guarda,
    // da una rete lenta.
    messaggiDiUtente.mockRejectedValue(new Error('La funzione non è ancora attiva sul server.'))
    avviaMessaggi('u-1')
    await unGiro()

    const st = useMessaggiStore.getState()
    expect(st.primoGiroFatto).toBe(true)
    expect(st.errore).toBe('La funzione non è ancora attiva sul server.')
    expect(st.messaggi).toEqual([])
  })

  it('riuscito, porta i messaggi e nessun errore', async () => {
    messaggiDiUtente.mockResolvedValue([{ id: 'ms1' }])
    avviaMessaggi('u-1')
    await unGiro()

    const st = useMessaggiStore.getState()
    expect(st.primoGiroFatto).toBe(true)
    expect(st.errore).toBeNull()
    expect(st.messaggi).toHaveLength(1)
  })

  it('un giro riuscito cancella l’errore di quello prima', async () => {
    messaggiDiUtente.mockRejectedValueOnce(new Error('rete assente'))
    avviaMessaggi('u-1')
    await unGiro()
    expect(useMessaggiStore.getState().errore).toBe('rete assente')

    // Il secondo giro parte da solo dopo il ritmo di fondo; qui lo si forza
    // ripartendo, che è la stessa strada del ritorno sull'app.
    messaggiDiUtente.mockResolvedValue([])
    fermaMessaggi()
    avviaMessaggi('u-1')
    await unGiro()
    expect(useMessaggiStore.getState().errore).toBeNull()
  })
})

describe('cambio di utente', () => {
  it('uscendo si svuota tutto', async () => {
    // I messaggi sono dell'ACCOUNT, non del dispositivo: restando in memoria li
    // vedrebbe chi entra dopo.
    messaggiDiUtente.mockResolvedValue([{ id: 'ms1' }])
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
    let sblocca: (v: unknown) => void = () => {}
    messaggiDiUtente.mockReturnValue(new Promise(r => { sblocca = r }))
    avviaMessaggi('u-1')
    await new Promise(r => setTimeout(r, 10))

    fermaMessaggi()
    avviaMessaggi('u-2')
    sblocca([{ id: 'roba-di-u1' }])
    await unGiro()

    expect(useMessaggiStore.getState().messaggi).toEqual([])
  })
})

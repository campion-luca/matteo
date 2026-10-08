import { describe, it, expect, beforeEach } from 'vitest'
import { leggiSessione, salvaSessione, scartaSessione, sessioneAperta, allenamentoInCorso, inizioSessione, orologioSessione, segnaAvvio, copreAltra, type SerieInCorso } from '@/features/gym/sessioneInCorso'
import type { GymScheda } from '@/store/useJarvisStore'

// La sessione a metà è l'unico dato dell'app che non sta né nello store né in
// cloud: vive in localStorage finché l'allenamento non finisce. Quello che si
// verifica qui è che venga ripresa SOLO quando ha ancora senso riprenderla —
// ripresentare le spunte sbagliate significherebbe registrare un allenamento
// che non è stato fatto, che è peggio di perderlo.

const scheda = (esercizi: Array<{ id: string; sets: number }>): GymScheda => ({
  id: 'sc1',
  title: 'Push A',
  createdAt: '2026-09-01',
  updatedAt: '2026-09-01',
  exercises: esercizi.map(e => ({ id: e.id, name: 'Es ' + e.id, sets: e.sets, reps: '8' })),
})

const serie = (n: number, fatte = 0): SerieInCorso => ({
  checks: Array.from({ length: n }, (_, i) => i < fatte),
  weights: Array(n).fill('60'),
  reps: Array(n).fill('8'),
})

const PUSH = scheda([{ id: 'e1', sets: 4 }, { id: 'e2', sets: 3 }])
const mezzaSessione = { e1: serie(4, 2), e2: serie(3) }

beforeEach(() => localStorage.clear())

describe('sessione di allenamento in corso', () => {
  it('senza niente salvato non riprende nulla', () => {
    expect(leggiSessione(PUSH)).toBeNull()
  })

  it('riprende quello che era stato spuntato', () => {
    salvaSessione(PUSH.id, mezzaSessione)
    expect(leggiSessione(PUSH)).toEqual(mezzaSessione)
  })

  it('non riprende la sessione di un’ALTRA scheda', () => {
    salvaSessione('sc-altra', mezzaSessione)
    expect(leggiSessione(PUSH)).toBeNull()
  })

  it('a fine allenamento la butta: i dati ora stanno nello storico', () => {
    salvaSessione(PUSH.id, mezzaSessione)
    scartaSessione()
    expect(leggiSessione(PUSH)).toBeNull()
  })

  // ── Rimasta aperta ────────────────────────────────────────────
  // Dopo dodici ore non spariva solo "dove ero rimasto": spariva l'allenamento.
  // Adesso resta, segnata come vecchia, e la si butta solo dopo una settimana.
  it('dopo dodici ore c’è ancora, ma è un allenamento rimasto aperto', () => {
    const ieri = Date.now() - 13 * 60 * 60 * 1000
    salvaSessione(PUSH.id, mezzaSessione, ieri)
    expect(leggiSessione(PUSH)).toEqual(mezzaSessione)
    expect(sessioneAperta()).toMatchObject({ schedaId: 'sc1', vecchia: true })
  })

  it('entro le dodici ore è in corso', () => {
    const prima = Date.now() - 2 * 60 * 60 * 1000
    salvaSessione(PUSH.id, mezzaSessione, prima)
    expect(leggiSessione(PUSH)).toEqual(mezzaSessione)
    expect(sessioneAperta()).toMatchObject({ vecchia: false })
  })

  it('dopo una settimana si butta davvero', () => {
    salvaSessione(PUSH.id, mezzaSessione, Date.now() - 8 * 24 * 60 * 60 * 1000)
    expect(leggiSessione(PUSH)).toBeNull()
    expect(sessioneAperta()).toBeNull()
  })

  // ── Quando è cominciata ───────────────────────────────────────
  it('l’inizio è la prima spunta, e i salvataggi dopo non lo spostano', () => {
    const t0 = Date.now() - 40 * 60 * 1000
    // Aperta e non toccata: non è ancora cominciata.
    salvaSessione(PUSH.id, { e1: serie(4), e2: serie(3) }, t0 - 60_000)
    expect(inizioSessione(PUSH.id)).toBeNull()
    salvaSessione(PUSH.id, { e1: serie(4, 1), e2: serie(3) }, t0)
    salvaSessione(PUSH.id, mezzaSessione, t0 + 10 * 60 * 1000)
    expect(inizioSessione(PUSH.id)).toBe(t0)
    expect(sessioneAperta()).toMatchObject({ iniziataA: t0 })
    expect(inizioSessione('sc-altra')).toBeNull()
  })

  // ── Se la scheda cambia, si tiene quello che ha ancora un posto ──
  // Prima bastava una serie in più — magari aggiunta dall'allenatore a metà
  // allenamento — perché tutte le spunte venissero buttate.
  it('se un esercizio è stato tolto, restano le spunte degli altri', () => {
    salvaSessione(PUSH.id, mezzaSessione)
    expect(leggiSessione(scheda([{ id: 'e1', sets: 4 }]))).toEqual({ e1: mezzaSessione.e1 })
  })

  it('se un esercizio è stato aggiunto, non compare: parte da zero chi chiama', () => {
    salvaSessione(PUSH.id, mezzaSessione)
    expect(leggiSessione(scheda([{ id: 'e1', sets: 4 }, { id: 'e2', sets: 3 }, { id: 'e3', sets: 3 }]))).toEqual(mezzaSessione)
  })

  it('se le serie aumentano, quelle nuove nascono non spuntate col peso dell’ultima', () => {
    salvaSessione(PUSH.id, mezzaSessione)
    const r = leggiSessione(scheda([{ id: 'e1', sets: 5 }, { id: 'e2', sets: 3 }]))!
    expect(r.e1.checks).toEqual([true, true, false, false, false])
    expect(r.e1.weights).toEqual(['60', '60', '60', '60', '60'])
    expect(r.e1.reps).toHaveLength(5)
  })

  it('se le serie diminuiscono, quelle in più si tagliano', () => {
    salvaSessione(PUSH.id, mezzaSessione)
    const r = leggiSessione(scheda([{ id: 'e1', sets: 1 }, { id: 'e2', sets: 3 }]))!
    expect(r.e1.checks).toEqual([true])
    expect(r.e1.weights).toEqual(['60'])
  })

  it('un esercizio sostituito con un altro perde le sue spunte, gli altri no', () => {
    salvaSessione(PUSH.id, mezzaSessione)
    expect(leggiSessione(scheda([{ id: 'e1', sets: 4 }, { id: 'e9', sets: 3 }]))).toEqual({ e1: mezzaSessione.e1 })
  })

  it('sopravvive a un contenuto illeggibile', () => {
    localStorage.setItem('jarvis-sessione-in-corso-v1', '{non json')
    expect(leggiSessione(PUSH)).toBeNull()
  })

  it('non esplode se lo storage è negato', () => {
    const vero = Storage.prototype.setItem
    Storage.prototype.setItem = () => { throw new DOMException('QuotaExceededError') }
    expect(() => salvaSessione(PUSH.id, mezzaSessione)).not.toThrow()
    Storage.prototype.setItem = vero
  })

  // ── Riprendere da fuori ───────────────────────────────────────
  it('dice quale scheda ha un allenamento aperto, e a che punto è', () => {
    salvaSessione(PUSH.id, mezzaSessione)
    expect(sessioneAperta()).toMatchObject({ schedaId: 'sc1', fatte: 2, totali: 7, vecchia: false, vuota: false })
  })

  // ── Avviato vuol dire aperto ──────────────────────────────────
  // Prima un allenamento senza una spunta non contava: uscendo dalla pagina
  // non si capiva se fosse rimasto acceso. Adesso resta aperto finché non lo si
  // termina — ma si ricorda che dentro non c'è niente da perdere.
  it('avviato e mai toccato è aperto lo stesso, e si sa che è vuoto', () => {
    salvaSessione(PUSH.id, { e1: serie(4), e2: serie(3) })
    expect(sessioneAperta()).toMatchObject({ schedaId: 'sc1', fatte: 0, totali: 7, vecchia: false, vuota: true })
  })

  it('una nota scritta è già lavoro: non è vuoto', () => {
    salvaSessione(PUSH.id, { e1: { ...serie(4), note: 'spalla' }, e2: serie(3) })
    expect(sessioneAperta()).toMatchObject({ fatte: 0, vuota: false })
  })

  it('vuoto e fermo da più di dodici ore sparisce da sé, senza diventare "non chiuso"', () => {
    salvaSessione(PUSH.id, { e1: serie(4), e2: serie(3) }, Date.now() - 11 * 60 * 60 * 1000)
    expect(sessioneAperta()).toMatchObject({ vuota: true, vecchia: false })
    salvaSessione(PUSH.id, { e1: serie(4), e2: serie(3) }, Date.now() - 13 * 60 * 60 * 1000)
    expect(sessioneAperta()).toBeNull()
  })

  // ── Con la scheda accanto: quello che si annuncia in home e nell'elenco ──
  it('l’allenamento in corso porta la sua scheda e i conti di adesso', () => {
    salvaSessione(PUSH.id, mezzaSessione)
    // La scheda nel frattempo ha una serie in più sul primo esercizio.
    const cresciuta = scheda([{ id: 'e1', sets: 5 }, { id: 'e2', sets: 3 }])
    expect(allenamentoInCorso(id => (id === 'sc1' ? cresciuta : undefined))).toMatchObject({ scheda: cresciuta, fatte: 2, totali: 8, vecchia: false })
  })

  it('solo avviato: è in corso, a zero serie', () => {
    salvaSessione(PUSH.id, { e1: serie(4), e2: serie(3) })
    expect(allenamentoInCorso(() => PUSH)).toMatchObject({ scheda: PUSH, fatte: 0, totali: 7 })
  })

  it('se la scheda non esiste più non c’è niente da riprendere', () => {
    salvaSessione(PUSH.id, mezzaSessione)
    expect(allenamentoInCorso(() => undefined)).toBeUndefined()
  })

  it('né se gli esercizi spuntati sono stati tutti sostituiti', () => {
    salvaSessione(PUSH.id, mezzaSessione)
    expect(allenamentoInCorso(() => scheda([{ id: 'e8', sets: 4 }, { id: 'e9', sets: 3 }]))).toBeUndefined()
  })

  it('aprire un’altra scheda solo per guardarla non cancella quella cominciata', () => {
    salvaSessione(PUSH.id, mezzaSessione)
    expect(copreAltra('sc-altra', { x: serie(3) })).toBe(true)
    // Appena lì si spunta qualcosa, l'allenamento vero diventa quello.
    expect(copreAltra('sc-altra', { x: serie(3, 1) })).toBe(false)
    expect(copreAltra(PUSH.id, { e1: serie(4), e2: serie(3) })).toBe(false)
  })

  // ── L'orologio della durata ───────────────────────────────────
  it('la durata corre da quando si entra per cominciare, non dalla prima spunta', () => {
    const t0 = Date.now() - 60 * 60 * 1000
    segnaAvvio(PUSH.id, t0)
    salvaSessione(PUSH.id, { e1: serie(4), e2: serie(3) }, t0 + 1000)
    // Chi spunta tutto alla fine: la prima spunta arriva dopo cinquanta minuti.
    salvaSessione(PUSH.id, mezzaSessione, t0 + 50 * 60 * 1000)
    expect(orologioSessione(PUSH.id)).toBe(t0)
    expect(inizioSessione(PUSH.id)).toBe(t0 + 50 * 60 * 1000)
  })

  it('finché non si spunta niente, rientrare fa ripartire l’orologio', () => {
    const mattina = Date.now() - 8 * 60 * 60 * 1000
    segnaAvvio(PUSH.id, mattina)
    salvaSessione(PUSH.id, { e1: serie(4), e2: serie(3) }, mattina)
    const sera = Date.now() - 60 * 1000
    segnaAvvio(PUSH.id, sera)
    expect(orologioSessione(PUSH.id)).toBe(sera)
  })

  it('con delle serie già spuntate, rientrare non sposta l’orologio', () => {
    const t0 = Date.now() - 30 * 60 * 1000
    segnaAvvio(PUSH.id, t0)
    salvaSessione(PUSH.id, mezzaSessione, t0 + 60_000)
    segnaAvvio(PUSH.id, Date.now())
    expect(orologioSessione(PUSH.id)).toBe(t0)
    expect(leggiSessione(PUSH)).toEqual(mezzaSessione)
  })

  it('entrare in una scheda non cancella l’allenamento cominciato su un’altra', () => {
    salvaSessione('sc-altra', mezzaSessione)
    segnaAvvio(PUSH.id)
    expect(sessioneAperta()).toMatchObject({ schedaId: 'sc-altra' })
  })

  // ── Rimasta aperta: conta quando è COMINCIATA ─────────────────
  it('riaprirla non la fa tornare "in corso"', () => {
    const venerdi = Date.now() - 5 * 24 * 60 * 60 * 1000
    salvaSessione(PUSH.id, mezzaSessione, venerdi)
    // Oggi la pagina si riapre e risalva.
    salvaSessione(PUSH.id, mezzaSessione)
    expect(sessioneAperta()).toMatchObject({ vecchia: true, iniziataA: venerdi })
    expect(inizioSessione(PUSH.id)).toBe(venerdi)
  })

  // ── Una sessione salvata dalla versione di prima ──────────────
  it('senza un inizio scritto si prende l’ultima volta che è stata toccata, e la durata non si misura', () => {
    const ieri = Date.now() - 20 * 60 * 60 * 1000
    localStorage.setItem('jarvis-sessione-in-corso-v1', JSON.stringify({ schedaId: PUSH.id, salvataA: ieri, progress: mezzaSessione }))
    salvaSessione(PUSH.id, mezzaSessione)
    expect(inizioSessione(PUSH.id)).toBe(ieri)
    expect(orologioSessione(PUSH.id)).toBeNull()
  })
})


import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { leggiProfili, useProfiliStore, nomeCompleto, etaDi, focusDi, haDettagli, type Profilo } from '@/lib/profili'
import { SchedaProfilo } from '@/features/coach/ProfiloUtente'

// Il profilo: nome e cognome, la faccia, e quello che uno racconta di sé. Quello
// che deve reggere: le foto si scaricano solo quando cambiano (chi segue trenta
// persone non se ne riprende trenta a ogni apertura), chi non si vede più se ne
// va anche dal telefono, e un profilo vuoto non disegna sezioni vuote.

const ANNA = 'u-anna', BRUNO = 'u-bruno'
const FOTO = 'data:image/webp;base64,AAAA'

const riga = (o: Partial<Profilo> & Pick<Profilo, 'user_id'>): Omit<Profilo, 'foto'> => ({
  nome: null, cognome: null, foto_agg: null, nascita: null, eta: null, dettagli: {}, updated_at: '2026-10-01T10:00:00Z', ...o,
})

/** Un server finto: risponde alle letture di `profili`, e si ricorda cosa gli
 *  è stato chiesto. */
function server(righe: Array<Omit<Profilo, 'foto'> & { foto?: string | null }>) {
  const chiamate: string[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
    const u = new URL(String(url))
    chiamate.push(decodeURIComponent(u.search))
    const select = u.searchParams.get('select') ?? ''
    const chi = (u.searchParams.get('user_id') ?? '').replace(/^in\.\(|\)$/g, '').split(',').map(s => s.replace(/"/g, ''))
    const trovate = righe.filter(r => chi.includes(r.user_id))
    const corpo = select.includes('foto,') || select.endsWith('foto')
      ? trovate.map(r => ({ user_id: r.user_id, foto: r.foto ?? null }))
      : trovate.map(r => { const c = { ...r }; delete c.foto; return c })
    return new Response(JSON.stringify(corpo), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  return chiamate
}

describe('i profili dal server', () => {
  beforeEach(() => useProfiliStore.setState({ owner: null, profili: {} }))
  afterEach(() => vi.restoreAllMocks())

  it('la prima volta scarica la foto, la seconda no se non è cambiata', async () => {
    const chiamate = server([{ ...riga({ user_id: ANNA, nome: 'Anna', foto_agg: '2026-10-01T10:00:00Z' }), foto: FOTO }])
    const primo = await leggiProfili([ANNA])
    expect(primo[ANNA].foto).toBe(FOTO)
    expect(chiamate).toHaveLength(2)

    const secondo = await leggiProfili([ANNA])
    // La foto è quella che il telefono aveva già: una richiesta sola, senza foto.
    expect(secondo[ANNA].foto).toBe(FOTO)
    expect(chiamate).toHaveLength(3)
    expect(chiamate[2]).not.toMatch(/select=user_id,foto(&|$)/)
  })

  it('la foto cambiata si riscarica, quella tolta sparisce', async () => {
    useProfiliStore.setState({ owner: null, profili: {
      [ANNA]: { ...riga({ user_id: ANNA, foto_agg: '2026-10-01T10:00:00Z' }), foto: 'data:image/webp;base64,VECCHIA' },
      [BRUNO]: { ...riga({ user_id: BRUNO, foto_agg: '2026-10-01T10:00:00Z' }), foto: FOTO },
    } })
    server([
      { ...riga({ user_id: ANNA, foto_agg: '2026-10-05T10:00:00Z' }), foto: FOTO },
      riga({ user_id: BRUNO, foto_agg: null }),
    ])
    const p = await leggiProfili([ANNA, BRUNO])
    expect(p[ANNA].foto).toBe(FOTO)
    expect(p[BRUNO].foto).toBeNull()
  })

  it('chi non torna più dal server se ne va anche dal telefono', async () => {
    useProfiliStore.setState({ owner: null, profili: { [BRUNO]: { ...riga({ user_id: BRUNO, nome: 'Bruno' }), foto: FOTO } } })
    server([riga({ user_id: ANNA, nome: 'Anna' })])
    await leggiProfili([ANNA, BRUNO])
    // Collegamento sciolto: la sua faccia non resta nel mio elenco.
    expect(useProfiliStore.getState().profili[BRUNO]).toBeUndefined()
    expect(useProfiliStore.getState().profili[ANNA]?.nome).toBe('Anna')
  })
})

describe('come si legge un profilo', () => {
  it('nome e cognome, o il nome del collegamento se mancano', () => {
    expect(nomeCompleto({ nome: 'Mario', cognome: 'Rossi' }, 'Marietto')).toBe('Mario Rossi')
    expect(nomeCompleto({ nome: ' ', cognome: null }, 'Marietto')).toBe('Marietto')
    expect(nomeCompleto(undefined, 'Marietto')).toBe('Marietto')
  })

  it('l’età dalla data di nascita, col compleanno che deve ancora venire', () => {
    const oggi = new Date(2026, 9, 21)
    expect(etaDi({ nascita: '1995-10-22', eta: null }, oggi)).toBe(30)
    expect(etaDi({ nascita: '1995-10-21', eta: null }, oggi)).toBe(31)
    // Senza data, il numero scritto.
    expect(etaDi({ nascita: null, eta: 40 }, oggi)).toBe(40)
    expect(etaDi({ nascita: null, eta: null }, oggi)).toBeNull()
  })

  it('i focus uno per uno, e il curriculum conta solo per chi allena', () => {
    expect(focusDi({ focus: 'ipertrofia, forza;  Hyrox ,' })).toEqual(['ipertrofia', 'forza', 'Hyrox'])
    expect(haDettagli({ curriculum: 'ISSA' })).toBe(false)
    expect(haDettagli({ pt: true, curriculum: 'ISSA' })).toBe(true)
  })
})

describe('il profilo a schermo', () => {
  afterEach(cleanup)

  it('mostra solo le sezioni compilate', () => {
    render(<SchedaProfilo nomeRiserva="Anna" profilo={{
      ...riga({ user_id: ANNA, nome: 'Anna', cognome: 'Bianchi', dettagli: { obiettivi: 'La prima trazione', focus: 'forza' } }), foto: null,
    }}/>)
    expect(screen.getByText('Anna Bianchi')).toBeInTheDocument()
    expect(screen.getByText('La prima trazione')).toBeInTheDocument()
    expect(screen.getByText('forza')).toBeInTheDocument()
    expect(screen.queryByText('Infortuni e limitazioni')).not.toBeInTheDocument()
    // Non è un personal trainer: niente curriculum né etichetta.
    expect(screen.queryByText('Personal trainer')).not.toBeInTheDocument()
  })

  it('vuoto lo dice, con il nome che si ha', () => {
    render(<SchedaProfilo nomeRiserva="Marco" profilo={undefined}/>)
    expect(screen.getByText('Marco non ha ancora compilato il profilo.')).toBeInTheDocument()
  })
})

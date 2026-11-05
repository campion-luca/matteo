import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'
import {
  conMemoria, genereDi, SCRIPT_MEMORIA, segnaMemoria, leggiMemoria, inviaMemoria, memoriaInSospeso,
  DIARIO_MAX_BYTE, type DiarioFile,
} from '@/lib/diario'

// Il diario personale (5 nov 2026): i propri file sotto la foto del profilo.
// Una pagina HTML si apre in un riquadro isolato e quello che si salva nel suo
// localStorage arriva all'app, che lo scrive sul server.

vi.mock('@/lib/supabase', async importOriginal => ({
  ...(await importOriginal<object>()),
  idUtenteSuDisco: () => IO,
}))

const IO = 'u-io'
const { DiarioPersonale, VisoreDiario } = await import('@/features/profile/DiarioPersonale')
const { JarvisProfile } = await import('@/features/profile/JarvisProfile')

const GESTIONALE = `<!doctype html>
<html lang="it">
<head><meta charset="utf-8"><title>Gestionale di Luca</title></head>
<body><script>let S; try { S = JSON.parse(localStorage.getItem('gestionale-luca-v1')) } catch (e) {}</script></body>
</html>`

const voce = (x: Partial<DiarioFile> = {}): DiarioFile => ({
  id: 'f1', nome: 'Gestionale di Luca.html', tipo: 'text/html', dimensione: 27_800,
  percorso: `${IO}/dabc`, created_at: '2026-11-05T09:00:00Z', updated_at: '2026-11-05T09:00:00Z', ...x,
})

let righe: Array<DiarioFile & { memoria?: unknown }> = []
let oggetti: Record<string, string> = {}
let chiamate: Array<{ metodo: string; url: string; init?: RequestInit }> = []

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })

function server() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = decodeURIComponent(String(input))
    const metodo = init?.method ?? 'GET'
    chiamate.push({ metodo, url, init })
    const st = url.match(/\/storage\/v1\/object\/diario\/?(.*)$/)
    if (st) {
      if (metodo === 'POST') { oggetti[st[1]] = 'caricato'; return json({ Key: `diario/${st[1]}` }) }
      if (metodo === 'DELETE') {
        for (const p of JSON.parse(String(init?.body)).prefixes as string[]) delete oggetti[p]
        return json([])
      }
      const contenuto = oggetti[st[1]]
      return contenuto === undefined ? json({ message: 'Object not found' }, 404) : new Response(contenuto, { status: 200, headers: { 'Content-Type': 'text/html' } })
    }
    if (url.includes('/rest/v1/diario_file')) {
      const corpo = init?.body ? JSON.parse(String(init.body)) : undefined
      const id = url.match(/id=eq\.([^&]+)/)?.[1]
      if (metodo === 'POST') {
        const riga = { id: 'f-nuovo', created_at: '2026-11-05T10:00:00Z', updated_at: '2026-11-05T10:00:00Z', ...corpo }
        righe.unshift(riga)
        return json([riga], 201)
      }
      if (metodo === 'PATCH') {
        righe = righe.map(r => (r.id === id ? { ...r, ...corpo } : r))
        return url.includes('select=') ? json(righe.filter(r => r.id === id)) : new Response(null, { status: 204 })
      }
      if (metodo === 'DELETE') { righe = righe.filter(r => r.id !== id); return new Response(null, { status: 204 }) }
      if (url.includes('select=memoria')) return json(righe.filter(r => r.id === id).map(r => ({ memoria: r.memoria ?? null })))
      return json(righe)
    }
    return json([])
  })
}

beforeEach(() => {
  localStorage.clear()
  righe = []
  oggetti = {}
  chiamate = []
  server()
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('che cosa si apre e come', () => {
  it('dal tipo, o dall’estensione quando il telefono non lo sa', () => {
    expect(genereDi({ nome: 'dieta.html', tipo: '' })).toBe('html')
    expect(genereDi({ nome: 'x', tipo: 'text/html' })).toBe('html')
    expect(genereDi({ nome: 'foto.heic', tipo: 'image/heic' })).toBe('immagine')
    expect(genereDi({ nome: 'esami.PDF', tipo: '' })).toBe('pdf')
    expect(genereDi({ nome: 'note.md', tipo: '' })).toBe('testo')
    expect(genereDi({ nome: 'tabella.xlsx', tipo: 'application/vnd.ms-excel' })).toBe('altro')
  })
})

describe('la pagina con la sua memoria', () => {
  it('lo script entra subito dopo <head>, dopo il doctype e prima di ogni script della pagina', () => {
    const out = conMemoria(GESTIONALE, { id: 'f1', memoria: {}, scuro: false })
    expect(out.startsWith('<!doctype html>')).toBe(true)
    const memoria = out.indexOf(SCRIPT_MEMORIA)
    expect(memoria).toBeGreaterThan(out.indexOf('<head>'))
    expect(memoria).toBeLessThan(out.indexOf('JSON.parse(localStorage'))
  })

  it('senza <head> dopo <html>, senza niente dopo il doctype; mai prima del doctype', () => {
    expect(conMemoria('<html><body>x</body></html>', { id: 'f', memoria: {}, scuro: false }).indexOf('<script>')).toBe('<html>'.length)
    expect(conMemoria('<!DOCTYPE html><p>x</p>', { id: 'f', memoria: {}, scuro: false }).indexOf('<script>')).toBe('<!DOCTYPE html>'.length)
    expect(conMemoria('<p>x</p>', { id: 'f', memoria: {}, scuro: false }).startsWith('<script>')).toBe(true)
    // `<header>` non è `<head>`.
    expect(conMemoria('<header>a</header>', { id: 'f', memoria: {}, scuro: false }).startsWith('<script>')).toBe(true)
  })

  it('un «</script>» dentro la memoria non chiude lo script', () => {
    const out = conMemoria('<head></head>', { id: 'f', memoria: { nota: '</script><b>x</b>' }, scuro: true })
    expect(out.match(/<\/script>/g)).toHaveLength(1)
  })

  it('il localStorage finto ridà quello salvato e manda ogni modifica all’app', () => {
    const win: Record<string, unknown> = {}
    const arrivati: unknown[] = []
    const setAttribute = vi.fn()
    // Lo script come gira nella pagina, con finestra, genitore e documento finti.
    new Function('window', 'parent', 'document', `${SCRIPT_MEMORIA}(${JSON.stringify({ id: 'f1', dati: { a: '1' }, tema: 'dark' })})`)(
      win, { postMessage: (m: unknown) => arrivati.push(m) }, { documentElement: { setAttribute } },
    )
    const ls = win.localStorage as Storage
    expect(ls.getItem('a')).toBe('1')
    expect(ls.getItem('manca')).toBeNull()
    ls.setItem('b', '2')
    expect(arrivati[arrivati.length - 1]).toEqual({ diario: 'f1', memoria: { a: '1', b: '2' } })
    expect(ls.length).toBe(2)
    ls.removeItem('a')
    expect(arrivati[arrivati.length - 1]).toEqual({ diario: 'f1', memoria: { b: '2' } })
    // sessionStorage c'è, ma non si ricorda: non manda niente.
    const prima = arrivati.length
    ;(win.sessionStorage as Storage).setItem('x', 'y')
    expect((win.sessionStorage as Storage).getItem('x')).toBe('y')
    expect(arrivati).toHaveLength(prima)
    expect(setAttribute).toHaveBeenCalledWith('data-theme', 'dark')
  })
})

describe('la memoria in sospeso', () => {
  it('si segna sul telefono e vince su quella del server finché non arriva', async () => {
    righe = [{ ...voce(), memoria: { k: 'server' } }]
    segnaMemoria('f1', { k: 'telefono' })
    expect(await leggiMemoria('f1')).toEqual({ k: 'telefono' })
    await inviaMemoria('f1')
    expect(righe[0].memoria).toEqual({ k: 'telefono' })
    expect(memoriaInSospeso('f1')).toBe(false)
    expect(await leggiMemoria('f1')).toEqual({ k: 'telefono' })
  })
})

describe('l’elenco del diario', () => {
  const monta = (onApri = vi.fn()) => render(
    <ConfirmDeleteProvider><DiarioPersonale userId={IO} onApri={onApri}/><ConfirmModal/></ConfirmDeleteProvider>,
  )

  it('vuoto dice cosa ci si mette', async () => {
    monta()
    expect(await screen.findByText(/Ancora nessun file/)).toBeInTheDocument()
  })

  it('mostra i file con come si aprono, quanto pesano e da quando ci sono', async () => {
    righe = [voce()]
    const onApri = vi.fn()
    const user = userEvent.setup()
    monta(onApri)
    expect(await screen.findByText('Gestionale di Luca.html')).toBeInTheDocument()
    expect(screen.getByText('Si apre e si usa qui · 27 kB · 05/11/26')).toBeInTheDocument()
    await user.click(screen.getByText('Gestionale di Luca.html'))
    expect(onApri).toHaveBeenCalledWith(expect.objectContaining({ id: 'f1' }))
  })

  it('aggiungere un file lo manda allo Storage nella propria cartella, poi scrive la voce', async () => {
    const user = userEvent.setup()
    monta()
    await screen.findByText(/Ancora nessun file/)
    await user.upload(screen.getByLabelText('Scegli un file per il diario'), new File([GESTIONALE], 'Gestionale di Luca.html', { type: 'text/html' }))
    expect(await screen.findByText('Gestionale di Luca.html')).toBeInTheDocument()

    const su = chiamate.find(c => c.metodo === 'POST' && c.url.includes('/storage/v1/object/diario/'))!
    expect(su.url).toMatch(new RegExp(`/object/diario/${IO}/d[a-z0-9]+$`))
    expect(new Headers(su.init?.headers).get('x-upsert')).toBe('false')
    const voceScritta = JSON.parse(String(chiamate.find(c => c.metodo === 'POST' && c.url.includes('/rest/v1/diario_file'))!.init?.body))
    expect(voceScritta).toMatchObject({ user_id: IO, nome: 'Gestionale di Luca.html', tipo: 'text/html' })
    expect(voceScritta.percorso.startsWith(`${IO}/`)).toBe(true)
  })

  it('un file oltre i 10 MB si ferma prima di partire', async () => {
    const user = userEvent.setup()
    monta()
    await screen.findByText(/Ancora nessun file/)
    await user.upload(screen.getByLabelText('Scegli un file per il diario'), new File([new Uint8Array(DIARIO_MAX_BYTE + 1)], 'video.mov', { type: 'video/quicktime' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Il file è troppo grande: al massimo 10 MB.')
    expect(chiamate.some(c => c.url.includes('/storage/'))).toBe(false)
  })

  it('togliere chiede, poi toglie il file e la voce', async () => {
    righe = [voce()]
    oggetti[voce().percorso] = GESTIONALE
    const user = userEvent.setup()
    monta()
    await user.click(await screen.findByRole('button', { name: 'Togli Gestionale di Luca.html dal diario' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Togli' }))
    await waitFor(() => expect(righe).toEqual([]))
    expect(oggetti).toEqual({})
    expect(await screen.findByText(/Ancora nessun file/)).toBeInTheDocument()
  })
})

describe('il visore', () => {
  it('apre la pagina isolata, con la memoria salvata, e scrive le modifiche che arrivano da lei', async () => {
    righe = [{ ...voce(), memoria: { 'gestionale-luca-v1': '{"v":1}' } }]
    oggetti[voce().percorso] = GESTIONALE
    render(<VisoreDiario voce={voce()}/>)
    const riquadro = await screen.findByTitle('Gestionale di Luca.html') as HTMLIFrameElement
    // Isolata: script sì, l'origine dell'app no.
    expect(riquadro.getAttribute('sandbox')).toContain('allow-scripts')
    expect(riquadro.getAttribute('sandbox')).not.toContain('allow-same-origin')
    const doc = riquadro.getAttribute('srcdoc')!
    expect(doc).toContain('<title>Gestionale di Luca</title>')
    expect(doc).toContain('"gestionale-luca-v1":"{\\"v\\":1}"')

    // Un messaggio da un'altra finestra non conta.
    act(() => { window.dispatchEvent(new MessageEvent('message', { data: { diario: 'f1', memoria: { x: 'intruso' } }, source: window })) })
    expect(memoriaInSospeso('f1')).toBe(false)

    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: { diario: 'f1', memoria: { 'gestionale-luca-v1': '{"v":2}' } }, source: riquadro.contentWindow }))
    })
    expect(memoriaInSospeso('f1')).toBe(true)
    await waitFor(() => expect(righe[0].memoria).toEqual({ 'gestionale-luca-v1': '{"v":2}' }), { timeout: 2000 })
    expect(memoriaInSospeso('f1')).toBe(false)
  })

  it('un file che non c’è più lo dice', async () => {
    render(<VisoreDiario voce={voce()}/>)
    expect(await screen.findByRole('alert')).toHaveTextContent('Il file non c’è più sul server.')
  })
})

describe('nel profilo', () => {
  it('sotto la foto una riga apre il diario; un file si apre sopra il diario, e la freccia torna un passo alla volta', async () => {
    righe = [voce()]
    oggetti[voce().percorso] = GESTIONALE
    const user = userEvent.setup()
    render(<ConfirmDeleteProvider><JarvisProfile open onClose={vi.fn()} sezione="utente"/></ConfirmDeleteProvider>)
    const riga = screen.getByRole('button', { name: /Il mio diario personale/ })
    const nome = screen.getByLabelText('Nome utente')
    const dati = screen.getByText('Dati generali')
    // Nell'ordine: il nome (col riquadro della foto), la riga del diario, i dati generali.
    expect(nome.compareDocumentPosition(riga) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(riga.compareDocumentPosition(dati) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // L'elenco dei file non sta nel profilo: si legge solo aprendo il diario.
    expect(screen.queryByText('Gestionale di Luca.html')).not.toBeInTheDocument()
    expect(chiamate.some(c => c.url.includes('/rest/v1/diario_file'))).toBe(false)

    await user.click(riga)
    expect(screen.getByText('Diario personale')).toBeInTheDocument()
    expect(screen.queryByText('Dati generali')).not.toBeInTheDocument()
    await user.click(await screen.findByText('Gestionale di Luca.html'))
    expect(await screen.findByTitle('Gestionale di Luca.html')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sostituisci il file' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Torna al diario' }))
    expect(await screen.findByText('Gestionale di Luca.html')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Aggiungi/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Torna al profilo' }))
    expect(await screen.findByText('Dati generali')).toBeInTheDocument()
  })
})

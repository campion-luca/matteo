// Il diario personale: i propri file, visibili solo a sé. Si apre dalla riga
// «Il mio diario personale» sotto la foto del Profilo. Una pagina HTML si apre e si USA qui dentro — un gestionale della
// dieta, un foglio di calcolo fatto a mano — e quello che ci si scrive resta;
// foto, PDF e testi si guardano; il resto si scarica.
//
// Tre pezzi: l'elenco (la pagina del diario), il visore (a tutta pagina) e i due tasti del visore in testata (scarica e sostituisci). Il
// come — Storage, memoria, isolamento — sta in lib/diario.ts.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { NucEyebrow } from '@/components/ui/NucComponents'
import { Icons } from '@/components/ui/Icons'
import { useT } from '@/lib/i18n'
import { useTema } from '@/lib/tema'
import { fmtShortDate } from '@/lib/dateFormat'
import { useConfirmDelete } from '@/hooks/useConfirmDelete'
import {
  elencoDiario, caricaNelDiario, sostituisciFile, eliminaDalDiario, scaricaDalDiario,
  leggiMemoria, segnaMemoria, inviaMemoria, memoriaInSospeso, conMemoria, genereDi, eMemoria, pesoMemoria,
  pesoLeggibile, MEMORIA_MAX_BYTE, type DiarioFile, type Genere, type Memoria,
} from '@/lib/diario'

const CARD: CSSProperties = { background: 'var(--surface)', border: 'var(--bordo)' }
const messaggio = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** La sigla sul quadratino della voce: l'estensione, o il genere. */
function sigla(v: DiarioFile, g: Genere): string {
  const est = v.nome.toLowerCase().match(/\.([a-z0-9]{1,4})$/)?.[1]
  if (est) return est.toUpperCase()
  return g === 'html' ? 'HTML' : g === 'pdf' ? 'PDF' : g === 'immagine' ? 'IMG' : g === 'testo' ? 'TXT' : 'FILE'
}

// L'elenco si ricorda fra un'apertura e l'altra: tornando dal visore si
// rivede subito com'era, e intanto si rilegge.
const ultimoElenco = new Map<string, DiarioFile[]>()

/** Scarica sul dispositivo, come «Esporta i miei dati». */
function salvaSulDispositivo(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Un minuto: su iPhone Safari chiede conferma prima di scaricare.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// ── L'elenco ───────────────────────────────────────────────────
export function DiarioPersonale({ userId, onApri }: {
  userId: string | null
  onApri: (v: DiarioFile) => void
}) {
  const t = useT()
  const { confirmDelete } = useConfirmDelete()
  const [voci, setVoci] = useState<DiarioFile[] | null>(() => (userId ? ultimoElenco.get(userId) ?? null : null))
  const [errore, setErrore] = useState<string | null>(null)
  const [lavoro, setLavoro] = useState<null | 'carico' | string>(null)
  const input = useRef<HTMLInputElement>(null)

  const metti = useCallback((f: (prima: DiarioFile[]) => DiarioFile[]) => {
    setVoci(prima => {
      const v = f(prima ?? [])
      if (userId) ultimoElenco.set(userId, v)
      return v
    })
  }, [userId])

  const leggi = useCallback(async () => {
    if (!userId) return
    setErrore(null)
    try { const v = await elencoDiario(userId); metti(() => v) }
    catch (e) { setErrore(messaggio(e)) }
  }, [userId, metti])

  useEffect(() => { void leggi() }, [leggi])

  const scelto = async (file: File | undefined) => {
    if (!file || !userId) return
    setLavoro('carico'); setErrore(null)
    try {
      const v = await caricaNelDiario(userId, file)
      metti(prima => [v, ...prima])
    } catch (e) {
      setErrore(messaggio(e))
    } finally {
      setLavoro(null)
      // Lo stesso file scelto due volte di fila deve ripartire.
      if (input.current) input.current.value = ''
    }
  }

  const togli = (v: DiarioFile) => confirmDelete(async () => {
    setLavoro(v.id); setErrore(null)
    try {
      await eliminaDalDiario(v)
      metti(prima => prima.filter(x => x.id !== v.id))
    } catch (e) {
      setErrore(messaggio(e))
    } finally {
      setLavoro(null)
    }
  }, v.nome, {
    eyebrow: t('Diario personale'),
    title: t('Togliere questo file?'),
    body: t('«{nome}» esce dal diario, e con lui quello che ci avevi salvato dentro.', { nome: v.nome }),
    cta: t('Togli'),
  })

  // Senza accesso non c'è un diario da mostrare: è nel cloud, di qualcuno.
  if (!userId) return null

  return (
    <section>
      <NucEyebrow right={
        <button
          onClick={() => input.current?.click()}
          disabled={lavoro !== null}
          className="j-hard j-focus"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 12px',
            fontFamily: NUC.display, fontSize: 14, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
            background: 'var(--surface)', color: NUC.ink, border: 'var(--bordo)',
            cursor: lavoro ? 'default' : 'pointer', opacity: lavoro ? 0.5 : 1,
          }}
        >
          <Icons.plus size={14} stroke={2.4}/>
          {lavoro === 'carico' ? t('Carico…') : t('Aggiungi')}
        </button>
      }>{t('I tuoi file')}</NucEyebrow>
      <input
        ref={input} type="file" hidden
        aria-label={t('Scegli un file per il diario')}
        onChange={e => { void scelto(e.target.files?.[0]) }}
      />

      <div style={CARD}>
        {voci === null && !errore && (
          <div style={{ padding: 14, fontSize: 14, color: 'var(--fg-mute)' }}>{t('Carico il diario…')}</div>
        )}
        {voci !== null && voci.length === 0 && (
          <div style={{ padding: 14, fontSize: 14, lineHeight: 1.5, color: 'var(--fg-mute)' }}>
            {t('Ancora nessun file. Visibili solo a te: una pagina HTML si apre e si usa qui dentro, e quello che ci scrivi resta salvato; foto, PDF e testi si guardano.')}
          </div>
        )}
        {(voci ?? []).map((v, i) => {
          const g = genereDi(v)
          return (
            <div key={v.id} className="flex items-center" style={{ borderTop: i ? '1px solid var(--line)' : 'none', opacity: lavoro === v.id ? 0.5 : 1 }}>
              <button
                onClick={() => onApri(v)}
                className="j-riga-gruppo flex items-center"
                style={{ flex: 1, minWidth: 0, gap: 12, padding: 14, textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--fg)', cursor: 'pointer' }}
              >
                <span aria-hidden style={{
                  width: 44, height: 44, flexShrink: 0, boxSizing: 'border-box', border: 'var(--bordo)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: g === 'html' ? 'var(--ink)' : 'var(--surface-2)', color: g === 'html' ? 'var(--surface)' : NUC.ink,
                  fontFamily: NUC.display, fontSize: 12, fontWeight: 800, letterSpacing: '.04em',
                }}>{sigla(v, g)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nome}</span>
                  <span style={{ display: 'block', fontSize: 13, lineHeight: 1.4, color: 'var(--fg-mute)', marginTop: 2 }}>
                    {g === 'html' ? t('Si apre e si usa qui') : g === 'altro' ? t('Si scarica') : t('Si guarda qui')} · {pesoLeggibile(v.dimensione)} · {fmtShortDate(v.updated_at.slice(0, 10))}
                  </span>
                </span>
              </button>
              <button
                onClick={() => togli(v)}
                disabled={lavoro !== null}
                aria-label={t('Togli {nome} dal diario', { nome: v.nome })}
                className="j-focus"
                style={{ width: 48, alignSelf: 'stretch', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--fg-mute)', cursor: 'pointer' }}
              >
                <Icons.trash size={17} stroke={1.9}/>
              </button>
            </div>
          )
        })}
      </div>
      {errore && (
        <div role="alert" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: 'var(--danger)', display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span>{errore}</span>
          {voci === null && (
            <button onClick={() => { void leggi() }} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: 'var(--fg)', textDecoration: 'underline', cursor: 'pointer' }}>
              {t('Riprova')}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

// ── I tasti del visore, in testata ─────────────────────────────
export function AzioniFile({ voce, onSostituito }: {
  voce: DiarioFile
  /** La voce col contenuto nuovo: il visore la riapre. */
  onSostituito: (v: DiarioFile) => void
}) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  const [lavoro, setLavoro] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const scarica = async () => {
    setLavoro(true); setErrore(null)
    try { salvaSulDispositivo(await scaricaDalDiario(voce), voce.nome) }
    catch (e) { setErrore(messaggio(e)) }
    finally { setLavoro(false) }
  }
  const sostituisci = async (file: File | undefined) => {
    if (!file) return
    setLavoro(true); setErrore(null)
    try { onSostituito(await sostituisciFile(voce, file)) }
    catch (e) { setErrore(messaggio(e)) }
    finally {
      setLavoro(false)
      if (input.current) input.current.value = ''
    }
  }

  const tasto: CSSProperties = {
    width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--surface)', border: 'var(--bordo)', color: 'var(--fg)',
    cursor: lavoro ? 'default' : 'pointer', opacity: lavoro ? 0.5 : 1, flexShrink: 0,
  }
  return (
    <div className="flex items-center" style={{ gap: 8, flexShrink: 0 }}>
      {errore && <span role="alert" style={{ fontSize: 12, color: 'var(--danger)', maxWidth: 160, lineHeight: 1.3 }}>{errore}</span>}
      {/* Sostituire tiene la voce e la sua memoria: è come si aggiorna una
          pagina HTML senza perdere quello che ci si era scritto. */}
      <button onClick={() => input.current?.click()} disabled={lavoro} aria-label={t('Sostituisci il file')} title={t('Sostituisci il file, tenendo i dati salvati')} className="j-focus" style={tasto}>
        <Icons.refresh size={17} stroke={2}/>
      </button>
      <button onClick={() => { void scarica() }} disabled={lavoro} aria-label={t('Scarica il file')} title={t('Scarica il file')} className="j-focus" style={tasto}>
        <Icons.scarica size={17} stroke={2}/>
      </button>
      <input ref={input} type="file" hidden aria-label={t('Scegli il file nuovo')} onChange={e => { void sostituisci(e.target.files?.[0]) }}/>
    </div>
  )
}

// ── Il visore ──────────────────────────────────────────────────
/** Quanto si aspetta, dopo l'ultima modifica in una pagina, prima di mandarla
 *  al server: chi scrive i grammi di un pasto ne cambia dieci di fila. */
const ATTESA_INVIO_MS = 800

// I permessi della pagina: script, moduli, finestre (un link che apre una
// scheda nuova) e dialoghi. MAI `allow-same-origin`: con quello la pagina
// avrebbe l'origine dell'app, leggerebbe l'accesso a Supabase e potrebbe
// togliersi da sola il recinto.
const RECINTO = 'allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads'

type Aperto =
  | { genere: 'html'; srcDoc: string }
  | { genere: 'immagine' | 'pdf'; url: string }
  | { genere: 'testo'; testo: string }
  | { genere: 'altro'; blob: Blob }

export function VisoreDiario({ voce }: { voce: DiarioFile }) {
  const t = useT()
  const { scuro } = useTema()
  const [aperto, setAperto] = useState<Aperto | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [nonInviata, setNonInviata] = useState(false)
  const [troppa, setTroppa] = useState(false)
  const riquadro = useRef<HTMLIFrameElement>(null)
  const genere = genereDi(voce)
  // Il tema con cui si apre: cambiarlo dopo ricaricherebbe la pagina a metà
  // lavoro.
  const scuroAllAvvio = useRef(scuro)

  // Apre il file. Una pagina HTML con la sua memoria, scritta UNA volta: il
  // `srcDoc` non cambia più finché resta aperta, o ogni salvataggio la
  // ricaricherebbe da capo.
  useEffect(() => {
    let vivo = true
    let url: string | null = null
    setAperto(null); setErrore(null)
    ;(async () => {
      try {
        const blob = await scaricaDalDiario(voce)
        if (genere === 'html') {
          const [html, memoria] = await Promise.all([blob.text(), leggiMemoria(voce.id)])
          if (vivo) setAperto({ genere, srcDoc: conMemoria(html, { id: voce.id, memoria, scuro: scuroAllAvvio.current }) })
        } else if (genere === 'testo') {
          const testo = await blob.text()
          if (vivo) setAperto({ genere, testo })
        } else if (genere === 'immagine' || genere === 'pdf') {
          // Il PDF col suo tipo e nessun altro: un file che dice di essere un
          // PDF ma è una pagina non deve girare qui fuori dal recinto.
          url = URL.createObjectURL(genere === 'pdf' ? new Blob([blob], { type: 'application/pdf' }) : blob)
          if (vivo) setAperto({ genere, url })
        } else if (vivo) {
          setAperto({ genere: 'altro', blob })
        }
      } catch (e) {
        if (vivo) setErrore(messaggio(e))
      }
    })()
    return () => { vivo = false; if (url) URL.revokeObjectURL(url) }
  }, [voce, genere])

  // La memoria: ogni modifica della pagina arriva come messaggio. Si segna
  // subito sul telefono, e si manda al server poco dopo l'ultima.
  const invio = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manda = useCallback(() => {
    if (invio.current) { clearTimeout(invio.current); invio.current = null }
    if (!memoriaInSospeso(voce.id)) return
    inviaMemoria(voce.id).then(
      () => setNonInviata(memoriaInSospeso(voce.id)),
      () => setNonInviata(true),
    )
  }, [voce.id])

  useEffect(() => {
    if (genere !== 'html') return
    const arrivo = (e: MessageEvent) => {
      // Solo dalla pagina di questo riquadro, e solo per questo file: la
      // pagina ha un'origine vuota («null»), e l'unica cosa che la distingue
      // è la finestra da cui scrive.
      if (!riquadro.current || e.source !== riquadro.current.contentWindow) return
      const d = e.data as { diario?: unknown; memoria?: unknown } | null
      if (!d || d.diario !== voce.id || !eMemoria(d.memoria)) return
      const memoria: Memoria = d.memoria
      if (pesoMemoria(memoria) > MEMORIA_MAX_BYTE) { setTroppa(true); return }
      setTroppa(false)
      segnaMemoria(voce.id, memoria)
      if (invio.current) clearTimeout(invio.current)
      invio.current = setTimeout(manda, ATTESA_INVIO_MS)
    }
    // Chiudendo l'app, o mettendola in secondo piano, si manda subito: il
    // telefono potrebbe non riaprirla per ore.
    const via = () => { if (document.visibilityState === 'hidden') manda() }
    window.addEventListener('message', arrivo)
    window.addEventListener('online', manda)
    document.addEventListener('visibilitychange', via)
    // Quello rimasto in sospeso da un'altra volta parte appena si apre.
    manda()
    return () => {
      window.removeEventListener('message', arrivo)
      window.removeEventListener('online', manda)
      document.removeEventListener('visibilitychange', via)
      // Chiudendo il visore si manda quello che manca.
      manda()
    }
  }, [genere, voce.id, manda])

  const pieno: CSSProperties = { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }

  if (errore) {
    return (
      <div className="j-colonna" style={{ padding: '10px 20px' }}>
        <div role="alert" style={{ ...CARD, padding: 14, fontSize: 14, lineHeight: 1.5, color: 'var(--danger)' }}>{errore}</div>
      </div>
    )
  }
  if (!aperto) {
    return <div className="j-colonna" style={{ padding: '10px 20px', fontSize: 14, color: 'var(--fg-mute)' }}>{t('Apro il file…')}</div>
  }

  return (
    <div style={pieno}>
      {(nonInviata || troppa) && (
        <div role="status" style={{ padding: '8px 20px', fontSize: 13, lineHeight: 1.4, background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', color: troppa ? 'var(--danger)' : 'var(--fg-mute)' }}>
          {troppa ? t('Questa pagina salva troppi dati: oltre 1 MB non si ricordano.') : t('Le modifiche sono su questo telefono: le mando appena c’è rete.')}
        </div>
      )}
      {aperto.genere === 'html' && (
        <iframe
          ref={riquadro}
          title={voce.nome}
          srcDoc={aperto.srcDoc}
          sandbox={RECINTO}
          referrerPolicy="no-referrer"
          style={{ flex: 1, minHeight: 0, width: '100%', border: 'none', borderTop: '1px solid var(--line)', background: 'var(--bg)' }}
        />
      )}
      {aperto.genere === 'pdf' && (
        <iframe title={voce.nome} src={aperto.url} style={{ flex: 1, minHeight: 0, width: '100%', border: 'none', borderTop: '1px solid var(--line)' }}/>
      )}
      {aperto.genere === 'immagine' && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '10px 20px 40px' }}>
          <img src={aperto.url} alt={voce.nome} style={{ maxWidth: '100%', height: 'auto', border: 'var(--bordo)', boxSizing: 'border-box' }}/>
        </div>
      )}
      {aperto.genere === 'testo' && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '10px 20px 40px' }}>
          <pre className="j-colonna" style={{ ...CARD, margin: '0 auto', padding: 14, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', boxSizing: 'border-box' }}>{aperto.testo}</pre>
        </div>
      )}
      {aperto.genere === 'altro' && (
        <div className="j-colonna" style={{ padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...CARD, padding: 14, fontSize: 14, lineHeight: 1.5, color: 'var(--fg-mute)' }}>
            {t('Questo tipo di file non si apre qui: scaricalo e aprilo con l’app giusta.')}
          </div>
          <button onClick={() => salvaSulDispositivo(aperto.blob, voce.nome)} className="j-btn-accent-sm">{t('Scarica il file')}</button>
        </div>
      )}
    </div>
  )
}

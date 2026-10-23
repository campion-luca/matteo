// Il proprio profilo pubblico: quello che vedono il coach e chi si allena con
// te (vedi ProfiloUtente). Sta dentro "Profilo", in un pannello suo.
//
// Al contrario del resto di quella pagina non scrive nello store ma su una
// tabella sua (vedi lib/profili): il profilo esiste per farsi leggere dagli
// altri, e il blob dello stato non lo legge nessuno all'infuori di te. Per lo
// stesso motivo ha un tasto "Salva": va in rete, e può non riuscire.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { Avatar } from '@/components/ui/Avatar'
import { useT } from '@/lib/i18n'
import { useStore } from '@/store/useJarvisStore'
import { leggiProfili, salvaFoto, salvaProfilo, useProfilo, etaDi, type DettagliProfilo } from '@/lib/profili'
import { fotoDaFile } from '@/lib/fotoProfilo'
import { SchedaProfilo } from '@/features/coach/ProfiloUtente'

/** Cambiare la propria foto: sceglierla, ridurla, mandarla. */
function useCambiaFoto(userId: string | null) {
  const input = useRef<HTMLInputElement>(null)
  const [lavoro, setLavoro] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const scelta = async (file: File | undefined) => {
    if (!file || !userId) return
    setLavoro(true); setErrore(null)
    try {
      await salvaFoto(userId, await fotoDaFile(file))
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e))
    } finally {
      setLavoro(false)
      // Lo stesso file scelto due volte di fila deve ripartire.
      if (input.current) input.current.value = ''
    }
  }

  const togli = async () => {
    if (!userId) return
    setLavoro(true); setErrore(null)
    try { await salvaFoto(userId, null) }
    catch (e) { setErrore(e instanceof Error ? e.message : String(e)) }
    finally { setLavoro(false) }
  }

  const campo = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      hidden
      onChange={e => { void scelta(e.target.files?.[0]) }}
    />
  )
  return { campo, apri: () => input.current?.click(), togli, lavoro, errore }
}

/** L'avatar in cima al Profilo: la foto, o l'iniziale sulla tinta del tema.
 *  Toccandolo se ne sceglie una. */
export function AvatarProfilo({ userId, nome, size, fondoIniziale, coloreIniziale, onErrore }: {
  userId: string | null
  nome: string
  size: number
  fondoIniziale: string
  coloreIniziale: string
  /** L'errore va scritto da chi ha intorno lo spazio per farlo. */
  onErrore: (e: string | null) => void
}) {
  const t = useT()
  const profilo = useProfilo(userId)
  const foto = useCambiaFoto(userId)
  useEffect(() => { onErrore(foto.errore) }, [foto.errore, onErrore])
  // La propria foto si rilegge entrando: potrebbe averla cambiata da un altro
  // telefono. Se non è cambiata non si riscarica (vedi lib/profili).
  useEffect(() => {
    if (userId) void leggiProfili([userId]).catch(() => { /* senza rete resta quella che si ha */ })
  }, [userId])

  const quadrato: CSSProperties = {
    width: size, height: size, flexShrink: 0,
    border: 'var(--bordo)', boxSizing: 'border-box',
  }
  return (
    <>
    <button
      onClick={foto.apri}
      disabled={!userId || foto.lavoro}
      aria-label={profilo?.foto ? t('Cambia la foto') : t('Aggiungi una foto')}
      style={{ position: 'relative', padding: 0, background: 'none', border: 'none', cursor: userId ? 'pointer' : 'default', flexShrink: 0, opacity: foto.lavoro ? 0.5 : 1 }}
    >
      {profilo?.foto ? (
        <img src={profilo.foto} alt="" style={{ ...quadrato, display: 'block', objectFit: 'cover' }}/>
      ) : (
        <div style={{
          ...quadrato,
          background: fondoIniziale,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: NUC.display, fontSize: Math.round(size * 0.5), fontWeight: 800, color: coloreIniziale,
          transition: 'background 400ms',
        }}>
          {(nome.trim() || '?')[0].toUpperCase()}
        </div>
      )}
      {userId && (
        <span aria-hidden="true" style={{
          position: 'absolute', right: -6, bottom: -6, width: 28, height: 28, boxSizing: 'border-box',
          background: 'var(--surface)', border: 'var(--bordo)',
          color: 'var(--fg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icons.camera size={14} stroke={1.8}/>
        </span>
      )}
    </button>
    {/* Fuori dal tasto: un campo dentro un tasto è un tasto dentro un tasto. */}
    {foto.campo}
    </>
  )
}

/** Il pannello: foto, nome e cognome, e quello che racconti di te. */
export function ProfiloPubblico({ userId }: { userId: string | null }) {
  const t = useT()
  const [s] = useStore()
  const profilo = useProfilo(userId)
  const foto = useCambiaFoto(userId)

  // Il modulo parte da quello che si sa (il telefono ricorda l'ultimo profilo
  // letto) e si riallinea quando arriva quello del server — ma solo finché non
  // si è cominciato a scrivere: dopo, quello che c'è nei campi è dell'utente.
  const [toccato, setToccato] = useState(false)
  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [d, setD] = useState<DettagliProfilo>({})
  // L'anno come lo si sta scrivendo: "2", "20", "201"… Tenuto come numero, ogni
  // cifra intermedia era un anno impossibile e il campo si svuotava sotto le dita.
  const [dal, setDal] = useState('')
  const [stato, setStato] = useState<'carico' | 'pronto'>(profilo ? 'pronto' : 'carico')
  const [salvo, setSalvo] = useState(false)
  const [esito, setEsito] = useState<{ testo: string; tono: 'ok' | 'errore' } | null>(null)
  const [anteprima, setAnteprima] = useState(false)

  useEffect(() => {
    if (!userId) { setStato('pronto'); return }
    let vivo = true
    leggiProfili([userId])
      .catch(() => { /* tabella non ancora creata o rete: il salvataggio dirà cosa non va */ })
      .finally(() => { if (vivo) setStato('pronto') })
    return () => { vivo = false }
  }, [userId])

  useEffect(() => {
    if (toccato) return
    // Il nome dell'app come punto di partenza: chi apre il pannello la prima
    // volta trova già scritto quello che ha detto all'inizio.
    setNome(profilo?.nome ?? s.userName ?? '')
    setCognome(profilo?.cognome ?? '')
    setD(profilo?.dettagli ?? {})
    setDal(profilo?.dettagli?.dal ? String(profilo.dettagli.dal) : '')
    // `s.userName` solo come ripiego iniziale: cambiarlo altrove non deve
    // riscrivere un campo che l'utente sta guardando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilo, toccato])

  const cambia = (patch: Partial<DettagliProfilo>) => { setToccato(true); setEsito(null); setD(v => ({ ...v, ...patch })) }

  // L'età viene dai dati generali, dove c'è già: chiederla due volte vorrebbe
  // dire due numeri che prima o poi non vanno d'accordo.
  const eta = etaDi({ nascita: s.userDob ?? null, eta: s.userAge ?? null })
  const annoOra = new Date().getFullYear()

  // L'anno scritto, se è un anno possibile.
  const annoDal = (): number | undefined => {
    const n = parseInt(dal)
    return Number.isFinite(n) && n >= 1940 && n <= annoOra ? n : undefined
  }

  const pulito = (): DettagliProfilo => {
    const out: DettagliProfilo = {}
    for (const [k, v] of Object.entries(d) as Array<[keyof DettagliProfilo, unknown]>) {
      if (typeof v === 'string') { if (v.trim()) (out as Record<string, unknown>)[k] = v.trim() }
      else if (v !== undefined && v !== false) (out as Record<string, unknown>)[k] = v
    }
    // Curriculum ed esperienze sono di chi allena: tolto il "sì", restano
    // scritti qui ma non si mandano a nessuno.
    if (!out.pt) { delete out.curriculum; delete out.esperienze }
    const anno = annoDal()
    if (anno) out.dal = anno
    else delete out.dal
    return out
  }

  const salva = async () => {
    if (!userId || salvo) return
    if (dal.trim() && !annoDal()) {
      setEsito({ testo: t('L’anno in cui hai cominciato va scritto per intero, fra il 1940 e oggi.'), tono: 'errore' })
      return
    }
    setSalvo(true); setEsito(null)
    try {
      await salvaProfilo(userId, {
        nome: nome.trim() || null,
        cognome: cognome.trim() || null,
        nascita: s.userDob || null,
        eta: s.userAge ?? null,
        dettagli: pulito(),
      })
      setToccato(false)
      setEsito({ testo: t('Profilo salvato.'), tono: 'ok' })
    } catch (e) {
      setEsito({ testo: e instanceof Error ? e.message : String(e), tono: 'errore' })
    } finally {
      setSalvo(false)
    }
  }

  if (!userId) {
    return <div className="j-empty">{t('Serve l’accesso per avere un profilo.')}</div>
  }
  if (stato === 'carico' && !profilo) {
    return <div className="j-empty">{t('Caricamento…')}</div>
  }

  if (anteprima) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: NUC.font, fontSize: 13, color: 'var(--fg-mute)', lineHeight: 1.45 }}>
          {t('Così ti vede chi ti segue e chi segui. Quello che non hai ancora salvato qui c’è già, a loro arriva col salvataggio.')}
        </div>
        <SchedaProfilo
          profilo={{
            user_id: userId, nome, cognome, foto: profilo?.foto ?? null, foto_agg: null,
            nascita: s.userDob ?? null, eta: s.userAge ?? null, dettagli: pulito(), updated_at: '',
          }}
          nomeRiserva={s.userName || t('Tu')}
        />
        <button onClick={() => setAnteprima(false)} className="j-btn-log">{t('Torna a modificare')}</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ fontFamily: NUC.font, fontSize: 13, color: 'var(--fg-mute)', lineHeight: 1.45 }}>
        {t('Lo vedono solo il tuo coach e le persone che segui. Se cambi coach, quello nuovo trova già qui chi sei e da dove arrivi.')}
      </div>

      {/* La foto: si cambia subito, non aspetta "Salva". */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar foto={profilo?.foto} nome={[nome, cognome].join(' ').trim() || s.userName || '?'} size={80}/>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={foto.apri} disabled={foto.lavoro} className="j-btn-log" style={{ width: 'auto', height: 36, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icons.camera size={14} stroke={1.8}/>{foto.lavoro ? t('Attendi…') : profilo?.foto ? t('Cambia foto') : t('Aggiungi foto')}
            </button>
            {profilo?.foto && (
              <button onClick={() => { void foto.togli() }} disabled={foto.lavoro} className="j-btn-log" style={{ width: 'auto', height: 36, padding: '0 14px', color: 'var(--fg-mute)' }}>
                {t('Togli')}
              </button>
            )}
          </div>
          <div style={{ fontFamily: NUC.label, fontSize: 10, lineHeight: 1.45, color: 'var(--fg-mute)' }}>
            {t('Viene ridotta a un quadrato piccolo prima di partire: non rallenta niente.')}
          </div>
        </div>
        {foto.campo}
      </div>
      {foto.errore && <Esito testo={foto.errore} tono="errore"/>}

      <div style={{ display: 'flex', gap: 10 }}>
        <Campo etichetta={t('Nome')}>
          <input className="j-field" value={nome} maxLength={40} placeholder={t('Il tuo nome')}
            onChange={e => { setToccato(true); setEsito(null); setNome(e.target.value) }}/>
        </Campo>
        <Campo etichetta={t('Cognome')}>
          <input className="j-field" value={cognome} maxLength={40} placeholder={t('Il tuo cognome')}
            onChange={e => { setToccato(true); setEsito(null); setCognome(e.target.value) }}/>
        </Campo>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <Campo etichetta={t('Età')}>
          {/* Non si scrive qui: la si cambia nei dati generali. */}
          <div className="j-field" style={{ display: 'flex', alignItems: 'center', color: eta === null ? 'var(--fg-mute)' : 'var(--fg)', background: 'var(--surface-2)' }}>
            {eta === null ? '—' : t('{n} anni', { n: eta })}
          </div>
        </Campo>
        <Campo etichetta={t('Ti alleni dal')}>
          <input className="j-field" type="number" inputMode="numeric" min={1940} max={annoOra} placeholder={String(annoOra - 3)}
            value={dal}
            onChange={e => { setToccato(true); setEsito(null); setDal(e.target.value.slice(0, 4)) }}/>
        </Campo>
      </div>

      <Campo etichetta={t('Focus principali')} nota={t('Separati da virgole.')}>
        <input className="j-field" value={d.focus ?? ''} maxLength={160} placeholder={t('es. ipertrofia, forza, Hyrox')}
          onChange={e => cambia({ focus: e.target.value })}/>
      </Campo>

      <Campo etichetta={t('Chi sei')}>
        <AreaTesto valore={d.bio} onChange={v => cambia({ bio: v })} placeholder={t('Due righe su di te.')}/>
      </Campo>

      {/* Allena anche altri? Allora conta il mestiere. Una scelta a due tasti,
          come il sesso nei dati generali: è una domanda, non un'impostazione. */}
      <Campo etichetta={t('Alleni altre persone?')} gruppo>
        <div style={{ display: 'flex', gap: 8 }}>
          {([false, true] as const).map(v => (
            <button key={String(v)} onClick={() => cambia({ pt: v || undefined })} aria-pressed={!!d.pt === v} style={{
              flex: 1, height: 40, borderRadius: 'var(--radius)', cursor: 'pointer',
              background: !!d.pt === v ? 'var(--surface-2)' : 'var(--surface)',
              border: `1px solid ${!!d.pt === v ? 'var(--j-accent)' : 'var(--hairline)'}`,
              color: !!d.pt === v ? 'var(--j-accent-ink)' : 'var(--fg-mute)',
              fontFamily: NUC.font, fontSize: 14, transition: 'all 180ms',
            }}>
              {v ? t('Sì, sono un personal trainer') : t('No')}
            </button>
          ))}
        </div>
      </Campo>

      {d.pt && (
        <>
          <Campo etichetta={t('Formazione e certificazioni')}>
            <AreaTesto valore={d.curriculum} onChange={v => cambia({ curriculum: v })} placeholder={t('Studi, corsi, certificazioni.')}/>
          </Campo>
          <Campo etichetta={t('Esperienze')}>
            <AreaTesto valore={d.esperienze} onChange={v => cambia({ esperienze: v })} placeholder={t('Dove hai lavorato, chi hai seguito.')}/>
          </Campo>
        </>
      )}

      <Campo etichetta={t('Obiettivi')}>
        <AreaTesto valore={d.obiettivi} onChange={v => cambia({ obiettivi: v })} placeholder={t('Dove vuoi arrivare.')}/>
      </Campo>
      <Campo etichetta={t('Il tuo percorso')}>
        <AreaTesto valore={d.percorso} onChange={v => cambia({ percorso: v })} placeholder={t('Sport fatti, pause, come sei arrivato fin qui.')}/>
      </Campo>
      <Campo etichetta={t('Infortuni e limitazioni')}>
        <AreaTesto valore={d.limitazioni} onChange={v => cambia({ limitazioni: v })} placeholder={t('Quello che chi ti allena deve sapere.')}/>
      </Campo>

      {esito && <Esito testo={esito.testo} tono={esito.tono}/>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setAnteprima(true)} className="j-btn-log" style={{ flex: 1 }}>{t('Anteprima')}</button>
        <button onClick={() => { void salva() }} disabled={salvo} className="j-btn-accent-sm" style={{ flex: 1, opacity: salvo ? 0.5 : 1 }}>
          {salvo ? t('Attendi…') : t('Salva')}
        </button>
      </div>
    </div>
  )
}

/** Un campo con la sua etichetta. `gruppo` per una fila di tasti: dentro una
 *  <label> il tocco sull'etichetta premerebbe il primo tasto della fila. */
function Campo({ etichetta, nota, gruppo, children }: { etichetta: string; nota?: string; gruppo?: boolean; children: ReactNode }) {
  const Contenitore = gruppo ? 'div' : 'label'
  return (
    <Contenitore role={gruppo ? 'group' : undefined} aria-label={gruppo ? etichetta : undefined} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--fg-mute)' }}>
        {etichetta}
        {nota && <span style={{ textTransform: 'none', letterSpacing: '.02em', marginLeft: 6, opacity: 0.8 }}>{nota}</span>}
      </span>
      {children}
    </Contenitore>
  )
}

function AreaTesto({ valore, onChange, placeholder }: { valore?: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <textarea
      className="j-field"
      rows={3}
      maxLength={1500}
      value={valore ?? ''}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{ height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.5 }}
    />
  )
}

function Esito({ testo, tono }: { testo: string; tono: 'ok' | 'errore' }) {
  return (
    <div role="status" style={{
      padding: '10px 12px', borderRadius: 'var(--radius)',
      background: tono === 'errore' ? 'rgba(var(--danger-rgb),0.06)' : 'var(--surface-2)',
      border: `1px solid ${tono === 'errore' ? 'rgba(var(--danger-rgb),0.24)' : 'var(--hairline)'}`,
      fontFamily: NUC.font, fontSize: 12.5, lineHeight: 1.5,
      color: tono === 'errore' ? 'var(--danger)' : 'var(--fg-soft)',
    }}>{testo}</div>
  )
}

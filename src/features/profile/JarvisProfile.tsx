// Le due schermate personali, in un overlay solo: il PROFILO (nome, dati del
// corpo, peso) e le IMPOSTAZIONI (lingua, aspetto, account). Quale delle
// due lo dice la prop `sezione`; le aprono le due icone in cima all'app, la
// persona e la rotella (vedi SalutoHeader).
//
// Erano un elenco solo, e i propri dati stavano in cima a una pagina che parla di
// temi e password.
//
// Ogni interruttore qui scrive nello store, cioè nel blob che va in cloud.
// (Il pannello "Cambio tema" non c'è più: dal rebranding di ottobre 2026 il tema
// è uno solo.)
import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { NUC, cursore } from '@/lib/jarvis-tokens'
import { NucEyebrow, Interruttore } from '@/components/ui/NucComponents'
import { useStore, useJarvisStore, NOME_MAX, type JarvisState } from '@/store/useJarvisStore'
import { todayISO } from '@/lib/isoDate'
import { fmtDayMonth } from '@/lib/dateFormat'
import { LineChart } from '@/features/gym/gymShared'
import { fmtNum } from '@/features/gym/gymModel'
import { Icons } from '@/components/ui/Icons'
import { supabase, idUtenteSuDisco } from '@/lib/supabase'
import { attivaPush, spegniPush, statoPush, type StatoPush } from '@/lib/push'
import { esci } from '@/lib/uscita'
import { useConfirmDelete } from '@/hooks/useConfirmDelete'
import { useT, translate, LANG_LABELS, LANGS, type Lang } from '@/lib/i18n'
import { AvatarProfilo, ProfiloPubblico } from './ProfiloPubblico'
import { etaDi } from '@/lib/profili'

interface JarvisProfileProps {
  open: boolean
  onClose: () => void
  /** Due porte, lo stesso overlay. 'utente' mostra quello che è TUO — nome, dati
   *  del corpo, peso — e 'impostazioni' tutto il resto: lingua, aspetto, account.
   *  Erano un elenco solo, e i propri dati stavano in cima a una pagina che parla
   *  di temi e password. Dividerli è anche il motivo per cui in alto ci sono due
   *  icone e non una (vedi SalutoHeader). */
  sezione?: 'impostazioni' | 'utente'
}

// ── La conferma ────────────────────────────────────────────────
// Qui quasi niente ha un tasto "Salva": interruttori, temi e campi scrivono
// nello store mentre li tocchi. È comodo, ma chi cambia qualcosa si aspetta di
// sentirsi dire che è stato preso — senza, resta il dubbio di dover cercare un
// tasto che non c'è. Così a ogni modifica compare "Salvato" in testata, per un
// paio di secondi.
//
// Guarda lo store e non i singoli tasti: una voce aggiunta domani è coperta da
// sola. L'elenco è chiuso perché da qui dentro si cambiano solo queste cose, e
// lo store intero cambia anche per conto suo (un'alzata corretta
// dall'allenatore, per dire) mentre la pagina è aperta.
const CAMPI_IMPOSTAZIONI = [
  'lang',
  'userName', 'userAge', 'userSex', 'userWeight', 'userHeight', 'userDob', 'weightLog',
] as const satisfies ReadonlyArray<keyof JarvisState>
const DURATA_CONFERMA = 1800

function useSalvato(attivo: boolean): boolean {
  const [salvato, setSalvato] = useState(false)
  useEffect(() => {
    if (!attivo) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const smetti = useJarvisStore.subscribe((ora, prima) => {
      if (!CAMPI_IMPOSTAZIONI.some(k => ora[k] !== prima[k])) return
      setSalvato(true)
      clearTimeout(timer)
      timer = setTimeout(() => setSalvato(false), DURATA_CONFERMA)
    })
    return () => { smetti(); clearTimeout(timer); setSalvato(false) }
  }, [attivo])
  return salvato
}

export function JarvisProfile({ open, onClose, sezione = 'impostazioni' }: JarvisProfileProps) {
  const [s, set] = useStore()
  const t = useT()
  const [name, setName] = useState(s.userName || '')
  const [editingBody, setEditingBody] = useState(false)
  // Il pannello del profilo pubblico. È una PAGINA dentro il profilo,
  // non un modale: il modale si apre a z-index 90 e le impostazioni sono un overlay a
  // 95, quindi finiva sotto la pagina che l'aveva aperto — si vedevano le due
  // schermate una dentro l'altra. Alzare lo z-index del modale avrebbe spostato il
  // problema sul prossimo overlay; una pagina non ce l'ha proprio, e per due
  // pannelli grandi come questi è anche la forma giusta.
  // È il profilo che vedono il coach e chi segui (vedi ProfiloPubblico).
  const [pannello, setPannello] = useState<null | 'pubblico'>(null)
  // Letto una volta: è chi è entrato su questo telefono, e non cambia con la
  // pagina aperta.
  const [userId] = useState(idUtenteSuDisco)
  const [erroreFoto, setErroreFoto] = useState<string | null>(null)
  const mieiDati = sezione === 'utente'
  const [age, setAge]       = useState(s.userAge ? String(s.userAge) : '')
  const [sex, setSex]       = useState<'M' | 'F' | ''>(s.userSex ?? '')
  const [weight, setWeight] = useState(s.userWeight ? String(s.userWeight) : '')
  const [height, setHeight] = useState(s.userHeight ? String(s.userHeight) : '')
  const [dob, setDob]       = useState(s.userDob ?? '')
  const [visible, setVisible] = useState(false)
  const [mount, setMount] = useState(open)
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [pwdOk, setPwdOk] = useState(false)
  const salvato = useSalvato(open)

  useEffect(() => {
    if (open) {
      setName(s.userName || '')
      setAge(s.userAge ? String(s.userAge) : '')
      setSex(s.userSex ?? '')
      setWeight(s.userWeight ? String(s.userWeight) : '')
      setHeight(s.userHeight ? String(s.userHeight) : '')
      setDob(s.userDob ?? '')
      setEditingBody(false)
      setPannello(null)
      setMount(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else if (mount) {
      setVisible(false)
      const timer = setTimeout(() => setMount(false), 320)
      return () => clearTimeout(timer)
    }
    // Reset del form solo all'apertura: legge i valori correnti dello store una tantum,
    // non deve rieseguire a ogni loro cambiamento mentre il modal è aperto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Una pesata registrata più in basso cambia il peso nello store mentre questa
  // pagina è aperta: il campo deve seguirla. Senza, "Salva" rimetteva il peso
  // letto all'apertura, e la pesata appena fatta spariva dal profilo.
  useEffect(() => {
    setWeight(s.userWeight ? String(s.userWeight) : '')
  }, [s.userWeight])

  const saveName = () => set({ userName: name.trim() })

  // Con la data di nascita l'età si calcola, come nel primo avvio: quella
  // scritta a mano a 28 anni restava 28 per sempre, e qui accanto alla data del
  // compleanno si leggevano due numeri che non tornavano.
  const etaCalcolata = dob ? etaDi({ nascita: dob, eta: null }) : null
  const etaDaSalvare = etaCalcolata ?? (age ? parseInt(age) : undefined)

  const saveBody = () => {
    set({
      userAge:    etaDaSalvare,
      userSex:    sex    ? sex                : undefined,
      userWeight: weight ? parseFloat(weight) : undefined,
      userHeight: height ? parseFloat(height) : undefined,
      userDob:    dob    ? dob                : undefined,
    })
    setEditingBody(false)
  }

  const handleSave = () => {
    set({
      userName:   name.trim(),
      userAge:    etaDaSalvare,
      userSex:    sex    ? sex                : undefined,
      userWeight: weight ? parseFloat(weight) : undefined,
      userHeight: height ? parseFloat(height) : undefined,
      userDob:    dob    ? dob                : undefined,
    })
    onClose()
  }

  // Giorno, mese, anno con le barre: vale in italiano e in inglese (vedi dateFormat).
  const formatDob = (v: string) => {
    if (!v) return '—'
    const [y, m, d] = v.split('-')
    return `${d}/${m}/${y}`
  }

  // Esce da QUESTO telefono soltanto, dopo aver provato a mandare al cloud
  // quello che manca, e anche senza rete (vedi lib/uscita).
  const [uscendo, setUscendo] = useState(false)
  const { confirmDelete: chiedi } = useConfirmDelete()
  const esciDavvero = async () => {
    if (uscendo) return
    setUscendo(true)
    await esci().catch(() => { /* l'uscita non deve mai restare a metà */ })
    setUscendo(false)
    onClose()
  }
  // Un tocco solo non basta più: adesso "Logout" esce anche senza rete, e nel
  // seminterrato della palestra vorrebbe dire restare fuori dall'app finché non
  // torna il segnale. Quello che non è ancora nel cloud non si perde (resta su
  // questo telefono, vedi lib/proprietario), e lo si dice.
  const handleLogout = () => chiedi(() => { void esciDavvero() }, t('Logout'), {
    eyebrow: t('Logout'),
    title: t('Uscire dall’account?'),
    body: t('Esci solo da questo dispositivo. Quello che non è ancora salvato nel cloud, e un allenamento lasciato a metà, restano qui: li ritrovi rientrando su questo telefono. Per rientrare serve la rete.'),
    cta: t('Esci'),
  })

  // ── Una copia dei propri dati ────────────────────────────────
  // Tutto lo stato dell'account in un file, sul dispositivo. Nel cloud c'è una
  // riga sola per utente, riscritta a ogni salvataggio: senza una copia, quello
  // che un errore di sincronizzazione porta via non c'è modo di riaverlo. Il
  // file è lo stesso oggetto che l'app salva, leggibile. (L'app non sa ancora
  // rileggerlo: è una copia da tenere, non un ripristino a un tocco.)
  const esporta = () => {
    const stato = useJarvisStore.getState()
    const file = new Blob([JSON.stringify({ app: 'matteo', esportato: new Date().toISOString(), dati: stato }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = `matteo-${todayISO()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Un minuto, non un secondo: su iPhone Safari chiede conferma prima di
    // scaricare, e con l'indirizzo già revocato il file non c'era più.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  if (!mount) return null

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 95,
      background: 'var(--bg)',
      backgroundImage: 'var(--paper-grain)',
      transform: visible ? 'translateY(0)' : 'translateY(100%)',
      transition: `transform ${visible ? '340ms' : '260ms'} cubic-bezier(.2,.9,.25,1.1)`,
      display: 'flex', flexDirection: 'column',
      fontFamily: NUC.font, color: 'var(--fg)',
    }}>

      {/* Testata — la stessa delle schede, delle statistiche e del coaching:
          freccia a sinistra, titolo grande accanto. Prima era una barra a sé
          (freccia piccola, titolo in maiuscoletto al centro, fondo diverso), e
          aprendo le impostazioni sembrava di essere usciti dall'app.
          Sta sulla stessa colonna delle voci qui sotto, o su uno schermo largo il
          back finirebbe a un palmo dalla roba che comanda. */}
      <div className="j-colonna j-page-header">
        <div className="flex items-center gap-3">
          {/* Il back è uno solo e sa dov'è: da un pannello torna all'elenco, dall'elenco
              chiude le impostazioni. Due frecce sovrapposte — una del pannello e una
              della pagina — sono il modo più rapido di far uscire qualcuno per sbaglio. */}
          {/* Dal profilo la freccia salva quello che si è scritto e chiude: il
              tasto "Salva" in testata non c'è più (rebranding, ott 2026). Il nome
              si salvava già uscendo dal campo; i dati generali col loro tasto. */}
          <button
            onClick={() => pannello ? setPannello(null) : mieiDati ? handleSave() : onClose()}
            aria-label={pannello ? (mieiDati ? t('Torna al profilo') : t('Torna alle impostazioni')) : mieiDati ? t('Chiudi il profilo') : t('Chiudi le impostazioni')}
            className="j-btn-back"
          >
            <Icons.back size={20} stroke={1.8}/>
          </button>
          <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            <div className="j-page-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pannello === 'pubblico' ? t('Profilo pubblico')
                : mieiDati ? t('Profilo') : t('Impostazioni')}
            </div>
            {/* La conferma (vedi `useSalvato`), sotto il titolo: dove le altre
                pagine hanno l'occhiello. C'è sempre e cambia solo opacità:
                comparendo dal nulla sposterebbe tutto a ogni tocco. */}
            <span role="status" style={{
              // Appesa sotto il titolo senza occupare posto: il titolo resta
              // centrato sulla freccia anche quando la conferma non si vede.
              position: 'absolute', left: 0, top: '100%',
              display: 'flex', alignItems: 'center', gap: 4, height: 14, marginTop: 2,
              fontFamily: NUC.label, fontSize: 10.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase',
              color: 'var(--j-accent-ink)', whiteSpace: 'nowrap',
              opacity: salvato ? 1 : 0, transition: 'opacity var(--motion-fast) var(--ease)',
            }}>
              {/* Il testo c'è solo quando serve: un lettore di schermo annuncia
                  una regione `status` quando il suo contenuto cambia, non quando
                  diventa opaca. */}
              <Icons.check size={12} stroke={2.6}/>{salvato ? t('Salvato') : <span aria-hidden>{t('Salvato')}</span>}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="j-profile-body j-colonna" style={{ flex: 1, overflowY: 'auto', padding: '10px 20px 40px', display: 'flex', flexDirection: 'column', gap: mieiDati && !pannello ? 26 : 20 }}>
      {pannello === 'pubblico' ? (
        <ProfiloPubblico userId={userId}/>
      ) : (
        <>

        {/* ── Quello che è TUO ─────────────────────────────────────
            Nome, dati del corpo e peso: si aprono dall'icona utente in cima
            all'app, non più da qui in mezzo a temi e password. */}
        {mieiDati && (
        <>

        {/* La faccia e il nome, in un riquadro: a sinistra il quadrato della
            foto (toccandolo se ne sceglie una), a destra il nome. Il nome è un
            campo, ma senza il bordo del campo: si legge come il titolo della
            pagina, e si corregge toccandolo. */}
        <div style={{ ...CARD, display: 'flex', alignItems: 'center', gap: 16, padding: 14 }}>
          <AvatarProfilo
            userId={userId}
            nome={name}
            size={72}
            fondoIniziale="var(--ink)"
            coloreIniziale="var(--surface)"
            onErrore={setErroreFoto}
          />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label htmlFor="prof-nome" style={ETICHETTA}>{t('Nome utente')}</label>
            {/* Salva all'uscita dal campo: il nome è l'unica cosa che si scrive
                qui, e uscire senza toccarlo era il caso normale. */}
            <input
              id="prof-nome"
              className="j-campo-grande j-campo-nome"
              value={name}
              onChange={e => setName(e.target.value.slice(0, NOME_MAX))}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') { saveName(); (e.target as HTMLInputElement).blur() } }}
              maxLength={NOME_MAX}
              placeholder={t('Il tuo nome')}
            />
          </div>
        </div>
        {erroreFoto && (
          <div style={{ fontFamily: NUC.font, fontSize: 13, lineHeight: 1.5, color: 'var(--danger)', marginTop: -8 }}>{erroreFoto}</div>
        )}

        {/* ── Dati generali: quattro numeri in griglia, la data sotto ── */}
        <section>
          <NucEyebrow right={
            <button
              onClick={() => { if (editingBody) saveBody(); else setEditingBody(true) }}
              className="j-hard j-focus"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 12px',
                fontFamily: NUC.display, fontSize: 14, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                // Mentre si scrive il tasto è pieno: è lui che chiude e salva.
                background: editingBody ? 'var(--ink)' : 'var(--surface)',
                color: editingBody ? 'var(--surface)' : NUC.ink,
                border: 'var(--bordo)', cursor: 'pointer',
              }}
            >
              {editingBody ? <Icons.check size={14} stroke={2.6}/> : <Icons.pencil size={13} stroke={2}/>}
              {editingBody ? t('Salva') : t('Modifica')}
            </button>
          }>{t('Dati generali')}</NucEyebrow>

          {editingBody ? (
            <div style={{ ...CARD, padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div id="prof-sesso" style={ETICHETTA}>{t('Sesso')}</div>
                {/* Si può anche lasciare vuoto: toccando di nuovo quello scelto
                    lo si toglie. */}
                <div role="radiogroup" aria-labelledby="prof-sesso" style={{ display: 'flex', border: 'var(--bordo)' }}>
                  {(['M', 'F'] as const).map((v, i) => (
                    <button key={v} role="radio" aria-checked={sex === v} onClick={() => setSex(sex === v ? '' : v)} className="j-focus" style={{
                      flex: 1, height: 44, border: 'none', borderLeft: i === 0 ? 'none' : 'var(--bordo)',
                      background: sex === v ? 'var(--ink)' : 'var(--surface)',
                      color: sex === v ? 'var(--surface)' : NUC.ink,
                      fontFamily: NUC.display, fontSize: 15, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}>
                      {v === 'M' ? t('Uomo') : t('Donna')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Età, peso e altezza: tre campi su una riga. */}
              <div style={{ display: 'flex', gap: 10 }}>
                <label style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={ETICHETTA}>{t('Età')}</span>
                  {/* Con la data di nascita si calcola da sola: il campo la mostra e non si scrive. */}
                  <input
                    type="number" inputMode="numeric" min="10" max="100"
                    value={etaCalcolata !== null ? String(etaCalcolata) : age} onChange={e => setAge(e.target.value)}
                    disabled={etaCalcolata !== null} title={etaCalcolata !== null ? t('Si calcola dalla data di nascita') : undefined}
                    placeholder="—" className="j-field" style={etaCalcolata !== null ? { color: 'var(--fg-mute)' } : undefined}
                  />
                </label>
                <label style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={ETICHETTA}>{t('Peso (kg)')}</span>
                  <input type="number" inputMode="decimal" min="30" max="250" step="0.5" value={weight} onChange={e => setWeight(e.target.value)} placeholder="—" className="j-field"/>
                </label>
                <label style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={ETICHETTA}>{t('Altezza (cm)')}</span>
                  <input type="number" inputMode="numeric" min="100" max="230" value={height} onChange={e => setHeight(e.target.value)} placeholder="—" className="j-field"/>
                </label>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={ETICHETTA}>{t('Data di nascita')}</span>
                <input type="date" value={dob} onChange={e => setDob(e.target.value)} className="j-field"/>
              </label>
            </div>
          ) : (
            <div style={CARD}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <Dato k={t('Peso')} v={weight ? fmtNum(parseFloat(weight)) : null} unita="kg"/>
                <Dato k={t('Altezza')} v={height || null} unita="cm" style={{ borderLeft: '1px solid var(--line)' }}/>
                <Dato k={t('Età')} v={etaCalcolata !== null ? String(etaCalcolata) : age || null} unita={t('anni')} style={{ borderTop: '1px solid var(--line)' }}/>
                <Dato k={t('Sesso')} v={sex === 'M' ? t('Uomo') : sex === 'F' ? t('Donna') : null} style={{ borderTop: '1px solid var(--line)', borderLeft: '1px solid var(--line)' }}/>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                padding: '11px 14px', background: 'var(--surface-2)', borderTop: '1px solid var(--line)',
              }}>
                <span style={{ ...ETICHETTA, fontSize: 12 }}>{t('Data di nascita')}</span>
                <span style={{ fontFamily: NUC.display, fontSize: 16, fontWeight: 800, color: dob ? NUC.ink : 'var(--muted-dark)', fontVariantNumeric: 'tabular-nums' }}>{formatDob(dob)}</span>
              </div>
            </div>
          )}
        </section>

        {/* La pesata */}
        <PesoSection/>

        {/* Il profilo che vedono gli altri: una pagina sua. Nome, cognome, foto
            e il proprio percorso — per il coach, e per il prossimo coach. */}
        <div style={CARD}>
          <RigaImpostazione
            icona={<Icons.user size={18} stroke={1.9}/>}
            titolo={t('Profilo pubblico')}
            sotto={t('Quello che vedono il tuo coach e chi segui')}
            onClick={() => setPannello('pubblico')}
          />
        </div>

        </>
        )}

        {/* ── Le regolazioni dell'app ──────────────────────────── */}
        {/* Tre sezioni (rebranding, ott 2026): Generale, Account e — sotto un
            tratteggio — la Zona pericolosa, dove sta l'unica cosa che cancella
            dei dati. Erano blocchi uno sotto l'altro, e lo "svuota" stava fra
            le notifiche e la password. */}
        {!mieiDati && (
        <>

        <section>
          <NucEyebrow>{t('Generale')}</NucEyebrow>
          <div style={CARD}>
            <LinguaSection/>
            {/* Notifiche: stavano in cima al Coaching, dove a ogni ingresso
                toglievano una riga alle cose da fare. Sono un'impostazione del
                dispositivo, e si cercano qui. */}
            <NotificheSection/>
          </div>
        </section>

        <section>
          <NucEyebrow>{t('Account')}</NucEyebrow>
          <div style={CARD}>
            <RigaImpostazione
              icona={<Icons.lucchetto size={18} stroke={1.9}/>}
              titolo={t('Cambia password')}
              aperta={showChangePwd}
              onClick={() => { setShowChangePwd(v => !v); setPwdError(null); setPwdOk(false) }}
            />
            {showChangePwd && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 14px 14px' }}>
                <input
                  type="password" placeholder={t('Password attuale')}
                  value={oldPwd} onChange={e => { setOldPwd(e.target.value); setPwdError(null); setPwdOk(false) }}
                  className="j-field"
                />
                <input
                  type="password" placeholder={t('Nuova password')}
                  value={newPwd} onChange={e => { setNewPwd(e.target.value); setPwdError(null); setPwdOk(false) }}
                  className="j-field"
                />
                {pwdError && <div style={{ fontFamily: NUC.font, fontSize: 13, color: 'var(--danger)' }}>{pwdError}</div>}
                {pwdOk   && <div style={{ fontFamily: NUC.font, fontSize: 13, color: 'var(--j-accent-ink)' }}>{t('Password aggiornata ✓')}</div>}
                <button
                  disabled={pwdLoading || !oldPwd || !newPwd}
                  onClick={async () => {
                    if (newPwd.length < 6) { setPwdError(t('La nuova password deve avere almeno 6 caratteri.')); return }
                    setPwdLoading(true); setPwdError(null)
                    const { data: { user } } = await supabase.auth.getUser()
                    if (!user?.email) { setPwdError(t('Utente non trovato.')); setPwdLoading(false); return }
                    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: oldPwd })
                    if (signInErr) { setPwdError(t('Password attuale non corretta.')); setPwdLoading(false); return }
                    const { error: updateErr } = await supabase.auth.updateUser({ password: newPwd })
                    if (updateErr) { setPwdError(updateErr.message); setPwdLoading(false); return }
                    setPwdOk(true); setOldPwd(''); setNewPwd(''); setPwdLoading(false)
                  }}
                  className="j-btn-accent-sm"
                  style={{ opacity: (!oldPwd || !newPwd || pwdLoading) ? 0.5 : 1 }}
                >
                  {pwdLoading ? t('Attendi…') : t('Aggiorna password')}
                </button>
              </div>
            )}
            {/* Una copia dei dati, prima dell'uscita: è il posto dove la si cerca. */}
            <RigaImpostazione
              icona={<Icons.scarica size={18} stroke={1.9}/>}
              titolo={t('Esporta i miei dati')}
              sotto={t('Allenamenti, schede e pesate in un file, fuori dall’app.')}
              onClick={esporta}
              divisa
            />
            <RigaImpostazione
              icona={<Icons.esci size={18} stroke={1.9}/>}
              titolo={uscendo ? t('Attendi…') : t('Esci')}
              onClick={handleLogout}
              disabled={uscendo}
              freccia={false}
              divisa
            />
          </div>
        </section>

        {/* Il tratteggio dice che da qui in giù si cancella. */}
        <div aria-hidden style={{ borderTop: '2px dashed var(--muted-dark)', margin: '2px 0' }}/>

        <section>
          <NucEyebrow>{t('Zona pericolosa')}</NucEyebrow>
          <div style={CARD}>
            <SvuotaAlzateSection/>
          </div>
        </section>

        {/* Crediti — l'ultima riga della schermata, sbiadita.
            Non è una gentilezza: le illustrazioni degli esercizi vengono dal
            dataset gratuito di RepDB, la cui licenza le concede anche per uso
            commerciale a UNA condizione, cioè che questa riga sia visibile. Se
            sparisce, le immagini in src/assets/esercizi vanno tolte lo stesso
            giorno.

            Il testo resta in inglese in tutte le lingue, e fuori da `t()`: è la
            formula che la licenza chiede alla lettera, non una frase
            dell'interfaccia. Tradurla sarebbe riscriverla. */}
        <div style={{ marginTop: 'auto', paddingTop: 24, textAlign: 'center' }}>
          <a
            href="https://repdb.co" target="_blank" rel="noopener noreferrer"
            style={{
              fontFamily: NUC.font, fontSize: 12,
              color: 'var(--fg-mute)', textDecoration: 'none',
            }}
          >
            Exercise data by RepDB (repdb.co)
          </a>
        </div>

        </>
        )}
        </>
      )}
      </div>

    </div>
  )
}

// ── Lingua ─────────────────────────────────────────────────────
// Due bandiere affiancate, una per lingua, con la spunta su quella attiva.
//
// Le bandiere non sono decorazione: sono l'unica parte di questa schermata che si
// capisce quando l'app è nella lingua sbagliata. Chi apre le impostazioni per
// TORNARE indietro sta guardando parole che non legge, e "Sprache" non lo aiuta;
// il tricolore sì. Per lo stesso motivo sotto ogni bandiera c'è il nome della
// lingua scritto NELLA lingua — "English", non "Inglese".
function LinguaSection() {
  const [s, set] = useStore()
  const t = useT()
  const { confirmDelete } = useConfirmDelete()
  const attuale: Lang = s.lang ?? 'it'

  const chiedi = (target: Lang) => {
    // Toccare la lingua che è già attiva non è un errore da segnalare: non è
    // successo niente, e un dialogo che chiede di confermare il nulla è peggio.
    if (target === attuale) return
    confirmDelete(
      () => set({ lang: target }),
      LANG_LABELS[target],
      {
        eyebrow: t('Lingua'),
        // Il titolo è già nella lingua di DESTINAZIONE: è l'anteprima di quello
        // che sta per succedere, e chi ha toccato la bandiera sbagliata se ne
        // accorge qui invece che a schermata cambiata.
        title: translate(target, 'Impostare la lingua su {lingua}?', { lingua: LANG_LABELS[target] }),
        // Il corpo resta nella lingua CORRENTE, cioè l'unica che chi legge sa di
        // capire. Un dialogo tutto in inglese che chiede di passare all'inglese
        // presuppone risolta la domanda che sta ponendo.
        body: t('Tutta l’app passa in {lingua}. Puoi tornare indietro da qui quando vuoi.', { lingua: LANG_LABELS[target] }),
        cta: translate(target, 'Sì, cambia lingua'),
        tone: 'neutral',
      },
    )
  }

  return (
    <div style={{ padding: 14 }}>
      <div style={TITOLO_RIGA}>{t('Lingua')}</div>
      <div style={SOTTO_RIGA}>{t('I nomi che hai scritto tu restano come li hai scritti.')}</div>
      {/* Il nome di ogni lingua è scritto NELLA lingua — "English", non
          "Inglese": è l'unica parte della schermata che si capisce quando l'app
          è nella lingua sbagliata. */}
      <div role="radiogroup" aria-label={t('Lingua')} className="j-switch" style={{ ...cursore(LANGS.indexOf(attuale), LANGS.length), marginTop: 12 }}>
        {LANGS.map(l => {
          const on = l === attuale
          return (
            <button
              key={l}
              onClick={() => chiedi(l)}
              role="radio"
              aria-checked={on}
              className="j-switch-cell"
              style={{ height: 44, cursor: on ? 'default' : 'pointer', fontSize: 15 }}
            >
              {LANG_LABELS[l]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Notifiche ──────────────────────────────────────────────────
// Un interruttore, e sotto in che stato si è. Di serie sono accese: l'app le
// chiede al primo ingresso e a chi ha già detto di sì le riaccende da sola
// (vedi lib/push). Da qui si spengono, e si riaccendono.
//
// Dice sempre cosa fare, perché le notifiche hanno cinque modi diversi di "non
// andare" — permesso negato, iPhone senza l'app installata, browser senza
// push… — e un interruttore fermo che non spiega perché è peggio di niente.
// Dove il push non è configurato sul progetto la sezione non c'è: prometterebbe
// notifiche che non possono arrivare.
function NotificheSection() {
  const t = useT()
  const [stato, setStato] = useState<StatoPush | null>(null)
  const [lavoro, setLavoro] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    statoPush().then(s => { if (vivo) setStato(s) }).catch(() => { if (vivo) setStato('non-supportato') })
    return () => { vivo = false }
  }, [])

  if (stato === null || stato === 'non-configurato') return null

  const attivo = stato === 'attivo'
  const cambia = async () => {
    const io = idUtenteSuDisco()
    if (!io || lavoro) return
    setLavoro(true); setErrore(null)
    try {
      if (attivo) { await spegniPush(); setStato('spento') }
      else setStato(await attivaPush(io))
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e))
    } finally {
      setLavoro(false)
    }
  }

  const testo =
    attivo ? t('Notifiche attive su questo dispositivo.')
    : stato === 'spento' ? t('Attiva le notifiche per sapere subito quando ti scrivono o un allievo finisce un allenamento.')
    : stato === 'negato' ? t('Le notifiche sono bloccate per questa app. Riattivale dalle impostazioni del telefono o del browser.')
    : stato === 'da-installare' ? t('Su iPhone le notifiche arrivano solo con l’app installata: da Safari tocca Condividi, poi “Aggiungi alla schermata Home”, e aprila da lì.')
    : t('Questo browser non supporta le notifiche.')

  return (
    <div style={{ padding: 14, borderTop: '1px solid var(--line)' }}>
      <div className="flex items-start justify-between" style={{ gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={TITOLO_RIGA}>{t('Notifiche')}</div>
          <div style={SOTTO_RIGA}>{testo}</div>
        </div>
        <Interruttore acceso={attivo} onClick={() => { void cambia() }} disabled={lavoro || !(attivo || stato === 'spento')} etichetta={t('Notifiche')}/>
      </div>
      {errore && <div style={{ fontFamily: NUC.font, fontSize: 13, color: 'var(--danger)', marginTop: 8 }}>{errore}</div>}
    </div>
  )
}

// ── I pezzi delle impostazioni ─────────────────────────────────
// Una card bianca col bordo d'inchiostro, dentro righe divise da un filo.
const CARD: CSSProperties = { background: 'var(--surface)', border: 'var(--bordo)' }
const TITOLO_RIGA: CSSProperties = { fontFamily: NUC.font, fontSize: 15, fontWeight: 600, color: 'var(--fg)', lineHeight: 1.3 }
const SOTTO_RIGA: CSSProperties = { fontFamily: NUC.font, fontSize: 13, lineHeight: 1.4, color: 'var(--fg-mute)', marginTop: 2 }

/** Una riga che si tocca: icona, titolo, a volte una riga sotto, e la freccia. */
function RigaImpostazione({ icona, titolo, sotto, onClick, aperta, disabled, freccia = true, divisa }: {
  icona: ReactNode; titolo: string; sotto?: string; onClick: () => void
  /** Apre qualcosa qui sotto (la password): la freccia gira. */
  aperta?: boolean
  disabled?: boolean
  freccia?: boolean
  /** Il filo sopra: per tutte le righe tranne la prima. */
  divisa?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled} aria-expanded={aperta} className="j-riga-gruppo flex items-center w-full" style={{
      gap: 12, padding: '14px', minHeight: 52, textAlign: 'left', cursor: disabled ? 'default' : 'pointer',
      background: 'transparent', border: 'none', borderTop: divisa ? '1px solid var(--line)' : 'none', color: 'var(--fg)',
    }}>
      <span style={{ display: 'flex', flexShrink: 0 }}>{icona}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ ...TITOLO_RIGA, display: 'block' }}>{titolo}</span>
        {sotto && <span style={{ ...SOTTO_RIGA, display: 'block' }}>{sotto}</span>}
      </span>
      {freccia && (
        <span style={{ display: 'flex', flexShrink: 0, transform: aperta ? 'rotate(90deg)' : 'none', transition: 'transform var(--motion-fast) var(--ease)' }}>
          <Icons.chev size={16} stroke={2.2}/>
        </span>
      )}
    </button>
  )
}

/** Quanto si tiene premuto un tasto che cancella, prima che cancelli. */
const DURATA_PRESSIONE = 1500

/** Il tasto della Zona pericolosa: si tiene premuto finché il fondo non si
 *  riempie, e solo allora fa quello che dice. È la conferma, al posto di un
 *  dialogo: un tocco per sbaglio non basta, e chi lo vuole davvero non deve
 *  rispondere a una domanda. Da tastiera, dove tenere premuto non ha senso, il
 *  tasto chiede conferma come gli altri (`onTastiera`). */
function TieniPremuto({ etichetta, disabled, onFatto, onTastiera }: {
  etichetta: string; disabled?: boolean
  onFatto: () => void
  onTastiera: () => void
}) {
  const t = useT()
  const [premuto, setPremuto] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])
  const ferma = () => { clearTimeout(timer.current); setPremuto(false) }
  return (
    <button
      disabled={disabled}
      onPointerDown={e => {
        if (disabled || e.button !== 0) return
        setPremuto(true)
        timer.current = setTimeout(() => { setPremuto(false); onFatto() }, DURATA_PRESSIONE)
      }}
      onPointerUp={ferma} onPointerLeave={ferma} onPointerCancel={ferma}
      // Il menù del tocco lungo, sul telefono, coprirebbe il tasto a metà.
      onContextMenu={e => e.preventDefault()}
      onClick={e => { if (e.detail === 0) onTastiera() }}
      style={{
        position: 'relative', overflow: 'hidden', width: '100%', height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0 14px',
        background: 'var(--surface)', border: `2px solid ${disabled ? 'var(--muted-dark)' : 'var(--danger)'}`,
        color: disabled ? 'var(--fg-mute)' : 'var(--danger)', cursor: disabled ? 'default' : 'pointer',
        userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'manipulation',
      } as CSSProperties}
    >
      {/* Il fondo che si riempie mentre lo si tiene: dice quanto manca. */}
      <span aria-hidden style={{
        position: 'absolute', top: 0, bottom: 0, left: 0, width: premuto ? '100%' : '0%',
        background: 'rgba(var(--danger-rgb), .14)',
        transition: premuto ? `width ${DURATA_PRESSIONE}ms linear` : 'width 150ms ease-out',
      }}/>
      <span style={{ position: 'relative', fontFamily: NUC.display, fontSize: 18, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase' }}>{etichetta}</span>
      {!disabled && (
        <span style={{ position: 'relative', fontFamily: NUC.display, fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>{t('Tieni premuto')}</span>
      )}
    </button>
  )
}

// L'etichetta sopra un numero o un campo: "PESO", "NOME UTENTE".
const ETICHETTA: CSSProperties = { fontFamily: NUC.display, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg-mute)' }

/** Un dato del profilo: l'etichetta, e sotto il numero grande con l'unità
 *  piccola accanto ("76,2 KG"). Senza valore, un trattino grigio. */
function Dato({ k, v, unita, style }: { k: string; v: string | null; unita?: string; style?: CSSProperties }) {
  return (
    <div style={{ minWidth: 0, padding: '12px 14px 14px', ...style }}>
      <div style={ETICHETTA}>{k}</div>
      <div style={{
        marginTop: 6, fontFamily: NUC.display, fontWeight: 800, lineHeight: 1, textTransform: 'uppercase',
        color: v ? NUC.ink : 'var(--muted-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        <span style={{ fontSize: 'clamp(28px, 8.4vw, 36px)' }}>{v ?? '—'}</span>
        {v && unita && <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em', color: 'var(--fg-mute)', marginLeft: 4 }}>{unita}</span>}
      </div>
    </div>
  )
}

// ── La pesata ──────────────────────────────────────────────────
// Stava nella scheda Personal Coach, insieme a fabbisogno calorico e proteine.
// Quella parte è uscita dall'app; le pesate no, perché sono il denominatore di
// tutta la forza relativa — la mappa del corpo resta vuota senza — e sono la
// curva che un allenatore collegato guarda per prima.
//
// Il posto giusto è qui: il peso di oggi è già in "Dati generali" qui sopra, e
// tenere la misura e il suo storico in due schermate diverse era il motivo per
// cui si finiva a correggere il campo a mano invece di registrare una pesata.
function PesoSection() {
  const t = useT()
  const weightLog = useJarvisStore(st => st.weightLog)
  const userWeight = useJarvisStore(st => st.userWeight)
  const [kg, setKg] = useState('')

  // Una pesata al giorno: risalvare oggi sovrascrive invece di accodare. E il
  // peso del profilo segue sempre l'ultima misura, così il resto dell'app legge
  // un valore solo e non deve scegliere fra due.
  const valore = parseFloat(kg)
  const valido = valore > 20 && valore < 400
  const registra = () => {
    if (!valido) return
    const date = todayISO()
    useJarvisStore.setState(st => ({
      weightLog: [...st.weightLog.filter(e => e.date !== date), { date, kg: valore }]
        .sort((a, b) => a.date.localeCompare(b.date)),
      userWeight: valore,
    }))
    setKg('')
  }

  const ultime = weightLog.slice(-14)
  const delta = ultime.length >= 2 ? ultime[ultime.length - 1].kg - ultime[0].kg : null

  return (
    <section>
      <NucEyebrow style={{ marginBottom: 6 }}>{t('Pesata di oggi')}</NucEyebrow>
      <div style={{ fontFamily: NUC.font, fontSize: 13, lineHeight: 1.45, color: 'var(--fg-mute)', marginBottom: 12 }}>
        {t('Ogni mattina, appena sveglio, a stomaco vuoto. Conta la direzione, non il numero.')}
      </div>

      {/* Il campo più stretto e "Registra" alla sua destra, sulla stessa riga.
          Nel campo, in grigio, l'ultimo peso: è il numero da cui si parte. */}
      <div style={{ display: 'flex', gap: 12 }}>
        <label className="j-campo-riquadro" style={{
          flex: 1, minWidth: 0, height: 56, display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 14px', background: 'var(--surface)', border: 'var(--bordo)', cursor: 'text',
        }}>
          <input
            type="number" inputMode="decimal" step="0.1"
            value={kg} onChange={e => setKg(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') registra() }}
            aria-label={t('Peso di oggi in kg')}
            placeholder={userWeight ? fmtNum(userWeight) : '—'}
            className="j-campo-grande"
            style={{ flex: 1, minWidth: 0, fontSize: 26 }}
          />
          <span aria-hidden style={{ ...ETICHETTA, fontSize: 13 }}>kg</span>
        </label>
        {/* Da spento NON è l'accento sbiadito: l'opacità vela testo e fondo
            insieme, e "REGISTRA" si leggerebbe male. Meglio un tasto grigio,
            che è anche più onesto — non è acceso a metà, aspetta un numero. */}
        <button
          onClick={registra} disabled={!valido}
          className={valido ? 'j-cta j-focus' : 'j-focus'}
          style={{
            flexShrink: 0, height: 56, padding: '0 18px',
            background: valido ? 'var(--j-accent)' : 'var(--surface)',
            border: valido ? 'var(--bordo)' : '2px solid var(--line)',
            color: valido ? 'var(--j-accent-fg)' : 'var(--muted-dark)',
            fontFamily: NUC.display, fontSize: 17, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
            cursor: valido ? 'pointer' : 'default',
          }}
        >{t('Registra')}</button>
      </div>

      {ultime.length >= 2 ? (
        <div style={{ ...CARD, padding: 12, marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: NUC.display, fontSize: 26, fontWeight: 800, lineHeight: 1, color: NUC.ink }}>
              {fmtNum(ultime[ultime.length - 1].kg)}<span style={{ ...ETICHETTA, fontSize: 12, marginLeft: 4 }}>kg</span>
            </span>
            {delta !== null && (
              <span style={{ ...ETICHETTA, textTransform: 'none', letterSpacing: '.02em', fontSize: 12.5, textAlign: 'right' }}>
                {delta > 0 ? '+' : ''}{t('{d} kg dalla prima delle {n} pesate', { d: fmtNum(Number(delta.toFixed(1))), n: ultime.length })}
              </span>
            )}
          </div>
          <LineChart
            data={ultime.map(e => e.kg)}
            labels={ultime.map(e => fmtDayMonth(e.date))}
            pointLabels={ultime.map(e => fmtNum(e.kg))}
            height={104} color="var(--ink)" yAxis labelSize={9}
            yFormat={v => v.toFixed(1)}
          />
        </div>
      ) : (
        // Il posto dove comparirà il grafico, tratteggiato finché è vuoto.
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, padding: '14px 16px',
          border: '1.5px dashed var(--muted-dark)', color: 'var(--fg-mute)',
          fontFamily: NUC.font, fontSize: 13.5, lineHeight: 1.45,
        }}>
          <span style={{ display: 'flex', flexShrink: 0, color: NUC.ink }}><Icons.trend size={18} stroke={1.9}/></span>
          {ultime.length === 1
            ? t('Con una seconda pesata qui compare la direzione.')
            : t('Registra la prima pesata: dalla seconda qui compare la direzione.')}
        </div>
      )}
    </section>
  )
}

// ── Svuota le alzate ───────────────────────────────────────────
// Azzerare lo storico di un esercizio si poteva già fare, ma un esercizio alla
// volta: dopo un lungo stop, o passando a un altro modo di allenarsi, servivano
// venti conferme per rimettere a zero i numeri.
//
// Quello che NON tocca è tutto il resto: gli esercizi restano in lista con nome,
// gruppo muscolare e colore, e con loro schede, dati personali, pesate e sessioni
// Hyrox. Si cancellano le alzate, non la palestra.
function SvuotaAlzateSection() {
  const t = useT()
  const { confirmDelete } = useConfirmDelete()
  const palestra = useJarvisStore(st => st.palestraExercises)
  const totale = palestra.reduce((n, ex) => n + ex.history.length, 0)

  // Da tastiera: lo stesso, ma dopo un dialogo (vedi TieniPremuto).
  const svuota = () => confirmDelete(
    () => azzera(),
    t('tutte le alzate'),
    {
      eyebrow: t('Svuota memoria'),
      title: t('Cancellare tutte le alzate?'),
      body: t('Cancelli {quante} di tutti gli esercizi, e con esse massimali, record e grafici. Restano gli esercizi, le schede, i tuoi dati e le pesate. L’azione è definitiva.', {
        quante: totale === 1 ? t('l’unica alzata') : t('tutte le {n} alzate', { n: totale }),
      }),
      cta: t('Sì, svuota'),
    },
  )

  const azzera = () => useJarvisStore.setState(st => ({
    // `current` torna vuoto insieme allo storico: è il pre-compilato del
    // prossimo log, e lasciarlo sui carichi cancellati li farebbe rientrare
    // dalla finestra alla prima alzata registrata.
    palestraExercises: st.palestraExercises.map(ex => ({
      ...ex, history: [], current: { kg: 0, reps: 0, sets_n: 0 },
    })),
  }))

  return (
    <div style={{ padding: 14 }}>
      <div style={TITOLO_RIGA}>{t('Memoria delle alzate')}</div>
      <div style={SOTTO_RIGA}>{t('Azzera lo storico di tutti gli esercizi. Esercizi, schede, dati personali e pesate restano dove sono.')}</div>
      <div style={{ marginTop: 12 }}>
        <TieniPremuto
          etichetta={totale === 0 ? t('Nessuna alzata registrata') : totale === 1 ? t('Svuota 1 alzata') : t('Svuota {n} alzate', { n: totale })}
          disabled={totale === 0}
          onFatto={azzera}
          onTastiera={svuota}
        />
      </div>
    </div>
  )
}

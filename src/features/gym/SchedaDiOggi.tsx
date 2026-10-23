// La sezione "Schede" della home: la scheda da fare oggi, e il tasto per
// cominciare. Ha preso il posto dei gruppi muscolari, che adesso si aprono dalla
// card "Esercizi" (rebranding, ott 2026): aprendo l'app la domanda è "cosa
// faccio oggi?", non "in che gruppo sta la panca".
//
// Quale scheda lo decide `schedaDiOggi` (anteprimaScheda.ts): la prossima del
// giro, cioè quella che non si fa da più tempo.
import { useMemo, type CSSProperties } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { NucEyebrow } from '@/components/ui/NucComponents'
import { useJarvisStore } from '@/store/useJarvisStore'
import { useT, tData } from '@/lib/i18n'
import { todayISO } from '@/lib/isoDate'
import { idUtenteSuDisco } from '@/lib/supabase'
import { schedeRicevuteInCache } from '@/lib/coach'
import { quantoFa } from './gymModel'
import { schedaDiOggi, muscoliDellaScheda, durataPrevista, durataArrotondata, serieDellaScheda } from './anteprimaScheda'
import { sessioneAperta } from './sessioneInCorso'

export function SezioneSchede({ onTutte, onAvvia }: {
  /** Apre l'elenco di tutte le schede. */
  onTutte: () => void
  /** Apre la scheda: `subito` = dritti nell'allenamento, altrimenti sul
   *  dettaglio (c'è un altro allenamento aperto, e lì si chiede cosa farne). */
  onAvvia: (schedaId: string, subito: boolean) => void
}) {
  const t = useT()
  const { gymSchede, palestraExercises } = useJarvisStore(useShallow(st => ({
    gymSchede: st.gymSchede,
    palestraExercises: st.palestraExercises,
  })))

  // Quelle del coach dall'ultima lettura salvata sul telefono, come fa la barra
  // dell'allenamento in corso: la home non aspetta la rete per dire cosa fare.
  const oggi = useMemo(() => {
    const io = idUtenteSuDisco()
    const ricevute = io ? schedeRicevuteInCache(io).map(r => r.scheda) : []
    return schedaDiOggi([...ricevute, ...(gymSchede ?? [])], palestraExercises, todayISO())
  }, [gymSchede, palestraExercises])

  const titolo = (
    <NucEyebrow right={
      // Un tastino col bordo, come "+ Nuova" e "Modifica" altrove: scritto e
      // basta, accanto al titolo, si leggeva come parte del titolo.
      <button onClick={onTutte} className="j-hard j-focus" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 12px',
        background: 'var(--surface)', border: 'var(--bordo)', cursor: 'pointer',
        fontFamily: NUC.display, fontSize: 14, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: NUC.ink,
      }}>
        {t('Tutte')} <Icons.arrow size={15} stroke={2.4}/>
      </button>
    }>
      {t('Schede')}
    </NucEyebrow>
  )

  if (!oggi) {
    return (
      <section style={{ marginBottom: 26 }}>
        {titolo}
        <div style={{ background: 'var(--surface)', border: 'var(--bordo)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontFamily: NUC.font, fontSize: 15, lineHeight: 1.45, color: 'var(--fg-soft)' }}>
            {t('Nessuna scheda. Scrivine una: da qui ti dirà ogni giorno quale tocca.')}
          </div>
          <button onClick={onTutte} className="j-btn-accent" style={{ marginTop: 0 }}>{t('Crea una scheda')}</button>
        </div>
      </section>
    )
  }

  const { scheda, fattaOggi, giorniFa } = oggi
  const muscoli = muscoliDellaScheda(scheda, palestraExercises)
  const principale = tData(muscoli[0]?.muscolo ?? scheda.title)
  const altri = muscoli.slice(1, 4).map(m => tData(m.muscolo))
  const esercizi = scheda.exercises.filter(e => e.name.trim()).length
  const serie = serieDellaScheda(scheda)
  const minuti = Math.round(durataArrotondata(durataPrevista(scheda)) / 60)

  // Un altro allenamento aperto, con qualcosa dentro: si passa dal dettaglio,
  // dove si chiede se chiuderlo. Quello di questa scheda si riprende e basta.
  const aperta = sessioneAperta()
  const altraAperta = !!aperta && aperta.schedaId !== scheda.id && !aperta.vuota
  const inCorso = !!aperta && aperta.schedaId === scheda.id

  const numero = (valore: string, etichetta: string) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: NUC.display, fontSize: 36, fontWeight: 700, lineHeight: 1, color: 'var(--surface)' }}>{valore}</div>
      <div style={{ fontFamily: NUC.display, fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted-dark)', marginTop: 4 }}>{etichetta}</div>
    </div>
  )

  return (
    <section style={{ marginBottom: 26 }}>
      {titolo}
      {/* La card "Oggi": piena d'inchiostro, l'unica nera della home. */}
      <div style={{ background: 'var(--ink)', border: 'var(--bordo)', padding: '16px 16px 18px', color: 'var(--surface)' }}>
        <div style={{ fontFamily: NUC.display, fontSize: 15, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--j-accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fattaOggi ? t('Oggi · {scheda} · fatta', { scheda: scheda.title }) : t('Oggi · {scheda}', { scheda: scheda.title })}
        </div>
        {/* Il gruppo principale, grande quanto ci sta: 76px, meno se il nome è
            lungo («Tricipiti» a 76px non entra in una card da telefono). */}
        <div style={{ containerType: 'inline-size', marginTop: 8 } as CSSProperties}>
          <div style={{
            fontFamily: NUC.display, fontWeight: 800, lineHeight: .85, letterSpacing: '-0.01em', textTransform: 'uppercase',
            fontSize: `min(76px, calc(100cqw / ${Math.max(principale.length, 4) * 0.5}))`,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {principale}
          </div>
        </div>
        <div style={{ fontFamily: NUC.font, fontSize: 13, lineHeight: 1.4, color: 'var(--muted-dark)', marginTop: 8 }}>
          {altri.length > 0 && <>+ {altri.join(' · ')} · </>}
          {giorniFa === null ? t('mai fatta') : t('ultima volta {quando}', { quando: quantoFa(giorniFa, t) })}
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10,
          marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line-dark)',
        }}>
          {numero(String(esercizi), esercizi === 1 ? t('esercizio') : t('esercizi'))}
          {numero(String(serie), t('serie'))}
          {numero(minuti ? `${minuti}'` : '—', t('minuti'))}
        </div>
      </div>

      {/* Il CTA: l'unica ombra della home, sul fondo cemento sotto la card. */}
      {fattaOggi ? (
        <button onClick={() => onAvvia(scheda.id, false)} className="j-btn-log" style={{ marginTop: 12 }}>
          <Icons.check size={16} stroke={2.4}/> {t('Fatta oggi · apri la scheda')}
        </button>
      ) : (
        <button onClick={() => onAvvia(scheda.id, !altraAperta)} className="j-btn-accent" style={{ marginTop: 12 }}>
          {inCorso ? t('Riprendi allenamento') : t('Inizia allenamento')} <Icons.arrow size={22} stroke={2.4}/>
        </button>
      )}
    </section>
  )
}

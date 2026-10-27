// La sezione "Schede" della home: la scheda da fare oggi, e il tasto per
// cominciare. Ha preso il posto dei gruppi muscolari, che adesso si aprono dalla
// card "Esercizi" (rebranding, ott 2026): aprendo l'app la domanda è "cosa
// faccio oggi?", non "in che gruppo sta la panca".
//
// Quale scheda lo decide `schedaDiOggi` (anteprimaScheda.ts, letta da
// `useSchedaDiOggi` in gymHooks): la prossima del giro, cioè quella che non si fa
// da più tempo.
import { useState, type CSSProperties } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { NucEyebrow } from '@/components/ui/NucComponents'
import { useJarvisStore } from '@/store/useJarvisStore'
import { useT, tData } from '@/lib/i18n'
import { quantoFa } from './gymModel'
import { muscoliDellaScheda, durataPrevista, durataArrotondata, serieDellaScheda } from './anteprimaScheda'
import { sessioneAperta, allenamentoInCorso, scartaSessione } from './sessioneInCorso'
import { useSchedaDiOggi } from './gymHooks'

/** Lo stacco fra la card e il tasto, e fra il titolo e la card: segue l'altezza
 *  dello schermo come gli altri respiri della home. */
const STACCO = 'clamp(8px, 1.4dvh, 12px)'

// Un tastino col bordo, come "+ Nuova" e "Modifica" altrove: scritto e basta,
// accanto al titolo, si leggeva come parte del titolo.
const TASTINO: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 clamp(8px, 2.6vw, 12px)',
  background: 'var(--surface)', border: 'var(--bordo)', cursor: 'pointer', whiteSpace: 'nowrap',
  fontFamily: NUC.display, fontSize: 14, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: NUC.ink,
}

export function SezioneSchede({ onTutte, onAvvia, onChiudi }: {
  /** Apre l'elenco di tutte le schede. */
  onTutte: () => void
  /** Apre la scheda: `subito` = dritti nell'allenamento, altrimenti sul
   *  dettaglio (c'è un altro allenamento aperto, e lì si chiede cosa farne). */
  onAvvia: (schedaId: string, subito: boolean) => void
  /** «Chiudi allenamento» su un allenamento con delle serie fatte: si apre il
   *  suo riepilogo, dove si sceglie se salvarlo o no — lo stesso di «Termina». */
  onChiudi: (schedaId: string) => void
}) {
  const t = useT()
  const palestraExercises = useJarvisStore(st => st.palestraExercises)
  const oggi = useSchedaDiOggi()
  // Lo scarto non tocca lo store: è questo a far rileggere il disco.
  const [, ridisegna] = useState(0)

  // Un altro allenamento aperto, con qualcosa dentro: si passa dal dettaglio,
  // dove si chiede se chiuderlo. Quello di questa scheda si riprende e basta.
  const aperta = sessioneAperta()
  const inCorso = !!oggi && !!aperta && aperta.schedaId === oggi.scheda.id

  // Chi ha toccato «Inizia» ed è tornato indietro trovava solo «Riprendi»: per
  // chiudere doveva rientrare e passare da «Termina». Avviato e mai toccato si
  // chiude e basta — non c'è niente da salvare né da perdere.
  const chiudi = () => {
    if (!aperta) return
    if (aperta.vuota) { scartaSessione(); ridisegna(n => n + 1); return }
    onChiudi(aperta.schedaId)
  }

  const titolo = (
    <NucEyebrow style={{ marginBottom: STACCO, flexShrink: 0 }} right={
      <span style={{ display: 'flex', gap: 'clamp(6px, 2vw, 8px)' }}>
        {/* Sotto i 360px, accanto a «Schede» e a «Tutte», il nome intero non
            ci sta e tagliava il titolo: lì dice «Chiudi» (vedi .j-chiudi-corto). */}
        {inCorso && (
          <button onClick={chiudi} aria-label={t('Chiudi allenamento')} className="j-hard j-focus" style={TASTINO}>
            <span className="j-chiudi-lungo">{t('Chiudi allenamento')}</span>
            <span className="j-chiudi-corto">{t('Chiudi')}</span>
          </button>
        )}
        <button onClick={onTutte} className="j-hard j-focus" style={TASTINO}>
          {t('Tutte')} <Icons.arrow size={15} stroke={2.4}/>
        </button>
      </span>
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

  const altraAperta = !!aperta && aperta.schedaId !== scheda.id && !aperta.vuota
  // Le serie fatte: le diceva la barra "Allenamento in corso" in cima alla home,
  // che per questa scheda non c'è più (vedi `tranne` in InCorsoInHome) — il tasto
  // qui sotto dice già "Riprendi", e le due insieme non stavano su un telefono.
  // Solo per quello di oggi: uno di un altro giorno rimasto aperto lo annuncia
  // ancora la barra, col suo giorno.
  const avanzamento = inCorso && !fattaOggi ? allenamentoInCorso(id => (id === scheda.id ? scheda : undefined)) : undefined
  const inCorsoOggi = !!avanzamento && !avanzamento.vecchia

  const numero = (valore: string, etichetta: string) => (
    <div className="j-oggi-cifra">
      <div className="j-oggi-numero">{valore}</div>
      <div className="j-oggi-etichetta">{etichetta}</div>
    </div>
  )

  return (
    // Prende tutto lo spazio che la home le lascia sotto le tre card (vedi la
    // colonna in JarvisGym), e dentro se lo prende la card nera: è lei che si
    // stringe sui telefoni bassi, non il tasto che finisce sotto il bordo.
    <section style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column' }}>
      {titolo}
      {/* La card "Oggi": misure e regole in `.j-oggi` (globals.css). */}
      <div className="j-oggi">
        <div className="j-oggi-corpo">
          <div style={{ minWidth: 0 }}>
            <div className="j-oggi-occhiello">
              {fattaOggi ? t('Oggi · {scheda} · fatta', { scheda: scheda.title })
                : inCorsoOggi ? t('In corso · {scheda}', { scheda: scheda.title })
                : t('Oggi · {scheda}', { scheda: scheda.title })}
            </div>
            <div className="j-oggi-nome" style={{ '--oggi-em': Math.max(principale.length, 4) * 0.5 } as CSSProperties}>
              {principale}
            </div>
            <div className="j-oggi-dettaglio">
              {altri.length > 0 && <>+ {altri.join(' · ')} · </>}
              {avanzamento && inCorsoOggi ? t('{fatte}/{totali} serie fatte', { fatte: avanzamento.fatte, totali: avanzamento.totali })
                : giorniFa === null ? t('mai fatta') : t('ultima volta {quando}', { quando: quantoFa(giorniFa, t) })}
            </div>
          </div>
          <div className="j-oggi-numeri">
            {numero(String(esercizi), esercizi === 1 ? t('esercizio') : t('esercizi'))}
            {numero(String(serie), t('serie'))}
            {numero(minuti ? `${minuti}'` : '—', t('minuti'))}
          </div>
        </div>
      </div>

      {/* Il CTA: l'unica ombra della home, sul fondo cemento sotto la card. Un
          poco più basso sui telefoni bassi, mai sotto i 50px. */}
      {fattaOggi ? (
        <button onClick={() => onAvvia(scheda.id, false)} className="j-btn-log" style={{ marginTop: STACCO, flexShrink: 0 }}>
          <Icons.check size={16} stroke={2.4}/> {t('Fatta oggi · apri la scheda')}
        </button>
      ) : (
        // Un allenamento di un ALTRO giorno rimasto aperto non si riprende alla
        // cieca: quello che si fa oggi finirebbe sotto quel giorno. Si passa dal
        // dettaglio, che chiede se chiuderlo o scartarlo e ricominciare.
        <button onClick={() => onAvvia(scheda.id, !altraAperta && !aperta?.vecchia)} className="j-btn-accent" style={{ marginTop: STACCO, height: 'clamp(50px, 7.6dvh, 60px)', flexShrink: 0 }}>
          {inCorso ? t('Riprendi allenamento') : t('Inizia allenamento')} <Icons.arrow size={22} stroke={2.4}/>
        </button>
      )}
    </section>
  )
}

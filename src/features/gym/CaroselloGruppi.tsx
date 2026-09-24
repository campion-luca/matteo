// ── Il carosello dei gruppi muscolari ──────────────────────────
// Una card grande per gruppo, piena del suo colore, con la figura del corpo e
// il distretto acceso; si sfoglia di lato e la card dopo spunta dal bordo, così
// si capisce subito che ce ne sono altre. Sotto, i puntini dicono dove si è.
//
// È la vista di partenza dei gruppi (vedi `vistaGruppiIniziale`); griglia ed
// elenco restano dietro l'interruttore accanto al titolo.
//
// ── Perché i colori PIENI anche in Premium ──
// Premium spegne i colori dei dati in grigio (`useMono`), e per le macchie
// piccole — il filetto di una riga, un'icona — è la regola giusta. Qui però il
// colore È la card: in grigio le otto card diventerebbero otto rettangoli
// uguali, che è l'opposto di quello che il carosello deve fare. Chi lo monta gli
// passa la mappa grezza.
//
// ── Lo scorrimento lo fa il browser ──
// `scroll-snap` e nessuna libreria: il dito trascina, il browser aggancia la card
// più vicina, e l'unico JavaScript è quello che legge a quale card si è arrivati
// per accendere il puntino. Nessun transform animato a mano, niente da
// ricomporre a ogni fotogramma.
import { useRef, useState, useCallback, type CSSProperties } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { MuscleIcon } from './MuscleIcons'
import { useT, useTData } from '@/lib/i18n'
import { fmtDayMonthFull } from '@/lib/dateFormat'
import { todayISO } from '@/lib/isoDate'
import type { PalestraExercise } from '@/store/useJarvisStore'

const GAP = 12

/** L'ultimo giorno in cui si è allenato un esercizio del gruppo, o `null`. */
function ultimaVolta(items: PalestraExercise[]): string | null {
  let max: string | null = null
  for (const ex of items) for (const h of ex.history) {
    if (h.date && (!max || h.date > max)) max = h.date
  }
  return max
}

function ieri(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function CaroselloGruppi({ gruppi, colori, icone, indice, onIndice, onApri, onNuovo }: {
  gruppi: Array<{ muscle: string; items: PalestraExercise[] }>
  /** I colori GREZZI dei gruppi, non desaturati: vedi il commento in testa. */
  colori: Record<string, string>
  icone: Record<string, string>
  /** La card in vista: la tiene chi monta il carosello, che la scrive accanto
   *  al titolo ("1 / 8"). */
  indice: number
  onIndice: (i: number) => void
  onApri: (muscle: string) => void
  onNuovo: () => void
}) {
  const t = useT()
  const tData = useTData()
  const nastro = useRef<HTMLDivElement>(null)
  const [oggi] = useState(todayISO)
  const [ieriIso] = useState(ieri)

  // A che card si è: la posizione diviso il passo (una card più lo spazio). Si
  // scrive solo quando cambia, così scorrere non ridisegna niente fra un
  // aggancio e l'altro.
  const alloScorrere = useCallback(() => {
    const el = nastro.current
    const prima = el?.firstElementChild as HTMLElement | null
    if (!el || !prima) return
    const i = Math.round(el.scrollLeft / (prima.offsetWidth + GAP))
    const giusto = Math.max(0, Math.min(gruppi.length - 1, i))
    if (giusto !== indice) onIndice(giusto)
  }, [gruppi.length, indice, onIndice])

  const vaiA = (i: number) => {
    const el = nastro.current
    const card = el?.children[i] as HTMLElement | undefined
    // `offsetLeft` è misurato dal nastro (che è `position: relative`) e comprende
    // i 20px di margine interno: tolti quelli, la card si aggancia al bordo.
    if (el && card) el.scrollTo({ left: card.offsetLeft - 20, behavior: 'smooth' })
  }

  const card: CSSProperties = {
    flex: '0 0 auto',
    width: 'min(76%, 320px)',
    height: 'clamp(230px, 38dvh, 340px)',
    scrollSnapAlign: 'start',
    borderRadius: 'var(--radius-lg)',
    position: 'relative', overflow: 'hidden',
    padding: 0, border: 'none', cursor: 'pointer', textAlign: 'left',
  }

  return (
    <div>
      <div
        ref={nastro}
        onScroll={alloScorrere}
        style={{
          position: 'relative',
          display: 'flex', gap: GAP,
          overflowX: 'auto', overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          // A filo dei bordi dello schermo: la card dopo deve spuntare dal
          // bordo vero, non fermarsi al margine della pagina.
          margin: '0 -20px', padding: '0 20px 4px', scrollPaddingInline: 20,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {gruppi.map(({ muscle, items }) => {
          const c = colori[muscle] ?? colori.Altro ?? '#8a7440'
          // Il fondo è il colore schiarito verso il bianco, l'inchiostro lo stesso
          // colore scurito verso il nero: una sola tinta per card, a due altezze.
          // Con qualsiasi colore di gruppo il testo sta ben sopra 7:1.
          const fondo = `color-mix(in srgb, ${c} 52%, #fff)`
          const inchiostro = `color-mix(in srgb, ${c} 22%, #000)`
          const quando = ultimaVolta(items)
          const data = !quando ? null
            : quando === oggi ? t('oggi')
            : quando === ieriIso ? t('ieri')
            : fmtDayMonthFull(quando)
          return (
            <button key={muscle} onClick={() => onApri(muscle)} className="j-carosello-card j-focus" style={{ ...card, background: fondo, color: inchiostro }}>
              {/* La figura occupa la metà destra, alta quanto la card: è il
                  soggetto, il testo le sta davanti in basso a sinistra. */}
              <div aria-hidden style={{
                position: 'absolute', top: '5%', bottom: '5%', right: '-2%', width: '62%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <MuscleIcon
                  muscle={muscle} icon={icone[muscle]} size={200}
                  color={inchiostro}
                  acceso={`color-mix(in srgb, ${c} 45%, #000)`}
                  style={{ height: '100%', width: 'auto', maxWidth: '100%', opacity: 0.9 }}
                />
              </div>
              <div style={{ position: 'absolute', left: 18, right: 18, bottom: 16 }}>
                <div style={{ fontFamily: NUC.label, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' }}>
                  {items.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: items.length })}
                </div>
                <div style={{
                  fontFamily: NUC.font, fontSize: 'clamp(28px, 9vw, 40px)', fontWeight: 700,
                  lineHeight: 1.05, letterSpacing: '-.01em', marginTop: 4,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{tData(muscle)}</div>
                <div style={{ fontFamily: NUC.label, fontSize: 12, marginTop: 5, opacity: 0.85 }}>
                  {data ? t('Ultima volta: {data}', { data }) : t('Mai allenato')}
                </div>
              </div>
            </button>
          )
        })}

        {/* Ultima, come nelle altre due viste: i gruppi sono otto o poco più e
            la card per crearne uno nuovo è quella che si cerca di meno. */}
        <button onClick={onNuovo} className="j-carosello-card j-focus" style={{
          ...card, background: 'transparent', border: '1.5px dashed var(--hairline)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
          color: 'var(--fg-mute)', textAlign: 'center',
        }}>
          <Icons.plus size={28} stroke={1.8}/>
          <span style={{ fontFamily: NUC.font, fontSize: 15 }}>{t('Nuovo gruppo')}</span>
        </button>
      </div>

      {/* I puntini: dove si è, e un tocco per saltare. Quello acceso è una
          pillola — più largo, non solo più chiaro — perché un cambio di sola
          luminosità fra puntini da 6px non si vede sotto il sole. */}
      <div role="tablist" aria-label={t('Gruppi muscolari')} style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
        {gruppi.map(({ muscle }, i) => {
          const on = i === indice
          return (
            <button
              key={muscle} role="tab" aria-selected={on} aria-label={tData(muscle)}
              onClick={() => vaiA(i)}
              className="j-hit"
              style={{
                width: on ? 18 : 6, height: 6, padding: 0, border: 'none', cursor: 'pointer',
                borderRadius: 'var(--radius-pill)',
                background: on ? 'var(--fg)' : 'var(--fg-mute)', opacity: on ? 1 : 0.45,
                transition: 'width 160ms var(--ease)',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

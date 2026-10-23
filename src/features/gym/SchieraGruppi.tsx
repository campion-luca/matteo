// ── Le card dei gruppi muscolari ───────────────────────────────
// Una card per gruppo, piena del suo colore, con la figura del corpo e il
// distretto acceso; tutte in vista, una griglia che scende invece di un
// carosello da sfogliare di lato. Sul telefono due per riga, da desktop una
// fila sola di card più strette.
//
// Era un carosello (una card grande alla volta, la successiva che spuntava dal
// bordo, i puntini sotto): chiesto di toglierlo a ottobre 2026, prima da
// desktop e poi anche sul telefono. Bisognava sfogliare otto card per vedere
// che gruppi c'erano.
//
// È la vista di partenza dei gruppi (vedi `vistaGruppiIniziale`, dove si chiama
// ancora 'carosello' perché è il valore salvato sui telefoni); la griglia
// piccola e l'elenco restano dietro l'interruttore accanto al titolo.
import { useState, type CSSProperties } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { MuscleIcon } from './MuscleIcons'
import { useT, useTData } from '@/lib/i18n'
import { fmtDayMonthFull } from '@/lib/dateFormat'
import { todayISO } from '@/lib/isoDate'
import type { PalestraExercise } from '@/store/useJarvisStore'

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

/** I toni di una card, dal colore del suo gruppo. Il fondo è il colore schiarito
 *  verso il bianco, l'inchiostro lo stesso colore scurito verso il nero: una
 *  sola tinta per card, a due altezze. Con qualsiasi colore di gruppo il testo
 *  sta ben sopra 7:1. `acceso` è il distretto sulla figura. */
function toni(colori: Record<string, string>, muscle: string) {
  const c = colori[muscle] ?? colori.Altro ?? '#8a7440'
  return {
    fondo: `color-mix(in srgb, ${c} 52%, #fff)`,
    inchiostro: `color-mix(in srgb, ${c} 22%, #000)`,
    acceso: `color-mix(in srgb, ${c} 45%, #000)`,
  }
}

/** "Ultima volta: ieri", oppure "Mai allenato": quando si è lavorato un gruppo. */
function useQuando(): (items: PalestraExercise[]) => string {
  const t = useT()
  const [oggi] = useState(todayISO)
  const [ieriIso] = useState(ieri)
  return items => {
    const quando = ultimaVolta(items)
    if (!quando) return t('Mai allenato')
    const data = quando === oggi ? t('oggi') : quando === ieriIso ? t('ieri') : fmtDayMonthFull(quando)
    return t('Ultima volta: {data}', { data })
  }
}

/** Quante card tiene una riga da desktop, al massimo. In una pagina larga 860px
 *  nove sono card da 84: più strette, il nome di un gruppo non ci sta. */
const PER_RIGA = 9

export function SchieraGruppi({ gruppi, colori, icone, onApri, onNuovo, colonne }: {
  gruppi: Array<{ muscle: string; items: PalestraExercise[] }>
  /** I colori dei gruppi. */
  colori: Record<string, string>
  icone: Record<string, string>
  onApri: (muscle: string) => void
  onNuovo: () => void
  /** Quante per riga. Sul telefono 2, e allora c'è spazio anche per "Ultima
   *  volta"; senza, da desktop, una fila sola (o righe pari, vedi sotto) e
   *  "Ultima volta" va nel suggerimento sotto il puntatore. */
  colonne?: number
}) {
  const t = useT()
  const tData = useTData()
  const quando = useQuando()
  const larghe = colonne !== undefined

  // Da desktop gli otto gruppi di serie più "Nuovo gruppo" fanno una riga sola.
  // Chi ne ha creati altri va a capo, ma in righe pari: dieci card sono cinque
  // e cinque, non nove e una rimasta sola.
  const tessere = gruppi.length + 1
  const righe = Math.ceil(tessere / PER_RIGA)
  const perRiga = colonne ?? Math.ceil(tessere / righe)

  const tessera: CSSProperties = {
    minWidth: 0,
    // Sul telefono quasi quadrate; da desktop in `dvh`, perché la fila deve
    // finire sopra il bordo della finestra.
    ...(larghe ? { aspectRatio: '1 / 1.08' } : { height: 'clamp(132px, 24dvh, 220px)' }),
    boxSizing: 'border-box',
    borderRadius: 'var(--radius)',
    position: 'relative', overflow: 'hidden',
    padding: 0, border: 'var(--bordo)', cursor: 'pointer', textAlign: 'left',
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${perRiga}, minmax(0, 1fr))`, gap: larghe ? 12 : 8 }}>
      {gruppi.map(({ muscle, items }) => {
        const { fondo, inchiostro, acceso } = toni(colori, muscle)
        return (
          <button key={muscle} onClick={() => onApri(muscle)} title={quando(items)} className="j-carosello-card j-focus" style={{ ...tessera, background: fondo, color: inchiostro }}>
            {/* La figura prende tutto quello che il testo lascia libero. */}
            <div aria-hidden style={{
              position: 'absolute', top: '7%', bottom: larghe ? 70 : 46, left: 0, right: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MuscleIcon
                muscle={muscle} icon={icone[muscle]} size={120}
                color={inchiostro}
                acceso={acceso}
                style={{ height: '100%', width: 'auto', maxWidth: '100%', opacity: 0.9 }}
              />
            </div>
            <div style={{ position: 'absolute', left: larghe ? 12 : 8, right: larghe ? 12 : 8, bottom: larghe ? 11 : 9 }}>
              <div style={{
                fontFamily: NUC.display, fontSize: larghe ? 12 : 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {items.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: items.length })}
              </div>
              <div style={{
                fontFamily: NUC.display, fontSize: larghe ? 22 : 15, fontWeight: 800, textTransform: 'uppercase',
                lineHeight: 1.05, marginTop: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{tData(muscle)}</div>
              {/* Sul telefono il suggerimento sotto il puntatore non c'è: la
                  data si scrive. */}
              {larghe && (
                <div style={{
                  fontFamily: NUC.font, fontSize: 12, marginTop: 2, opacity: 0.85,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{quando(items)}</div>
              )}
            </div>
          </button>
        )
      })}

      {/* Ultima: un gruppo nuovo. */}
      <button onClick={onNuovo} className="j-carosello-card j-focus" style={{
        ...tessera, background: 'transparent', border: '1.5px dashed var(--muted-dark)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '0 6px', color: 'var(--fg-mute)', textAlign: 'center',
      }}>
        <Icons.plus size={22} stroke={1.8}/>
        <span style={{ fontFamily: NUC.display, fontSize: larghe ? 15 : 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', lineHeight: 1.2 }}>{t('Nuovo gruppo')}</span>
      </button>
    </div>
  )
}

// La tecnica allenante di una riga, nel form della scheda (vedi tecniche).
// Quattro scelte in due file da due — in una fila sola, a 320px, «Eccentrica
// lenta» non ci stava — e sotto, scelta una, cosa si fa e su quali serie.
// Ritoccarla la toglie: è facoltativa, e la maggior parte delle righe non ne ha.
import { NUC } from '@/lib/jarvis-tokens'
import { useT } from '@/lib/i18n'
import type { TecnicaRiga } from '@/store/useJarvisStore'
import { Scelte } from './FormProgressione'
import { ETICHETTA, SPIEGA } from './stiliForm'
import { TIPI_TECNICA, tecnicaNuova, testiTecnica } from './tecniche'

export function CampoTecnica({ valore, onChange, backoff }: {
  valore: TecnicaRiga | undefined
  onChange: (t: TecnicaRiga | undefined) => void
  /** La riga va a top set, con tante back-off: la tecnica sta su quelle, mai
   *  sul top set (vedi tecniche). Assente su ogni altra riga. */
  backoff?: number
}) {
  const t = useT()
  const scelta = valore ? testiTecnica(valore.tipo, t) : null
  return (
    <div style={{ marginTop: 14 }}>
      <div style={ETICHETTA}>{t('Tecnica allenante')} · {t('facoltativa')}</div>
      <div role="group" aria-label={t('Tecnica allenante')} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', border: 'var(--bordo)' }}>
        {TIPI_TECNICA.map((tipo, i) => {
          const accesa = valore?.tipo === tipo
          return (
            <button
              key={tipo} type="button" aria-pressed={accesa}
              onClick={() => onChange(accesa ? undefined : tecnicaNuova(tipo))}
              className="j-focus"
              style={{
                minHeight: 44, padding: '4px 6px', cursor: 'pointer', border: 'none',
                borderLeft: i % 2 ? 'var(--bordo)' : 'none', borderTop: i >= 2 ? 'var(--bordo)' : 'none',
                background: accesa ? 'var(--ink)' : 'var(--surface)', color: accesa ? 'var(--surface)' : NUC.ink,
                fontFamily: NUC.display, fontSize: 13, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', lineHeight: 1.1,
              }}
            >
              {testiTecnica(tipo, t).nome}
            </button>
          )
        })}
      </div>
      {valore && scelta && (
        <>
          <div style={{ ...SPIEGA, color: NUC.ink }}>{scelta.come}</div>
          <div style={{ marginTop: 10 }}>
            <Scelte
              valori={['ultima', 'tutte'] as const}
              etichette={{ ultima: t('Sull’ultima serie'), tutte: backoff === undefined ? t('Su tutte le serie') : t('Su tutte le back-off') }}
              attivo={valore.serie}
              onScegli={serie => onChange({ ...valore, serie })}
              etichetta={t('Su quali serie')}
            />
          </div>
          {backoff !== undefined && (
            <div role="note" style={{ ...SPIEGA, color: backoff === 0 ? 'var(--j-accent-ink)' : NUC.ink }}>
              {backoff === 0
                ? t('Con il solo top set non c’è una serie su cui farla: aggiungi delle back-off. Sul top set no, perché è il suo RIR a dire se il carico sale.')
                : t('Sul top set no: è il suo RIR a dire se il carico sale. La tecnica va sulle back-off.')}
            </div>
          )}
          <div style={SPIEGA}>{t('Tocca di nuovo la tecnica per toglierla.')}</div>
        </>
      )}
    </div>
  )
}

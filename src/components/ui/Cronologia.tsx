// Il disegno della cronologia: anni, e dentro gli anni i mesi, ognuno con il
// suo numero di voci e una tendina. Il raggruppamento sta in lib/cronologia.ts.
//
// Aperti in partenza ci sono solo l'anno e il mese più recenti: è quello che si
// viene a guardare quasi sempre, e il resto chiuso è una riga per mese invece
// che tutte le righe di tutti i mesi. Il primo tocco su un'intestazione vince
// sulla regola, e la scelta resta finché la pagina è aperta — anche quando
// arriva una voce nuova, che non deve richiudere quello che si sta leggendo.
import { useState, type ReactNode, type CSSProperties } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { useT } from '@/lib/i18n'
import { fmtMese } from '@/lib/dateFormat'
import { perAnnoEMese } from '@/lib/cronologia'

const SENZA_DATA = 'senza-data'

function Freccia({ aperto }: { aperto: boolean }) {
  return (
    <span style={{ display: 'flex', color: NUC.faint, transform: aperto ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
      <Icons.chev size={12} stroke={2}/>
    </span>
  )
}

const CONTA: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
  fontFamily: NUC.label, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: NUC.faint,
}

const TESTATA: CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
}

export function Cronologia<T>({ voci, dataDi, chiaveDi, conta, voce, gruppo = c => c }: {
  /** Già nell'ordine in cui vanno lette dentro un mese (di solito dalla più recente). */
  voci: readonly T[]
  /** La data ISO della voce ("2026-09-23"); `undefined` per le voci senza giorno. */
  dataDi: (v: T) => string | undefined
  chiaveDi: (v: T) => string | number
  /** "3 sessioni", "1 alzata": il numero accanto all'anno e al mese. */
  conta: (n: number) => string
  /** Una voce. `primo` = la prima del suo mese, per chi disegna un filetto fra le righe. */
  voce: (v: T, primo: boolean) => ReactNode
  /** Il contenitore delle voci di un mese: una card, una colonna distanziata. */
  gruppo?: (contenuto: ReactNode) => ReactNode
}) {
  const t = useT()
  const { anni, senzaData } = perAnnoEMese(voci, dataDi)
  const [scelte, setScelte] = useState<Record<string, boolean>>({})

  const annoRecente = anni[0] ? `anno-${anni[0].anno}` : null
  const meseRecente = anni[0]?.mesi[0]?.chiave ?? null
  const aperto = (k: string) => scelte[k] ?? (
    k === annoRecente || k === meseRecente || (k === SENZA_DATA && anni.length === 0)
  )
  const cambia = (k: string) => setScelte(s => ({ ...s, [k]: !aperto(k) }))

  const elenco = (lista: T[]) => gruppo(lista.map((v, i) => <div key={chiaveDi(v)}>{voce(v, i === 0)}</div>))

  return (
    <div>
      {anni.map((a, ai) => {
        const ka = `anno-${a.anno}`
        const annoAperto = aperto(ka)
        return (
          <section key={ka} style={{ marginTop: ai === 0 ? 0 : 6 }}>
            <button
              onClick={() => cambia(ka)} aria-expanded={annoAperto} className="j-focus"
              style={{ ...TESTATA, padding: '8px 2px', borderBottom: '1px solid var(--hairline-soft)' }}
            >
              <span style={{ fontFamily: NUC.font, fontSize: 17, fontWeight: 500, color: NUC.ink, fontVariantNumeric: 'tabular-nums' }}>{a.anno}</span>
              <span style={CONTA}>{conta(a.totale)}<Freccia aperto={annoAperto}/></span>
            </button>

            {annoAperto && a.mesi.map(m => {
              const meseAperto = aperto(m.chiave)
              return (
                <div key={m.chiave}>
                  <button
                    onClick={() => cambia(m.chiave)} aria-expanded={meseAperto} className="j-focus"
                    style={{ ...TESTATA, padding: '11px 2px 8px' }}
                  >
                    <span style={{ fontFamily: NUC.label, fontSize: 10, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--tertiary-ink)' }}>
                      {fmtMese(m.mese)}
                    </span>
                    <span style={CONTA}>{conta(m.voci.length)}<Freccia aperto={meseAperto}/></span>
                  </button>
                  {meseAperto && elenco(m.voci)}
                </div>
              )
            })}
          </section>
        )
      })}

      {senzaData.length > 0 && (
        <section style={{ marginTop: anni.length ? 6 : 0 }}>
          <button
            onClick={() => cambia(SENZA_DATA)} aria-expanded={aperto(SENZA_DATA)} className="j-focus"
            style={{ ...TESTATA, padding: '8px 2px', borderBottom: '1px solid var(--hairline-soft)', marginBottom: aperto(SENZA_DATA) ? 6 : 0 }}
          >
            <span style={{ fontFamily: NUC.font, fontSize: 15, fontWeight: 500, color: NUC.dim }}>{t('Senza data')}</span>
            <span style={CONTA}>{conta(senzaData.length)}<Freccia aperto={aperto(SENZA_DATA)}/></span>
          </button>
          {aperto(SENZA_DATA) && elenco(senzaData)}
        </section>
      )}
    </div>
  )
}

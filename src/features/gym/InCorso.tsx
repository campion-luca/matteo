// ── L'allenamento aperto, detto fuori dalla sua pagina ─────────
// Chi esce dall'allenamento per guardare altro deve sapere due cose senza
// doversele chiedere: che è rimasto aperto, e come ci si torna. Una barra sola,
// uguale in cima all'elenco delle schede e in cima alla home: un tocco e si è
// dove si era; il cestino lo butta via, chiedendo prima.
import { useState, type CSSProperties } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { useJarvisStore } from '@/store/useJarvisStore'
import { useT } from '@/lib/i18n'
import { fmtDayMon } from '@/lib/dateFormat'
import { localISO } from '@/lib/isoDate'
import { idUtenteSuDisco } from '@/lib/supabase'
import { schedaRicevutaInCache } from '@/lib/coach'
import { allenamentoInCorso, type AllenamentoInCorso } from './sessioneInCorso'
import { useScartaAllenamento } from './gymHooks'

export function BarraInCorso({ inCorso, onRiprendi, onScarta, style }: {
  inCorso: AllenamentoInCorso
  onRiprendi: () => void
  onScarta: () => void
  style?: CSSProperties
}) {
  const t = useT()
  return (
    <div className="flex items-center gap-2" style={{
      padding: '10px 10px 10px 14px', borderRadius: 'var(--radius)',
      background: 'color-mix(in srgb, var(--j-accent) 10%, var(--surface))', border: '1px solid var(--j-accent)',
      ...style,
    }}>
      <button onClick={onRiprendi} className="flex items-center gap-3" style={{
        flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ display: 'flex', flexShrink: 0, color: 'var(--j-accent-ink)' }}><Icons.play size={18}/></span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: NUC.label, fontSize: 9, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--j-accent-ink)' }}>
            {/* Di ieri o di prima: lo si dice, col giorno. Riprendendolo e
                chiudendolo finisce in QUEL giorno, non in quello di oggi. */}
            {inCorso.vecchia
              ? t('Allenamento non chiuso · {giorno}', { giorno: fmtDayMon(localISO(new Date(inCorso.iniziataA))) })
              : t('Allenamento in corso')}
          </span>
          <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 15, fontWeight: 500, color: NUC.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
            {inCorso.scheda.title}
          </span>
          <span style={{ display: 'block', fontFamily: NUC.label, fontSize: 10, color: NUC.faint, marginTop: 2 }}>
            {t('{fatte}/{totali} serie fatte · tocca per riprendere', { fatte: inCorso.fatte, totali: inCorso.totali })}
          </span>
        </span>
      </button>
      <button onClick={onScarta} aria-label={t('Scarta allenamento in corso')} title={t('Scarta allenamento in corso')} className="flex items-center justify-center" style={{
        width: 32, height: 32, flexShrink: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        background: 'var(--surface-2)', border: `1px solid ${NUC.hairline}`, color: NUC.dim,
      }}>
        <Icons.trash size={13} stroke={1.6}/>
      </button>
    </div>
  )
}

/** La barra in cima alla home: c'è solo con un allenamento aperto, e finché la
 *  sua scheda esiste. `onRiprendi` riceve l'id della scheda da riaprire. */
export function InCorsoInHome({ onRiprendi, style }: {
  onRiprendi: (schedaId: string) => void
  style?: CSSProperties
}) {
  const gymSchede = useJarvisStore(st => st.gymSchede)
  const scarta = useScartaAllenamento()
  // Lo scarto non tocca lo store: è questo a far rileggere il disco.
  const [, ridisegna] = useState(0)
  // Si rilegge a ogni giro, come nell'elenco delle schede: sono poche centinaia
  // di byte, e la home si ridisegna proprio quando ci si torna dall'allenamento.
  // Le schede dell'allenatore non stanno nello store: si cercano fra quelle
  // dell'ultima lettura, e solo se la scheda non è una delle proprie.
  const inCorso = allenamentoInCorso(id => {
    const mia = gymSchede?.find(x => x.id === id)
    if (mia) return mia
    const io = idUtenteSuDisco()
    return io ? schedaRicevutaInCache(io, id) : undefined
  })
  if (!inCorso) return null
  return (
    <BarraInCorso
      inCorso={inCorso}
      onRiprendi={() => onRiprendi(inCorso.scheda.id)}
      onScarta={() => scarta(() => ridisegna(n => n + 1), inCorso.vuota)}
      style={style}
    />
  )
}

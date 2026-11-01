// La card del rank nella pagina di un esercizio: la medaglia e quanto manca al
// prossimo. Dice sempre il prossimo passo: è lì per far venire voglia di
// migliorare, non per dare un voto.
import { NUC, accentFgFor } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { useT } from '@/lib/i18n'
import type { RankEsercizio } from './rankEsercizio'

export function RankCard({ rank: { rank, prossimo, avanzamento } }: { rank: RankEsercizio }) {
  const t = useT()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, marginBottom: 26, background: 'var(--surface)', border: 'var(--bordo)' }}>
      <div aria-hidden style={{
        width: 52, height: 52, flexShrink: 0, boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: rank.colore, color: accentFgFor(rank.colore), border: 'var(--bordo)',
      }}>
        <Icons.trophy size={24} stroke={1.8}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: NUC.display, fontSize: 20, fontWeight: 800, lineHeight: 1.1, textTransform: 'uppercase', color: NUC.ink }}>{t(rank.nome)}</div>
        <div aria-hidden style={{ height: 12, marginTop: 8, border: '1.5px solid var(--ink)', background: 'var(--surface-2)' }}>
          <div style={{ height: '100%', width: `${avanzamento * 100}%`, background: 'var(--j-accent)' }}/>
        </div>
        <div style={{ fontFamily: NUC.font, fontSize: 13, lineHeight: 1.4, color: NUC.faint, marginTop: 6 }}>
          {!prossimo ? t('Rank massimo')
            : prossimo.mancano === 1 ? t('Manca 1 kg di massimale per {rank}', { rank: t(prossimo.rank.nome) })
            : t('Mancano {kg} kg di massimale per {rank}', { kg: prossimo.mancano, rank: t(prossimo.rank.nome) })}
        </div>
      </div>
    </div>
  )
}

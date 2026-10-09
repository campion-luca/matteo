// L'invito ad accendere le notifiche, al primo ingresso su un dispositivo.
//
// Le notifiche sono accese di serie, ma la prima volta il permesso lo deve dare
// la persona con un tocco suo: il browser non lascia fare altrimenti. Quindi lo
// si chiede subito — una volta sola — invece di aspettare che qualcuno trovi
// l'interruttore nelle impostazioni. Chi dice «non ora» non se lo sente
// richiedere: resta spento, e si accende da lì quando vuole.
//
// Non compare a chi il permesso l'ha già dato (gli si accendono da sole, vedi
// `riallineaPush`), a chi l'ha negato, né dove il push non c'è.
import { useEffect, useState } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { JModal } from '@/components/ui/Primitives'
import { useT } from '@/lib/i18n'
import { attivaPush, daProporrePush, segnaInvitoPush } from '@/lib/push'

export function InvitoNotifiche({ userId }: { userId: string }) {
  const t = useT()
  const [aperto, setAperto] = useState(false)
  const [lavoro, setLavoro] = useState(false)

  useEffect(() => {
    let vivo = true
    daProporrePush().then(si => { if (vivo && si) setAperto(true) }).catch(() => { /* niente invito */ })
    return () => { vivo = false }
  }, [userId])

  // Chiuso in qualunque modo, l'invito è stato visto: non torna.
  const chiudi = () => { segnaInvitoPush(); setAperto(false) }

  // La richiesta di permesso parte dentro il tocco, senza niente in mezzo: i
  // browser la mostrano solo se c'è un gesto dietro.
  const attiva = () => {
    setLavoro(true)
    void attivaPush(userId)
      .catch(() => { /* tabella o rete: si riprova dalle impostazioni */ })
      .finally(() => { setLavoro(false); chiudi() })
  }

  return (
    <JModal open={aperto} onClose={chiudi} title={t('Notifiche')}>
      <div style={{ fontFamily: NUC.font, fontSize: 13.5, lineHeight: 1.55, color: 'var(--fg-soft)' }}>
        {t('Vuoi sapere subito quando il coach ti scrive, ti assegna una scheda o corregge un’alzata — e, se alleni qualcuno, quando finisce un allenamento?')}
      </div>
      <div style={{ fontFamily: NUC.label, fontSize: 10.5, lineHeight: 1.5, color: 'var(--fg-mute)', marginTop: 8 }}>
        {t('Si cambia quando vuoi da Impostazioni.')}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button onClick={chiudi} disabled={lavoro} style={{
          flex: 1, height: 44, borderRadius: 'var(--radius)', cursor: 'pointer',
          background: 'var(--surface-2)', border: '1px solid var(--hairline)',
          fontFamily: NUC.font, fontSize: 13, color: NUC.dim,
        }}>{t('Non ora')}</button>
        <button onClick={attiva} disabled={lavoro} className="j-hard" style={{
          flex: 1, height: 44, borderRadius: 'var(--radius)', cursor: lavoro ? 'default' : 'pointer',
          background: 'var(--j-accent)', border: '1px solid var(--j-accent)', color: 'var(--j-accent-fg)',
          fontFamily: NUC.font, fontSize: 13, fontWeight: 500, opacity: lavoro ? 0.6 : 1,
        }}>{lavoro ? t('Attendi…') : t('Attiva')}</button>
      </div>
    </JModal>
  )
}

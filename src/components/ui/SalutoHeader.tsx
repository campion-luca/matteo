import { NUC } from '@/lib/jarvis-tokens'
import { useGreeting } from './Primitives'
import { Icons } from './Icons'
import { useJarvisStore } from '@/store/useJarvisStore'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { fmtGiornoLungo } from '@/lib/dateFormat'
import { useT, useLang } from '@/lib/i18n'

// L'intestazione dell'app: la data di oggi, il saluto col nome, e i comandi che
// valgono ovunque — ricerca, profilo, impostazioni.
//
// Stava dentro la home, che non esiste più come schermata a sé: adesso la pagina
// d'ingresso È l'allenamento, e questa testata ci va in cima al posto del vecchio
// "Allenamento · 38 esercizi in palestra". Vive qui e non dentro JarvisGym perché
// non parla di palestra: parla di chi sta usando l'app.
//
// Il saluto è l'unica cosa in Fraunces di tutta l'app (`--font-saluto`): è la voce
// dell'app, non un titolo fra i tanti.
export function SalutoHeader({ onSearch, onUser, onSettings }: {
  onSearch: () => void
  onUser: () => void
  onSettings: () => void
}) {
  const t = useT()
  const lang = useLang()
  const isDesktop = useIsDesktop()
  const userName = useJarvisStore(st => st.userName)
  const greeting = useGreeting(userName)

  // Il nome va enfatizzato dentro la frase: serve sapere dove comincia e dove
  // finisce, perché il saluto cambia con l'ora e con le feste.
  const nameStart = userName ? greeting.indexOf(userName) : -1
  const greetBefore = nameStart >= 0 ? greeting.slice(0, nameStart) : greeting
  const greetAfter  = nameStart >= 0 ? greeting.slice(nameStart + userName.length) : ''

  // I tre comandi: stessa forma, quadrati, sulla riga del saluto. La misura è
  // elastica ma non scende sotto i 34px — sotto non si centra più il pollice.
  const tasto = (label: string, onClick: () => void, icona: JSX.Element) => (
    <button onClick={onClick} aria-label={label} title={label} className="j-hard j-hard-sm j-focus" style={{
      width: 'clamp(34px, 9.5vw, 42px)', aspectRatio: '1 / 1', borderRadius: 0, flexShrink: 0,
      background: 'var(--surface)', border: '1px solid var(--hairline)',
      color: 'var(--fg-soft)', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {icona}
    </button>
  )

  return (
    <div className="jarvis-boot" style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 'clamp(8px, 3vw, 16px)',
      marginBottom: isDesktop ? 20 : 'clamp(10px, 1.8dvh, 18px)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: NUC.label, fontSize: 'clamp(10.5px, 3vw, 12px)', fontWeight: 600, letterSpacing: '.04em',
          color: 'var(--tertiary-ink)', marginBottom: 4,
        }}>{fmtGiornoLungo(new Date(), lang)}</div>
        <div style={{
          fontFamily: 'var(--font-saluto)',
          // Il minore fra larghezza e altezza: su un telefono basso il saluto su
          // due righe è la cosa che spinge giù tutto il resto.
          fontSize: isDesktop ? 'clamp(26px, 3.4vw, 36px)' : 'clamp(23px, 3.2dvh, 31px)',
          fontWeight: 500, letterSpacing: '-0.01em',
          lineHeight: 1.05, color: 'var(--fg)',
        }}>
          {greetBefore}
          {nameStart >= 0 && (
            <em style={{
              fontStyle: 'normal', fontWeight: 600,
              textDecoration: 'underline',
              textDecorationColor: 'var(--j-accent)',
              textDecorationThickness: 1,
              textUnderlineOffset: 3,
            }}>{userName}</em>
          )}
          {greetAfter}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'clamp(5px, 1.6vw, 8px)', flexShrink: 0, paddingTop: 2 }}>
        {tasto(t('Ricerca globale'), onSearch, <Icons.search size={16} stroke={1.8} style={{ width: '42%', height: 'auto' }}/>)}
        {/* Il profilo è una voce sua e non più una sezione delle impostazioni:
            nome, dati e peso sono cose TUE, non regolazioni dell'app. */}
        {tasto(t('Profilo'), onUser, <Icons.user size={16} stroke={1.7} style={{ width: '42%', height: 'auto' }}/>)}
        {tasto(t('Impostazioni'), onSettings, <Icons.settings size={15} stroke={1.6} style={{ width: '40%', height: 'auto' }}/>)}
      </div>
    </div>
  )
}

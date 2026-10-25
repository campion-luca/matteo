import type { CSSProperties } from 'react'
import { useGreeting } from './Primitives'
import { Icons } from './Icons'
import { useJarvisStore, NOME_MAX } from '@/store/useJarvisStore'
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
//
// Su telefono sta su DUE righe, sempre: la formula sopra («Buon pomeriggio,»),
// il nome sotto. Lasciato andare a capo da sé ne prendeva due la mattina e tre
// il pomeriggio — «Buon / pomeriggio, / Luca.» — e ogni riga in più sposta in giù
// tutta la home. Perché ognuna resti su una riga sola il corpo si stringe quanto
// serve alla più lunga delle due (vedi `.j-saluto` in globals.css, che fa il
// conto sulla larghezza vera della colonna): con «Buongiorno, Luca» non cambia
// niente, con «Buon pomeriggio» o un nome lungo scende di qualche punto.

/** Quanto è largo in media un carattere del saluto, in `em`. Misurato sul
 *  Barlow Condensed 800 maiuscolo: la riga più larga («Buonasera,») sta a 0,445,
 *  «Buon pomeriggio,» a 0,41. Il margine c'è perché se il conto sbaglia per
 *  difetto la riga finisce coi puntini. */
const EM_A_CARATTERE = 0.5
/** Oltre queste lettere la formula va a capo da sé («Buona Festa della
 *  Repubblica,» ne ha ventinove): stringerla fino a farla stare su una riga la
 *  renderebbe illeggibile, e succede un giorno all'anno. */
const FORMULA_MAX = 20

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

  // Le due righe del telefono. Il corpo lo decide la più lunga — ma un nome
  // oltre il limite (salvato prima che ci fosse) non conta per intero: non deve
  // rimpicciolire tutto il saluto, finisce coi puntini.
  const formula = greetBefore.trimEnd()
  const suDueRighe = !isDesktop && nameStart >= 0
  const caratteri = Math.max(
    Math.min(formula.length, FORMULA_MAX),
    Math.min(userName.length, NOME_MAX) + greetAfter.length,
  )
  // Il nome, uguale nei due casi. Corsivo e non sottolineato: la sottolineatura
  // è il segno di un link, e un nome che sembra cliccabile ma non fa niente è
  // una promessa rotta.
  const nome = <span>{userName}</span>

  // I tre comandi: stessa forma, quadrati, sulla riga del saluto. La misura è
  // elastica ma non scende sotto i 34px — sotto non si centra più il pollice.
  // Sotto i 393px di larghezza scendono fino a 38: a 320 (un iPhone con lo
  // zoom dello schermo) tre tasti da 44 lasciavano al saluto meno di metà riga.
  const tasto = (label: string, onClick: () => void, icona: JSX.Element) => (
    <button onClick={onClick} aria-label={label} title={label} className="j-hard j-hard-sm j-focus" style={{
      width: 'clamp(38px, 11.2vw, 44px)', aspectRatio: '1 / 1', borderRadius: 'var(--radius)', flexShrink: 0,
      background: 'var(--surface)', border: 'var(--bordo)',
      color: 'var(--fg-soft)', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {icona}
    </button>
  )

  return (
    // Niente dissolvenza d'ingresso: questa testata si rimontava a ogni ritorno
    // alla home, e ogni volta il saluto ricompariva da trasparente in 400ms.
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 'clamp(8px, 3vw, 16px)',
      marginBottom: isDesktop ? 20 : 'clamp(10px, 1.8dvh, 18px)',
    }}>
      {/* `flex: 1` sul telefono: la colonna prende tutto lo spazio che i tre
          tasti lasciano, ed è su quella larghezza che il saluto si misura. */}
      <div className={suDueRighe ? 'j-saluto-colonna' : undefined} style={{ minWidth: 0, flex: suDueRighe ? 1 : undefined }}>
        {/* Su una riga sola: andando a capo («Mercoledì 30 / settembre») spingeva
            giù tutta la home. Sui telefoni stretti si stringe un poco. */}
        <div className="j-eyebrow" style={{
          marginBottom: 6, fontSize: 'clamp(12px, 3.9vw, 15px)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{fmtGiornoLungo(new Date(), lang)}</div>
        {suDueRighe ? (
          <div className="j-saluto" style={{ '--saluto-em': (EM_A_CARATTERE * caratteri).toFixed(2) } as CSSProperties}>
            <div className={formula.length <= FORMULA_MAX ? 'j-saluto-riga' : undefined}>{formula}</div>
            <div className="j-saluto-riga">{nome}{greetAfter}</div>
          </div>
        ) : (
          // Su desktop, e senza nome: una frase sola, che va a capo se serve.
          <div style={{
            fontFamily: 'var(--font-saluto)', textTransform: 'uppercase',
            fontSize: 44, fontWeight: 800, letterSpacing: '-0.01em',
            lineHeight: .95, color: 'var(--fg)',
          }}>
            {greetBefore}
            {nameStart >= 0 && nome}
            {greetAfter}
          </div>
        )}
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

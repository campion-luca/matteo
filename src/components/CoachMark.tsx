/* eslint-disable react-refresh/only-export-components -- co-esporta di proposito il componente host e le funzioni con cui il resto dell'app accende i suggerimenti */
// Spiegazioni contestuali: quando apri una funzione per la PRIMA volta, l'app ti
// dice cosa ci puoi fare. Poi non lo dice mai più.
//
// Sostituisce il tutorial d'ingresso, che era un modale mostrato all'avvio della
// scheda Allenamento con dentro un paragrafo generico. Il problema di quel modale
// non era il testo: era il momento. Arrivava prima che l'utente avesse visto
// qualcosa, quindi spiegava cose che non erano ancora sullo schermo, e per
// toglierselo bastava un tocco fatto senza leggere. Una spiegazione che arriva
// mentre la funzione è aperta parla di ciò che si sta guardando.
//
// Ogni suggerimento si mostra una volta sola e per SEMPRE: la lista degli id già
// visti sta nello store (`onboardingSeen`), quindi viaggia col cloud e non
// ricompare cambiando dispositivo. È lo stesso campo del vecchio tutorial —
// riusarlo evita una chiave di stato in più e una migrazione per una lista di
// stringhe.
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { NUC } from '@/lib/jarvis-tokens'
import { useT } from '@/lib/i18n'
import { Icons } from '@/components/ui/Icons'
import { useJarvisStore, markOnboardingSeen } from '@/store/useJarvisStore'

// ── Il catalogo ────────────────────────────────────────────────
// `title` è la funzione appena aperta, `points` cosa ci si fa. Sono elenchi
// perché una spiegazione si legge in diagonale: tre righe corte si assorbono in
// un'occhiata, un paragrafo no — ed è esattamente quello che l'utente fa quando
// vuole tornare a ciò che stava facendo.
type IconKey = keyof typeof Icons

export interface CoachHint {
  title: string
  points: string[]
  icon: IconKey
}

// I testi restano in italiano anche qui dentro: sono la CHIAVE con cui il
// dizionario tedesco li ritrova (vedi `i18n.ts`). Tradurli in questo punto
// significherebbe congelarli sulla lingua che c'era all'avvio dell'app, perché
// questa costante nasce una volta sola all'import. La traduzione avviene sotto,
// quando il suggerimento viene disegnato.
export const HINTS: Record<string, CoachHint> = {
  gym: {
    title: 'Allenamento',
    icon: 'dumbbell',
    points: [
      'I tuoi esercizi sono raccolti per gruppo muscolare: tocca un gruppo per aprirlo.',
      'Dentro ogni esercizio registri le alzate — carico, serie e ripetizioni — e le ritrovi tutte nello storico.',
      'Con “Schede” prepari un allenamento in anticipo e poi lo esegui passo passo.',
    ],
  },
  muscleGroup: {
    title: 'Gruppo muscolare',
    icon: 'weight',
    points: [
      'Qui trovi tutti gli esercizi di questo gruppo, con l’ultima alzata registrata.',
      'Il colore del gruppo lo scegli tu: si cambia dalla matita dell’esercizio.',
      'Tocca un esercizio per aprirlo e registrare una nuova alzata.',
    ],
  },
  exercise: {
    title: 'Scheda esercizio',
    icon: 'chart',
    points: [
      'Il tasto grande registra una nuova alzata: carico, serie e ripetizioni.',
      'Sotto trovi lo storico completo — ogni riga si può correggere o cancellare.',
      'Il grafico segue il carico nel tempo: toccalo per aprire tutti gli altri.',
      'Se vuoi ripartire da zero senza perdere l’esercizio, usa “svuota la memoria”.',
    ],
  },
  addLift: {
    title: 'Registra un’alzata',
    icon: 'plus',
    points: [
      'Metti il carico più alto che hai usato, le serie e le ripetizioni.',
      'Se hai cambiato peso serie per serie, accendi “peso diverso per serie”.',
      '“A corpo libero” somma il tuo peso corporeo: le trazioni non valgono zero.',
      'Se batti il tuo massimo su questo esercizio, l’app te lo dice subito.',
    ],
  },
  charts: {
    title: 'Tutti i grafici',
    icon: 'chart',
    points: [
      '“Carico” è il peso sul bilanciere, “Massimale stimato” tiene conto anche delle ripetizioni.',
      'Sull’asse verticale ci sono i chili, in basso la data di ogni alzata.',
      'Sono due letture della stessa storia: il carico dice cosa hai caricato, il massimale quanto sei forte.',
    ],
  },
  schede: {
    title: 'Schede',
    icon: 'book',
    points: [
      'Una scheda è l’allenamento scritto prima: esercizi, serie e ripetizioni in ordine.',
      'In esecuzione la segui riga per riga e ogni serie chiusa finisce nello storico.',
      'Puoi collegare ogni riga a un esercizio esistente, così i progressi si sommano ai suoi.',
    ],
  },
  bodyMap: {
    title: 'Mappa della forza',
    icon: 'user',
    points: [
      'Ogni distretto è colorato per quanto sei forte, non per quanti chili sollevi.',
      'Il punteggio va da 0 a 100, dove 100 è il livello “forte” di quel distretto: così braccia e gambe si confrontano.',
      'Tocca un distretto per vedere i chili veri da cui esce il punteggio.',
    ],
  },
  profile: {
    title: 'Profilo',
    icon: 'user',
    points: [
      'Peso e altezza non sono un vezzo: da lì escono la forza relativa e la mappa del corpo.',
      'Da qui cambi tema, colore e stile del menù di navigazione.',
      'Da qui registri il peso quando ti pesi: serve al trend, non al singolo numero.',
    ],
  },
  coach: {
    title: 'Personal Coach',
    icon: 'dumbbell',
    points: [
      'Puoi far seguire i tuoi allenamenti da un’altra persona che usa Matteo.',
      'Generi un codice, glielo dai, e da quel momento vede i tuoi allenamenti e il tuo peso.',
      'Vede solo: non può modificare niente. E puoi togliergli l’accesso quando vuoi.',
      'Dall’altra linguetta fai il contrario: inserisci il codice di chi vuoi seguire.',
    ],
  },
  budget: {
    title: 'Budget',
    icon: 'wallet',
    points: [
      'Metti lo stipendio e le spese fisse: l’app calcola cosa ti resta ogni mese.',
      'Le spese grosse imminenti si scalano a parte, senza sporcare il conto mensile.',
      'Il “sogno” ti dice fra quanto ci arrivi con quello che avanzi.',
    ],
  },
}

// ── Lo stato: quale suggerimento è a schermo ───────────────────
// Un solo suggerimento alla volta. Aprendo una funzione dentro l'altra (esercizio
// → registra alzata) partirebbero due popup sovrapposti, e il secondo coprirebbe
// il primo prima che si sia letto. Chi arriva dopo aspetta il proprio turno: la
// coda parte da sola alla chiusura di quello davanti.
interface CoachState {
  queue: string[]
  push: (id: string) => void
  shift: () => void
}

const useCoachState = create<CoachState>(set => ({
  queue: [],
  push: id => set(s => (s.queue.includes(id) ? s : { queue: [...s.queue, id] })),
  shift: () => set(s => ({ queue: s.queue.slice(1) })),
}))

/** Segnala che l'utente ha appena aperto una funzione. Se il suggerimento è già
 *  stato visto non succede niente: si può chiamare senza condizioni. */
export function fireCoach(id: keyof typeof HINTS): void {
  if (!HINTS[id]) return
  if ((useJarvisStore.getState().onboardingSeen ?? []).includes(`hint:${id}`)) return
  useCoachState.getState().push(id)
}

// ── Il popup ───────────────────────────────────────────────────
// Sale dal basso, non si mette al centro: al centro avrebbe coperto proprio la
// cosa che sta spiegando. Le righe entrano una dopo l'altra — è il "dinamico"
// che serve qui, perché guida l'occhio nell'ordine in cui il testo va letto,
// invece di scaricare quattro frasi tutte insieme.
export function CoachMarkHost() {
  const t = useT()
  const id = useCoachState(s => s.queue[0])
  const shift = useCoachState(s => s.shift)
  const [visible, setVisible] = useState(false)
  const hint = id ? HINTS[id] : undefined

  useEffect(() => {
    if (!id) { setVisible(false); return }
    // Un frame di ritardo: montare già visibile salterebbe la transizione, e il
    // popup comparirebbe di scatto sopra la schermata appena aperta.
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [id])

  useEffect(() => {
    if (!id) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!id || !hint) return null

  function close() {
    if (!id) return
    markOnboardingSeen(`hint:${id}`)
    setVisible(false)
    // Aspetta la discesa prima di togliere dal DOM, altrimenti il popup sparisce
    // di colpo e il successivo in coda sembra lo stesso che si è teletrasportato.
    setTimeout(shift, 220)
  }

  const Ico = Icons[hint.icon]

  return (
    <div
      onClick={close}
      style={{
        position: 'absolute', inset: 0, zIndex: 120,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 12px calc(14px + env(safe-area-inset-bottom))',
      }}
    >
      {/* Il velo è un figlio e non lo sfondo del contenitore: messo lì, la sua
          opacità avrebbe schiarito anche il popup, che del contenitore è figlio.
          Tenuto a metà del velo dei modali — questo non è un blocco, è un
          affiancamento, e uno scrim pieno spegnerebbe la schermata di cui sta
          parlando proprio mentre la spiega. */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'var(--scrim)',
        opacity: visible ? 0.55 : 0,
        transition: 'opacity 220ms var(--ease)',
      }}/>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={hint.title}
        onClick={e => e.stopPropagation()}
        className="j-hard-static"
        style={{
          position: 'relative',
          width: '100%', maxWidth: 400,
          background: 'var(--surface)',
          backgroundImage: 'var(--paper-grain)',
          border: '1px solid var(--fg)',
          borderRadius: 0,
          padding: '16px 16px 14px',
          transform: visible ? 'translateY(0)' : 'translateY(18px)',
          opacity: visible ? 1 : 0,
          transition: 'transform 260ms cubic-bezier(.2,.9,.25,1.1), opacity 200ms var(--ease)',
        }}
      >
        {/* Intestazione: l'icona è la stessa del tasto che si è appena premuto,
            così il popup si aggancia a quello e non a una schermata qualsiasi. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 30, height: 30, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--j-accent)', color: 'var(--j-accent-fg)',
          }}>
            <Ico size={16} stroke={1.8}/>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontFamily: NUC.label, fontSize: 9, letterSpacing: '.18em',
              textTransform: 'uppercase', color: 'var(--fg-mute)',
            }}>{t('Come funziona')}</div>
            <div style={{
              fontFamily: NUC.serif, fontSize: 17, fontWeight: 500,
              letterSpacing: -0.2, color: 'var(--fg)',
            }}>{t(hint.title)}</div>
          </div>
        </div>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {hint.points.map((p, i) => (
            <li
              key={i}
              style={{
                display: 'flex', gap: 9, alignItems: 'flex-start',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(6px)',
                // Lo sfalsamento è la parte "dinamica": 70 ms bastano a far leggere
                // le righe in ordine senza che l'ultima si faccia aspettare.
                transition: `opacity 260ms var(--ease) ${90 + i * 70}ms, transform 260ms var(--ease) ${90 + i * 70}ms`,
              }}
            >
              <span style={{
                width: 5, height: 5, marginTop: 7, flexShrink: 0,
                background: 'var(--j-accent)',
              }}/>
              <span style={{
                fontFamily: NUC.font, fontSize: 13.5, lineHeight: 1.5, color: 'var(--fg)',
              }}>{t(p)}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={close}
          autoFocus
          className="j-hard"
          style={{
            marginTop: 16, width: '100%', minHeight: 42,
            background: 'var(--j-accent)', border: 'none', borderRadius: 0,
            color: 'var(--j-accent-fg)',
            fontFamily: NUC.label, fontSize: 11, fontWeight: 500,
            letterSpacing: '.16em', textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          {t('Ho capito')}
        </button>
      </div>
    </div>
  )
}

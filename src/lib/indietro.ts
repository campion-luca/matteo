import { useEffect, useId, useRef } from 'react'
import { create } from 'zustand'

// ── Dov'è il tasto "indietro" ──────────────────────────────────
// Sta in basso, di fianco al tasto Home/Allenamento, e compare solo quando c'è
// davvero un posto dove tornare: dalla home o dalla palestra non si vede.
//
// ── Perché un registro e non una prop ──────────────────────────
// Chi sa DOVE si torna è la schermata aperta (l'esercizio sa che si torna al
// gruppo, il gruppo sa che si torna all'elenco). Chi disegna il tasto è la nav,
// che sta in fondo all'app e quelle schermate non le conosce: stanno dentro la
// tab, montate e smontate da JarvisGym. Passare la funzione a mano vorrebbe dire
// farla scendere per cinque livelli di componenti che non se ne fanno niente, e
// aggiungere una prop a ognuno il giorno che nasce una schermata nuova.
//
// Qui invece la schermata dichiara "da me si torna così" e chi disegna il tasto
// legge. Una schermata che si dimentica di dichiararlo non lascia bloccati: non
// mostra la freccia, e su desktop la sua freccia in alto a sinistra c'è sempre.
//
// ── Perché una PILA e non un valore solo ───────────────────────
// Le schermate si annidano: gruppo muscolare → esercizio → grafici. Con un solo
// valore, l'ultima ad aprirsi lo sovrascriverebbe e — peggio — chiudendosi lo
// azzererebbe, lasciando senza freccia il gruppo che sta sotto e che una via
// d'uscita ce l'ha. Con una pila ognuna toglie la propria voce e riemerge quella
// di prima, che è esattamente il comportamento che ci si aspetta da "indietro".

interface Voce { id: string; fn: () => void }

const usePila = create<{ voci: Voce[] }>(() => ({ voci: [] }))

/** Dichiara come si torna indietro da questa schermata, per tutto il tempo in
 *  cui è aperta. Passare `undefined` significa "da qui non si torna". */
export function useIndietro(fn: (() => void) | undefined): void {
  const id = useId()
  // La funzione arriva quasi sempre come arrow inline, quindi cambia identità a
  // ogni render di chi la passa. Tenerla in un ref e registrare un rimando fisso
  // evita di iscriversi e disiscriversi in continuazione — e con essa il tasto
  // che sfarfalla mentre la schermata sotto si ridisegna.
  const rif = useRef(fn)
  rif.current = fn

  const attivo = !!fn
  useEffect(() => {
    if (!attivo) return
    const voce: Voce = { id, fn: () => rif.current?.() }
    usePila.setState(s => ({ voci: [...s.voci, voce] }))
    return () => usePila.setState(s => ({ voci: s.voci.filter(v => v.id !== id) }))
  }, [id, attivo])
}

/** L'azione dell'ultima schermata che si è dichiarata, o `null` se non c'è
 *  niente da cui tornare. La legge chi disegna il tasto. */
export function useAzioneIndietro(): (() => void) | null {
  const voci = usePila(s => s.voci)
  return voci.length ? voci[voci.length - 1].fn : null
}

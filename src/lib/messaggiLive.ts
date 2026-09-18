// I messaggi, tenuti aggiornati da soli.
//
// ── Perché non un WebSocket ────────────────────────────────────
// Supabase ha il realtime, ma sta in `@supabase/realtime-js`: è la metà del peso
// che questo progetto ha tolto assemblando il client a mano (vedi il commento in
// lib/supabase.ts), e vorrebbe una pubblicazione in più da abilitare a mano sul
// database. In cambio darebbe un centinaio di millisecondi contro i tre secondi
// di qui — su una conversazione fra due persone, una differenza che nessuno
// misura. E in palestra, dove la rete è quella che è, una connessione persistente
// che cade e si riapre è una fonte di stati sbagliati in più, non in meno.
//
// Quindi: si richiede, ma con la testa.
//  • UN solo giro per tutta l'app, qualunque sia il numero di schermate in ascolto
//  • il ritmo lo decide la più esigente fra loro: 3s con una conversazione aperta,
//    20s per il solo badge rosso in home
//  • a schermo spento non si chiede niente, e si riparte subito al ritorno
//  • quello che si scrive compare prima di partire (eco locale), così il campo si
//    svuota nell'istante in cui si preme invio
import { useEffect } from 'react'
import { create } from 'zustand'
import {
  messaggiDiUtente, creaMessaggio, salvaMessaggio, segnaLetti, eliminaMessaggio,
  ruoloIn, nonLetti,
  type Messaggio, type BozzaMessaggio,
} from './messaggi'

/** Il badge in home: basta sapere entro il minuto che è arrivato qualcosa. */
export const RITMO_FONDO = 20_000
/** Una conversazione aperta davanti agli occhi. */
export const RITMO_APERTO = 3_000

interface Stato {
  /** Chi siamo. `null` = nessuna sessione, il giro è fermo. */
  userId: string | null
  messaggi: Messaggio[]
  /** Il primo giro è FINITO — riuscito o no.
   *
   *  Non "è riuscito", che è la versione che aveva questo campo e che lasciava la
   *  schermata dei messaggi su "Caricamento…" per sempre: se la tabella sul
   *  server non c'è ancora, ogni giro fallisce, e una condizione che aspetta il
   *  successo aspetta una cosa che non arriverà mai. Chi guarda non ha modo di
   *  distinguerlo da una rete lenta, e resta lì. */
  primoGiroFatto: boolean
  /** Cosa è andato storto nell'ultimo giro, se è andato storto. Si azzera al
   *  primo giro che riesce. Il giro di sfondo non lo mostra da nessuna parte —
   *  sarebbe un avviso rosso ogni tre secondi in ascensore — ma una schermata
   *  APERTA sui messaggi deve poterlo dire, o mostra "nessun messaggio" mentre in
   *  realtà non ha potuto guardare. */
  errore: string | null
}

export const useMessaggiStore = create<Stato>(() => ({
  userId: null, messaggi: [], primoGiroFatto: false, errore: null,
}))

let timer: ReturnType<typeof setTimeout> | undefined
let inVolo = false
// Ogni schermata in ascolto lascia qui il ritmo che le serve. Un Set di oggetti e
// non di numeri: due schermate possono chiedere lo stesso ritmo, e togliendo il
// numero alla chiusura della prima si spegnerebbe anche la seconda.
const ritmi = new Set<{ ms: number }>()

function ritmoCorrente(): number {
  let ms = RITMO_FONDO
  for (const r of ritmi) ms = Math.min(ms, r.ms)
  return ms
}

function programma(fra = ritmoCorrente()) {
  clearTimeout(timer)
  timer = setTimeout(() => { void giro() }, fra)
}

async function giro(): Promise<void> {
  const userId = useMessaggiStore.getState().userId
  if (!userId) return
  // A schermo spento non si interroga niente: l'app in tasca non ha nessuno che
  // guardi il badge, e un giro ogni tre secondi è batteria e traffico buttati.
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    programma()
    return
  }
  if (inVolo) { programma(); return }
  inVolo = true
  try {
    const righe = await messaggiDiUtente()
    // L'utente può essere cambiato mentre la richiesta era in viaggio: scrivere
    // qui dentro senza guardare significherebbe mostrare a uno i messaggi di un
    // altro, per il tempo che il giro dopo ci mette a correggere.
    if (useMessaggiStore.getState().userId === userId) {
      useMessaggiStore.setState({ messaggi: righe, errore: null })
    }
  } catch (e) {
    // Rete assente, sessione scaduta, o la tabella non ancora creata sul
    // database: si riprova al giro dopo e intanto resta quello che si aveva.
    // L'errore si registra ma non si grida: chi lo mostra è solo la schermata
    // aperta sui messaggi.
    if (useMessaggiStore.getState().userId === userId) {
      useMessaggiStore.setState({ errore: e instanceof Error ? e.message : String(e) })
    }
  } finally {
    inVolo = false
    // Qui e non nel ramo che riesce: è la riga che fa finire il "Caricamento…"
    // anche quando il server non risponderà mai.
    if (useMessaggiStore.getState().userId === userId) {
      useMessaggiStore.setState({ primoGiroFatto: true })
    }
    programma()
  }
}

/** Accende il giro per questo utente. Idempotente: chiamarla due volte con lo
 *  stesso id non fa niente. */
export function avviaMessaggi(userId: string): void {
  if (useMessaggiStore.getState().userId === userId) return
  useMessaggiStore.setState({ userId, messaggi: [], primoGiroFatto: false, errore: null })
  programma(0)
}

/** Spegne tutto e svuota. Al logout è obbligatorio: i messaggi sono dell'account,
 *  non del dispositivo. */
export function fermaMessaggi(): void {
  clearTimeout(timer)
  timer = undefined
  useMessaggiStore.setState({ userId: null, messaggi: [], primoGiroFatto: false, errore: null })
}

/** Un giro subito, senza aspettare il prossimo. */
export function ricaricaMessaggi(): void {
  if (useMessaggiStore.getState().userId) programma(0)
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    // Tornando sull'app si riparte subito: chi riapre il telefono per leggere la
    // risposta non deve aspettare il timer che era fermo mentre lo schermo era
    // spento.
    if (document.visibilityState === 'visible') ricaricaMessaggi()
  })
}

/** I messaggi, ricontrollati al ritmo che questa schermata chiede finché resta
 *  montata. Chi tiene aperta una conversazione passa `RITMO_APERTO`; il badge in
 *  home non passa niente e si accontenta del ritmo di fondo. */
export function useMessaggi(ritmo: number = RITMO_FONDO) {
  const messaggi = useMessaggiStore(s => s.messaggi)
  const primoGiroFatto = useMessaggiStore(s => s.primoGiroFatto)
  const errore = useMessaggiStore(s => s.errore)
  const userId = useMessaggiStore(s => s.userId)

  useEffect(() => {
    const voce = { ms: ritmo }
    ritmi.add(voce)
    // Un ascoltatore nuovo può volere un ritmo più svelto di quello in corso, e
    // il timer già armato scadrebbe troppo tardi: aprendo una conversazione si
    // resterebbe fino a venti secondi sui messaggi di prima.
    programma(0)
    return () => { ritmi.delete(voce); programma() }
  }, [ritmo])

  return { messaggi, primoGiroFatto, errore, userId }
}

/** Quanti messaggi devo ancora leggere. Il numero del badge rosso in home. */
export function useNonLetti(): number {
  const { messaggi, userId } = useMessaggi()
  return userId ? nonLetti(messaggi, userId).length : 0
}

/** Manda un messaggio. Compare in elenco PRIMA di partire: il campo si svuota
 *  subito e la riga è già lì, che è ciò che distingue una chat da un modulo.
 *  Se il server rifiuta, la riga se ne va com'è arrivata e l'errore risale a chi
 *  ha chiamato, che ha una schermata dove dirlo. */
export async function invia(bozza: BozzaMessaggio): Promise<Messaggio> {
  const m = creaMessaggio(bozza)
  useMessaggiStore.setState(s => ({ messaggi: [...s.messaggi, m] }))
  try {
    await salvaMessaggio(m)
  } catch (e) {
    useMessaggiStore.setState(s => ({ messaggi: s.messaggi.filter(x => x.id !== m.id) }))
    throw e
  }
  ricaricaMessaggi()
  return m
}

/** Segna letti i messaggi passati, ciascuno dal lato in cui sto io.
 *
 *  Anche qui l'effetto è immediato in locale: il badge si spegne aprendo la
 *  conversazione, non al giro dopo. Se la scrittura fallisce non si torna
 *  indietro — il prossimo giro riporta lo stato vero dal server, e nel frattempo
 *  un badge spento per tre secondi di troppo non ha fatto danni. */
export function segnaLettiOra(messaggi: Messaggio[], userId: string): void {
  const daSegnare = nonLetti(messaggi, userId)
  if (daSegnare.length === 0) return
  const perRuolo = { coach: [] as string[], atleta: [] as string[] }
  for (const m of daSegnare) {
    const r = ruoloIn(m, userId)
    if (r) perRuolo[r].push(m.id)
  }
  const visti = new Set(daSegnare.map(m => m.id))
  useMessaggiStore.setState(s => ({
    messaggi: s.messaggi.map(m => {
      if (!visti.has(m.id)) return m
      return ruoloIn(m, userId) === 'coach'
        ? { ...m, letto_coach: true }
        : { ...m, letto_atleta: true }
    }),
  }))
  void segnaLetti(perRuolo.coach, 'coach').catch(() => {})
  void segnaLetti(perRuolo.atleta, 'atleta').catch(() => {})
}

/** Toglie un messaggio, subito in locale e poi sul server. */
export async function elimina(id: string): Promise<void> {
  const prima = useMessaggiStore.getState().messaggi
  useMessaggiStore.setState({ messaggi: prima.filter(m => m.id !== id) })
  try {
    await eliminaMessaggio(id)
  } catch (e) {
    useMessaggiStore.setState({ messaggi: prima })
    throw e
  }
}

// ── Le foto degli esercizi ─────────────────────────────────────
// Una foto per esercizio, mostrata nella fascia in cima alla card della griglia.
// Chi non ce l'ha tiene il disegno del gruppo muscolare: vedi il commento sopra
// `GrigliaEsercizi` in JarvisGym.tsx per il perché quel ripiego è accettabile.
//
// ── Perché la chiave è il NOME e non l'id ───────────────────────
// `esercizidaCatalogo` genera un `uid('px')` nuovo per ogni utente: lo stesso
// "Panca piana" ha un id diverso sul telefono di ognuno, quindi l'id non lega
// niente a niente. Il nome invece viene copiato nello store tale e quale, ed è
// la sola cosa che due installazioni hanno in comune.
//
// Il confronto passa da `slugEsercizio`, non dal nome esatto: chi si è scritto
// "panca  piana" a mano prende la foto lo stesso, e i nomi dei file restano
// scrivibili in un URL anche quando l'esercizio si chiama "Panca piana al MPW".
//
// ── Perché src/assets e non public/ ─────────────────────────────
// La mappa la costruisce Vite leggendo la cartella: si aggiunge una foto e
// basta, senza un elenco da tenere allineato a mano — che è esattamente il
// punto in cui queste cose si rompono, sei mesi dopo, in silenzio. In più i
// file escono col nome-impronta e si possono cachare per sempre.

const FILE = import.meta.glob('../../assets/esercizi/*.{webp,jpg,jpeg,png}', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>

/** Il nome di un esercizio ridotto alla forma con cui si cerca la sua foto:
 *  minuscolo, senza accenti, tutto il resto attaccato da trattini. */
export function slugEsercizio(nome: string): string {
  return nome
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // "Séance" e "Seance" sono la stessa foto
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const PER_SLUG: Record<string, string> = {}
for (const [percorso, url] of Object.entries(FILE)) {
  const nomeFile = percorso.split('/').pop()!.replace(/\.[^.]+$/, '')
  PER_SLUG[slugEsercizio(nomeFile)] = url
}

/** L'indirizzo della foto di questo esercizio, o `undefined` se non ce l'ha —
 *  cioè quasi sempre, per gli esercizi che uno si aggiunge da sé. */
export function fotoEsercizio(nome: string): string | undefined {
  return PER_SLUG[slugEsercizio(nome)]
}

/** Gli slug che una foto ce l'hanno. Serve ai test e a chi deve capire perché
 *  un'immagine non compare (di solito: il file si chiama diversamente). */
export const SLUG_CON_FOTO: string[] = Object.keys(PER_SLUG).sort()

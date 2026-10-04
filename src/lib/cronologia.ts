// Tutto quello che ha una data — le alzate di un esercizio, gli allenamenti di
// una scheda, le sessioni Hyrox, le giornate di un allievo — si ordina allo
// stesso modo: per anno, e dentro l'anno per mese.
//
// Prima erano elenchi piatti, dal più recente al più vecchio. Con un mese di
// dati vanno benissimo; con due anni sono duecento righe da scorrere per
// arrivare a "com'era a marzo dell'anno scorso", e niente nella lista dice dove
// finisce un periodo e ne comincia un altro.
//
// Qui c'è solo il raggruppamento, puro e testato. Il disegno sta in
// components/ui/Cronologia.tsx.

export interface MeseCronologia<T> {
  /** "2026-09": unica in tutta la cronologia, fa da chiave e da id del gruppo. */
  chiave: string
  anno: number
  /** 0-11, come `Date.getMonth()`. */
  mese: number
  voci: T[]
}

export interface AnnoCronologia<T> {
  anno: number
  mesi: MeseCronologia<T>[]
  /** Le voci di tutto l'anno: è il numero accanto all'anno. */
  totale: number
}

export interface Cronologia<T> {
  /** Dal più recente. */
  anni: AnnoCronologia<T>[]
  /** Le voci senza una data vera. Esistono: le alzate registrate prima che lo
   *  storico salvasse il giorno hanno solo l'etichetta della settimana ("W38"),
   *  e non c'è modo di sapere di che mese fossero. Non si buttano e non si
   *  infilano in un mese a caso: stanno in fondo, a parte. */
  senzaData: T[]
}

const ISO = /^(\d{4})-(\d{2})-\d{2}/

/**
 * Raggruppa le voci per anno e mese, dal più recente.
 *
 * Dentro un mese l'ordine resta quello di `voci`: chi chiama passa la lista già
 * ordinata come la vuole vedere (di solito dalla più recente), e qui non si
 * riordina niente — due alzate dello stesso giorno restano nell'ordine in cui
 * sono state fatte.
 */
export function perAnnoEMese<T>(voci: readonly T[], dataDi: (v: T) => string | undefined): Cronologia<T> {
  const perAnno = new Map<number, Map<number, T[]>>()
  const senzaData: T[] = []

  for (const v of voci) {
    const m = ISO.exec(dataDi(v) ?? '')
    if (!m) { senzaData.push(v); continue }
    const anno = Number(m[1])
    const mese = Number(m[2]) - 1
    if (mese < 0 || mese > 11) { senzaData.push(v); continue }
    const mesi = perAnno.get(anno) ?? new Map<number, T[]>()
    const lista = mesi.get(mese) ?? []
    lista.push(v)
    mesi.set(mese, lista)
    perAnno.set(anno, mesi)
  }

  const anni = [...perAnno.entries()]
    .sort(([a], [b]) => b - a)
    .map(([anno, mesi]) => {
      const elenco = [...mesi.entries()]
        .sort(([a], [b]) => b - a)
        .map(([mese, lista]) => ({
          chiave: `${anno}-${String(mese + 1).padStart(2, '0')}`,
          anno, mese, voci: lista,
        }))
      return { anno, mesi: elenco, totale: elenco.reduce((s, x) => s + x.voci.length, 0) }
    })

  return { anni, senzaData }
}

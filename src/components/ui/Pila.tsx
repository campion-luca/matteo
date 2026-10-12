import type { ReactNode } from 'react'

// Le pagine dell'allenamento, una sopra l'altra.
//
// L'app naviga a strati: si tocca un gruppo muscolare e la sua pagina COPRE
// l'elenco, si tocca un esercizio e la sua pagina copre il gruppo. È così su
// ogni schermo.
//
// Da desktop per un periodo sono state due colonne: l'elenco a sinistra, la
// scheda aperta a destra, e nella metà ancora vuota una riga che diceva cosa
// aprire. Tolte su richiesta (ott 2026): anche lì adesso c'è una pagina sola, al
// centro — la colonna la fa `Strato` qui sotto, la misura `.j-desktop` in
// globals.css.
//
// `radice` è la pagina di partenza, `master` l'elenco aperto sopra di lei (se
// c'è), `detail` la pagina aperta da quell'elenco.
//
// Gli strati coperti restano montati, solo nascosti. Prima si mostrava lo strato
// più alto e basta, cioè ogni pagina aperta distruggeva quella sotto: tornare
// indietro voleva dire ricostruire da capo la home — testata, settimana,
// carosello — con lo scorrimento di nuovo in cima. Adesso l'indietro toglie lo
// strato di sopra, e sotto c'è la pagina com'era.
export function Pila({ radice, master = null, detail }: {
  radice: ReactNode
  master?: ReactNode | null
  detail: ReactNode | null
}) {
  return (
    <>
      <Strato coperto={!!(master || detail)}>{radice}</Strato>
      {master && <Strato coperto={!!detail}>{master}</Strato>}
      {detail && <Strato coperto={false}>{detail}</Strato>}
    </>
  )
}

// La larghezza di lettura di una pagina. Su un telefono non si sente: lo schermo
// è più stretto. Su un monitor è quello che tiene tab, card e righe a una misura
// che si legge, invece di stenderli da un bordo all'altro.
// Sta sullo strato e non più scritta pagina per pagina: la home, le statistiche
// e le schede se la portavano dietro ognuna per conto suo, e le pagine di gruppo
// e di esercizio — nate dentro mezza finestra — non l'avevano affatto.
const LARGHEZZA_PAGINA = 860

// Uno strato della pila. Coperto non si smonta: si nasconde con `visibility`,
// che smette di disegnarlo e di prendere tocchi e fuoco ma tiene la posizione di
// scorrimento — con `display: none` Safari la azzererebbe.
// Scoperto NON scrive `visible`: lo eredita. Gli strati stanno anche uno dentro
// l'altro (la home dentro lo strato coperto dalle schede), e un `visible`
// esplicito su un figlio lo farebbe riapparire attraverso il genitore nascosto.
//
// Il centro lo fanno i margini: con `inset: 0` e un tetto di larghezza, quello
// che avanza ai lati si divide in parti uguali.
export function Strato({ coperto, children }: { coperto: boolean; children: ReactNode }) {
  return (
    <div aria-hidden={coperto || undefined} style={{
      position: 'absolute', inset: 0,
      maxWidth: LARGHEZZA_PAGINA, marginInline: 'auto',
      visibility: coperto ? 'hidden' : undefined,
    }}>
      {children}
    </div>
  )
}

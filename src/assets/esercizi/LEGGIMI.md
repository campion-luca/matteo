# Le immagini degli esercizi

> **Exercise data by [RepDB](https://repdb.co)**

Le immagini già qui dentro vengono dal dataset gratuito di RepDB e **non sono
MIT come il resto del repo**: la licenza le concede per l'uso dentro l'app,
anche commerciale, purché quella riga resti visibile (è in fondo alle
Impostazioni e nel README). Vietato ridistribuirle come dataset o raccolta, e
vietato darle in pasto a modelli generativi — quindi **chi disegna le mancanti
non deve usarle come riferimento di stile**: si parte dalla descrizione del
gesto. Il testo completo è in [LICENSE](../../../LICENSE) e sul repo di RepDB.

Le immagini tue, disegnate o fotografate da te, non hanno nessuno di questi
vincoli: convivono qui dentro senza problemi.

Una foto per esercizio. Finisce nella fascia quadrata in cima alla card, nella
vista a griglia della palestra. Chi non ce l'ha tiene il disegno del gruppo
muscolare, e non è un guasto: è il ripiego per gli esercizi che ognuno si
aggiunge da sé, dove una foto non può esistere in anticipo.

## Come si aggiunge una foto

Si copia il file qui dentro e si lancia `npm run foto`. Nient'altro: nessun
elenco da aggiornare, nessuna riga di codice da toccare. La mappa la costruisce
Vite leggendo la cartella (`src/features/gym/eserciziFoto.ts`).

**Il file si chiama come l'esercizio.** Alla lettera:

| Esercizio               | File copiato qui               | Come resta dopo `npm run foto` |
| ----------------------- | ------------------------------ | ------------------------------ |
| Panca piana al MPW      | `Panca piana al MPW.webp`      | `panca-piana-al-mpw.webp`      |
| Piegamenti              | `Piegamenti.webp`              | `piegamenti.webp`              |
| Alzate laterali al cavo | `Alzate laterali al cavo.webp` | `alzate-laterali-al-cavo.webp` |

Maiuscole, spazi e accenti non contano: il confronto passa da `slugEsercizio`,
che riduce nome ed esercizio alla stessa forma. Contano le **parole**:
`Panca piana MPW` e `Panca piana al MPW` sono due cose diverse, e la seconda
resterebbe senza foto. `npm run foto` elenca proprio questi casi.

Se un esercizio viene rinominato nel catalogo, il suo file va rinominato uguale.

## Formato

- **Quadrate.** La fascia è 1:1 e ritaglia con `object-fit: cover`: una foto
  verticale ci perde la testa e i piedi.
- **~400×400**, il doppio della misura a cui si vede sui telefoni densi. Più
  grandi non si vedono meglio, si scaricano più lentamente — e chi le scarica di
  solito è in palestra, con una tacca di rete.
- **`.webp`** di preferenza (`.jpg`, `.jpeg`, `.png` funzionano lo stesso).
  Punta ai 20-40 KB per foto.

## Dove finiscono

Sono servite dal build, non da `public/`: escono col nome-impronta, quindi si
cachano per sempre, e il service worker se le porta offline. Le estensioni
ammesse stanno in `globPatterns` dentro `vite.config.ts`: aggiungerne una qui
senza aggiungerla lì vuol dire immagini rotte senza rete, cioè in palestra.

Sotto i 4 KB Vite le incorpora nel bundle come `data:` invece di emetterle come
file. Alle misure di sopra non succede, ma se un giorno una foto sparisce
dall'elenco degli asset è lì che è andata — e funziona lo stesso.

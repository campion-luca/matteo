// Mette in ordine src/assets/esercizi e dice a che punto siamo.
//
//   npm run foto
//
// Le foto arrivano chiamate come l'esercizio ("Panca piana al MPW.webp"), che è
// il modo comodo per chi le prepara. Qui vengono rinominate nella forma slug
// ("panca-piana-al-mpw.webp") per una ragione precisa: un file con lo spazio nel
// nome finisce nel bundle come `Panca%20piana-hash.webp` e nel manifest offline
// del service worker con lo spazio letterale. I due si riconciliano solo se
// workbox normalizza allo stesso modo, e non è una cosa su cui valga la pena
// scommettere un'immagine che non si carica in palestra.
//
// L'app le trova comunque, in un modo o nell'altro: `fotoEsercizio` confronta gli
// slug e non i nomi (src/features/gym/eserciziFoto.ts). Questo script serve a
// scegliere la forma più sicura una volta sola, non a far funzionare le cose.

import { readdirSync, renameSync, readFileSync, existsSync } from 'node:fs'
import { join, extname, basename } from 'node:path'

const CARTELLA = 'src/assets/esercizi'
const ESTENSIONI = new Set(['.webp', '.jpg', '.jpeg', '.png'])

const slug = n => n
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

if (!existsSync(CARTELLA)) {
  console.error(`Manca la cartella ${CARTELLA}.`)
  process.exit(1)
}

// I nomi del catalogo, letti dal sorgente: importare catalogo.ts da node
// vorrebbe dire risolvere l'alias "@" e i tipi, per una lista di stringhe.
//
// Le virgolette possono essere singole o doppie — "Abduzione dell'anca al cavo"
// fra apici non ci sta. Prenderne un tipo solo vorrebbe dire perdere per strada
// proprio l'esercizio col nome più insidioso, e darlo per coperto quando non lo è.
const sorgente = readFileSync('src/features/gym/catalogo.ts', 'utf8')
const catalogo = [...sorgente.matchAll(/[{][ ]*n:[ ]*(?:'([^']*)'|"([^"]*)")/g)]
  .map(m => m[1] ?? m[2])

const rinominate = []
for (const file of readdirSync(CARTELLA)) {
  const est = extname(file).toLowerCase()
  if (!ESTENSIONI.has(est)) continue
  const voluto = slug(basename(file, extname(file))) + (est === '.jpeg' ? '.jpg' : est)
  if (voluto === file) continue
  renameSync(join(CARTELLA, file), join(CARTELLA, voluto))
  rinominate.push(`${file} → ${voluto}`)
}

const presenti = new Set(
  readdirSync(CARTELLA)
    .filter(f => ESTENSIONI.has(extname(f).toLowerCase()))
    .map(f => slug(basename(f, extname(f)))),
)
const senzaFoto = catalogo.filter(n => !presenti.has(slug(n)))
const orfane = [...presenti].filter(s => !catalogo.some(n => slug(n) === s))

if (rinominate.length) {
  console.log(`\nRinominate (${rinominate.length}):`)
  for (const r of rinominate) console.log('  ' + r)
}
if (orfane.length) {
  console.log(`\nFoto senza un esercizio con quel nome (${orfane.length}):`)
  for (const o of orfane) console.log('  ' + o)
  console.log('  → di solito è un nome scritto quasi giusto: controlla il catalogo.')
}
if (senzaFoto.length) {
  console.log(`\nEsercizi ancora senza foto (${senzaFoto.length}):`)
  for (const n of senzaFoto) console.log(`  ${n}  →  ${slug(n)}.webp`)
}

const coperti = catalogo.length - senzaFoto.length
console.log(`\n${coperti}/${catalogo.length} esercizi del catalogo hanno la foto.`)
if (orfane.length) process.exitCode = 1

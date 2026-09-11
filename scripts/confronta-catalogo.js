/* Confronta i TUOI esercizi salvati col catalogo di partenza di Matteo.
 *
 * Serve a rispondere a una domanda sola prima di premere "aggiungi i mancanti":
 * quali degli esercizi che hai già sono la stessa cosa di uno del catalogo nuovo,
 * chiamata in un altro modo? Quelli vanno RINOMINATI, non duplicati: il rename
 * tiene storico, massimali, record, colore e il collegamento con le schede, e la
 * foto compare da sola perché si aggancia al nome.
 *
 * SOLO LETTURA. Non scrive, non cancella, non manda niente da nessuna parte:
 * legge il localStorage di questo dispositivo e stampa.
 *
 * COME SI USA: apri l'app, premi F12, vai su Console, incolla tutto, invio.
 *
 * ── Perché il punteggio non basta e si guarda la DIREZIONE ──
 * La prima versione dava 100% a "Front squat → Squat" e a "Stacco rumeno →
 * Stacco", perché il nome corto sta dentro il lungo. Sono esercizi diversi, e un
 * 100% lì è peggio di nessun suggerimento: sembra una conferma.
 *
 * Quello che distingue i due casi non è QUANTO si somigliano, è da che parte sta
 * la parola in più:
 *
 *   "Panca piana"  ⊂  "Panca piana al MPW"   il nuovo dice DOVE → stessa cosa
 *   "Squat"        ⊂  "Front squat"          il tuo dice COME  → altra cosa
 *
 * Quando il tuo nome è contenuto in quello nuovo, il nuovo è lo stesso esercizio
 * detto più preciso: rinominare ci sta. Quando è il nuovo a essere contenuto nel
 * tuo, sei tu ad avere la variante, e rinominare la cancellerebbe.
 */
(() => {
  const NUOVI = [
    'Panca piana al MPW', 'Panca inclinata al MPW', 'Panca declinata al MPW',
    'Croci ai cavi bassi', 'Croci ai cavi alti', 'Croci alla peck deck', 'Piegamenti',
    'Trazioni', 'Stacco', 'Lat machine presa larga', 'Rematore T-Bar presa larga',
    'Rematore con manubri su panca inclinata', 'Pulley basso presa stretta',
    'Pullover al cavo alto', 'Scrollate con manubri',
    'Military press al MPW', 'Alzate laterali con manubri', 'Alzate laterali al cavo',
    'Peck deck inversa', 'Face pull',
    'Curl manubri su panca inclinata', 'Curl bilanciere Z', 'Curl panca Scott', 'Curl a martello',
    'Push down al cavo', 'Estensioni overhead al cavo',
    'Sollevamenti gambe alla sbarra', 'Ab wheel', 'Woodchopper ai cavi',
    'Pallof press al cavo', 'Landmine press rotation', 'Suitcase carry',
    'Squat', 'Leg curl seduto', 'Polpacci in piedi', 'Polpacci seduto',
    "Abduzione dell'anca al cavo",
  ]

  const grezzo = localStorage.getItem('jarvis-store-v4')
  if (!grezzo) return console.log("Nessuno store su questo dispositivo: apri l'app e fai il login prima.")
  const miei = ((JSON.parse(grezzo) || {}).state || {}).palestraExercises || []
  if (!miei.length) return console.log('Non hai nessun esercizio salvato.')

  const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

  // Parole che non distinguono un esercizio da un altro: tenerle gonfia i
  // punteggi ("ai cavi" contro "al cavo") senza aggiungere significato.
  const VUOTE = new Set(['al', 'ai', 'alla', 'alle', 'allo', 'con', 'su', 'di', 'del', 'della', 'dell', 'in', 'a', 'e', 'da'])
  const parole = s => slug(s).split(' ').filter(p => p && !VUOTE.has(p))

  // Due parole sono "la stessa parola" se sono identiche, oppure se cambia solo
  // la vocale finale: "cavi"/"cavo", "abduzioni"/"abduzione", "alzata"/"alzate".
  // In italiano il plurale è quasi sempre quello, e basta.
  //
  // La prima versione usava una distanza di edit tollerante (fino a due lettere)
  // e accoppiava "Pressa" con "Military press" e "Plank" con "Panca piana":
  // parole corte e diverse distano pochissimo, e la tolleranza che serve a
  // "cavi/cavo" è la stessa che rovina tutto il resto. Cambiare l'ULTIMA lettera
  // a parità di lunghezza è una condizione stretta che prende i plurali e non
  // prende "press"→"pressa", dove la lettera è aggiunta, non cambiata.
  const vicine = (a, b) => {
    if (a === b) return true
    if (a.length !== b.length || a.length < 4) return false
    return a.slice(0, -1) === b.slice(0, -1)
  }
  const dentro = (insieme, p) => insieme.some(q => vicine(p, q))

  const confronta = (mio, nuovo) => {
    const pm = parole(mio), pn = parole(nuovo)
    if (!pm.length || !pn.length) return null
    const comuni = pm.filter(p => dentro(pn, p)).length
    if (!comuni) return null
    const mioDentroNuovo = pm.every(p => dentro(pn, p))
    const nuovoDentroMio = pn.every(p => dentro(pm, p))
    const verso =
      mioDentroNuovo && nuovoDentroMio ? 'stesse-parole' :
      mioDentroNuovo ? 'preciso' :      // il nuovo aggiunge: probabile rename
      nuovoDentroMio ? 'variante' :     // aggiungi TU: è un altro esercizio
      'parziale'
    return { nuovo, verso, forza: comuni / Math.max(pm.length, pn.length), comuni }
  }

  const uguali = [], rinomina = [], guarda = [], varianti = [], soli = []
  for (const ex of miei) {
    const riga = { n: ex.n, alzate: (ex.history || []).length }
    if (NUOVI.some(x => slug(x) === slug(ex.n))) { uguali.push(riga); continue }

    const tutti = NUOVI.map(x => confronta(ex.n, x)).filter(Boolean)
    const forti = tutti.filter(c => c.verso === 'preciso' || c.verso === 'stesse-parole')
      .sort((a, b) => b.forza - a.forza)
    if (forti.length) { rinomina.push({ ...riga, cand: forti.slice(0, 3) }); continue }

    const varia = tutti.filter(c => c.verso === 'variante').sort((a, b) => b.forza - a.forza)
    if (varia.length) { varianti.push({ ...riga, cand: varia.slice(0, 1) }); continue }

    // Parole in comune ma nessuna inclusione: ci vuole un occhio umano, e solo
    // se le parole in comune sono almeno due — "press", "curl" o "panca" da sole
    // accoppiano qualsiasi cosa con qualsiasi cosa.
    const parz = tutti.filter(c => c.comuni >= 2).sort((a, b) => b.forza - a.forza)
    if (parz.length) guarda.push({ ...riga, cand: parz.slice(0, 2) })
    else soli.push(riga)
  }

  const alz = n => n === 0 ? 'mai allenato' : n === 1 ? '1 alzata' : n + ' alzate'
  const nota = r => r.alzate ? '  ← ' + alz(r.alzate) + ', lo storico segue il rename' : '  ' + alz(r.alzate)
  const T = (s, n) => (s + '                                              ').slice(0, n)
  const vuoto = () => console.log('')
  const titolo = (s, colore) => console.log('%c' + s, 'color:' + colore + ';font-weight:bold')

  vuoto()
  console.log('%cI TUOI ESERCIZI: ' + miei.length, 'font-weight:bold')

  vuoto(); titolo('-- GIÀ UGUALI · non toccarli, la foto arriva da sola (' + uguali.length + ') --', '#2a7')
  uguali.forEach(r => console.log('   ' + T(r.n, 44) + alz(r.alzate)))

  vuoto(); titolo('-- DA RINOMINARE · il nome nuovo dice la stessa cosa, più preciso (' + rinomina.length + ') --', '#c80')
  rinomina.forEach(r => {
    console.log('   ' + T(r.n, 34) + '->  ' + T(r.cand[0].nuovo, 42) + nota(r))
    r.cand.slice(1).forEach(c => console.log('   ' + T('', 34) + '    oppure: ' + c.nuovo))
  })

  vuoto(); titolo('-- DA GUARDARE · si somigliano ma non è detto (' + guarda.length + ') --', '#a6a')
  guarda.forEach(r => console.log('   ' + T(r.n, 34) + '~   ' + T(r.cand.map(c => c.nuovo).join(' | '), 42) + nota(r)))

  vuoto(); titolo('-- PAROLA IN PIÙ NEL TUO NOME · qui decidi tu (' + varianti.length + ') --', '#c44')
  if (varianti.length) console.log('%c   Se la parola in più dice solo dove o come ("Trazioni alla sbarra"), è lo stesso\n'
    + '   esercizio e il rename ci sta. Se cambia l\'esercizio ("Front squat", "Stacco\n'
    + '   rumeno"), lascialo dov\'è: rinominandolo lo perdi dentro un altro.', 'color:#888')
  varianti.forEach(r => console.log('   ' + T(r.n, 34) + '?   ' + T(r.cand[0].nuovo, 42) + '  ' + alz(r.alzate)))

  vuoto(); titolo('-- SOLO TUOI · nessuna somiglianza, restano come sono (' + soli.length + ') --', '#888')
  soli.forEach(r => console.log('   ' + T(r.n, 44) + alz(r.alzate)))

  const restano = NUOVI.filter(x =>
    !miei.some(e => slug(e.n) === slug(x)) && !rinomina.some(r => r.cand[0].nuovo === x))
  vuoto(); titolo('-- TI VERRANNO AGGIUNTI, dopo i rename (' + restano.length + ') --', '#47c')
  console.log('   ' + restano.join(' · '))

  vuoto()
  console.log('%cNessun dato è stato modificato.', 'color:#888')
})()

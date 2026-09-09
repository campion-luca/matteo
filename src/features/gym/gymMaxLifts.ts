// I tre massimali — squat, panca piana, stacco da terra. Logica pura, niente JSX.
//
// Perché queste tre e non "la tua alzata migliore": il widget di prima mostrava un
// solo numero, il massimale più alto di qualunque esercizio. Era quasi sempre lo
// stesso esercizio per mesi, e non diceva niente su cosa fosse rimasto indietro.
// Squat, panca e stacco sono invece il modo in cui la forza si racconta da sempre —
// tre numeri e la loro somma (il "total") sono la carta d'identità di chi alza.
//
// Ogni riga può arrivare da tre posti diversi, e il widget DICE sempre da quale:
//   dichiarato → l'hai provato: una singola al massimo, salvata come massimale.
//   stimato    → hai fatto quell'alzata a ripetizioni, e Epley la porta a una singola.
//   distretto  → non hai quell'esercizio in lista: il numero viene dai chili che
//                sollevi sui gruppi muscolari coinvolti, peso corporeo incluso.
// La terza è un ordine di grandezza, non un massimale. Serve a non lasciare la card
// vuota a chi allena le gambe alla pressa e non ha mai messo un bilanciere addosso.
import type { PalestraExercise } from '@/store/useJarvisStore'
import { entry1RM, setLoads } from './gymModel'
import type { DistrictStrength } from './gymStrength'

export type MaxSource = 'dichiarato' | 'stimato' | 'distretto'

// Chiavi del dizionario, non testo già pronto: chi le stampa le passa da `t`
// (vedi JarvisDashboard). Qui siamo a livello di modulo, dove la lingua non
// esiste ancora.
export const SOURCE_LABELS: Record<MaxSource, string> = {
  dichiarato: 'Dichiarato',
  stimato:    'Stimato',
  distretto:  'Dal distretto',
}

interface BigLift {
  id: string
  name: string
  /** Il distretto la cui soglia è tarata su QUESTA alzata (vedi gymStrength). */
  district: string
  include: RegExp
  /** Le varianti che non sono quell'alzata: il loro massimale non è questo. */
  exclude?: RegExp
}

// `district` non è una scelta libera: le soglie di gymStrength sono definite
// sull'alzata rappresentativa del distretto — panca per il petto, squat per le
// gambe, stacco per i glutei. È lo stesso accoppiamento, letto al contrario.
export const BIG_LIFTS: BigLift[] = [
  {
    id: 'squat', name: 'Squat', district: 'Gambe',
    include: /squat|accosciata/,
    // Bulgaro, sissy, goblet, hack: sono esercizi seri, ma il loro massimale non è
    // il massimale di squat, e mostrarlo come tale gonfierebbe il total.
    exclude: /bulgar|split|sissy|jump|goblet|hack|pistol|overhead|smith/,
  },
  {
    id: 'panca', name: 'Panca piana', district: 'Petto',
    include: /panca|bench|distensioni/,
    exclude: /inclinat|declinat|incline|decline|manubri|dumbbell|scott|presa stretta|close|spalle|militar/,
  },
  {
    id: 'stacco', name: 'Stacco da terra', district: 'Glutei',
    include: /stacco|deadlift/,
    // Il sumo resta dentro: è uno stacco da gara. Rumeno e gambe tese no — si fanno
    // con molto meno carico e per un altro motivo.
    exclude: /rumen|romanian|stiff|gambe tese|trap bar|manubri|dumbbell/,
  },
]

export interface MaxLift {
  id: string
  name: string
  /** Chili del massimale, arrotondati. null = niente da cui ricavarlo. */
  kg: number | null
  source: MaxSource | null
  /** L'esercizio da cui viene il numero, quando ne viene da uno. */
  exercise?: string
  /** `kg` diviso il peso corporeo. null se il peso non è noto. */
  ratio: number | null
}

function matches(name: string, lift: BigLift): boolean {
  const n = name.toLowerCase()
  return lift.include.test(n) && !(lift.exclude?.test(n) ?? false)
}

/** Il carico più pesante dell'alzata, peso corporeo incluso a corpo libero. */
function topLoad(ex: PalestraExercise['history'][number], bodyWeightKg: number): number {
  return Math.max(...setLoads(ex, bodyWeightKg))
}

export function maxLifts(
  exercises: PalestraExercise[],
  bodyWeightKg: number,
  districts: DistrictStrength[],
): MaxLift[] {
  return BIG_LIFTS.map(lift => {
    const own = exercises.filter(ex => matches(ex.n, lift))

    let kg = 0
    let source: MaxSource | null = null
    let exercise: string | undefined

    // 1. Il massimale dichiarato batte tutto: è l'unico che è stato provato.
    for (const ex of own) {
      for (const h of ex.history) {
        if (!h.maxLift) continue
        const v = topLoad(h, bodyWeightKg)
        if (v > kg) { kg = v; source = 'dichiarato'; exercise = ex.n }
      }
    }

    // 2. Altrimenti la stima sull'esercizio giusto.
    if (!source) {
      for (const ex of own) {
        for (const h of ex.history) {
          const v = entry1RM(h, bodyWeightKg)
          if (v > kg) { kg = v; source = 'stimato'; exercise = ex.n }
        }
      }
    }

    // 3. Altrimenti i chili del distretto, che è un'indicazione e non un massimale.
    if (!source) {
      const d = districts.find(x => x.muscle === lift.district)
      if (d && d.best > 0) { kg = d.best; source = 'distretto' }
    }

    return {
      id: lift.id, name: lift.name,
      kg: source ? Math.round(kg) : null,
      source, exercise,
      ratio: source && bodyWeightKg > 0 ? kg / bodyWeightKg : null,
    }
  })
}

// Il total ha senso solo con tutte tre: sommarne due darebbe un numero più basso
// che sembra un total vero, e chi lo confronta con quello di qualcun altro non
// avrebbe modo di accorgersene.
export function maxTotal(lifts: MaxLift[]): number | null {
  return lifts.every(l => l.kg !== null)
    ? lifts.reduce((s, l) => s + (l.kg ?? 0), 0)
    : null
}

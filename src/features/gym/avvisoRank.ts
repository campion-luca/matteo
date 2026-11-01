// L'avviso a chi mi segue quando salgo di rank su un esercizio: una riga nella chat
// con ciascun coach, come quella di fine allenamento. Parte dalle due strade da cui
// arriva un'alzata, la scheda e l'alzata singola.
import { myCoaches } from '@/lib/coach'
import { bozzaChat } from '@/lib/messaggi'
import { avvisa } from '@/lib/messaggiLive'
import { t, tData } from '@/lib/i18n'

/** I coach si leggono qui e non si passano: il rank si sale di rado, e l'alzata
 *  singola non li ha sottomano. Se la lettura fallisce l'avviso non parte, e
 *  l'alzata c'è lo stesso: è un di più. */
export async function avvisaNuovoRank(io: string, mioNome: string, record: ReadonlyArray<{ name: string; salitoA?: string }>): Promise<void> {
  const saliti = record.filter(r => r.salitoA)
  if (!saliti.length) return
  const coach = await myCoaches(io).catch(() => [])
  for (const l of coach) {
    for (const r of saliti) {
      avvisa(bozzaChat({
        coachId: l.coach_id, athleteId: io, autore: io, autoreNome: mioNome, tipo: 'rank',
        testo: t('Nuovo rank su {esercizio}: {rank}.', { esercizio: tData(r.name), rank: t(r.salitoA ?? '') }),
      }))
    }
  }
}

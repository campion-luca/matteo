import { describe, it, expect, beforeEach, vi } from 'vitest'
import { avvisaNuovoRank } from '@/features/gym/avvisoRank'
import { myCoaches, type CoachLink } from '@/lib/coach'
import { avvisa } from '@/lib/messaggiLive'

// Quando un allievo sale di rank, il coach lo viene a sapere nella chat. Se qualcosa
// va storto l'alzata resta salvata: l'avviso è un di più.
vi.mock('@/lib/coach', async orig => ({ ...(await orig() as object), myCoaches: vi.fn() }))
vi.mock('@/lib/messaggiLive', async orig => ({ ...(await orig() as object), avvisa: vi.fn() }))

const link = (coach_id: string): CoachLink => ({ coach_id, athlete_id: 'io', athlete_name: 'Anna', coach_name: 'Luca', created_at: '2026-10-01T10:00:00Z' })

beforeEach(() => { vi.mocked(avvisa).mockClear(); vi.mocked(myCoaches).mockReset() })

describe('l’avviso al coach', () => {
  it('parte una riga per ogni rank salito, a nome dell’allievo', async () => {
    vi.mocked(myCoaches).mockResolvedValue([link('coach-1')])
    await avvisaNuovoRank('io', 'Anna', [{ name: 'Panca piana', salitoA: 'Oro' }])
    expect(avvisa).toHaveBeenCalledTimes(1)
    expect(vi.mocked(avvisa).mock.calls[0][0]).toMatchObject({
      coach_id: 'coach-1', athlete_id: 'io', autore: 'io', autore_nome: 'Anna', tipo: 'rank',
      testo: 'Nuovo rank su Panca piana: Oro.',
    })
  })

  it('un record che non fa salire non avvisa nessuno, e non chiede nemmeno chi sono i coach', async () => {
    await avvisaNuovoRank('io', 'Anna', [{ name: 'Panca piana' }])
    expect(myCoaches).not.toHaveBeenCalled()
    expect(avvisa).not.toHaveBeenCalled()
  })

  it('senza coach non parte niente', async () => {
    vi.mocked(myCoaches).mockResolvedValue([])
    await avvisaNuovoRank('io', 'Anna', [{ name: 'Panca piana', salitoA: 'Oro' }])
    expect(avvisa).not.toHaveBeenCalled()
  })

  it('senza rete tace, e non fa fallire chi l’ha chiamato', async () => {
    vi.mocked(myCoaches).mockRejectedValue(new Error('rete'))
    await expect(avvisaNuovoRank('io', 'Anna', [{ name: 'Panca piana', salitoA: 'Oro' }])).resolves.toBeUndefined()
    expect(avvisa).not.toHaveBeenCalled()
  })

  it('a fine scheda con due rank saliti arrivano due righe', async () => {
    vi.mocked(myCoaches).mockResolvedValue([link('coach-1')])
    await avvisaNuovoRank('io', 'Anna', [{ name: 'Panca piana', salitoA: 'Oro' }, { name: 'Squat' }, { name: 'Lat machine', salitoA: 'Argento' }])
    expect(avvisa).toHaveBeenCalledTimes(2)
  })
})

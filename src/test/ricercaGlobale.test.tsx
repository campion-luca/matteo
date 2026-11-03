import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GlobalSearch } from '@/features/search/GlobalSearch'
import { useJarvisStore, EMPTY_STATE, type GymScheda } from '@/store/useJarvisStore'
import { storageKey } from '@/lib/supabase'
import { ricordaSchedeRicevute, dimenticaSchedeRicevute } from '@/lib/coach'

// La ricerca globale trova anche le schede che il coach mi ha mandato: prima
// l'indice leggeva solo `gymSchede`, e una scheda ricevuta — che GymSchede apre
// per id come le mie — dalla ricerca non si trovava.

const scheda = (id: string, title: string, o: Partial<GymScheda> = {}): GymScheda => ({
  id, title, createdAt: '2026-10-01', updatedAt: '2026-10-01', exercises: [], ...o,
})
const ricevuta = (sc: GymScheda) => ({ id: sc.id, coach_id: 'c1', athlete_id: 'u1', scheda: sc, coach_name: 'Marco', updated_at: '2026-10-01T10:00:00Z' })

describe('la ricerca globale', () => {
  beforeEach(() => {
    localStorage.setItem(storageKey, JSON.stringify({ access_token: 'x', user: { id: 'u1' } }))
    useJarvisStore.setState({ ...EMPTY_STATE, gymSchede: [scheda('mia', 'Push mia'), scheda('bozza-mia', 'Push da finire', { draft: true })] }, true)
    ricordaSchedeRicevute('u1', [ricevuta(scheda('dal-coach', 'Push del coach')), ricevuta(scheda('bozza-coach', 'Push in bozza', { draft: true }))])
  })
  afterEach(() => { cleanup(); dimenticaSchedeRicevute(); localStorage.removeItem(storageKey) })

  it('trova le schede ricevute dal coach accanto alle mie, ma non le sue bozze', async () => {
    const onApri = vi.fn()
    const user = userEvent.setup()
    render(<GlobalSearch open onClose={vi.fn()} onApri={onApri}/>)
    await user.type(screen.getByPlaceholderText('Cerca esercizi, schede…'), 'push')
    expect(screen.getByRole('button', { name: /Push mia/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Push da finire/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Push in bozza/ })).toBeNull()

    await user.click(screen.getByRole('button', { name: /Push del coach/ }))
    expect(onApri).toHaveBeenCalledWith({ tipo: 'scheda', id: 'dal-coach' })
  })
})

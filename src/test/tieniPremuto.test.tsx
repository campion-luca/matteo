import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { JarvisProfile } from '@/features/profile/JarvisProfile'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'

// La Zona pericolosa delle impostazioni: "Svuota le alzate" non chiede più
// conferma con un dialogo, si tiene premuto finché il fondo non si riempie. Un
// tocco breve non deve cancellare niente; da tastiera, dove tenere premuto non
// ha senso, torna il dialogo.

const conAlzate = () => useJarvisStore.setState({
  ...EMPTY_STATE, userName: 'Luca',
  palestraExercises: [{ id: 'p1', n: 'Panca piana', muscle: 'Petto', current: { kg: 60, reps: 10, sets_n: 3 }, history: [{ d: 'W', date: '2026-10-01', kg: 60, reps: 10, sets_n: 3 }] }],
}, true)
const alzate = () => useJarvisStore.getState().palestraExercises[0].history.length

const monta = () => render(
  <ConfirmDeleteProvider>
    <JarvisProfile open onClose={vi.fn()} sezione="impostazioni"/>
    <ConfirmModal/>
  </ConfirmDeleteProvider>,
)

describe('svuotare le alzate si fa tenendo premuto', () => {
  beforeEach(() => { conAlzate(); vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); cleanup() })

  it('un tocco breve non cancella niente', () => {
    monta()
    const tasto = screen.getByRole('button', { name: /Svuota 1 alzata/ })
    fireEvent.pointerDown(tasto, { button: 0 })
    act(() => { vi.advanceTimersByTime(400) })
    fireEvent.pointerUp(tasto)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(alzate()).toBe(1)
  })

  it('tenuto premuto fino in fondo, svuota', () => {
    monta()
    const tasto = screen.getByRole('button', { name: /Svuota 1 alzata/ })
    fireEvent.pointerDown(tasto, { button: 0 })
    act(() => { vi.advanceTimersByTime(1600) })
    expect(alzate()).toBe(0)
  })

  it('da tastiera chiede conferma, e non svuota da solo', () => {
    monta()
    const tasto = screen.getByRole('button', { name: /Svuota 1 alzata/ })
    // Un clic da tastiera arriva con `detail` a 0.
    fireEvent.click(tasto, { detail: 0 })
    expect(screen.getByText('Cancellare tutte le alzate?')).toBeInTheDocument()
    expect(alzate()).toBe(1)
  })
})

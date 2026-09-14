import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useIndietro, useAzioneIndietro } from '@/lib/indietro'

// Il tasto "indietro" in basso: la schermata aperta dichiara dove si torna, la
// nav lo disegna. Le due parti non si conoscono, quindi è qui che si verifica
// che si parlino — e soprattutto che le schermate annidate non si calpestino.

afterEach(cleanup)

describe('registro dell’azione indietro', () => {
  it('senza nessuna schermata aperta non c’è niente da premere', () => {
    const { result } = renderHook(() => useAzioneIndietro())
    expect(result.current).toBeNull()
  })

  it('chi si dichiara diventa il bersaglio del tasto', () => {
    const torna = vi.fn()
    renderHook(() => useIndietro(torna))
    const { result } = renderHook(() => useAzioneIndietro())

    expect(result.current).not.toBeNull()
    act(() => result.current!())
    expect(torna).toHaveBeenCalledOnce()
  })

  it('fra due schermate annidate vince quella aperta per ultima', () => {
    // Gruppo muscolare → esercizio: "indietro" deve riportare al gruppo, non
    // all'elenco dei gruppi.
    const alGruppo = vi.fn()
    const allElenco = vi.fn()
    renderHook(() => useIndietro(allElenco))
    renderHook(() => useIndietro(alGruppo))
    const { result } = renderHook(() => useAzioneIndietro())

    act(() => result.current!())
    expect(alGruppo).toHaveBeenCalledOnce()
    expect(allElenco).not.toHaveBeenCalled()
  })

  it('chiudendo quella sopra riemerge quella sotto', () => {
    // È il motivo per cui serve una pila e non un valore solo: con un valore, la
    // schermata che si chiude azzererebbe tutto e lascerebbe senza freccia
    // quella di sotto, che una via d'uscita ce l'ha.
    const allElenco = vi.fn()
    const alGruppo = vi.fn()
    renderHook(() => useIndietro(allElenco))
    const interna = renderHook(() => useIndietro(alGruppo))
    const { result, rerender } = renderHook(() => useAzioneIndietro())

    interna.unmount()
    rerender()

    expect(result.current).not.toBeNull()
    act(() => result.current!())
    expect(allElenco).toHaveBeenCalledOnce()
    expect(alGruppo).not.toHaveBeenCalled()
  })

  it('una schermata senza uscita non mette niente in pila', () => {
    renderHook(() => useIndietro(undefined))
    const { result } = renderHook(() => useAzioneIndietro())
    expect(result.current).toBeNull()
  })

  it('chiama sempre l’ultima funzione ricevuta, non quella del primo render', () => {
    // La funzione arriva come arrow inline: cambia identità a ogni render di chi
    // la passa. Se il registro tenesse quella del primo giro, "indietro"
    // riporterebbe dove si tornava allora — che con uno stato cambiato nel
    // frattempo è il posto sbagliato.
    const vecchia = vi.fn()
    const nuova = vi.fn()
    const { rerender } = renderHook(({ fn }) => useIndietro(fn), { initialProps: { fn: vecchia } })
    const lettore = renderHook(() => useAzioneIndietro())

    rerender({ fn: nuova })
    act(() => lettore.result.current!())

    expect(nuova).toHaveBeenCalledOnce()
    expect(vecchia).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Pila } from '@/components/ui/Pila'

// Le pagine sono una pila: quella aperta copre quella sotto, che resta montata
// (nascosta) e si ritrova com'era tornando indietro.

afterEach(cleanup)

const strato = (testo: string) => screen.getByText(testo).parentElement as HTMLElement

describe('Pila', () => {
  it('la radice resta montata sotto il gruppo aperto, nascosta', () => {
    render(<Pila radice={<div>radice</div>} master={<div>gruppo</div>} detail={null}/>)
    expect(strato('radice').style.visibility).toBe('hidden')
    expect(strato('gruppo').style.visibility).toBe('')
  })

  it('con la pagina di dettaglio, sono coperte sia la radice sia il gruppo', () => {
    render(<Pila radice={<div>radice</div>} master={<div>gruppo</div>} detail={<div>esercizio</div>}/>)
    expect(strato('radice').style.visibility).toBe('hidden')
    expect(strato('gruppo').style.visibility).toBe('hidden')
    expect(strato('esercizio').style.visibility).toBe('')
  })

  it('tornando indietro la radice è lo stesso elemento di prima, non uno nuovo', () => {
    const { rerender } = render(<Pila radice={<div>radice</div>} master={<div>gruppo</div>} detail={null}/>)
    const prima = screen.getByText('radice')
    rerender(<Pila radice={<div>radice</div>} master={null} detail={null}/>)
    expect(screen.getByText('radice')).toBe(prima)
    expect(strato('radice').style.visibility).toBe('')
  })
})

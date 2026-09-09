/* eslint-disable react-refresh/only-export-components -- file di contesto: co-esporta di proposito Provider (componente) e hook useConfirmDelete */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { t } from '@/lib/i18n'

// Il dialogo nasce per le eliminazioni, ma serve anche ad azioni distruttive che
// non cancellano una riga (svuotare lo storico di un esercizio). `copy` cambia le
// parole senza duplicare focus trap, scrim e accessibilità in un secondo modale.
export interface ConfirmCopy {
  eyebrow?: string
  title?: string
  /** Frase completa. Se manca, si usa quella dell'eliminazione con `label` dentro. */
  body?: string
  cta?: string
  /** Il colore del tasto di conferma. 'danger' (rosso) è il default e resta
   *  giusto per tutto ciò che cancella. Serve 'neutral' perché il dialogo regge
   *  ormai anche scelte che non distruggono niente — il cambio lingua — e un
   *  tasto rosso lì dentro dice "stai per perdere qualcosa", che è falso. */
  tone?: 'danger' | 'neutral'
}

interface PendingConfirm {
  label: string
  copy?: ConfirmCopy
  onConfirm: () => void
}

interface ConfirmDeleteCtx {
  confirmDelete: (onConfirm: () => void, label?: string, copy?: ConfirmCopy) => void
  pending: PendingConfirm | null
  confirm: () => void
  cancel: () => void
}

export const ConfirmDeleteContext = createContext<ConfirmDeleteCtx | null>(null)

export function ConfirmDeleteProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirmDelete = useCallback((onConfirm: () => void, label = t('questo elemento'), copy?: ConfirmCopy) => {
    setPending({ label, copy, onConfirm })
  }, [])

  const confirm = useCallback(() => {
    if (!pending) return
    pending.onConfirm()
    setPending(null)
  }, [pending])

  const cancel = useCallback(() => setPending(null), [])

  return (
    <ConfirmDeleteContext.Provider value={{ confirmDelete, pending, confirm, cancel }}>
      {children}
    </ConfirmDeleteContext.Provider>
  )
}

export function useConfirmDelete() {
  const ctx = useContext(ConfirmDeleteContext)
  if (!ctx) throw new Error('useConfirmDelete: missing ConfirmDeleteProvider')
  return ctx
}

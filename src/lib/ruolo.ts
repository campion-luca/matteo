// Chi è coach. Tutti gli altri sono atleti: lo è chiunque si iscrive, e non c'è
// niente da scrivere perché lo sia.
//
// Il ruolo sta in una tabella sua (supabase/ruoli_schema.sql), e NON nel blob o nel
// profilo: quelli li scrive il titolare, e chiunque potrebbe darsi da solo il titolo
// di coach. In quella tabella dal client non si scrive. Qui si legge soltanto,
// per decidere cosa mostrare: a dire chi può seguire chi resta il database.
//
// L'ultima risposta resta sul telefono, così la pagina del Coaching non cambia
// forma dopo un secondo e senza rete si resta quello che si è.
import { create } from 'zustand'
import { supabase, idUtenteSuDisco } from './supabase'
import { readStorage, writeStorage, removeStorage } from './safeStorage'

const CHIAVE = 'jarvis-ruolo-v1'

function dalDisco(): boolean {
  const raw = readStorage('local', CHIAVE)
  if (!raw) return false
  try {
    const c = JSON.parse(raw) as { userId?: string; coach?: boolean }
    return c.userId === idUtenteSuDisco() && c.coach === true
  } catch {
    return false
  }
}

export const useRuolo = create<{ coach: boolean }>(() => ({ coach: dalDisco() }))

/** Rilegge il ruolo dal server. Non fallisce: senza rete, o senza la tabella,
 *  resta quello che si sapeva. */
export async function aggiornaRuolo(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase.from('coach_abilitati').select('user_id').eq('user_id', userId).limit(1)
    if (error) return
    const coach = (data ?? []).length > 0
    writeStorage('local', CHIAVE, JSON.stringify({ userId, coach }))
    useRuolo.setState({ coach })
  } catch { /* resta quello di prima */ }
}

/** Al logout e al cambio d'account: è dell'account, non del telefono. */
export function dimenticaRuolo(): void {
  removeStorage('local', CHIAVE)
  useRuolo.setState({ coach: false })
}

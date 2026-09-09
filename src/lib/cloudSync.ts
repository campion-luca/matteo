import { supabase } from './supabase'
import type { JarvisState } from '@/store/useJarvisStore'

export interface LoadResult {
  data: Partial<JarvisState>
  updatedAt: string | null
}

export async function loadUserData(userId: string): Promise<LoadResult | null> {
  const { data, error } = await supabase
    .from('user_data')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error          // errore rete/server: NON confonderlo con "nessun dato"
  if (!data) return null          // nessuna riga ancora (utente nuovo) → tieni lo stato locale
  return { data: data.data as Partial<JarvisState>, updatedAt: data.updated_at ?? null }
}

// Legge solo il timestamp della riga remota, senza scaricare il blob:
// serve al bridge per capire se un altro dispositivo ha salvato più di recente.
export async function fetchRemoteUpdatedAt(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_data')
    .select('updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.updated_at ?? null
}

// Salva lo stato e restituisce l'`updated_at` scritto. Lancia in caso di errore
// (rete, sessione scaduta, RLS): nessun salvataggio può fallire in silenzio.
export async function saveUserData(userId: string, state: JarvisState): Promise<string> {
  const { data, error } = await supabase
    .from('user_data')
    .upsert(
      { user_id: userId, data: state, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select('updated_at')
    .single()
  if (error) throw error
  return data.updated_at as string
}

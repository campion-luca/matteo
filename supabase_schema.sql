-- Run this in Supabase > SQL Editor

-- Tabella principale: un record per utente, tutto il dato in JSONB
CREATE TABLE IF NOT EXISTS public.user_data (
  user_id    uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  data       jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Abilita Row Level Security (ogni utente vede SOLO i suoi dati)
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

-- Policy: lettura e scrittura solo per il proprietario
CREATE POLICY "users_own_data" ON public.user_data
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

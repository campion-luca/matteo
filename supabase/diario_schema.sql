-- ═══════════════════════════════════════
-- Il diario personale: i file di ognuno, sotto la foto del profilo.
-- Da eseguire in Supabase → SQL Editor. Rieseguibile: ogni oggetto è creato
-- solo se manca, e le regole si riscrivono.
-- ═══════════════════════════════════════

-- Li vede soltanto chi li ha messi: né il coach, né chi lo segue. Si chiama
-- «personale» per questo. Se un giorno il coach dovrà vederne qualcuno, sarà
-- una scelta file per file, e una regola in più qui sotto.
--
-- Il file sta nello Storage, nel contenitore privato `diario`, nella cartella
-- col proprio id: `<user_id>/<nome a caso>`. La riga di `diario_file` ne dice
-- nome, tipo e peso, e per una pagina HTML la sua memoria (vedi lib/diario.ts).

-- ── Il contenitore ────────────────────────────────────────────
-- Privato: niente indirizzi pubblici, ogni lettura passa dalle regole qui
-- sotto col token di chi chiede. 10 MB a file, come dice l'app.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('diario', 'diario', false, 10485760)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit;

-- Ognuno nella sua cartella, e solo lì: la prima parte del percorso è il suo id.
DROP POLICY IF EXISTS "diario_file_letti_dal_titolare" ON storage.objects;
CREATE POLICY "diario_file_letti_dal_titolare" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'diario' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "diario_file_messi_dal_titolare" ON storage.objects;
CREATE POLICY "diario_file_messi_dal_titolare" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'diario' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Sostituire un file (la stessa voce, contenuto nuovo) è un aggiornamento.
DROP POLICY IF EXISTS "diario_file_sostituiti_dal_titolare" ON storage.objects;
CREATE POLICY "diario_file_sostituiti_dal_titolare" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'diario' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'diario' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "diario_file_tolti_dal_titolare" ON storage.objects;
CREATE POLICY "diario_file_tolti_dal_titolare" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'diario' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ── Le voci ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.diario_file (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  nome        text NOT NULL,
  tipo        text NOT NULL DEFAULT '',
  dimensione  bigint NOT NULL DEFAULT 0,
  percorso    text NOT NULL UNIQUE,
  -- Quello che una pagina HTML si salva (chiave → testo, come il suo
  -- localStorage). Vuota per gli altri file.
  memoria     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Quando è cambiato il CONTENUTO (caricato o sostituito), non la memoria.
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diario_lunghezze CHECK (
    char_length(nome) BETWEEN 1 AND 200 AND char_length(tipo) <= 100
    AND char_length(percorso) <= 300 AND dimensione >= 0
  ),
  -- La voce punta solo dentro la cartella di chi la possiede.
  CONSTRAINT diario_percorso_suo CHECK (split_part(percorso, '/', 1) = user_id::text),
  -- 1 MB di memoria a pagina: il gestionale della dieta ne usa una decina di kB.
  CONSTRAINT diario_memoria_piccola CHECK (memoria IS NULL OR octet_length(memoria::text) <= 1048576)
);

CREATE INDEX IF NOT EXISTS diario_file_user_idx ON public.diario_file (user_id, created_at DESC);

ALTER TABLE public.diario_file ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diario_voci_del_titolare" ON public.diario_file;
CREATE POLICY "diario_voci_del_titolare" ON public.diario_file
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';

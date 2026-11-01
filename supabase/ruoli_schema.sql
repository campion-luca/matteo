-- ═══════════════════════════════════════
-- I ruoli: chi è coach. Tutti gli altri sono atleti.
-- Da eseguire in Supabase → SQL Editor, DOPO coach_schema.sql e profili_schema.sql.
-- Rieseguibile: ogni oggetto è creato solo se manca.
-- ═══════════════════════════════════════

-- Una riga per coach. Chi non c'è è un atleta: così lo è chiunque si iscrive, senza
-- un trigger sulla registrazione che possa saltare.
--
-- In una tabella sua e non in una colonna di `profili`: il profilo lo scrive il suo
-- titolare, e la RLS lavora per righe, non per colonne. Una colonna lì dentro
-- avrebbe lasciato a chiunque la possibilità di promuoversi con una chiamata REST.
CREATE TABLE IF NOT EXISTS public.coach_abilitati (
  user_id    uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_abilitati ENABLE ROW LEVEL SECURITY;

-- Ognuno può sapere solo se è coach lui. Nessuna policy di scrittura, di proposito:
-- dal client non si diventa coach. Si aggiunge una riga da qui, dall'SQL Editor,
-- con l'id dell'account (Authentication → Users):
--   INSERT INTO public.coach_abilitati (user_id) VALUES ('…') ON CONFLICT DO NOTHING;
DROP POLICY IF EXISTS "coach_vede_se_stesso" ON public.coach_abilitati;
CREATE POLICY "coach_vede_se_stesso" ON public.coach_abilitati
  FOR SELECT USING (auth.uid() = user_id);


-- ── L'elenco dei coach, per chi ne cerca uno ──────────────────
-- Una funzione e non una policy su `profili`: una policy di lettura apre la riga
-- intera, e lì dentro ci sono la data di nascita, l'età, gli infortuni. Qui escono
-- solo nome, foto e quello che un coach racconta del proprio lavoro.
CREATE OR REPLACE FUNCTION public.elenco_coach()
RETURNS TABLE (user_id uuid, nome text, cognome text, foto text, focus text, bio text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT c.user_id, p.nome, p.cognome, p.foto, p.dettagli ->> 'focus', p.dettagli ->> 'bio'
    FROM public.coach_abilitati c
    LEFT JOIN public.profili p ON p.user_id = c.user_id
   WHERE auth.uid() IS NOT NULL
   ORDER BY p.nome NULLS LAST, c.created_at;
$$;

REVOKE ALL ON FUNCTION public.elenco_coach() FROM public;
GRANT EXECUTE ON FUNCTION public.elenco_coach() TO authenticated;


-- ── Solo un coach segue qualcuno ──────────────────────────────
-- Un trigger sui collegamenti e non un controllo nell'app: lì sarebbe una cortesia.
-- Vale solo per quelli nuovi: chi segue già qualcuno lo continua a seguire.
CREATE OR REPLACE FUNCTION public.solo_coach_segue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.coach_abilitati c WHERE c.user_id = NEW.coach_id) THEN
    RAISE EXCEPTION 'NON_COACH';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS coach_links_solo_coach ON public.coach_links;
CREATE TRIGGER coach_links_solo_coach
  BEFORE INSERT ON public.coach_links
  FOR EACH ROW EXECUTE FUNCTION public.solo_coach_segue();

NOTIFY pgrst, 'reload schema';

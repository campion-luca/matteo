-- ═══════════════════════════════════════════════════════════════
-- Il profilo di ognuno: chi è, con la faccia
-- Da eseguire in Supabase → SQL Editor, DOPO coach_schema.sql (le regole di
-- lettura guardano `coach_links`). Rieseguibile: ogni oggetto è creato solo se
-- manca.
-- ═══════════════════════════════════════════════════════════════

-- Una riga per persona, in una tabella sua e NON nel blob `user_data`.
--
-- Due motivi. Il primo è chi la legge: il blob non lo legge nessun altro (dentro
-- ci sono anche cose che a un allenatore non servono), il profilo invece esiste
-- per farsi leggere da chi ti segue e da chi segui. Il secondo è il peso: il
-- blob l'app lo rimanda per intero a ogni salvataggio — a ogni serie spuntata —
-- e una foto lì dentro viaggerebbe decine di volte per allenamento. Qui si
-- scrive quando la si cambia e si legge quando serve.
CREATE TABLE IF NOT EXISTS public.profili (
  user_id     uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  nome        text,
  cognome     text,
  -- La foto, già piccola: un quadrato di 256 px compresso dall'app prima di
  -- partire (vedi src/lib/fotoProfilo.ts), una ventina di kB. Come testo e non
  -- su Storage: un file così piccolo non vale un bucket, le sue policy e una
  -- seconda richiesta per ogni faccia di un elenco.
  foto        text,
  -- Quando è cambiata la foto, e solo lei. L'app tiene le foto sul telefono e
  -- la riscarica solo se questo è diverso da quello che ha: chi segue trenta
  -- persone non si ritira giù trenta foto a ogni apertura del Coaching.
  foto_agg    timestamptz,
  -- L'età. La data di nascita se c'è, perché l'età che se ne ricava invecchia da
  -- sé; altrimenti il numero scritto nel profilo.
  nascita     date,
  eta         smallint,
  -- Tutto il resto — da quando ti alleni, i focus, il percorso, il curriculum —
  -- in un documento solo. È la parte che cambierà: "non ho ancora pensato a
  -- come e cosa". Un campo nuovo lì dentro non chiede di rieseguire questo file.
  dettagli    jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- Solo immagini, e in forma di data URL: è quello che finisce dentro un <img>
  -- sul telefono di un altro, e niente che non sia un'immagine ci deve arrivare.
  CONSTRAINT foto_e_un_immagine CHECK (foto IS NULL OR foto ~ '^data:image/(jpeg|png|webp);base64,'),
  -- Un tetto largo (la foto dell'app pesa un decimo): ferma chi volesse usare la
  -- riga come magazzino scrivendoci a mano.
  CONSTRAINT foto_piccola CHECK (foto IS NULL OR length(foto) <= 200000),
  CONSTRAINT nome_corto CHECK (nome IS NULL OR length(nome) <= 40),
  CONSTRAINT cognome_corto CHECK (cognome IS NULL OR length(cognome) <= 40),
  CONSTRAINT eta_sensata CHECK (eta IS NULL OR eta BETWEEN 5 AND 120),
  CONSTRAINT dettagli_contenuti CHECK (length(dettagli::text) <= 20000)
);

ALTER TABLE public.profili ENABLE ROW LEVEL SECURITY;

-- Chi lo vede: io, e chi è collegato a me in uno dei due versi — il mio coach e
-- chi alleno. Nessun altro: non è un social, e un profilo con la faccia e l'età
-- non deve potersi leggere da chiunque conosca un uuid.
-- Quando il collegamento si scioglie, il profilo smette di vedersi da solo.
DROP POLICY IF EXISTS "profilo_visibile_ai_collegati" ON public.profili;
CREATE POLICY "profilo_visibile_ai_collegati" ON public.profili
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.coach_links l
       WHERE (l.coach_id = auth.uid() AND l.athlete_id = profili.user_id)
          OR (l.athlete_id = auth.uid() AND l.coach_id = profili.user_id)
    )
  );

-- Lo scrive solo chi ci è dentro.
DROP POLICY IF EXISTS "profilo_scritto_dal_titolare" ON public.profili;
CREATE POLICY "profilo_scritto_dal_titolare" ON public.profili
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "profilo_modificato_dal_titolare" ON public.profili;
CREATE POLICY "profilo_modificato_dal_titolare" ON public.profili
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "profilo_cancellato_dal_titolare" ON public.profili;
CREATE POLICY "profilo_cancellato_dal_titolare" ON public.profili
  FOR DELETE USING (auth.uid() = user_id);

-- `foto_agg` e `updated_at` li decide il server. L'app salva a pezzi (la foto da
-- una parte, i testi dall'altra): se toccasse a lei ricordarsi di aggiornare
-- `foto_agg`, basterebbe un salvataggio che se ne dimentica perché gli altri
-- telefoni tengano la foto vecchia per sempre.
CREATE OR REPLACE FUNCTION public.profilo_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.foto IS DISTINCT FROM OLD.foto THEN
    NEW.foto_agg := CASE WHEN NEW.foto IS NULL THEN NULL ELSE now() END;
  ELSE
    NEW.foto_agg := OLD.foto_agg;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profili_date ON public.profili;
CREATE TRIGGER profili_date
  BEFORE INSERT OR UPDATE ON public.profili
  FOR EACH ROW EXECUTE FUNCTION public.profilo_date();

NOTIFY pgrst, 'reload schema';

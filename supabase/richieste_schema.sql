-- ═══════════════════════════════════════
-- Le richieste di essere seguiti.
-- Da eseguire in Supabase → SQL Editor, DOPO coach_schema.sql, profili_schema.sql
-- e ruoli_schema.sql. Rieseguibile: ogni oggetto è creato solo se manca.
-- ═══════════════════════════════════════

-- Chi cerca un coach lo sceglie dall'elenco «Trova un coach» e gli chiede di
-- seguirlo; il coach accetta (si collegano) o rifiuta. È la seconda strada
-- accanto al codice, che resta: lì il gesto lo fa l'allievo dando il codice,
-- qui lo fa chiedendo. In tutti e due i casi è l'allievo a scegliere di
-- condividere i suoi dati.
--
-- Una richiesta per volta: per chiederlo a un altro coach si annulla prima
-- quella in attesa. Senza, un allievo poteva scrivere a dieci coach insieme, e
-- al primo che accettava gli altri nove si ritrovavano richieste già vecchie.
-- La chiave è l'allievo: una richiesta per volta, la regola sta nella tabella.
CREATE TABLE IF NOT EXISTS public.coach_richieste (
  athlete_id   uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  coach_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  -- Il nome dell'allievo quando ha chiesto: il coach non lo vedrebbe altrimenti,
  -- perché il profilo di chi non è collegato non si legge (vedi più sotto).
  athlete_name text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT richiesta_lunghezze CHECK (coalesce(char_length(athlete_name), 0) <= 200)
);

CREATE INDEX IF NOT EXISTS coach_richieste_coach_idx ON public.coach_richieste (coach_id);

ALTER TABLE public.coach_richieste ENABLE ROW LEVEL SECURITY;

-- «Questa persona è coach?», per la regola qui sotto. Una funzione e non una
-- lettura di `coach_abilitati` dentro la regola: lì ognuno vede solo la propria
-- riga, quindi chi chiede non vedrebbe mai quella del coach, e la richiesta non
-- passerebbe mai. Risponde sì o no e basta.
CREATE OR REPLACE FUNCTION public.e_coach(p_user uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.coach_abilitati c WHERE c.user_id = p_user);
$$;

REVOKE ALL ON FUNCTION public.e_coach(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.e_coach(uuid) TO authenticated;

-- La vedono le due parti, e nessun altro.
DROP POLICY IF EXISTS "richieste_visibili_alle_due_parti" ON public.coach_richieste;
CREATE POLICY "richieste_visibili_alle_due_parti" ON public.coach_richieste
  FOR SELECT USING (auth.uid() = athlete_id OR auth.uid() = coach_id);

-- La fa solo l'allievo, a nome proprio, a qualcuno che è davvero coach, e solo
-- se non ha già un coach (uno per volta, come nel riscatto del codice).
DROP POLICY IF EXISTS "richieste_fatte_dall_allievo" ON public.coach_richieste;
CREATE POLICY "richieste_fatte_dall_allievo" ON public.coach_richieste
  FOR INSERT WITH CHECK (
    auth.uid() = athlete_id
    AND coach_id <> athlete_id
    AND public.e_coach(coach_id)
    AND NOT EXISTS (SELECT 1 FROM public.coach_links l WHERE l.athlete_id = auth.uid())
  );

-- La toglie l'allievo (annulla) o il coach (rifiuta). Non si modifica: si
-- annulla e se ne fa un'altra. Nessuna policy di UPDATE, di proposito.
DROP POLICY IF EXISTS "richieste_tolte_da_entrambi" ON public.coach_richieste;
CREATE POLICY "richieste_tolte_da_entrambi" ON public.coach_richieste
  FOR DELETE USING (auth.uid() = athlete_id OR auth.uid() = coach_id);


-- ── Accettare ─────────────────────────────────────────────────
-- SECURITY DEFINER perché crea il collegamento, che dal client non si scrive.
-- I controlli sono quelli del riscatto del codice: chi accetta è coach, la
-- richiesta c'è ed è per lui, l'allievo non ha già un altro coach.
CREATE OR REPLACE FUNCTION public.accetta_richiesta(p_athlete uuid, p_coach_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.coach_richieste;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NON_AUTENTICATO';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.coach_abilitati c WHERE c.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'NON_COACH';
  END IF;

  -- `FOR UPDATE`: due tocchi su «Accetta» arrivati insieme non creano due volte
  -- la stessa cosa; il secondo trova la richiesta già tolta.
  SELECT * INTO r
    FROM public.coach_richieste q
   WHERE q.athlete_id = p_athlete AND q.coach_id = auth.uid()
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RICHIESTA_SPARITA';
  END IF;

  IF EXISTS (SELECT 1 FROM public.coach_links l WHERE l.athlete_id = p_athlete AND l.coach_id <> auth.uid()) THEN
    RAISE EXCEPTION 'GIA_SEGUITO';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.coach_links l WHERE l.athlete_id = p_athlete AND l.coach_id = auth.uid()) THEN
    INSERT INTO public.coach_links (coach_id, athlete_id, athlete_name, coach_name)
    VALUES (auth.uid(), p_athlete, r.athlete_name, left(p_coach_name, 200));
  END IF;

  -- La richiesta ha fatto il suo lavoro.
  DELETE FROM public.coach_richieste q WHERE q.athlete_id = p_athlete;
END $$;

REVOKE ALL ON FUNCTION public.accetta_richiesta(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accetta_richiesta(uuid, text) TO authenticated;


-- ── Un collegamento nuovo chiude la richiesta in attesa ───────
-- Chi aveva chiesto a un coach e intanto si collega a un altro col codice non
-- deve lasciare in giro la richiesta: il primo coach continuerebbe a vederla, e
-- accettandola troverebbe «ha già un coach». Vale per qualunque strada crei il
-- collegamento, codice o richiesta accettata.
CREATE OR REPLACE FUNCTION public.collegato_chiude_richiesta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.coach_richieste q WHERE q.athlete_id = NEW.athlete_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS coach_links_chiude_richiesta ON public.coach_links;
CREATE TRIGGER coach_links_chiude_richiesta
  AFTER INSERT ON public.coach_links
  FOR EACH ROW EXECUTE FUNCTION public.collegato_chiude_richiesta();


-- ── La faccia di chi chiede ───────────────────────────────────
-- Il profilo si legge solo fra collegati (profili_schema.sql). Al coach a cui
-- si chiede servono nome e foto di chi chiede, per sapere chi sta accettando:
-- li dà questa funzione, e solo quelli. Non una regola di lettura su `profili`,
-- che aprirebbe la riga intera — data di nascita, età, infortuni — a chi non
-- è ancora stato scelto (la stessa scelta di `elenco_coach`, in ruoli_schema.sql).
DROP POLICY IF EXISTS "profilo_visibile_al_coach_a_cui_si_chiede" ON public.profili;

CREATE OR REPLACE FUNCTION public.facce_richiedenti()
RETURNS TABLE (user_id uuid, nome text, cognome text, foto text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.user_id, p.nome, p.cognome, p.foto
    FROM public.coach_richieste q
    JOIN public.profili p ON p.user_id = q.athlete_id
   WHERE q.coach_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.facce_richiedenti() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.facce_richiedenti() TO authenticated;

NOTIFY pgrst, 'reload schema';

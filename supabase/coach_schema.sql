-- ═══════════════════════════════════════════════════════════════
-- Collegamento personal trainer ⇄ atleta
-- Da eseguire in Supabase → SQL Editor, DOPO supabase_schema.sql.
-- È scritto per essere rieseguibile: ogni oggetto è creato solo se manca.
-- ═══════════════════════════════════════════════════════════════

-- ── Chi segue chi ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_links (
  coach_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  athlete_id   uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  -- I nomi sono COPIATI qui al momento del collegamento. Senza, per scrivere
  -- "Luca" nella lista dell'allenatore servirebbe leggere il profilo dell'altro,
  -- cioè esattamente il permesso che questo schema è fatto per non concedere.
  athlete_name text,
  coach_name   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (coach_id, athlete_id),
  CONSTRAINT no_self_coaching CHECK (coach_id <> athlete_id)
);

CREATE INDEX IF NOT EXISTS coach_links_athlete_idx ON public.coach_links (athlete_id);

ALTER TABLE public.coach_links ENABLE ROW LEVEL SECURITY;

-- Il collegamento è visibile a entrambe le parti: l'atleta deve poter vedere chi
-- lo sta guardando, altrimenti "puoi revocare quando vuoi" è una promessa vuota.
DROP POLICY IF EXISTS "link_visible_to_both" ON public.coach_links;
CREATE POLICY "link_visible_to_both" ON public.coach_links
  FOR SELECT USING (auth.uid() = coach_id OR auth.uid() = athlete_id);

-- E scioglibile da entrambe. L'atleta perché è il suo dato; l'allenatore perché
-- deve poter togliere dalla lista chi non segue più.
DROP POLICY IF EXISTS "link_deletable_by_both" ON public.coach_links;
CREATE POLICY "link_deletable_by_both" ON public.coach_links
  FOR DELETE USING (auth.uid() = coach_id OR auth.uid() = athlete_id);

-- Nessuna policy di INSERT: un collegamento NON si crea scrivendo in tabella,
-- si crea riscattando un codice (vedi redeem_coach_code). Se l'insert diretto
-- fosse permesso, chiunque conoscesse l'uuid di un altro utente potrebbe
-- aggiungersi come suo allenatore senza che quello lo sappia.


-- ── I codici d'invito ──────────────────────────────────────────
-- È l'ATLETA a generare il codice e a darlo all'allenatore, non il contrario.
-- Il verso conta: chi condivide i propri dati deve essere quello che compie il
-- gesto. Nell'altro verso l'allenatore inviterebbe e all'atleta resterebbe solo
-- da accettare — un consenso che si dà per stanchezza.
CREATE TABLE IF NOT EXISTS public.coach_invites (
  code         text PRIMARY KEY,
  athlete_id   uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  athlete_name text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- I codici scadono: uno lasciato in una chat vecchia non deve restare una
  -- chiave valida per sempre.
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '7 days'
);

CREATE INDEX IF NOT EXISTS coach_invites_athlete_idx ON public.coach_invites (athlete_id);

ALTER TABLE public.coach_invites ENABLE ROW LEVEL SECURITY;

-- Un utente vede e gestisce SOLO i propri inviti. In particolare NON può leggere
-- la tabella per cercare codici altrui: il riscatto passa da una funzione.
DROP POLICY IF EXISTS "invite_owner" ON public.coach_invites;
CREATE POLICY "invite_owner" ON public.coach_invites
  FOR ALL USING (auth.uid() = athlete_id) WITH CHECK (auth.uid() = athlete_id);


-- ── Riscatto del codice ────────────────────────────────────────
-- SECURITY DEFINER perché l'allenatore deve poter risolvere un codice che non è
-- suo, senza per questo poter leggere la tabella degli inviti.
CREATE OR REPLACE FUNCTION public.redeem_coach_code(p_code text, p_coach_name text)
RETURNS TABLE (athlete_id uuid, athlete_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- `RETURNS TABLE (athlete_id, athlete_name)` non dichiara solo la forma del
-- risultato: crea due VARIABILI plpgsql con quei nomi, vive in tutto il corpo.
-- Da lì in poi ogni `athlete_id` scritto NUDO dentro una query è ambiguo fra la
-- variabile e la colonna omonima di coach_links, e il riscatto moriva con
-- «column reference "athlete_id" is ambiguous» invece di collegare l'allievo.
--
-- Questa direttiva dice che in caso di omonimia vince la COLONNA. È giusto per
-- l'intera funzione: quelle due variabili non vengono mai lette (il valore da
-- restituire arriva da `inv`), quindi non c'è un solo posto in cui volessimo la
-- variabile. Va prima di DECLARE, ed è l'unica riga che può stare lì.
-- Il corpo qui sotto non ne ha comunque bisogno — vedi l'upsert — ma resta:
-- è la rete per la prossima colonna nominata nuda che qualcuno aggiungerà.
#variable_conflict use_column
DECLARE
  inv public.coach_invites;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NON_AUTENTICATO';
  END IF;

  SELECT * INTO inv
    FROM public.coach_invites
   WHERE code = upper(btrim(p_code))
     AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CODICE_NON_VALIDO';
  END IF;

  IF inv.athlete_id = auth.uid() THEN
    RAISE EXCEPTION 'CODICE_TUO';
  END IF;

  -- Aggiorna-o-inserisci scritto a mano invece di ON CONFLICT. Non è gusto
  -- personale: il bersaglio dell'ON CONFLICT — `(coach_id, athlete_id)` — è il
  -- solo posto in cui una colonna va nominata NUDA per forza, e con una variabile
  -- omonima in scope quella riga è ambigua qualunque cosa si faccia. Qui invece
  -- ogni colonna dentro un'espressione è qualificata con l'alias `l`, e la lista
  -- di colonne dell'INSERT non è un'espressione: l'ambiguità non può ripresentarsi
  -- nemmeno se qualcuno un giorno togliesse la direttiva qui sopra.
  UPDATE public.coach_links l
     SET athlete_name = inv.athlete_name,
         coach_name   = p_coach_name
   WHERE l.coach_id   = auth.uid()
     AND l.athlete_id = inv.athlete_id;

  -- Se l'UPDATE ha trovato la riga erano già collegati, e i nomi sono appena
  -- stati rinfrescati: il legame si crea solo quando non c'era.
  IF NOT FOUND THEN
    INSERT INTO public.coach_links (coach_id, athlete_id, athlete_name, coach_name)
    VALUES (auth.uid(), inv.athlete_id, inv.athlete_name, p_coach_name);
  END IF;

  -- Il codice si consuma: è un invito, non una password permanente.
  DELETE FROM public.coach_invites WHERE code = inv.code;

  RETURN QUERY SELECT inv.athlete_id, inv.athlete_name;
END $$;

REVOKE ALL ON FUNCTION public.redeem_coach_code(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.redeem_coach_code(text, text) TO authenticated;


-- ── Cosa vede l'allenatore ─────────────────────────────────────
-- NON si dà all'allenatore una policy di SELECT su `user_data`.
--
-- Quella riga contiene TUTTO lo stato dell'utente in un unico blob, stipendio,
-- spese fisse e obiettivo di risparmio compresi. Una policy per riga avrebbe
-- concesso al personal trainer di leggere le finanze del suo allievo, il che non
-- è ciò che si intende con "vedere gli allenamenti".
--
-- Questa funzione ricompone un blob RIDOTTO ai campi dell'allenamento. Il filtro
-- sta nel database e non nel client: un filtro fatto nell'app sarebbe una
-- cortesia, non una regola, e basterebbe una chiamata REST scritta a mano per
-- scavalcarlo.
CREATE OR REPLACE FUNCTION public.athlete_training_data(p_athlete uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'userName',          d.data -> 'userName',
    'userSex',           d.data -> 'userSex',
    'userAge',           d.data -> 'userAge',
    'userWeight',        d.data -> 'userWeight',
    'userHeight',        d.data -> 'userHeight',
    'palestraExercises', d.data -> 'palestraExercises',
    'hyroxExercises',    d.data -> 'hyroxExercises',
    'gymSchede',         d.data -> 'gymSchede',
    -- Lo storico delle pesate: è la curva che un allenatore guarda per prima.
    -- Il COALESCE regge i blob salvati prima che le pesate uscissero da `kcal`,
    -- il contenitore del vecchio calcolo calorico: un allievo che non ha ancora
    -- riaperto l'app ha il dato solo nella posizione vecchia, e senza questo
    -- ramo il suo allenatore vedrebbe un grafico del peso vuoto.
    'weightLog',         COALESCE(
                           d.data -> 'weightLog',
                           d.data -> 'kcal' -> 'weightLog',
                           '[]'::jsonb
                         ),
    'updatedAt',         to_jsonb(d.updated_at)
  )
  FROM public.user_data d
  WHERE d.user_id = p_athlete
    AND EXISTS (
      SELECT 1 FROM public.coach_links l
       WHERE l.athlete_id = p_athlete
         AND l.coach_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.athlete_training_data(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.athlete_training_data(uuid) TO authenticated;


-- ── Manutenzione ───────────────────────────────────────────────
-- Gli inviti scaduti non fanno danno (la query li esclude) ma si accumulano.
-- Da chiamare a mano ogni tanto, o da un cron se un giorno ne servirà uno.
CREATE OR REPLACE FUNCTION public.purge_expired_coach_invites()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.coach_invites WHERE expires_at < now();
$$;


-- ── Le schede assegnate dall'allenatore ────────────────────────
-- Vivono in una TABELLA e non dentro il blob dell'atleta.
--
-- Il motivo è il modo in cui l'app salva: `user_data.data` è un documento unico
-- che il client riscrive PER INTERO ad ogni modifica, partendo dalla copia che ha
-- in memoria. Se l'allenatore scrivesse una scheda là dentro, il primo
-- salvataggio dell'atleta — partito da una copia letta prima — la cancellerebbe
-- senza un errore e senza che nessuno dei due se ne accorga. Righe separate non
-- hanno questo problema: le due parti scrivono su oggetti diversi.
CREATE TABLE IF NOT EXISTS public.coach_schede (
  -- TESTO e non uuid: l'id è quello della GymScheda, generato dal client nella
  -- forma "sc<base36><random>" (vedi src/lib/uid.ts). Su una colonna uuid ogni
  -- insert fallirebbe con "invalid input syntax for type uuid", e l'alternativa
  -- — generare qui un id diverso — vorrebbe dire due identità per la stessa
  -- scheda, una nell'app e una nel database.
  id           text PRIMARY KEY,
  coach_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  athlete_id   uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  -- Una GymScheda intera, nella stessa forma che ha nell'app: l'atleta la esegue
  -- col codice che già c'è, senza un secondo modello da tenere allineato a mano.
  scheda       jsonb NOT NULL,
  -- Copiato qui come per i link: scrivere "da Marco" nella lista dell'atleta
  -- senza dover leggere il profilo di Marco, cioè senza il permesso che questo
  -- schema esiste per non concedere.
  coach_name   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Riallinea chi avesse eseguito la prima stesura, dove `id` era uuid. Su una
-- tabella vuota non fa nulla di visibile; con dentro delle righe, uuid → text è
-- una conversione che non perde niente.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'coach_schede'
       AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.coach_schede ALTER COLUMN id TYPE text USING id::text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS coach_schede_athlete_idx ON public.coach_schede (athlete_id);
CREATE INDEX IF NOT EXISTS coach_schede_coach_idx   ON public.coach_schede (coach_id);

ALTER TABLE public.coach_schede ENABLE ROW LEVEL SECURITY;

-- Visibile a entrambi: all'atleta perché deve allenarcisi, all'allenatore perché
-- l'ha scritta lui e deve poterla rivedere.
DROP POLICY IF EXISTS "schede_visible_to_both" ON public.coach_schede;
CREATE POLICY "schede_visible_to_both" ON public.coach_schede
  FOR SELECT USING (auth.uid() = coach_id OR auth.uid() = athlete_id);

-- Scrive SOLO l'allenatore, e solo verso un atleta che lo ha collegato. Il
-- controllo sul collegamento sta qui e non nell'app: un filtro fatto nel client
-- sarebbe una cortesia, e basterebbe una chiamata REST scritta a mano per
-- assegnare schede a un utente qualsiasi di cui si conosca l'uuid.
DROP POLICY IF EXISTS "schede_written_by_coach" ON public.coach_schede;
CREATE POLICY "schede_written_by_coach" ON public.coach_schede
  FOR INSERT WITH CHECK (
    auth.uid() = coach_id AND EXISTS (
      SELECT 1 FROM public.coach_links l
       WHERE l.coach_id = auth.uid() AND l.athlete_id = coach_schede.athlete_id
    )
  );

-- La modifica resta dell'allenatore: la scheda è il suo lavoro, e un atleta che
-- la riscrive senza dirglielo gli toglierebbe il senso di averla assegnata.
DROP POLICY IF EXISTS "schede_updated_by_coach" ON public.coach_schede;
CREATE POLICY "schede_updated_by_coach" ON public.coach_schede
  FOR UPDATE USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);

-- Cancellabile da entrambi. Dall'allenatore perché l'ha scritta lui; dall'atleta
-- perché è roba che gli compare in casa, e poterla togliere è il minimo — è lo
-- stesso principio con cui il collegamento si scioglie da tutte e due le parti.
DROP POLICY IF EXISTS "schede_deletable_by_both" ON public.coach_schede;
CREATE POLICY "schede_deletable_by_both" ON public.coach_schede
  FOR DELETE USING (auth.uid() = coach_id OR auth.uid() = athlete_id);


-- ── Le note che l'allenatore scrive sugli esercizi dell'allievo ─
-- Stessa scelta delle schede, e per lo stesso motivo: una riga per nota, non un
-- campo dentro il blob dell'allievo, che il suo client riscrive per intero.
--
-- La chiave è la terna (allenatore, allievo, esercizio): due allenatori che
-- seguono la stessa persona scrivono note distinte sullo stesso esercizio, e
-- nessuno dei due sovrascrive l'altro.
CREATE TABLE IF NOT EXISTS public.coach_note (
  coach_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  athlete_id   uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  -- L'id del PalestraExercise nell'app dell'allievo. È testo e non uuid: gli id
  -- degli esercizi sono generati dal client nella forma "px_xxxx", e forzarli a
  -- uuid qui vorrebbe dire riscriverli tutti in casa di chi già ce li ha.
  exercise_id  text NOT NULL,
  nota         text NOT NULL,
  coach_name   text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (coach_id, athlete_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS coach_note_athlete_idx ON public.coach_note (athlete_id);

ALTER TABLE public.coach_note ENABLE ROW LEVEL SECURITY;

-- Visibile a entrambi: la nota esiste per essere letta dall'allievo.
DROP POLICY IF EXISTS "note_visible_to_both" ON public.coach_note;
CREATE POLICY "note_visible_to_both" ON public.coach_note
  FOR SELECT USING (auth.uid() = coach_id OR auth.uid() = athlete_id);

-- Scrive solo l'allenatore, e solo verso chi lo ha collegato.
DROP POLICY IF EXISTS "note_written_by_coach" ON public.coach_note;
CREATE POLICY "note_written_by_coach" ON public.coach_note
  FOR INSERT WITH CHECK (
    auth.uid() = coach_id AND EXISTS (
      SELECT 1 FROM public.coach_links l
       WHERE l.coach_id = auth.uid() AND l.athlete_id = coach_note.athlete_id
    )
  );

DROP POLICY IF EXISTS "note_updated_by_coach" ON public.coach_note;
CREATE POLICY "note_updated_by_coach" ON public.coach_note
  FOR UPDATE USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);

-- Cancellabile da entrambi, come tutto il resto: quello che compare in casa di
-- qualcuno, quel qualcuno deve poterlo togliere.
DROP POLICY IF EXISTS "note_deletable_by_both" ON public.coach_note;
CREATE POLICY "note_deletable_by_both" ON public.coach_note
  FOR DELETE USING (auth.uid() = coach_id OR auth.uid() = athlete_id);

-- ═══════════════════════════════════════════════════════════════
-- Una copia al giorno dei dati di ogni utente
-- Da eseguire in Supabase → SQL Editor, DOPO supabase_schema.sql.
-- Facoltativo: l'app funziona uguale con o senza. È rieseguibile.
-- ═══════════════════════════════════════════════════════════════
--
-- `user_data` tiene UNA riga per utente, e l'app la riscrive per intero a ogni
-- salvataggio. Vuol dire che qualunque cosa vada storta nella sincronizzazione —
-- un dispositivo rimasto indietro che vince un conflitto, una versione vecchia
-- dell'app, un errore di chi scrive il codice — non lascia niente da cui
-- tornare indietro: il dato di prima è stato sovrascritto.
--
-- Questa tabella tiene la riga com'era PRIMA della prima modifica di ogni
-- giorno: cioè lo stato della sera prima. Quattordici giorni, poi si butta.
-- L'app non la legge (per ora): serve a te, dalla dashboard, il giorno che a
-- qualcuno spariscono i dati. Per rimetterli a posto si copia il campo `data`
-- del giorno giusto dentro `user_data` E si aggiorna `updated_at`:
--
--   UPDATE public.user_data u
--      SET data = s.data, updated_at = now()
--     FROM public.user_data_storico s
--    WHERE u.user_id = '<id utente>' AND s.user_id = u.user_id AND s.giorno = '<giorno>';
--
-- L'orario è indispensabile: i dispositivi capiscono che il cloud è cambiato
-- solo da lì, e senza toccarlo il primo che salva riscriverebbe sopra i dati
-- appena ripristinati. (Chi ha modifiche non ancora inviate le tiene per ciò
-- che ha creato lui, come in ogni conflitto.)

CREATE TABLE IF NOT EXISTS public.user_data_storico (
  user_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  -- Il giorno in cui è stata fatta la copia. Contiene lo stato com'era alla
  -- fine del giorno PRIMA (o comunque prima della prima modifica di questo).
  giorno      date NOT NULL,
  data        jsonb NOT NULL,
  salvato_il  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, giorno)
);

ALTER TABLE public.user_data_storico ENABLE ROW LEVEL SECURITY;

-- Ognuno può leggere le proprie copie, e nient'altro. Nessuna policy di
-- scrittura: a scrivere è solo la funzione qui sotto, che gira coi permessi di
-- chi l'ha creata — dall'app non si possono né aggiungere né cancellare copie.
DROP POLICY IF EXISTS "storico_proprio" ON public.user_data_storico;
CREATE POLICY "storico_proprio" ON public.user_data_storico
  FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.conserva_user_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Una copia sola al giorno: la prima modifica della giornata conserva la riga
  -- com'era, le successive trovano già la copia e non fanno niente.
  INSERT INTO public.user_data_storico (user_id, giorno, data)
  VALUES (OLD.user_id, current_date, OLD.data)
  ON CONFLICT (user_id, giorno) DO NOTHING;

  DELETE FROM public.user_data_storico
   WHERE user_id = OLD.user_id AND giorno < current_date - 14;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS conserva_user_data ON public.user_data;
CREATE TRIGGER conserva_user_data
  BEFORE UPDATE ON public.user_data
  FOR EACH ROW EXECUTE FUNCTION public.conserva_user_data();

NOTIFY pgrst, 'reload schema';

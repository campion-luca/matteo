# Setup Supabase Storage — allegati delle schede

Gli allegati delle schede palestra (foto compresse e PDF) non vivono più nel blob
`user_data` (base64), ma su **Supabase Storage**, nel bucket privato `schede`.
Questi passaggi vanno eseguiti **una volta** dalla dashboard Supabase del progetto.

## 1. Crea il bucket privato

Dashboard → **Storage** → **New bucket**:

- **Name**: `schede`
- **Public bucket**: **OFF** (deve restare privato — la lettura avviene con signed URL a scadenza)
- **File size limit** (consigliato): `3 MB` (coerente col limite lato app)
- **Allowed MIME types** (opzionale ma consigliato): `image/jpeg, image/png, image/webp, application/pdf`

## 2. Policy RLS su `storage.objects`

Ogni file è salvato sotto il path `${auth.uid()}/schede/...`, quindi le policy
consentono a un utente di operare solo sui file dentro la propria cartella
(il primo segmento del path deve essere il suo UID).

Dashboard → **SQL Editor** → esegui:

```sql
-- Lettura: solo i propri file
create policy "schede: select own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'schede'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Inserimento: solo nella propria cartella
create policy "schede: insert own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'schede'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Aggiornamento: solo i propri file
create policy "schede: update own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'schede'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'schede'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Cancellazione: solo i propri file
create policy "schede: delete own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'schede'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

## 3. Verifica

- Con l'app, apri una scheda e allega una foto: nella dashboard Storage deve
  comparire il file sotto `schede/<tuo-uid>/schede/...`.
- Le schede esistenti con foto in base64 vengono migrate automaticamente su
  Storage la prima volta che le apri (migrazione lazy best-effort).
- Se le policy non sono attive, l'app mostra un errore inline nel modal di
  modifica scheda (nessun fallimento silenzioso).

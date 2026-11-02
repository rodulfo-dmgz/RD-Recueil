-- Regroupe les fichiers deposes par client dans le bucket Storage 'demandes'
-- (auparavant {reference}/{question}/..., desormais
-- {client}/{reference}/{question}/...) pour une navigation plus lisible
-- depuis le dashboard Supabase. La reference glisse donc du 1er au 2e
-- segment du chemin : les politiques RLS client (lecture/depot), qui
-- verifient ce segment, doivent suivre. La politique staff (bucket entier)
-- n'est pas concernee. Aucun fichier existant au moment de cette migration
-- (verifie en base), donc aucune donnee a migrer.

drop policy stockage_client_lecture on storage.objects;
create policy stockage_client_lecture on storage.objects for select to authenticated
  using (
    bucket_id = 'demandes'
    and exists (
      select 1 from demandes d
      where d.reference = (storage.foldername(name))[2] and a_acces(d.id)
    )
  );

drop policy stockage_client_depot on storage.objects;
create policy stockage_client_depot on storage.objects for insert to authenticated
  with check (
    bucket_id = 'demandes'
    and exists (
      select 1 from demandes d
      where d.reference = (storage.foldername(name))[2] and a_acces(d.id)
    )
  );
